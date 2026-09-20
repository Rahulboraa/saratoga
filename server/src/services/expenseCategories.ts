import { Expense, DEFAULT_EXPENSE_CATS } from '../models/Expense.js'
import { ExpenseCategory } from '../models/ExpenseCategory.js'

/**
 * Categories started life as a hard-coded list. The first time they are read, whatever
 * that list held — plus anything already used by an expense — becomes the editable set,
 * so nothing that exists loses its category.
 */
export async function ensureDefaultCategories() {
  if (await ExpenseCategory.countDocuments()) return
  const used = (await Expense.distinct('cat')).filter(Boolean) as string[]
  const names = [...new Set([...DEFAULT_EXPENSE_CATS, ...used])]
  await ExpenseCategory.insertMany(names.map((name) => ({ name })))
}

export async function listCategories() {
  await ensureDefaultCategories()
  return ExpenseCategory.find().sort({ name: 1 })
}

/** Names an expense is allowed to be filed under. */
export async function activeCategoryNames() {
  await ensureDefaultCategories()
  const rows = await ExpenseCategory.find({ active: true }).select('name')
  return rows.map((r) => r.name)
}

/**
 * The category an expense should carry. Rejects anything not on the list rather than
 * silently inventing a category from a typo.
 */
export async function assertCategory(cat: string | undefined) {
  if (cat === undefined) return
  const names = await activeCategoryNames()
  if (!names.includes(cat)) {
    throw Object.assign(new Error(`"${cat}" is not one of the expense categories`), { status: 400 })
  }
}
