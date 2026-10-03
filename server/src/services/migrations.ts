import { Booking } from '../models/Booking.js'
import { Payment } from '../models/Payment.js'
import { Expense } from '../models/Expense.js'
import { ExpensePayment } from '../models/ExpensePayment.js'
import { Visitor } from '../models/Visitor.js'
import { visitorTypeFromPurpose } from '../lib/visitorType.js'
import { Lead } from '../models/Lead.js'
import { User } from '../models/User.js'
import { ensureDefaultProperty } from './defaultProperty.js'
import { EVENT_TYPES, LEGACY_EVENT_TYPES, type EventType } from '../models/eventTypes.js'

const SCOPED_MODELS = {
  bookings: Booking,
  payments: Payment,
  expenses: Expense,
  expensePayments: ExpensePayment,
  visitors: Visitor,
  leads: Lead,
} as const

export type ScopedCollection = keyof typeof SCOPED_MODELS

/** Rows written before properties existed have no propertyId at all. */
const MISSING_PROPERTY = { $or: [{ propertyId: { $exists: false } }, { propertyId: null }] }
const MISSING_TYPE_CLAUSES: Record<string, unknown>[] = [{ type: { $exists: false } }, { type: null }]
const MISSING_TYPE = { $or: MISSING_TYPE_CLAUSES }

const ON_LIST = new Set<string>(EVENT_TYPES)

/** Records still carrying a value from the old, separate booking and lead lists. */
function offList(field: string) {
  return { [field]: { $nin: [...ON_LIST] } }
}

/**
 * Moves bookings and leads onto the shared event-type list, keeping the old value on the
 * record. "Party" has no equivalent — it covered birthdays, kitty parties and corporate
 * alike and nothing says which — so it becomes Other rather than a guess that would make
 * next year's targeting look authoritative while being invented. The kept value means
 * that call can be revisited, and it survives where a backup file could not: this runs in
 * a serverless function with no disk to write to.
 */
export async function migrateEventTypes() {
  const counts: Record<string, number> = {}

  const move = async (
    model: typeof Booking | typeof Lead,
    field: 'purpose' | 'eventType',
    keep: 'legacyPurpose' | 'legacyEventType',
  ) => {
    const rows = await (model as typeof Booking).find(offList(field)).select(field).lean()
    for (const row of rows) {
      const from = String((row as Record<string, unknown>)[field] ?? '')
      const to: EventType = LEGACY_EVENT_TYPES[from] ?? 'Other'
      await (model as typeof Booking).updateOne(
        { _id: row._id },
        { $set: { [field]: to, [keep]: from } },
      )
      const label = `${from || '(blank)'} → ${to}`
      counts[label] = (counts[label] ?? 0) + 1
    }
  }

  await move(Booking, 'purpose', 'legacyPurpose')
  await move(Lead, 'eventType', 'legacyEventType')
  return counts
}

export interface MigrationStatus {
  pending: Record<string, number>
  total: number
}

/** What is still left to migrate, so the UI can hide the prompt once nothing is. */
export async function migrationStatus(): Promise<MigrationStatus> {
  const entries = await Promise.all(
    Object.entries(SCOPED_MODELS).map(async ([label, model]) =>
      [label, await (model as typeof Booking).countDocuments(MISSING_PROPERTY)] as const,
    ),
  )
  const pending: Record<string, number> = Object.fromEntries(entries)
  pending.users = await User.countDocuments({ role: { $ne: 'admin' }, ...MISSING_PROPERTY })
  pending.visitorTypes = await Visitor.countDocuments(MISSING_TYPE)
  pending.bookingEventTypes = await Booking.countDocuments(offList('purpose'))
  pending.leadEventTypes = await Lead.countDocuments(offList('eventType'))

  return { pending, total: Object.values(pending).reduce((sum, n) => sum + n, 0) }
}

/**
 * Everything that existed before properties belongs to the original villa. Only touches
 * rows that have no property yet, so it is safe to run more than once.
 */
export async function stampExistingRecords() {
  const property = await ensureDefaultProperty()

  // Bring the collections' indexes in line with the schemas before writing. The first
  // cut of the per-property legacyId index was sparse, which a compound index only
  // honours when every field is missing — so stamping propertyId onto rows without a
  // legacyId made them all collide on null. Rebuilding drops that index for the
  // partial one, which indexes only rows that actually carry a legacyId.
  for (const model of Object.values(SCOPED_MODELS)) {
    await (model as typeof Booking).syncIndexes()
  }

  const counts: Record<string, number> = {}
  for (const [label, model] of Object.entries(SCOPED_MODELS)) {
    const result = await (model as typeof Booking).updateMany(
      MISSING_PROPERTY,
      { $set: { propertyId: property._id } },
    )
    counts[label] = result.modifiedCount
  }

  // Admins deliberately have no property; everyone else needs one to see anything.
  const users = await User.updateMany(
    { role: { $ne: 'admin' }, ...MISSING_PROPERTY },
    { $set: { propertyId: property._id } },
  )
  counts.users = users.modifiedCount

  return { property: { id: property.id, name: property.name }, counts }
}

/**
 * Visitor type used to be inferred from the free-text purpose. Reads that text once and
 * stores a real type. Done in a handful of bulk updates rather than row by row, so it
 * finishes inside a serverless request.
 */
export async function backfillVisitorTypes({ redoOther = false } = {}) {
  // Rows that never got a type, plus — when asked — the ones an earlier, blunter pass
  // dumped into Other. Types a person chose by hand are left alone.
  const filter = { $or: redoOther ? [...MISSING_TYPE_CLAUSES, { type: 'Other' }] : MISSING_TYPE_CLAUSES }
  const visitors = await Visitor.find(filter).select('purpose type')

  const counts: Record<string, number> = {}
  const writes = visitors
    .map((v) => ({ id: v._id, type: visitorTypeFromPurpose(v.purpose) }))
    .filter((w, i) => w.type !== visitors[i].type)

  for (const w of writes) counts[w.type] = (counts[w.type] ?? 0) + 1
  if (writes.length) {
    await Visitor.bulkWrite(writes.map((w) => ({
      updateOne: { filter: { _id: w.id }, update: { $set: { type: w.type } } },
    })))
  }
  return counts
}
