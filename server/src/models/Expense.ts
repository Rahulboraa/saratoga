import { Schema, model } from 'mongoose'

/** Seeded once into the ExpenseCategory collection, which is the source of truth after that. */
export const DEFAULT_EXPENSE_CATS = [
  'Salary', 'Catering', 'Decor', 'Electricity', 'Housekeeping',
  'Dry Cleaning', 'Meta Ads', 'Marketing', 'Maintenance', 'Other',
] as const

const expenseSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    date: { type: String, required: true, index: true },
    // Free text, constrained at the route against the editable category list.
    cat: { type: String, required: true, trim: true, index: true },
    // Optional: ties a cost to the event it was incurred for.
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },
    desc: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    vendor: { type: String, default: '' },
    by: { type: String, default: '' },
    notes: { type: String, default: '' },
    legacyId: { type: String, index: true },
  },
  { timestamps: true },
)

expenseSchema.index({ propertyId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: 'string' } } })

export const Expense = model('Expense', expenseSchema)
