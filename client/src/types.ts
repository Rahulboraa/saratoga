export type Role = 'admin' | 'manager' | 'sales' | 'caretaker'

export interface AuthUser {
  id: string
  username: string
  name: string
  role: Role
  /** null for admins, who span every property. */
  propertyId: string | null
}

export interface ManagedUser extends AuthUser {
  active: boolean
}

export interface Property {
  id: string
  name: string
  /** The entity that raises the invoice, when it differs from the villa's name. */
  legalName: string
  location: string
  active: boolean
  address: string
  gstin: string
  invoicePrefix: string
  invoiceTerms: string
  invoiceHeader: string
  invoiceFooter: string
  /** Separately bookable parts. Empty means the project is booked whole. */
  units: string[]
  imageUrl: string
  color: string
  inclusions: string
  exclusions: string
  confirmationNotes: string
}

/** One list for a booking's event type and a lead's — they describe the same thing. */
export const EVENT_TYPES = [
  'Birthday/Anniversary',
  'Corporate Party',
  'Kitty / Private Party',
  'Wedding/Pre-wedding',
  'Shoot',
  'Stays',
  'Other',
] as const
export type EventType = (typeof EVENT_TYPES)[number]
export const PURPOSES = EVENT_TYPES
export type Purpose = EventType
export const SOURCES = ['Airbnb', 'Direct', 'Referral'] as const

export interface Breakdown {
  venue: number
  catering: number
  decor: number
  music: number
  valet: number
  cleaning: number
  license: number
  security: number
}

export type BookingStatus = 'paid' | 'partial' | 'pending'

export interface Booking {
  invoiceNo?: string
  /** The day the booking was taken, not the day of the event. */
  createdAt?: string
  id: string
  guest: string
  phone: string
  checkinDate: string
  checkoutDate: string
  checkinTime: string
  checkoutTime: string
  pax: string
  purpose: Purpose
  source: string
  notes: string
  /** Which parts of the project this booking takes. Empty means all of it. */
  units?: string[]
  createdBy: string
  /** Who the invoice is raised on, when that is a company rather than the guest. */
  billingName?: string
  billingGstin?: string
  billingAddress?: string
  overlap?: boolean
  dest?: string
  breakdown?: Breakdown
  amount?: number
  collected?: number
  due?: number
  status?: BookingStatus
}

export interface CalendarBooking {
  id: string
  guest: string
  checkinDate: string
  checkoutDate: string
  checkinTime: string
  checkoutTime: string
  pax: string
  purpose: Purpose
  overlap?: boolean
  /** Which parts of the project are held. Empty means all of them. */
  units?: string[]
}

export interface Payment {
  id: string
  bookingId: string
  date: string
  amount: number
  method: string
  dest: string
  by: string
  notes: string
}

export interface ExpenseCategory {
  id: string
  name: string
  active: boolean
  inUse: number
}

export interface Expense {
  bookingId?: string | null
  bookingLabel?: string
  id: string
  date: string
  cat: string
  desc: string
  amount: number
  vendor: string
  by: string
  notes: string
  paid: number
  due: number
  status: BookingStatus
}

export interface ExpensePayment {
  id: string
  expenseId: string
  date: string
  amount: number
  method: string
  to: string
  by: string
  notes: string
}

/** How a payment arrived. Cash alone keeps a booking off the invoice series. */
export const PAYMENT_METHODS = ['UPI', 'Bank transfer', 'Card', 'Cheque', 'Cash'] as const

export const FU_STATUSES = ['Hold', 'Closed', 'Cancelled'] as const
export const VISITOR_TYPES = ['Guest', 'Vendor', 'Delivery', 'Staff', 'Other'] as const
export type VisitorType = (typeof VISITOR_TYPES)[number]

export interface Visitor {
  id: string
  date: string
  loggedAt: string
  name: string
  phone: string
  type: VisitorType
  purpose: string
  inTime: string
  outTime: string
  remarks: string
  loggedBy: string
  fuStatus?: string
  fuRemark?: string
}

export const OUTCOMES = [
  'Did Not Pick',
  'Interested',
  'Planning to Visit',
  'Callback',
  'Converted',
  'Not Interested',
  'Out of Budget',
  'Venue is Small',
  'Sold Out',
] as const
export const LEAD_FLAGS = [
  { value: 'review', label: 'Review' },
  { value: 'good', label: 'Good Call' },
  { value: 'escalate', label: 'Escalate' },
] as const

export interface Lead {
  id: string
  date: string
  time: string
  name: string
  phone: string
  eventType: EventType
  outcome: string
  followup: string
  /** The date the customer wants, as a range — a single day has both ends equal. */
  wantedFrom?: string
  wantedTo?: string
  notes: string
  calledAt?: string | null
  exec: string
  execLabel: string
  importedBy: string
  createdAt: string
  flag?: string
  adminComment?: string
}

export const CALL_OUTCOMES = ['connected', 'no-answer', 'busy', 'wrong-number', 'cancelled'] as const
export type CallOutcome = (typeof CALL_OUTCOMES)[number]

export interface CallRecord {
  id: string
  leadId: string
  exec: string
  execLabel: string
  phone: string
  startedAt: string
  outcome: CallOutcome | null
  durationSec: number
  durationSource: 'estimated' | 'manual' | 'carrier'
  notes: string
  recordingUrl: string
}

export interface ExecCallStats {
  exec: string
  execLabel: string
  calls: number
  connected: number
  talkTimeSec: number
  connectRate: number
}

export interface ExecReportRow {
  exec: string
  execLabel: string
  calls: number
  interested: number
  callbacks: number
  converted: number
  conversionRate: number
}

export interface FreeDate {
  date: string
  /** Parts still open that day. Empty where the project is booked whole. */
  units: string[]
}

export interface WantedLeads {
  from: string
  to: string
  freeDates: FreeDate[]
  total: number
  /** How many of them want a date that is actually still sellable. */
  pitchable: number
  rows: (Lead & { freeDates: string[]; freeUnits: string[] })[]
}

export interface CallActivity {
  from: string
  to: string
  execs: { exec: string; execLabel: string; total: number }[]
  perDay: ({ date: string } & Record<string, string | number>)[]
  perOutcome: ({ outcome: string } & Record<string, string | number>)[]
}

export interface MonthlyPoint {
  month: string
  booked: number
  collected: number
  pending: number
  expenses: number
  profit: number
}

export interface ConflictBooking {
  id: string
  guest: string
  checkinDate: string
  checkoutDate: string
  checkinTime: string
  checkoutTime: string
  purpose: Purpose
}

export interface DashboardStats {
  totalBookings: number
  upcomingCount: number
  uniqueDates: number
  overlapCount: number
  conflicts: ConflictBooking[]
  bookingsPerMonth: { month: string; count: number }[]
  purposeBreakdown: { purpose: Purpose; count: number; booked?: number; collected?: number }[]
  upcoming: Booking[]
  totalBooked?: number
  totalCollected?: number
  outstanding?: number
  upcomingUnpaid?: number
  monthlySeries?: MonthlyPoint[]
  bookedBreakup?: { month: string; venue: number; catering: number; decor: number; music: number; valet: number; cleaning: number }[]
}

export interface IncentiveMonth {
  month: string
  sales: number
  expenses: number
  profit: number
  deepak: number
  akhil: number
  total: number
}

export interface IncentiveStats {
  start: string
  selected: IncentiveMonth
  trend: IncentiveMonth[]
}

export interface ExpenseSummary {
  totalBill: number
  totalPaid: number
  totalDue: number
  categories: { cat: string; count: number; amount: number }[]
  plSeries: { month: string; revenue: number; expenses: number; profit: number; margin: number }[]
}

export interface MigrationStatus {
  pending: Record<string, number>
  total: number
}

export interface MigrationResult {
  property: { id: string; name: string }
  counts: Record<string, number>
  visitorTypes: Record<string, number>
  status: MigrationStatus
}

export interface AccountReport {
  months: string[]
  total: number
  accounts: { account: string; received: number; count: number; lastDate: string; share: number }[]
  payments: {
    id: string; date: string; amount: number; account: string
    method: string; by: string; notes: string; guest: string
  }[]
}

export interface InvestmentEntry {
  id: string
  partner: string
  date: string
  kind: 'Investment' | 'Withdrawal'
  amount: number
  mode: string
  notes: string
  by: string
}

export interface PartnerRow {
  partner: string
  invested: number
  withdrawn: number
  net: number
  share: number
  entries: number
  lastDate: string
}

export interface InvoicePayload {
  invoiceNo: string
  invoiceDate: string
  gstRate: number
  gstEnabled: boolean
  kind: 'Proforma Invoice' | 'Tax Invoice' | 'Invoice'
  booking: {
    id: string; guest: string; phone: string
    checkinDate: string; checkoutDate: string
    checkinTime: string; checkoutTime: string
    pax: string; purpose: string
    billingName: string; billingGstin: string; billingAddress: string
  }
  property: {
    name: string; address: string; location: string; gstin: string
    header: string; footer: string; terms: string[]
    /** The project's accent, and its id so one can be derived when none is set. */
    color: string; id: string
  }
  items: { label: string; amount: number }[]
  taxable: number
  cgst: number
  sgst: number
  licence: number
  security: number
  refunded: number
  total: number
  received: number
}

export interface ImportRow {
  index: number
  data: Record<string, unknown>
  valid: boolean
  errors: string[]
  duplicate: boolean
}

export interface ImportPreview {
  mapping: { mapped: Record<string, string>; unmapped: string[] }
  rows: ImportRow[]
  summary: { total: number; valid: number; invalid: number; duplicates: number }
}

export interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  invalid: number
}
