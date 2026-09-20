import { Schema, model } from 'mongoose'

const expenseCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const ExpenseCategory = model('ExpenseCategory', expenseCategorySchema)
