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
  location: string
  active: boolean
}

export const PURPOSES = ['Party', 'Shoot', 'Pre-wedding', 'Kids Birthday', 'Other'] as const
export type Purpose = (typeof PURPOSES)[number]
export const SOURCES = ['Airbnb', 'Direct', 'Referral'] as const

export interface Breakdown {
  venue: number
  catering: number
  decor: number
  music: number
  cleaning: number
  license: number
  security: number
}

export type BookingStatus = 'paid' | 'partial' | 'pending'

export interface Booking {
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
  createdBy: string
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

export const EXPENSE_CATS = [
  'Salary', 'Catering', 'Decor', 'Electricity', 'Housekeeping',
  'Dry Cleaning', 'Meta Ads', 'Marketing', 'Maintenance', 'Other',
] as const

export interface Expense {
  id: string
  date: string
  cat: (typeof EXPENSE_CATS)[number]
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

export const FU_STATUSES = ['Hold', 'Closed', 'Cancelled'] as const

export interface Visitor {
  id: string
  date: string
  loggedAt: string
  name: string
  phone: string
  purpose: string
  inTime: string
  outTime: string
  remarks: string
  loggedBy: string
  fuStatus?: string
  fuRemark?: string
}

export const EVENT_TYPES = [
  'Birthday / Anniversary / Milestone', 'Corporate / Office Party',
  'Wedding / Engagement', 'Shoot', 'Other',
] as const
export const OUTCOMES = ['Interested', 'Not Interested', 'Callback', 'Converted'] as const
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
  eventType: (typeof EVENT_TYPES)[number]
  outcome: string
  followup: string
  notes: string
  exec: string
  execLabel: string
  importedBy: string
  createdAt: string
  flag?: string
  adminComment?: string
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
  bookedBreakup?: { month: string; venue: number; catering: number; decor: number; music: number; cleaning: number }[]
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
