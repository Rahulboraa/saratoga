import { Schema, model } from 'mongoose'

/** Printed under the totals on every invoice. Editable per property. */
export const DEFAULT_INVOICE_TERMS = [
  '100% payment required before check-in.',
  'Valid ID proof of all guests to be submitted in advance.',
  'Check-in: 3:00 PM | Check-out: 10:00 AM.',
  'Music/DJ permitted till 10:30 PM as per applicable norms.',
  '₹10,000 refundable security deposit, subject to deductions.',
  '₹2,500 cleaning charge for excessive dirt/spillage.',
  'Property damage charged at actual cost.',
  'Smoking inside rooms/ground floor prohibited; ₹2,500 penalty.',
  'Out-of-state alcohol, illegal/prohibited items and weapons strictly prohibited.',
  'Late checkout/additional housekeeping/extra bedding chargeable.',
  'Booking may be terminated without refund for violation/misrepresentation.',
].join('\n')

const propertySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    location: { type: String, default: '' },
    active: { type: Boolean, default: true },
    // Printed on sales invoices raised for this property.
    address: { type: String, default: '' },
    gstin: { type: String, default: '' },
    invoicePrefix: { type: String, default: 'INV' },
    // One term per line.
    invoiceTerms: { type: String, default: DEFAULT_INVOICE_TERMS },
    // Invoice serials restart each financial year, per property.
    invoiceFy: { type: String, default: '' },
    invoiceSeq: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export const Property = model('Property', propertySchema)
