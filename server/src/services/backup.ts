import * as XLSX from 'xlsx'
import { Booking } from '../models/Booking.js'
import { Payment } from '../models/Payment.js'
import { Expense } from '../models/Expense.js'
import { ExpensePayment } from '../models/ExpensePayment.js'
import { Visitor } from '../models/Visitor.js'
import { Lead } from '../models/Lead.js'
import { paymentSums, expensePaymentSums, withFinance, statusOf } from './finance.js'
import { incentiveStats } from './stats.js'

export function istDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export async function buildWorkbook(): Promise<Buffer> {
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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name)

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

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

// Raw dump for exact restore (all fields, including internal keys)
export async function buildRawJson(): Promise<string> {
  const [bookings, payments, expenses, expensePayments, visitors, leads] = await Promise.all([
    Booking.find().lean(),
    Payment.find().lean(),
    Expense.find().lean(),
    ExpensePayment.find().lean(),
    Visitor.find().lean(),
    Lead.find().lean(),
  ])
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), bookings, payments, expenses, expensePayments, visitors, leads },
    null,
    2,
  )
}

interface Attachment {
  filename: string
  content: string // base64
}

export async function sendBackupEmail(xlsx: Buffer, json: string) {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.BACKUP_EMAIL_TO
  if (!apiKey || !to) throw new Error('RESEND_API_KEY or BACKUP_EMAIL_TO not set')
  const from = process.env.BACKUP_EMAIL_FROM || 'Saratoga Villa <onboarding@resend.dev>'
  const date = istDate()

  const attachments: Attachment[] = [
    { filename: `saratoga-backup-${date}.xlsx`, content: xlsx.toString('base64') },
    { filename: `saratoga-backup-${date}.json`, content: Buffer.from(json).toString('base64') },
  ]

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: to.split(',').map((s) => s.trim()),
      subject: `Saratoga Villa — data backup ${date}`,
      html: `<p>Nightly backup of Saratoga Villa Booking Manager for <b>${date}</b>.</p>
        <p>Two attachments:</p>
        <ul>
          <li><b>.xlsx</b> — readable spreadsheet (bookings, payments, expenses, visitors, leads, incentives)</li>
          <li><b>.json</b> — complete raw backup, for restore if ever needed</li>
        </ul>
        <p style="color:#64748b;font-size:12px">Automated backup. Do not reply.</p>`,
      attachments,
    }),
  })
  if (!res.ok) throw new Error(`Resend failed ${res.status}: ${await res.text()}`)
  return res.json()
}
