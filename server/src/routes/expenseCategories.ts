import { Router } from 'express'
import { z } from 'zod'
import { Expense } from '../models/Expense.js'
import { ExpenseCategory } from '../models/ExpenseCategory.js'
import { requireRole } from '../middleware/auth.js'
import { listCategories } from '../services/expenseCategories.js'

const nameSchema = z.string().trim().min(1).max(40)
const createSchema = z.object({ name: nameSchema })
const updateSchema = z.object({ name: nameSchema.optional(), active: z.boolean().optional() })

export const expenseCategoriesRouter = Router()
expenseCategoriesRouter.use(requireRole('admin'))

const shape = (c: InstanceType<typeof ExpenseCategory>, inUse: number) =>
  ({ id: c.id, name: c.name, active: c.active, inUse })

async function usageCounts() {
  const rows = await Expense.aggregate([{ $group: { _id: '$cat', n: { $sum: 1 } } }])
  return new Map<string, number>(rows.map((r) => [r._id, r.n]))
}

expenseCategoriesRouter.get('/', async (_req, res) => {
  const [categories, usage] = await Promise.all([listCategories(), usageCounts()])
  res.json(categories.map((c) => shape(c, usage.get(c.name) ?? 0)))
})

expenseCategoriesRouter.post('/', async (req, res) => {
  const { name } = createSchema.parse(req.body)
  if (await ExpenseCategory.findOne({ name })) {
    return res.status(409).json({ error: 'That category already exists' })
  }
  const category = await ExpenseCategory.create({ name })
  res.status(201).json(shape(category, 0))
})

expenseCategoriesRouter.patch('/:id', async (req, res) => {
  const body = updateSchema.parse(req.body)
  const category = await ExpenseCategory.findById(req.params.id)
  if (!category) return res.status(404).json({ error: 'Category not found' })

  if (body.name && body.name !== category.name) {
    if (await ExpenseCategory.findOne({ name: body.name })) {
      return res.status(409).json({ error: 'That category already exists' })
    }
    // Expenses store the category by name, so a rename has to carry them along or they
    // would be stranded under a category that no longer exists.
    await Expense.updateMany({ cat: category.name }, { $set: { cat: body.name } })
    category.name = body.name
  }
  if (body.active !== undefined) category.active = body.active
  await category.save()

  const usage = await usageCounts()
  res.json(shape(category, usage.get(category.name) ?? 0))
})

expenseCategoriesRouter.delete('/:id', async (req, res) => {
  const category = await ExpenseCategory.findById(req.params.id)
  if (!category) return res.status(404).json({ error: 'Category not found' })
  const inUse = await Expense.countDocuments({ cat: category.name })
  if (inUse > 0) {
    return res.status(409).json({
      error: `${inUse} expense${inUse === 1 ? '' : 's'} still use this category. Rename it, or switch it off to hide it from new entries.`,
    })
  }
  await category.deleteOne()
  res.json({ ok: true })
})
