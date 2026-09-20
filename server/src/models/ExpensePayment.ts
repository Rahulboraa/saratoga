import { Schema, model } from 'mongoose'

const expensePaymentSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    expenseId: { type: Schema.Types.ObjectId, ref: 'Expense', required: true, index: true },
    date: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, default: '' },
    to: { type: String, default: '' },
    by: { type: String, default: '' },
    notes: { type: String, default: '' },
    legacyId: { type: String, index: true },
  },
  { timestamps: true },
)

expensePaymentSchema.index({ propertyId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: 'string' } } })

export const ExpensePayment = model('ExpensePayment', expensePaymentSchema)
