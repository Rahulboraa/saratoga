import { Schema, model } from 'mongoose'

export const EVENT_TYPES = [
  'Birthday / Anniversary / Milestone', 'Corporate / Office Party',
  'Wedding / Engagement', 'Shoot', 'Other',
] as const
export const OUTCOMES = ['', 'Interested', 'Not Interested', 'Callback', 'Converted'] as const
export const FLAGS = ['', 'review', 'good', 'escalate'] as const

const leadSchema = new Schema(
  {
    date: { type: String, required: true },
    time: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    eventType: { type: String, enum: EVENT_TYPES, default: 'Other' },
    outcome: { type: String, enum: OUTCOMES, default: '' },
    followup: { type: String, default: '' },
    notes: { type: String, default: '' },
    exec: { type: String, default: '' },
    execLabel: { type: String, default: '' },
    flag: { type: String, enum: FLAGS, default: '' },
    adminComment: { type: String, default: '' },
    importedBy: { type: String, default: '' },
    legacyId: { type: String, index: { unique: true, sparse: true } },
  },
  { timestamps: true },
)

leadSchema.index({ exec: 1, date: -1 })

export const Lead = model('Lead', leadSchema)
