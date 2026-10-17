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

/** Printed at the very bottom of an invoice, under the terms. Editable per property. */
export const DEFAULT_INVOICE_FOOTER = 'This is a computer-generated document and needs no signature.'

const propertySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    location: { type: String, default: '' },
    active: { type: Boolean, default: true },
    // Printed on sales invoices raised for this property. The legal entity billing the
    // guest is not always what the villa is called, so it is held separately.
    legalName: { type: String, default: '' },
    address: { type: String, default: '' },
    gstin: { type: String, default: '' },
    invoicePrefix: { type: String, default: 'INV' },
    // Shown across the app so it is obvious which property is being worked on.
    imageUrl: { type: String, default: '' },
    color: { type: String, default: '' },
    // One term per line.
    invoiceTerms: { type: String, default: DEFAULT_INVOICE_TERMS },
    // Free text under the letterhead and at the foot of the invoice.
    invoiceHeader: { type: String, default: '' },
    invoiceFooter: { type: String, default: DEFAULT_INVOICE_FOOTER },
    // Defaults for the WhatsApp booking confirmation, one item per line.
    inclusions: { type: String, default: '' },
    exclusions: { type: String, default: '' },
    confirmationNotes: { type: String, default: '' },
    // Invoice serials restart each financial year, per property.
    invoiceFy: { type: String, default: '' },
    invoiceSeq: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export const Property = model('Property', propertySchema)
