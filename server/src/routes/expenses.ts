import { Router } from 'express'
import { onlySent } from '../lib/patch.js'
import { Expense } from '../models/Expense.js'
import { Booking } from '../models/Booking.js'
import { ExpensePayment } from '../models/ExpensePayment.js'
import { requireRole } from '../middleware/auth.js'
import { expenseSchema, expensePaymentSchema } from '../validation/schemas.js'
import { serializeExpense, serializeExpensePayment } from '../lib/sanitize.js'
import { expensePaymentSums, statusOf } from '../services/finance.js'
import { expenseSummary } from '../services/stats.js'
import { assertCategory } from '../services/expenseCategories.js'
import { scoped, writeProperty } from '../middleware/scope.js'

export const expensesRouter = Router()
expensesRouter.use(requireRole('admin'))

/** Guest names for the bookings an expense list refers to, so rows can show what it was for. */
async function bookingLabels(ids: unknown[]) {
  if (!ids.length) return new Map<string, string>()
  const bookings = await Booking.find({ _id: { $in: ids } }).select('guest checkinDate')
  return new Map(bookings.map((b) => [b.id, `${b.guest} · ${b.checkinDate}`]))
}

/** A mapped booking has to live in the same property, or the link would leak across them. */
async function resolveBooking(req: Parameters<typeof scoped>[0], bookingId: string | null | undefined) {
  if (!bookingId) return null
  const booking = await Booking.findOne(scoped(req, { _id: bookingId })).select('_id')
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 400 })
  return booking._id
}

expensesRouter.get('/summary', async (req, res) => {
  res.json(await expenseSummary(req.scope.filter, String(req.query.month || '')))
})

expensesRouter.get('/', async (req, res) => {
  const { month, cat } = req.query as Record<string, string | undefined>
  const page = Math.max(parseInt(String(req.query.page)) || 1, 1)
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 100)
  const filter: Record<string, unknown> = scoped(req)
  if (month) filter.date = { $regex: `^${month.replace(/[^\d-]/g, '')}` }
  if (cat) filter.cat = cat
  const [expenses, total, allDates] = await Promise.all([
    Expense.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit),
    Expense.countDocuments(filter),
    Expense.distinct('date', scoped(req)),
  ])
  const months = [...new Set(allDates.map((d) => d.slice(0, 7)))].sort().reverse()
  const sums = await expensePaymentSums(expenses.map((e) => e._id))
  const labels = await bookingLabels(expenses.map((e) => e.bookingId).filter(Boolean))
  const rows = expenses.map((e) => {
    const paid = sums.get(e.id) ?? 0
    return serializeExpense({
      ...e.toObject(), id: e.id, paid, due: e.amount - paid, status: statusOf(e.amount, paid),
      bookingLabel: labels.get(String(e.bookingId)) ?? '',
    })
  })
  res.json({ rows, total, page, limit, months })
})

expensesRouter.post('/', async (req, res) => {
  const body = expenseSchema.parse(req.body)
  await assertCategory(body.cat)
  const propertyId = writeProperty(req, res)
  if (!propertyId) return
  const bookingId = await resolveBooking(req, body.bookingId)
  const expense = await Expense.create({ ...body, bookingId, propertyId, by: body.by || req.user.name })
  res.status(201).json(serializeExpense({ ...expense.toObject(), id: expense.id, paid: 0, due: expense.amount, status: 'pending' }))
})

expensesRouter.patch('/:id', async (req, res) => {
  const body = onlySent(expenseSchema.partial().parse(req.body), req.body)
  await assertCategory(body.cat)
  const update: Record<string, unknown> = { ...body }
  if (body.bookingId !== undefined) update.bookingId = await resolveBooking(req, body.bookingId)
  const expense = await Expense.findOneAndUpdate(scoped(req, { _id: req.params.id }), update, { new: true, runValidators: true })
  if (!expense) return res.status(404).json({ error: 'Expense not found' })
  const sums = await expensePaymentSums([expense._id])
  const paid = sums.get(expense.id) ?? 0
  res.json(serializeExpense({ ...expense.toObject(), id: expense.id, paid, due: expense.amount - paid, status: statusOf(expense.amount, paid) }))
})

expensesRouter.delete('/:id', async (req, res) => {
  const expense = await Expense.findOneAndDelete(scoped(req, { _id: req.params.id }))
  if (!expense) return res.status(404).json({ error: 'Expense not found' })
  await ExpensePayment.deleteMany({ expenseId: expense._id })
  res.json({ ok: true })
})

expensesRouter.get('/:id/payments', async (req, res) => {
  const payments = await ExpensePayment.find(scoped(req, { expenseId: req.params.id })).sort({ date: 1 })
  res.json(payments.map((p) => serializeExpensePayment(p.toObject())))
})

expensesRouter.post('/:id/payments', async (req, res) => {
  const expense = await Expense.findOne(scoped(req, { _id: req.params.id }))
  if (!expense) return res.status(404).json({ error: 'Expense not found' })
  const body = expensePaymentSchema.parse(req.body)
  const payment = await ExpensePayment.create({ ...body, expenseId: expense._id, propertyId: expense.propertyId })
  res.status(201).json(serializeExpensePayment(payment.toObject()))
})

export const expensePaymentsRouter = Router()
expensePaymentsRouter.use(requireRole('admin'))

expensePaymentsRouter.patch('/:id', async (req, res) => {
  const body = onlySent(expensePaymentSchema.partial().parse(req.body), req.body)
  const payment = await ExpensePayment.findOneAndUpdate(scoped(req, { _id: req.params.id }), body, { new: true, runValidators: true })
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  res.json(serializeExpensePayment(payment.toObject()))
})

expensePaymentsRouter.delete('/:id', async (req, res) => {
  const payment = await ExpensePayment.findOneAndDelete(scoped(req, { _id: req.params.id }))
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  res.json({ ok: true })
})
