import * as XLSX from 'xlsx'
import { z } from 'zod'
import { Booking, PURPOSES, SOURCES } from '../models/Booking.js'
import { Payment } from '../models/Payment.js'
import { Expense, DEFAULT_EXPENSE_CATS } from '../models/Expense.js'
import { activeCategoryNames } from './expenseCategories.js'
import { Visitor, FU_STATUSES } from '../models/Visitor.js'
import { eventTypeFrom } from '../models/eventTypes.js'
import { visitorTypeFromPurpose } from '../lib/visitorType.js'
import { Lead, EVENT_TYPES, OUTCOMES } from '../models/Lead.js'
import { User } from '../models/User.js'
import { normalizeDate, normalizeNumber } from '../lib/dates.js'
import {
  bookingAdminSchema, paymentSchema, expenseSchema, visitorSchema, leadManagerSchema,
} from '../validation/schemas.js'

export const IMPORT_TYPES = ['bookings', 'payments', 'expenses', 'visitors', 'leads'] as const
export type ImportType = (typeof IMPORT_TYPES)[number]

type Raw = Record<string, unknown>

const ALIASES: Record<ImportType, Record<string, string[]>> = {
  bookings: {
    legacyId: ['id', 'legacyid'],
    guest: ['client', 'clientname', 'guest', 'guestname', 'name'],
    phone: ['phone', 'mobile', 'contact'],
    checkinDate: ['checkindate', 'date', 'checkin', 'checkindt'],
    checkoutDate: ['checkoutdate', 'checkout'],
    checkinTime: ['checkintime'],
    checkoutTime: ['checkouttime'],
    pax: ['pax', 'paxlocation'],
    purpose: ['purpose', 'type', 'eventtype'],
    source: ['source', 'leadsource'],
    dest: ['dest', 'destination', 'paymentdestination'],
    notes: ['notes', 'note', 'inclusions', 'remarks'],
    venue: ['venue', 'venuerental'],
    catering: ['catering'],
    decor: ['decor'],
    music: ['music'],
    valet: ['valet', 'valetcharges', 'parking'],
    cleaning: ['cleaning'],
    license: ['license'],
    security: ['security', 'securitydeposit'],
    legacyReceived: ['received'],
  },
  payments: {
    legacyId: ['id', 'legacyid'],
    bookingLegacyId: ['bookingid'],
    guest: ['client', 'clientname', 'guest', 'guestname'],
    date: ['date', 'paymentdate'],
    amount: ['amount'],
    method: ['method', 'mode', 'paymentmethod'],
    dest: ['dest', 'destination'],
    by: ['by', 'paidby'],
    notes: ['notes', 'note'],
  },
  expenses: {
    legacyId: ['id', 'legacyid'],
    date: ['date'],
    cat: ['cat', 'category'],
    desc: ['desc', 'description'],
    amount: ['amount', 'totalamount', 'bill', 'billamount'],
    vendor: ['vendor', 'to', 'payee', 'tovendorpayee'],
    by: ['by', 'paidby'],
    notes: ['notes', 'note'],
  },
  visitors: {
    legacyId: ['id', 'legacyid'],
    date: ['date', 'visitdate'],
    loggedAt: ['loggedat'],
    name: ['name', 'visitorname'],
    phone: ['phone', 'mobile', 'mobilenumber', 'contact'],
    type: ['type', 'visitortype', 'typeofvisitor'],
    purpose: ['purpose', 'purposeofvisit'],
    inTime: ['intime'],
    outTime: ['outtime'],
    remarks: ['remarks', 'notes'],
    fuStatus: ['fustatus', 'followupstatus'],
    fuRemark: ['furemark', 'followupremark'],
    loggedBy: ['loggedby'],
  },
  leads: {
    legacyId: ['id', 'legacyid'],
    date: ['date', 'calldate'],
    time: ['time', 'calltime'],
    name: ['name', 'leadname'],
    phone: ['phone', 'phonenumber', 'contact', 'mobile'],
    eventType: ['eventtype', 'event', 'familygatheringparty'],
    outcome: ['outcome', 'calloutcome', 'status'],
    followup: ['followup', 'followupdate', 'nextfollowup'],
    notes: ['notes', 'note', 'remarks', 'remark', 'remark1'],
    exec: ['exec', 'assign', 'assignto', 'assignedto'],
    flag: ['flag'],
    email: ['email'],
    state: ['state'],
    guests: ['guests', 'howmanyguestswillbevisitingsaratoga'],
    price: ['price', 'dateprice'],
  },
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** How a call went, as a sheet is likely to spell it. */
const OUTCOME_WORDS: [(typeof OUTCOMES)[number], string[]][] = [
  ['Did Not Pick', ['dnp', 'didnotpick', 'notpicked', 'noanswer', 'notanswered', 'notreachable', 'unreachable', 'nopickup', 'missed']],
  ['Not Interested', ['notinterested', 'notintrested', 'rejected', 'lost']],
  ['Interested', ['interested', 'intrested', 'hot', 'warm']],
  ['Callback', ['callback', 'calllater', 'followup']],
  ['Converted', ['converted', 'booked', 'won', 'closed']],
]

function leadOutcomeFrom(value: unknown): (typeof OUTCOMES)[number] {
  const text = norm(String(value ?? ''))
  if (!text) return ''
  for (const [outcome, words] of OUTCOME_WORDS) {
    if (words.some((w) => text.includes(w))) return outcome
  }
  return ''
}

function coerceEnum<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  const v = norm(String(value ?? ''))
  if (!v) return fallback
  const hit = options.find((o) => norm(o) === v) ?? options.find((o) => o && (norm(o).includes(v) || v.includes(norm(o))))
  return (hit ?? fallback) as T[number]
}

function coerceTime(value: unknown): string {
  const s = String(value ?? '').trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return ''
  let h = Number(m[1])
  if (/pm/i.test(s) && h < 12) h += 12
  if (/am/i.test(s) && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

const str = (v: unknown) => (v == null ? '' : String(v).trim())

export function parseFile(buffer: Buffer): Raw[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<Raw>(sheet, { defval: '' })
}

export function mapRow(type: ImportType, raw: Raw): Raw {
  const normalized: Raw = {}
  if (raw.breakdown && typeof raw.breakdown === 'object') raw = { ...raw, ...(raw.breakdown as Raw) }
  const rawByNorm = new Map(Object.entries(raw).map(([k, v]) => [norm(k), v]))
  for (const [field, aliases] of Object.entries(ALIASES[type])) {
    for (const alias of aliases) {
      const v = rawByNorm.get(alias)
      if (v !== undefined && v !== '') {
        normalized[field] = v
        break
      }
    }
  }
  return normalized
}

export function reportMapping(type: ImportType, headers: string[]) {
  const mapped: Record<string, string> = {}
  const unmapped: string[] = []
  for (const h of headers) {
    const hit = Object.entries(ALIASES[type]).find(([, aliases]) => aliases.includes(norm(h)))
    if (hit) mapped[h] = hit[0]
    else unmapped.push(h)
  }
  return { mapped, unmapped }
}

const FLAG_MAP: Record<string, string> = { review: 'review', goodcall: 'good', good: 'good', escalate: 'escalate' }

/**
 * `cats` is the live expense-category list; it is passed in because categories are
 * editable data now, not a fixed enum. Tests and callers that only handle other types
 * can leave it out.
 */
export function normalizeRow(type: ImportType, m: Raw, cats: readonly string[] = DEFAULT_EXPENSE_CATS): Raw {
  switch (type) {
    case 'bookings':
      return {
        legacyId: str(m.legacyId) || undefined,
        guest: str(m.guest),
        phone: str(m.phone),
        checkinDate: normalizeDate(m.checkinDate),
        checkoutDate: normalizeDate(m.checkoutDate),
        checkinTime: coerceTime(m.checkinTime) || '15:00',
        checkoutTime: coerceTime(m.checkoutTime) || '10:00',
        pax: str(m.pax),
        purpose: eventTypeFrom(m.purpose),
        source: coerceEnum(m.source, SOURCES, ''),
        dest: str(m.dest),
        notes: str(m.notes),
        breakdown: {
          venue: normalizeNumber(m.venue),
          catering: normalizeNumber(m.catering),
          decor: normalizeNumber(m.decor),
          music: normalizeNumber(m.music),
          valet: normalizeNumber(m.valet),
          cleaning: normalizeNumber(m.cleaning),
          license: normalizeNumber(m.license),
          security: normalizeNumber(m.security),
        },
        legacyReceived: normalizeNumber(m.legacyReceived),
      }
    case 'payments':
      return {
        legacyId: str(m.legacyId) || undefined,
        bookingLegacyId: str(m.bookingLegacyId),
        guest: str(m.guest),
        date: normalizeDate(m.date),
        amount: normalizeNumber(m.amount),
        method: str(m.method),
        dest: str(m.dest),
        by: str(m.by),
        notes: str(m.notes),
      }
    case 'expenses':
      return {
        legacyId: str(m.legacyId) || undefined,
        date: normalizeDate(m.date),
        cat: coerceEnum(m.cat, cats, 'Other'),
        desc: str(m.desc),
        amount: normalizeNumber(m.amount),
        vendor: str(m.vendor),
        by: str(m.by),
        notes: str(m.notes),
      }
    case 'visitors':
      return {
        legacyId: str(m.legacyId) || undefined,
        date: normalizeDate(m.date),
        loggedAt: str(m.loggedAt),
        name: str(m.name),
        phone: str(m.phone),
        // Sheets rarely carry a clean type column, so fall back to reading the purpose text.
        type: visitorTypeFromPurpose(str(m.type) || str(m.purpose)),
        purpose: str(m.purpose),
        inTime: coerceTime(m.inTime),
        outTime: coerceTime(m.outTime),
        remarks: str(m.remarks),
        fuStatus: coerceEnum(m.fuStatus, FU_STATUSES, ''),
        fuRemark: str(m.fuRemark),
        loggedBy: str(m.loggedBy),
      }
    case 'leads': {
      const extras = [
        str(m.email) && `Email: ${str(m.email)}`,
        str(m.state) && `State: ${str(m.state)}`,
        str(m.guests) && `Guests: ${str(m.guests)}`,
        str(m.price) && `Date/Price: ${str(m.price)}`,
      ].filter(Boolean)
      const flagRaw = norm(str((m as Raw).flag))
      return {
        legacyId: str(m.legacyId) || undefined,
        date: normalizeDate(m.date) || normalizeDate(new Date().toISOString()),
        time: coerceTime(m.time),
        name: str(m.name),
        phone: str(m.phone).replace(/^p:/i, '').replace(/[^\d+]/g, ''),
        eventType: eventTypeFrom(m.eventType),
        outcome: leadOutcomeFrom(m.outcome),
        followup: normalizeDate(m.followup),
        notes: [str(m.notes), ...extras].filter(Boolean).join(' | '),
        exec: str(m.exec).toLowerCase(),
        flag: FLAG_MAP[flagRaw] ?? '',
        adminComment: '',
      }
    }
  }
}

const importSchemas: Record<ImportType, z.ZodType> = {
  bookings: bookingAdminSchema.omit({ allowOverlap: true }).extend({
    legacyId: z.string().optional(),
    legacyReceived: z.coerce.number().min(0).default(0),
  }),
  payments: paymentSchema.extend({
    legacyId: z.string().optional(),
    bookingLegacyId: z.string().default(''),
    guest: z.string().default(''),
  }),
  expenses: expenseSchema.extend({ legacyId: z.string().optional() }),
  visitors: visitorSchema.extend({
    legacyId: z.string().optional(),
    date: z.string().min(1, 'date is required'),
    loggedAt: z.string().default(''),
    loggedBy: z.string().default(''),
  }),
  leads: leadManagerSchema.extend({ legacyId: z.string().optional() }),
}

export interface ImportRow {
  index: number
  data: Raw
  valid: boolean
  errors: string[]
  duplicate: boolean
  bookingRef?: string
}

async function bookingLookups(propertyId: string) {
  const bookings = await Booking.find({ propertyId }).select('guest checkinDate legacyId')
  const byLegacyId = new Map<string, string>()
  const byGuestDate = new Map<string, string>()
  for (const b of bookings) {
    if (b.legacyId) byLegacyId.set(b.legacyId, b.id)
    byGuestDate.set(`${b.guest.toLowerCase()}|${b.checkinDate}`, b.id)
  }
  return { byLegacyId, byGuestDate }
}

function naturalKey(type: ImportType, d: Raw): string {
  switch (type) {
    case 'bookings': return `${String(d.guest).toLowerCase()}|${d.checkinDate}|${d.checkinTime}|${d.phone}`
    case 'payments': return `${d.bookingRef}|${d.date}|${d.amount}`
    case 'expenses': return `${d.date}|${d.cat}|${String(d.desc).toLowerCase()}|${d.amount}`
    case 'visitors': return `${d.date}|${d.phone}|${String(d.name).toLowerCase()}`
    case 'leads': return `${d.phone}|${d.date}`
  }
}

async function existingKeys(type: ImportType, propertyId: string): Promise<{ legacyIds: Set<string>; naturals: Map<string, string> }> {
  const model = { bookings: Booking, payments: Payment, expenses: Expense, visitors: Visitor, leads: Lead }[type]
  // Duplicate detection is per property: the same guest can exist at two villas.
  const docs = await (model as typeof Booking).find({ propertyId }).lean()
  const legacyIds = new Set<string>()
  const naturals = new Map<string, string>()
  for (const doc of docs as Raw[]) {
    if (doc.legacyId) legacyIds.add(String(doc.legacyId))
    const d = type === 'payments' ? { ...doc, bookingRef: String(doc.bookingId) } : doc
    naturals.set(naturalKey(type, d), String(doc._id))
  }
  return { legacyIds, naturals }
}

export async function prepareRows(type: ImportType, rawRows: Raw[], propertyId: string): Promise<ImportRow[]> {
  const lookups = type === 'payments' ? await bookingLookups(propertyId) : null
  const validExecs = type === 'leads'
    ? new Set((await User.find({ $or: [{ propertyId }, { role: 'admin' }] }).select('username')).map((u) => u.username))
    : null
  const { legacyIds, naturals } = await existingKeys(type, propertyId)
  const cats = type === 'expenses' ? await activeCategoryNames() : DEFAULT_EXPENSE_CATS

  return rawRows.map((raw, index) => {
    const normalized = normalizeRow(type, mapRow(type, raw), cats)
    const parsed = importSchemas[type].safeParse(normalized)
    const errors: string[] = []
    let data: Raw = normalized
    if (parsed.success) data = parsed.data as Raw
    else errors.push(...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`))

    let bookingRef: string | undefined
    if (type === 'payments' && parsed.success) {
      bookingRef = lookups!.byLegacyId.get(String(data.bookingLegacyId)) ??
        lookups!.byGuestDate.get(`${String(data.guest).toLowerCase()}|${data.date}`)
      if (!bookingRef) errors.push('bookingId: no matching booking found')
    }
    if (type === 'leads' && parsed.success && data.exec && !validExecs!.has(String(data.exec))) {
      data.exec = ''
    }

    const valid = errors.length === 0
    const duplicate = valid && (
      (data.legacyId != null && legacyIds.has(String(data.legacyId))) ||
      naturals.has(naturalKey(type, { ...data, bookingRef }))
    )
    return { index, data, valid, errors, duplicate, bookingRef }
  })
}

export async function commitRows(
  type: ImportType,
  rows: ImportRow[],
  mode: 'skip' | 'update',
  importedBy: string,
  propertyId: string,
) {
  const { naturals } = await existingKeys(type, propertyId)
  const execLabels = type === 'leads'
    ? new Map((await User.find().select('username name')).map((u) => [u.username, u.name]))
    : null

  let inserted = 0
  let updated = 0
  let skipped = 0
  const invalid = rows.filter((r) => !r.valid).length

  for (const row of rows) {
    if (!row.valid) continue
    const { bookingLegacyId: _bl, guest: _g, ...rest } = row.data as Raw & { bookingLegacyId?: string; guest?: string }
    let data: Raw = type === 'payments' ? { ...rest, bookingId: row.bookingRef } : { ...row.data }
    data.propertyId = propertyId
    if (type === 'leads') {
      data.execLabel = execLabels!.get(String(data.exec)) ?? ''
      data.importedBy = importedBy
    }
    if (type === 'visitors' && !data.loggedAt) data.loggedAt = new Date(`${data.date}T00:00:00.000Z`).toISOString()

    const existingId = naturals.get(naturalKey(type, { ...data, bookingRef: row.bookingRef }))
    const model = { bookings: Booking, payments: Payment, expenses: Expense, visitors: Visitor, leads: Lead }[type] as typeof Booking

    if (data.legacyId != null && (await model.exists({ legacyId: data.legacyId, propertyId }))) {
      if (mode === 'update') {
        await model.updateOne({ legacyId: data.legacyId, propertyId }, { $set: data })
        updated++
      } else skipped++
      continue
    }
    if (existingId) {
      if (mode === 'update') {
        await model.updateOne({ _id: existingId, propertyId }, { $set: data })
        updated++
      } else skipped++
      continue
    }
    await model.create(data)
    inserted++
  }
  return { inserted, updated, skipped, invalid }
}
