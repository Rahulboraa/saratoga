import { z } from 'zod'
import { PURPOSES, SOURCES } from '../models/Booking.js'
import { EXPENSE_CATS } from '../models/Expense.js'
import { FU_STATUSES, VISITOR_TYPES } from '../models/Visitor.js'
import { EVENT_TYPES, OUTCOMES, FLAGS } from '../models/Lead.js'
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
  purpose: z.enum(PURPOSES).default('Other'),
  source: z.enum(SOURCES).default(''),
  notes: str.default(''),
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
  cat: z.enum(EXPENSE_CATS),
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
  eventType: z.enum(EVENT_TYPES).default('Other'),
  outcome: z.enum(OUTCOMES).default(''),
  followup: ymdOrEmpty.default(''),
  notes: str.default(''),
})

export const leadManagerSchema = leadCommonSchema.extend({
  exec: str.default(''),
  flag: z.enum(FLAGS).default(''),
  adminComment: str.default(''),
})
