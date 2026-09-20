import { Schema, model } from 'mongoose'

export const INVESTMENT_KINDS = ['Investment', 'Withdrawal'] as const

const investmentSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    // Partners are recorded by name: not all of them have a login.
    partner: { type: String, required: true, trim: true, index: true },
    date: { type: String, required: true, index: true },
    kind: { type: String, enum: INVESTMENT_KINDS, default: 'Investment' },
    amount: { type: Number, required: true, min: 0.01 },
    mode: { type: String, default: '' },
    notes: { type: String, default: '' },
    by: { type: String, default: '' },
  },
  { timestamps: true },
)

export const Investment = model('Investment', investmentSchema)
