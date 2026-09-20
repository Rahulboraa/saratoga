import { Schema, model } from 'mongoose'

const paymentSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    date: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    method: { type: String, default: '' },
    dest: { type: String, default: '' },
    by: { type: String, default: '' },
    notes: { type: String, default: '' },
    legacyId: { type: String, index: true },
  },
  { timestamps: true },
)

paymentSchema.index({ propertyId: 1, legacyId: 1 }, { unique: true, sparse: true })

export const Payment = model('Payment', paymentSchema)
