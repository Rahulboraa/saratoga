import { Schema, model } from 'mongoose'

export const EXPENSE_CATS = [
  'Salary', 'Catering', 'Decor', 'Electricity', 'Housekeeping',
  'Dry Cleaning', 'Meta Ads', 'Marketing', 'Maintenance', 'Other',
] as const

const expenseSchema = new Schema(
  {
    date: { type: String, required: true, index: true },
    cat: { type: String, enum: EXPENSE_CATS, required: true },
    desc: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    vendor: { type: String, default: '' },
    by: { type: String, default: '' },
    notes: { type: String, default: '' },
    legacyId: { type: String, index: { unique: true, sparse: true } },
  },
  { timestamps: true },
)

export const Expense = model('Expense', expenseSchema)
