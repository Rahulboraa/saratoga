import { Schema, model } from 'mongoose'

const paymentSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    date: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    method: { type: String, default: '' },
    dest: { type: String, default: '' },
    by: { type: String, default: '' },
    notes: { type: String, default: '' },
    legacyId: { type: String, index: { unique: true, sparse: true } },
  },
  { timestamps: true },
)

export const Payment = model('Payment', paymentSchema)
