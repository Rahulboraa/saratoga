import { Payment } from '../models/Payment.js'
import { Booking } from '../models/Booking.js'

const UNASSIGNED = 'Unassigned'

export interface AccountRow {
  account: string
  received: number
  count: number
  lastDate: string
  share: number
}

/**
 * Collections grouped by the account the money landed in. Refunds are negative
 * payments, so they net off the account they were refunded from.
 */
export async function accountReport(
  scope: Record<string, unknown>,
  month?: string,
  account?: string,
) {
  const monthFilter = month && month !== 'all'
    ? { date: { $regex: `^${month.replace(/[^\d-]/g, '')}` } }
    : {}

  const [all, inScope] = await Promise.all([
    Payment.find(scope).select('date'),
    Payment.find({ ...scope, ...monthFilter }).select('date amount dest method by notes bookingId'),
  ])

  const months = [...new Set(all.map((p) => p.date.slice(0, 7)).filter(Boolean))].sort().reverse()

  // Grouped case-insensitively: "Rajound paytm" and "Rajound Paytm" are one account.
  const byAccount = new Map<string, AccountRow>()
  for (const p of inScope) {
    const name = p.dest?.trim() || UNASSIGNED
    const key = name.toLowerCase()
    if (!byAccount.has(key)) byAccount.set(key, { account: name, received: 0, count: 0, lastDate: '', share: 0 })
    const row = byAccount.get(key)!
    row.received += p.amount
    row.count++
    if (p.date > row.lastDate) row.lastDate = p.date
  }

  const accounts = [...byAccount.values()].sort((a, b) => b.received - a.received)
  const total = accounts.reduce((sum, a) => sum + a.received, 0)
  for (const row of accounts) {
    row.share = total > 0 ? Math.round((row.received / total) * 1000) / 10 : 0
  }

  const listed = account
    ? inScope.filter((p) => (p.dest?.trim() || UNASSIGNED).toLowerCase() === account.toLowerCase())
    : inScope
  const recent = [...listed].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200)
  const bookings = await Booking.find({ _id: { $in: recent.map((p) => p.bookingId) } }).select('guest')
  const guestById = new Map(bookings.map((b) => [b.id, b.guest]))

  return {
    months,
    accounts,
    total,
    payments: recent.map((p) => ({
      id: p.id,
      date: p.date,
      amount: p.amount,
      account: p.dest?.trim() || UNASSIGNED,
      method: p.method,
      by: p.by,
      notes: p.notes,
      guest: guestById.get(String(p.bookingId)) ?? '',
    })),
  }
}
