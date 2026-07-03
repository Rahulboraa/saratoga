import { Schema, model } from 'mongoose'

export const FU_STATUSES = ['', 'Hold', 'Closed', 'Cancelled'] as const

const visitorSchema = new Schema(
  {
    date: { type: String, required: true, index: true },
    loggedAt: { type: String, default: () => new Date().toISOString() },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    purpose: { type: String, default: '' },
    inTime: { type: String, default: '' },
    outTime: { type: String, default: '' },
    remarks: { type: String, default: '' },
    fuStatus: { type: String, enum: FU_STATUSES, default: '' },
    fuRemark: { type: String, default: '' },
    loggedBy: { type: String, default: '' },
    legacyId: { type: String, index: { unique: true, sparse: true } },
  },
  { timestamps: true },
)

export const Visitor = model('Visitor', visitorSchema)
