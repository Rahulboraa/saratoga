import { Schema, model } from 'mongoose'

import { EVENT_TYPES } from './eventTypes.js'

export { EVENT_TYPES }
/** Kept as a name so existing imports of PURPOSES still read sensibly. */
export const PURPOSES = EVENT_TYPES
export const SOURCES = ['Airbnb', 'Direct', 'Referral', ''] as const
export const BREAKDOWN_KEYS = ['venue', 'catering', 'decor', 'music', 'valet', 'cleaning', 'license', 'security'] as const

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
    purpose: { type: String, enum: EVENT_TYPES, default: 'Other' },
    // What this was before the lists were merged. Kept so "Party" — which covered
    // several kinds of event with nothing to tell them apart — can be revisited.
    legacyPurpose: { type: String, default: '' },
    source: { type: String, enum: SOURCES, default: '' },
    dest: { type: String, default: '' },
    notes: { type: String, default: '' },
    // Who the invoice is actually raised on. A company paying for an event needs its own
    // name, GSTIN and address on the invoice to claim input credit; left empty the
    // invoice falls back to the guest's own name and phone.
    billingName: { type: String, default: '', trim: true },
    billingGstin: { type: String, default: '', trim: true, uppercase: true },
    billingAddress: { type: String, default: '', trim: true },
    breakdown: {
      venue: { type: Number, default: 0, min: 0 },
      catering: { type: Number, default: 0, min: 0 },
      decor: { type: Number, default: 0, min: 0 },
      music: { type: Number, default: 0, min: 0 },
      valet: { type: Number, default: 0, min: 0 },
      cleaning: { type: Number, default: 0, min: 0 },
      license: { type: Number, default: 0, min: 0 },
      security: { type: Number, default: 0, min: 0 },
    },
    amount: { type: Number, default: 0 },
    legacyReceived: { type: Number, default: 0 },
    // Off for bookings billed without tax; remembered so a reprint matches what was sent.
    gstEnabled: { type: Boolean, default: true },
    invoiceNo: { type: String, default: '' },
    invoiceDate: { type: String, default: '' },
    // The seller's GSTIN as it stood when the invoice was issued. A reprint is faithful
    // to what the guest holds, and an invoice raised before registration never gains tax
    // retrospectively just because a number was entered later.
    invoiceGstin: { type: String, default: '' },
    createdBy: { type: String, default: '' },
    legacyId: { type: String, index: true },
  },
  { timestamps: true },
)

bookingSchema.pre('validate', function () {
  if (!this.checkoutDate) this.checkoutDate = this.checkinDate
  const b = this.breakdown
  this.amount = (b?.venue ?? 0) + (b?.catering ?? 0) + (b?.decor ?? 0)
    + (b?.music ?? 0) + (b?.valet ?? 0) + (b?.cleaning ?? 0)
})

bookingSchema.index({ propertyId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: 'string' } } })

export const Booking = model('Booking', bookingSchema)
