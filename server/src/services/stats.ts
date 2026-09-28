import { Booking } from '../models/Booking.js'
import { Payment } from '../models/Payment.js'
import { Expense } from '../models/Expense.js'
import { ExpensePayment } from '../models/ExpensePayment.js'
import { overlapIdSet } from '../lib/overlap.js'
import { todayYmd, monthOf, monthsBetween } from '../lib/dates.js'
import { serializeBooking } from '../lib/sanitize.js'
import { paymentSums, withFinance } from './finance.js'
import { monthIncentive, INCENTIVE_START } from './incentives.js'
import type { Role } from '../models/User.js'

function addTo(map: Map<string, number>, key: string, value: number) {
  if (!key) return
  map.set(key, (map.get(key) ?? 0) + value)
}

type Scope = Record<string, unknown>

async function monthlyFinance(scope: Scope) {
  const [bookings, payments, expenses] = await Promise.all([
    Booking.find(scope).select('checkinDate amount legacyReceived'),
    Payment.find(scope).select('date amount'),
    Expense.find(scope).select('date amount'),
  ])
  const booked = new Map<string, number>()
  const collected = new Map<string, number>()
  const expensed = new Map<string, number>()
  for (const b of bookings) {
    addTo(booked, monthOf(b.checkinDate), b.amount)
    if (b.legacyReceived) addTo(collected, monthOf(b.checkinDate), b.legacyReceived)
  }
  for (const p of payments) addTo(collected, monthOf(p.date), p.amount)
  for (const e of expenses) addTo(expensed, monthOf(e.date), e.amount)
  return { booked, collected, expensed }
}

function allMonths(...maps: Map<string, number>[]) {
  const keys = maps.flatMap((m) => [...m.keys()]).filter(Boolean).sort()
  if (!keys.length) return []
  return monthsBetween(keys[0], keys[keys.length - 1])
}

export async function dashboardStats(role: Role, scope: Scope = {}) {
  const today = todayYmd()
  const bookings = await Booking.find(scope).sort({ checkinDate: 1 })
  const rows = bookings.map((b) => ({ ...b.toObject(), id: b.id }))
  const overlapIds = overlapIdSet(rows)

  const purposeBreakdown = new Map<string, { purpose: string; count: number; booked: number; collected: number }>()
  const bookingsPerMonth = new Map<string, number>()
  const uniqueDates = new Set<string>()
  let upcomingCount = 0

  const sums = await paymentSums(undefined, scope)
  for (const b of rows) {
    uniqueDates.add(b.checkinDate)
    addTo(bookingsPerMonth, monthOf(b.checkinDate), 1)
    if (b.checkinDate >= today) upcomingCount++
    if (!purposeBreakdown.has(b.purpose)) purposeBreakdown.set(b.purpose, { purpose: b.purpose, count: 0, booked: 0, collected: 0 })
    const p = purposeBreakdown.get(b.purpose)!
    p.count++
    p.booked += b.amount
    p.collected += withFinance(b as never, sums).collected
  }

  const upcoming = rows
    .filter((b) => b.checkinDate >= today)
    .slice(0, 25)
    .map((b) => serializeBooking(
      { ...b, overlap: overlapIds.has(b.id), ...(role !== 'sales' && role !== 'caretaker' ? withFinance(b as never, sums) : {}) },
      role,
    ))

  // Only surface overlaps that haven't fully passed — a past double-booking isn't actionable.
  const conflicts = rows
    .filter((b) => overlapIds.has(b.id) && (b.checkoutDate || b.checkinDate) >= today)
    .sort((a, b) => a.checkinDate.localeCompare(b.checkinDate))
    .map((b) => ({
      id: b.id, guest: b.guest, checkinDate: b.checkinDate, checkoutDate: b.checkoutDate,
      checkinTime: b.checkinTime, checkoutTime: b.checkoutTime, purpose: b.purpose,
    }))

  const common = {
    totalBookings: rows.length,
    upcomingCount,
    uniqueDates: uniqueDates.size,
    overlapCount: conflicts.length,
    conflicts,
    bookingsPerMonth: [...bookingsPerMonth.entries()].sort().map(([month, count]) => ({ month, count })),
    purposeBreakdown: [...purposeBreakdown.values()].map((p) =>
      role === 'admin' ? p : { purpose: p.purpose, count: p.count },
    ),
    upcoming,
  }

  if (role !== 'admin') return common

  const { booked, collected, expensed } = await monthlyFinance(scope)
  const totalBooked = rows.reduce((s, b) => s + b.amount, 0)
  const totalCollected = rows.reduce((s, b) => s + withFinance(b as never, sums).collected, 0)
  const upcomingUnpaid = rows.filter((b) => b.checkinDate >= today && withFinance(b as never, sums).status !== 'paid').length

  const months = allMonths(booked, collected, expensed)
  const monthlySeries = months.map((m) => {
    const bk = booked.get(m) ?? 0
    const col = collected.get(m) ?? 0
    const exp = expensed.get(m) ?? 0
    const inc = monthIncentive(m, bk, exp)
    return {
      month: m,
      booked: bk,
      collected: col,
      pending: Math.max(bk - col, 0),
      expenses: exp + inc.total,
      profit: bk - exp - inc.total,
    }
  })

  // Month-wise booking amount, split by component (booked, by check-in month)
  const breakupMap = new Map<string, { venue: number; catering: number; decor: number; music: number; valet: number; cleaning: number }>()
  for (const b of rows) {
    const m = monthOf(b.checkinDate)
    if (!m) continue
    if (!breakupMap.has(m)) breakupMap.set(m, { venue: 0, catering: 0, decor: 0, music: 0, valet: 0, cleaning: 0 })
    const e = breakupMap.get(m)!
    e.venue += b.breakdown?.venue ?? 0
    e.catering += b.breakdown?.catering ?? 0
    e.decor += b.breakdown?.decor ?? 0
    e.music += b.breakdown?.music ?? 0
    e.valet += b.breakdown?.valet ?? 0
    e.cleaning += b.breakdown?.cleaning ?? 0
  }
  const bookedBreakup = months.map((m) => ({ month: m, ...(breakupMap.get(m) ?? { venue: 0, catering: 0, decor: 0, music: 0, valet: 0, cleaning: 0 }) }))

  return {
    ...common,
    totalBooked,
    totalCollected,
    outstanding: totalBooked - totalCollected,
    upcomingUnpaid,
    monthlySeries,
    bookedBreakup,
  }
}

export async function incentiveStats(scope: Scope = {}, month?: string) {
  const { booked, expensed } = await monthlyFinance(scope)
  const months = allMonths(booked, expensed).filter((m) => m >= INCENTIVE_START)
  const trend = months.map((m) => monthIncentive(m, booked.get(m) ?? 0, expensed.get(m) ?? 0))
  const selected = month && month !== 'all'
    ? monthIncentive(month, booked.get(month) ?? 0, expensed.get(month) ?? 0)
    : trend.reduce(
        (acc, t) => ({
          month: 'all', sales: acc.sales + t.sales, expenses: acc.expenses + t.expenses,
          profit: acc.profit + t.profit, deepak: acc.deepak + t.deepak, akhil: acc.akhil + t.akhil,
          total: acc.total + t.total,
        }),
        { month: 'all', sales: 0, expenses: 0, profit: 0, deepak: 0, akhil: 0, total: 0 },
      )
  return { start: INCENTIVE_START, selected, trend }
}

export async function expenseSummary(scope: Scope = {}, month?: string) {
  const filter = { ...scope, ...(month ? { date: { $regex: `^${month.replace(/[^\d-]/g, '')}` } } : {}) }
  const expenses = await Expense.find(filter)
  const payments = await ExpensePayment.find(scope)
  const paidByExpense = new Map<string, number>()
  for (const p of payments) addTo(paidByExpense, String(p.expenseId), p.amount)

  let totalBill = 0
  let totalPaid = 0
  const byCat = new Map<string, { cat: string; count: number; amount: number }>()
  for (const e of expenses) {
    totalBill += e.amount
    totalPaid += paidByExpense.get(e.id) ?? 0
    if (!byCat.has(e.cat)) byCat.set(e.cat, { cat: e.cat, count: 0, amount: 0 })
    const c = byCat.get(e.cat)!
    c.count++
    c.amount += e.amount
  }

  const { booked, collected, expensed } = await monthlyFinance(scope)
  const months = allMonths(booked, collected, expensed)
  const plSeries = months.map((m) => {
    const bk = booked.get(m) ?? 0
    const exp = expensed.get(m) ?? 0
    const inc = monthIncentive(m, bk, exp)
    const profit = bk - exp - inc.total
    return {
      month: m,
      revenue: bk,
      expenses: exp + inc.total,
      profit,
      margin: bk > 0 ? Math.round((profit / bk) * 1000) / 10 : 0,
    }
  })

  // Incentive shown as an expense (category + totals). Incentive is on BOOKED, so include booked-only months too.
  const incMonthsAll = allMonths(booked, collected, expensed)
  const incMonths = month ? incMonthsAll.filter((m) => m.startsWith(month.replace(/[^\d-]/g, ''))) : incMonthsAll
  let incentiveTotal = 0
  for (const m of incMonths) incentiveTotal += monthIncentive(m, booked.get(m) ?? 0, expensed.get(m) ?? 0).total
  const categories = [...byCat.values()]
  if (incentiveTotal > 0) categories.push({ cat: 'Incentive', count: incMonths.filter((m) => monthIncentive(m, booked.get(m) ?? 0, expensed.get(m) ?? 0).total > 0).length, amount: incentiveTotal })

  return {
    totalBill: totalBill + incentiveTotal,
    totalPaid: totalPaid + incentiveTotal,
    totalDue: totalBill - totalPaid,
    categories: categories.sort((a, b) => b.amount - a.amount),
    plSeries,
  }
}
