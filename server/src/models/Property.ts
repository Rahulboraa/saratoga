import { Schema, model } from 'mongoose'

const propertySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    location: { type: String, default: '' },
    active: { type: Boolean, default: true },
    // Printed on sales invoices raised for this property.
    address: { type: String, default: '' },
    gstin: { type: String, default: '' },
    invoicePrefix: { type: String, default: 'INV' },
    // Invoice serials restart each financial year, per property.
    invoiceFy: { type: String, default: '' },
    invoiceSeq: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export const Property = model('Property', propertySchema)
