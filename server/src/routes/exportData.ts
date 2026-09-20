import { Router, type Response } from 'express'
import * as XLSX from 'xlsx'
import { Booking } from '../models/Booking.js'
import { Payment } from '../models/Payment.js'
import { Expense } from '../models/Expense.js'
import { ExpensePayment } from '../models/ExpensePayment.js'
import { Visitor } from '../models/Visitor.js'
import { Lead } from '../models/Lead.js'
import { requireRole } from '../middleware/auth.js'
import { paymentSums, expensePaymentSums, withFinance, statusOf } from '../services/finance.js'
import { incentiveStats } from '../services/stats.js'
import { buildWorkbook } from '../services/backup.js'
import { scoped } from '../middleware/scope.js'

export const exportRouter = Router()

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sendSheet(res: Response, name: string, rows: Record<string, unknown>[]) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name)
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  res.setHeader('Content-Disposition', `attachment; filename="${name.toLowerCase().replace(/ /g, '-')}-${today}.xlsx"`)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
}

exportRouter.get('/bookings', requireRole('admin', 'manager'), async (req, res) => {
  const { month, status, purpose, q, upcoming } = req.query as Record<string, string | undefined>
  const filter: Record<string, unknown> = scoped(req)
  if (upcoming) filter.checkinDate = { $gte: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) }
  if (month) filter.checkinDate = { $regex: `^${escapeRegex(month)}` }
  if (purpose) filter.purpose = purpose
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ guest: rx }, { phone: rx }]
  }
  const bookings = await Booking.find(filter).sort({ checkinDate: 1 })
  const sums = await paymentSums(bookings.map((b) => b._id))
  let rows = bookings.map((b) => ({ b, fin: withFinance(b, sums) }))
  if (status) rows = rows.filter((r) => r.fin.status === status)
  sendSheet(res, 'Bookings', rows.map(({ b, fin }) => ({
    Guest: b.guest, Phone: b.phone, 'Check-in': b.checkinDate, 'Check-out': b.checkoutDate,
    'In Time': b.checkinTime, 'Out Time': b.checkoutTime, Pax: b.pax, Purpose: b.purpose, Source: b.source,
    Venue: b.breakdown?.venue ?? 0, Catering: b.breakdown?.catering ?? 0, Decor: b.breakdown?.decor ?? 0,
    Music: b.breakdown?.music ?? 0, Cleaning: b.breakdown?.cleaning ?? 0,
    License: b.breakdown?.license ?? 0, Security: b.breakdown?.security ?? 0,
    Amount: b.amount, Received: fin.collected, Due: fin.due, Status: fin.status,
    Destination: b.dest, Notes: b.notes,
  })))
})

exportRouter.get('/expenses', requireRole('admin'), async (req, res) => {
  const { month, cat } = req.query as Record<string, string | undefined>
  const filter: Record<string, unknown> = scoped(req)
  if (month) filter.date = { $regex: `^${month.replace(/[^\d-]/g, '')}` }
  if (cat) filter.cat = cat
  const expenses = await Expense.find(filter).sort({ date: 1 })
  const sums = await expensePaymentSums(expenses.map((e) => e._id))
  const bookings = await Booking.find({ _id: { $in: expenses.map((e) => e.bookingId).filter(Boolean) } }).select('guest')
  const bookingName = new Map(bookings.map((b) => [b.id, b.guest]))
  sendSheet(res, 'Expenses', expenses.map((e) => {
    const paid = sums.get(e.id) ?? 0
    return {
      Date: e.date, Category: e.cat, Description: e.desc, Bill: e.amount,
      Paid: paid, Due: e.amount - paid, Status: statusOf(e.amount, paid),
      Booking: bookingName.get(String(e.bookingId)) ?? '',
      Vendor: e.vendor, By: e.by, Notes: e.notes,
    }
  }))
})

exportRouter.get('/leads', requireRole('admin', 'manager'), async (req, res) => {
  const { outcome, exec, eventType, q } = req.query as Record<string, string | undefined>
  const filter: Record<string, unknown> = scoped(req)
  if (exec === 'unassigned') filter.exec = ''
  else if (exec) filter.exec = exec
  if (outcome !== undefined) filter.outcome = outcome
  if (eventType) filter.eventType = eventType
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: rx }, { phone: rx }]
  }
  const leads = await Lead.find(filter).sort({ date: 1 })
  sendSheet(res, 'Leads', leads.map((l) => ({
    Date: l.date, Time: l.time, Name: l.name, Phone: l.phone, 'Event Type': l.eventType,
    Outcome: l.outcome, 'Follow-up': l.followup, 'Assigned To': l.execLabel, Flag: l.flag,
    Notes: l.notes, 'Admin Comment': l.adminComment,
  })))
})

exportRouter.get('/visitors', requireRole('admin', 'manager'), async (req, res) => {
  const { date, from, to, q } = req.query as Record<string, string | undefined>
  const filter: Record<string, unknown> = scoped(req)
  if (date) filter.date = date
  else if (from || to) filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: rx }, { phone: rx }, { purpose: rx }]
  }
  const visitors = await Visitor.find(filter).sort({ date: 1 })
  sendSheet(res, 'Visitors', visitors.map((v) => ({
    Date: v.date, Name: v.name, Phone: v.phone, Type: v.type, Purpose: v.purpose,
    'In Time': v.inTime, 'Out Time': v.outTime, Remarks: v.remarks,
    'Follow-up': v.fuStatus, 'Follow-up Note': v.fuRemark, 'Logged By': v.loggedBy,
  })))
})

exportRouter.get('/incentives', requireRole('admin'), async (req, res) => {
  if (!req.scope.propertyId) return res.status(400).json({ error: 'Select a property to export incentives' })
  const incentives = await incentiveStats(req.scope.filter)
  sendSheet(res, 'Incentives', incentives.trend.map((t) => ({
    Month: t.month, 'Booked Sales': t.sales, Expenses: t.expenses, Profit: t.profit,
    Deepak: t.deepak, Akhil: t.akhil, Total: t.total,
  })))
})

exportRouter.use(requireRole('admin'))

exportRouter.get('/', async (req, res) => {
  const buf = await buildWorkbook(req.scope.filter)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  res.setHeader('Content-Disposition', `attachment; filename="saratoga-export-${today}.xlsx"`)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})
