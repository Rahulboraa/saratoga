import type { Role } from '../models/User.js'

type Doc = Record<string, any>

function pick(doc: Doc, keys: string[]) {
  const out: Doc = {}
  for (const k of keys) if (doc[k] !== undefined) out[k] = doc[k]
  return out
}

function base(doc: Doc) {
  return { id: String(doc._id ?? doc.id) }
}

const BOOKING_COMMON = [
  'guest', 'phone', 'checkinDate', 'checkoutDate', 'checkinTime', 'checkoutTime',
  'pax', 'purpose', 'source', 'notes', 'createdBy', 'overlap',
]
const BOOKING_ADMIN = [...BOOKING_COMMON, 'dest', 'breakdown', 'amount', 'collected', 'due', 'status', 'invoiceNo', 'createdAt']

export function serializeBooking(doc: Doc, role: Role) {
  const out: Doc = { ...base(doc), ...pick(doc, role === 'admin' || role === 'manager' ? BOOKING_ADMIN : BOOKING_COMMON) }
  // When the booking was taken, as distinct from when the event is — what tells you how
  // much was closed on a given day.
  if (out.createdAt instanceof Date) out.createdAt = out.createdAt.toISOString().slice(0, 10)
  return out
}

const CALENDAR_KEYS = ['guest', 'checkinDate', 'checkoutDate', 'checkinTime', 'checkoutTime', 'pax', 'purpose', 'overlap']

export function serializeCalendarBooking(doc: Doc) {
  return { ...base(doc), ...pick(doc, CALENDAR_KEYS) }
}

const PAYMENT_KEYS = ['bookingId', 'date', 'amount', 'method', 'dest', 'by', 'notes']

export function serializePayment(doc: Doc) {
  return { ...base(doc), ...pick(doc, PAYMENT_KEYS), bookingId: String(doc.bookingId) }
}

const EXPENSE_KEYS = ['date', 'cat', 'desc', 'amount', 'vendor', 'by', 'notes', 'paid', 'due', 'status', 'bookingLabel']

export function serializeExpense(doc: Doc) {
  return {
    ...base(doc),
    ...pick(doc, EXPENSE_KEYS),
    bookingId: doc.bookingId ? String(doc.bookingId) : null,
  }
}

const EXPENSE_PAYMENT_KEYS = ['expenseId', 'date', 'amount', 'method', 'to', 'by', 'notes']

export function serializeExpensePayment(doc: Doc) {
  return { ...base(doc), ...pick(doc, EXPENSE_PAYMENT_KEYS), expenseId: String(doc.expenseId) }
}

const VISITOR_KEYS = ['date', 'loggedAt', 'name', 'phone', 'type', 'purpose', 'inTime', 'outTime', 'remarks', 'loggedBy']
const VISITOR_FU_KEYS = [...VISITOR_KEYS, 'fuStatus', 'fuRemark']

export function serializeVisitor(doc: Doc, role: Role) {
  return { ...base(doc), ...pick(doc, role === 'caretaker' ? VISITOR_KEYS : VISITOR_FU_KEYS) }
}

const LEAD_COMMON = [
  'date', 'time', 'name', 'phone', 'eventType', 'outcome', 'followup',
  'notes', 'exec', 'execLabel', 'importedBy', 'createdAt', 'calledAt',
]
const LEAD_MANAGER = [...LEAD_COMMON, 'flag', 'adminComment']

export function serializeLead(doc: Doc, role: Role) {
  const out: Doc = { ...base(doc), ...pick(doc, role === 'sales' ? LEAD_COMMON : LEAD_MANAGER) }
  if (out.createdAt instanceof Date) out.createdAt = out.createdAt.toISOString().slice(0, 10)
  return out
}

export const FINANCIAL_KEYS = [
  'amount', 'breakdown', 'collected', 'due', 'received', 'legacyReceived', 'dest',
  'venue', 'catering', 'decor', 'music', 'valet', 'cleaning', 'license', 'security',
  'totalBooked', 'totalCollected', 'outstanding', 'revenue', 'expenses', 'profit',
]

export function assertNoFinancialKeys(payload: unknown): string[] {
  const found: string[] = []
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (FINANCIAL_KEYS.includes(k)) found.push(k)
        walk(val)
      }
    }
  }
  walk(payload)
  return found
}
