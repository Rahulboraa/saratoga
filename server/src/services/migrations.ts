import { Booking } from '../models/Booking.js'
import { Payment } from '../models/Payment.js'
import { Expense } from '../models/Expense.js'
import { ExpensePayment } from '../models/ExpensePayment.js'
import { Visitor, VISITOR_TYPES } from '../models/Visitor.js'
import { Lead } from '../models/Lead.js'
import { User } from '../models/User.js'
import { ensureDefaultProperty } from './defaultProperty.js'

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
const MISSING_TYPE = { $or: [{ type: { $exists: false } }, { type: null }] }

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

  return { pending, total: Object.values(pending).reduce((sum, n) => sum + n, 0) }
}

/**
 * Everything that existed before properties belongs to the original villa. Only touches
 * rows that have no property yet, so it is safe to run more than once.
 */
export async function stampExistingRecords() {
  const property = await ensureDefaultProperty()

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
export async function backfillVisitorTypes() {
  const counts: Record<string, number> = {}

  for (const type of VISITOR_TYPES) {
    if (type === 'Other') continue
    const result = await Visitor.updateMany(
      { ...MISSING_TYPE, purpose: new RegExp(type, 'i') },
      { $set: { type } },
    )
    counts[type] = result.modifiedCount
  }

  // Anything left with a purpose we could not read is Other; a blank purpose is a guest.
  const other = await Visitor.updateMany(
    { ...MISSING_TYPE, purpose: { $nin: ['', null] } },
    { $set: { type: 'Other' } },
  )
  counts.Other = other.modifiedCount

  const rest = await Visitor.updateMany(MISSING_TYPE, { $set: { type: 'Guest' } })
  counts.Guest = (counts.Guest ?? 0) + rest.modifiedCount

  return counts
}
