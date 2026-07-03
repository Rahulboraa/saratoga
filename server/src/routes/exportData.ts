import { Router } from 'express'
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

export const exportRouter = Router()
exportRouter.use(requireRole('admin'))

exportRouter.get('/', async (_req, res) => {
  const [bookings, payments, expenses, expPayments, visitors, leads, incentives] = await Promise.all([
    Booking.find().sort({ checkinDate: 1 }),
    Payment.find().sort({ date: 1 }),
    Expense.find().sort({ date: 1 }),
    ExpensePayment.find().sort({ date: 1 }),
    Visitor.find().sort({ date: 1 }),
    Lead.find().sort({ date: 1 }),
    incentiveStats(),
  ])
  const sums = await paymentSums()
  const expSums = await expensePaymentSums()
  const guestById = new Map(bookings.map((b) => [b.id, b.guest]))
  const descById = new Map(expenses.map((e) => [e.id, e.desc]))

  const wb = XLSX.utils.book_new()
  const add = (name: string, rows: Record<string, unknown>[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name)

  add('Bookings', bookings.map((b) => {
    const fin = withFinance(b, sums)
    return {
      Guest: b.guest, Phone: b.phone, 'Check-in': b.checkinDate, 'Check-out': b.checkoutDate,
      'In Time': b.checkinTime, 'Out Time': b.checkoutTime, Pax: b.pax, Purpose: b.purpose, Source: b.source,
      Venue: b.breakdown?.venue ?? 0, Catering: b.breakdown?.catering ?? 0, Decor: b.breakdown?.decor ?? 0,
      Music: b.breakdown?.music ?? 0, Cleaning: b.breakdown?.cleaning ?? 0,
      License: b.breakdown?.license ?? 0, Security: b.breakdown?.security ?? 0,
      Amount: b.amount, Received: fin.collected, Due: fin.due, Status: fin.status,
      Destination: b.dest, Notes: b.notes,
    }
  }))

  add('Payments', payments.map((p) => ({
    Guest: guestById.get(String(p.bookingId)) ?? '', Date: p.date, Amount: p.amount,
    Method: p.method, Destination: p.dest, 'Paid By': p.by, Notes: p.notes,
  })))

  add('Expenses', expenses.map((e) => {
    const paid = expSums.get(e.id) ?? 0
    return {
      Date: e.date, Category: e.cat, Description: e.desc, Bill: e.amount,
      Paid: paid, Due: e.amount - paid, Status: statusOf(e.amount, paid),
      Vendor: e.vendor, By: e.by, Notes: e.notes,
    }
  }))

  add('Expense Payments', expPayments.map((p) => ({
    Expense: descById.get(String(p.expenseId)) ?? '', Date: p.date, Amount: p.amount,
    Method: p.method, To: p.to, By: p.by, Notes: p.notes,
  })))

  add('Visitors', visitors.map((v) => ({
    Date: v.date, Name: v.name, Phone: v.phone, Purpose: v.purpose,
    'In Time': v.inTime, 'Out Time': v.outTime, Remarks: v.remarks,
    'Follow-up': v.fuStatus, 'Follow-up Note': v.fuRemark, 'Logged By': v.loggedBy,
  })))

  add('Leads', leads.map((l) => ({
    Date: l.date, Time: l.time, Name: l.name, Phone: l.phone, 'Event Type': l.eventType,
    Outcome: l.outcome, 'Follow-up': l.followup, 'Assigned To': l.execLabel, Flag: l.flag,
    Notes: l.notes, 'Admin Comment': l.adminComment,
  })))

  add('Incentives', incentives.trend.map((t) => ({
    Month: t.month, 'Sales Collected': t.sales, Expenses: t.expenses, Profit: t.profit,
    Deepak: t.deepak, Akhil: t.akhil, Total: t.total,
  })))

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  res.setHeader('Content-Disposition', `attachment; filename="saratoga-export-${today}.xlsx"`)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})
