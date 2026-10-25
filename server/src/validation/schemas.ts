import { z } from 'zod'
import { SOURCES } from '../models/Booking.js'
import { eventTypeFrom } from '../models/eventTypes.js'

/**
 * Accepts anything and settles on a value from the shared list. A record written before
 * the lists were merged still carries its old type, and the form sends back whatever it
 * was given — rejecting that makes an old booking impossible to edit at all, which is
 * worse than quietly bringing it onto the current list as it is saved.
 */
const eventType = z.unknown().optional().transform(eventTypeFrom)
import { FU_STATUSES, VISITOR_TYPES } from '../models/Visitor.js'
import { INVESTMENT_KINDS } from '../models/Investment.js'
import { CALL_OUTCOMES, DURATION_SOURCES } from '../models/Call.js'
import { OUTCOMES, FLAGS } from '../models/Lead.js'
import { YMD, HM } from '../lib/dates.js'

const ymd = z.string().regex(YMD, 'Expected YYYY-MM-DD')
const ymdOrEmpty = z.union([ymd, z.literal('')])
const hm = z.string().regex(HM, 'Expected HH:MM')
const money = z.coerce.number().min(0)
const str = z.string().trim()

export const breakdownSchema = z.object({
  venue: money.default(0),
  catering: money.default(0),
  decor: money.default(0),
  music: money.default(0),
  valet: money.default(0),
  cleaning: money.default(0),
  license: money.default(0),
  security: money.default(0),
})

const bookingCommon = z.object({
  guest: str.min(1),
  phone: str.default(''),
  checkinDate: ymd,
  checkoutDate: ymdOrEmpty.default(''),
  checkinTime: hm.default('15:00'),
  checkoutTime: hm.default('10:00'),
  pax: str.default(''),
  purpose: eventType,
  source: z.enum(SOURCES).default(''),
  // Which parts of the project are taken. Empty is the whole place, which is what a
  // project that was never split always sends.
  units: z.array(str.min(1)).max(20).default([]),
  notes: str.default(''),
  billingName: str.max(120).default(''),
  // Format is checked loosely: an invoice still has to go out if a guest hands over a
  // GSTIN that does not match the usual pattern.
  billingGstin: str.max(20).default(''),
  billingAddress: str.max(300).default(''),
  allowOverlap: z.boolean().default(false),
})

export const bookingAdminSchema = bookingCommon.extend({
  dest: str.default(''),
  breakdown: breakdownSchema.prefault({}),
})

export const bookingManagerSchema = bookingCommon

export const paymentSchema = z.object({
  date: ymd,
  // Negative amounts are allowed so a refund can be recorded against the booking.
  amount: z.coerce.number().refine((n) => n !== 0, 'Amount cannot be zero'),
  method: str.default(''),
  dest: str.default(''),
  by: str.default(''),
  notes: str.default(''),
})

export const expenseSchema = z.object({
  date: ymd,
  cat: str.min(1).max(40),
  bookingId: z.union([z.string(), z.null()]).optional(),
  desc: str.min(1),
  amount: money,
  vendor: str.default(''),
  by: str.default(''),
  notes: str.default(''),
})

export const expensePaymentSchema = z.object({
  date: ymd,
  amount: z.coerce.number().positive(),
  method: str.default(''),
  to: str.default(''),
  by: str.default(''),
  notes: str.default(''),
})

export const callStartSchema = z.object({
  // The client stamps the time it opened the dialer, so a slow network does not shift it.
  startedAt: z.coerce.date().optional(),
})

export const callFinishSchema = z.object({
  outcome: z.enum(CALL_OUTCOMES),
  durationSec: z.coerce.number().int().min(0).max(4 * 60 * 60),
  durationSource: z.enum(DURATION_SOURCES).default('estimated'),
  notes: str.max(500).default(''),
})

export const investmentSchema = z.object({
  partner: str.min(1).max(60),
  date: ymd,
  kind: z.enum(INVESTMENT_KINDS).default('Investment'),
  amount: z.coerce.number().positive(),
  mode: str.default(''),
  notes: str.default(''),
  by: str.default(''),
})

export const visitorSchema = z.object({
  date: ymd.optional(),
  name: str.min(1),
  phone: str.min(1),
  type: z.enum(VISITOR_TYPES).default('Guest'),
  purpose: str.default(''),
  inTime: z.union([hm, z.literal('')]).default(''),
  outTime: z.union([hm, z.literal('')]).default(''),
  remarks: str.default(''),
  fuStatus: z.enum(FU_STATUSES).default(''),
  fuRemark: str.default(''),
})

export const visitorCaretakerSchema = visitorSchema.omit({ fuStatus: true, fuRemark: true })

export const visitorCaretakerPatchSchema = z.object({
  outTime: z.union([hm, z.literal('')]),
})

export const leadCommonSchema = z.object({
  date: ymd,
  time: z.union([hm, z.literal('')]).default(''),
  name: str.min(1),
  phone: str.min(1),
  eventType,
  outcome: z.enum(OUTCOMES).default(''),
  followup: ymdOrEmpty.default(''),
  // What the customer is asking for. Blank is allowed: a lead that never named a date
  // still has to be saveable, or the team stops recording them at all.
  wantedFrom: ymdOrEmpty.default(''),
  wantedTo: ymdOrEmpty.default(''),
  notes: str.default(''),
})

/**
 * Applied by the routes rather than baked into the schema: zod refuses `.partial()` on a
 * schema carrying a refinement, and an edit sends only the fields that changed. Adding it
 * last leaves both the full save and the partial one able to use it.
 */
export function withWantedRange<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine(
    (value) => {
      const v = value as { wantedFrom?: string; wantedTo?: string }
      return !v.wantedFrom || !v.wantedTo || v.wantedTo >= v.wantedFrom
    },
    { message: 'The last date cannot be before the first', path: ['wantedTo'] },
  )
}

export const leadManagerSchema = leadCommonSchema.extend({
  exec: str.default(''),
  flag: z.enum(FLAGS).default(''),
  adminComment: str.default(''),
})
