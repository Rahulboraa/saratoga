import { Router } from 'express'
import { Expense } from '../models/Expense.js'
import { ExpensePayment } from '../models/ExpensePayment.js'
import { requireRole } from '../middleware/auth.js'
import { expenseSchema, expensePaymentSchema } from '../validation/schemas.js'
import { serializeExpense, serializeExpensePayment } from '../lib/sanitize.js'
import { expensePaymentSums, statusOf } from '../services/finance.js'
import { expenseSummary } from '../services/stats.js'

export const expensesRouter = Router()
expensesRouter.use(requireRole('admin'))

expensesRouter.get('/summary', async (req, res) => {
  res.json(await expenseSummary(String(req.query.month || '')))
})

expensesRouter.get('/', async (req, res) => {
  const { month, cat } = req.query as Record<string, string | undefined>
  const page = Math.max(parseInt(String(req.query.page)) || 1, 1)
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 100)
  const filter: Record<string, unknown> = {}
  if (month) filter.date = { $regex: `^${month.replace(/[^\d-]/g, '')}` }
  if (cat) filter.cat = cat
  const [expenses, total, allDates] = await Promise.all([
    Expense.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit),
    Expense.countDocuments(filter),
    Expense.distinct('date'),
  ])
  const months = [...new Set(allDates.map((d) => d.slice(0, 7)))].sort().reverse()
  const sums = await expensePaymentSums(expenses.map((e) => e._id))
  const rows = expenses.map((e) => {
    const paid = sums.get(e.id) ?? 0
    return serializeExpense({ ...e.toObject(), id: e.id, paid, due: e.amount - paid, status: statusOf(e.amount, paid) })
  })
  res.json({ rows, total, page, limit, months })
})

expensesRouter.post('/', async (req, res) => {
  const body = expenseSchema.parse(req.body)
  const expense = await Expense.create({ ...body, by: body.by || req.user.name })
  res.status(201).json(serializeExpense({ ...expense.toObject(), id: expense.id, paid: 0, due: expense.amount, status: 'pending' }))
})

expensesRouter.patch('/:id', async (req, res) => {
  const body = expenseSchema.partial().parse(req.body)
  const expense = await Expense.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true })
  if (!expense) return res.status(404).json({ error: 'Expense not found' })
  const sums = await expensePaymentSums([expense._id])
  const paid = sums.get(expense.id) ?? 0
  res.json(serializeExpense({ ...expense.toObject(), id: expense.id, paid, due: expense.amount - paid, status: statusOf(expense.amount, paid) }))
})

expensesRouter.delete('/:id', async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id)
  if (!expense) return res.status(404).json({ error: 'Expense not found' })
  await ExpensePayment.deleteMany({ expenseId: expense._id })
  res.json({ ok: true })
})

expensesRouter.get('/:id/payments', async (req, res) => {
  const payments = await ExpensePayment.find({ expenseId: req.params.id }).sort({ date: 1 })
  res.json(payments.map((p) => serializeExpensePayment(p.toObject())))
})

expensesRouter.post('/:id/payments', async (req, res) => {
  const expense = await Expense.findById(req.params.id)
  if (!expense) return res.status(404).json({ error: 'Expense not found' })
  const body = expensePaymentSchema.parse(req.body)
  const payment = await ExpensePayment.create({ ...body, expenseId: expense._id })
  res.status(201).json(serializeExpensePayment(payment.toObject()))
})

export const expensePaymentsRouter = Router()
expensePaymentsRouter.use(requireRole('admin'))

expensePaymentsRouter.patch('/:id', async (req, res) => {
  const body = expensePaymentSchema.partial().parse(req.body)
  const payment = await ExpensePayment.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true })
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  res.json(serializeExpensePayment(payment.toObject()))
})

expensePaymentsRouter.delete('/:id', async (req, res) => {
  const payment = await ExpensePayment.findByIdAndDelete(req.params.id)
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  res.json({ ok: true })
})
