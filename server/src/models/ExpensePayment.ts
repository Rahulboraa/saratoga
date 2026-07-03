import { Schema, model } from 'mongoose'

const expensePaymentSchema = new Schema(
  {
    expenseId: { type: Schema.Types.ObjectId, ref: 'Expense', required: true, index: true },
    date: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, default: '' },
    to: { type: String, default: '' },
    by: { type: String, default: '' },
    notes: { type: String, default: '' },
    legacyId: { type: String, index: { unique: true, sparse: true } },
  },
  { timestamps: true },
)

export const ExpensePayment = model('ExpensePayment', expensePaymentSchema)
