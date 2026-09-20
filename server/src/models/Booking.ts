import { Schema, model } from 'mongoose'

export const PURPOSES = ['Party', 'Shoot', 'Pre-wedding', 'Kids Birthday', 'Other'] as const
export const SOURCES = ['Airbnb', 'Direct', 'Referral', ''] as const
export const BREAKDOWN_KEYS = ['venue', 'catering', 'decor', 'music', 'cleaning', 'license', 'security'] as const

const bookingSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    guest: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    checkinDate: { type: String, required: true, index: true },
    checkoutDate: { type: String, default: '' },
    checkinTime: { type: String, default: '15:00' },
    checkoutTime: { type: String, default: '10:00' },
    pax: { type: String, default: '' },
    purpose: { type: String, enum: PURPOSES, default: 'Other' },
    source: { type: String, enum: SOURCES, default: '' },
    dest: { type: String, default: '' },
    notes: { type: String, default: '' },
    breakdown: {
      venue: { type: Number, default: 0, min: 0 },
      catering: { type: Number, default: 0, min: 0 },
      decor: { type: Number, default: 0, min: 0 },
      music: { type: Number, default: 0, min: 0 },
      cleaning: { type: Number, default: 0, min: 0 },
      license: { type: Number, default: 0, min: 0 },
      security: { type: Number, default: 0, min: 0 },
    },
    amount: { type: Number, default: 0 },
    legacyReceived: { type: Number, default: 0 },
    createdBy: { type: String, default: '' },
    legacyId: { type: String, index: true },
  },
  { timestamps: true },
)

bookingSchema.pre('validate', function () {
  if (!this.checkoutDate) this.checkoutDate = this.checkinDate
  const b = this.breakdown
  this.amount = (b?.venue ?? 0) + (b?.catering ?? 0) + (b?.decor ?? 0) + (b?.music ?? 0) + (b?.cleaning ?? 0)
})

bookingSchema.index({ propertyId: 1, legacyId: 1 }, { unique: true, sparse: true })

export const Booking = model('Booking', bookingSchema)
