import { Schema, model } from 'mongoose'

export const FU_STATUSES = ['', 'Hold', 'Closed', 'Cancelled'] as const
export const VISITOR_TYPES = ['Guest', 'Vendor', 'Delivery', 'Staff', 'Other'] as const

const visitorSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    date: { type: String, required: true, index: true },
    loggedAt: { type: String, default: () => new Date().toISOString() },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    type: { type: String, enum: VISITOR_TYPES, default: 'Guest', index: true },
    purpose: { type: String, default: '' },
    inTime: { type: String, default: '' },
    outTime: { type: String, default: '' },
    remarks: { type: String, default: '' },
    fuStatus: { type: String, enum: FU_STATUSES, default: '' },
    fuRemark: { type: String, default: '' },
    loggedBy: { type: String, default: '' },
    legacyId: { type: String, index: true },
  },
  { timestamps: true },
)

visitorSchema.index({ propertyId: 1, legacyId: 1 }, { unique: true, sparse: true })

export const Visitor = model('Visitor', visitorSchema)
