import { Schema, model } from 'mongoose'
import { EVENT_TYPES } from './eventTypes.js'

export { EVENT_TYPES } from './eventTypes.js'
// '' is a lead nobody has called yet. 'Did Not Pick' is one that was called and did not
// answer — a distinction worth keeping, because the second still owes a call back.
export const OUTCOMES = ['', 'Did Not Pick', 'Interested', 'Not Interested', 'Callback', 'Converted'] as const

/** Outcomes that leave the lead still needing a call. */
export const OPEN_OUTCOMES = ['', 'Did Not Pick', 'Interested', 'Callback'] as const
export const FLAGS = ['', 'review', 'good', 'escalate'] as const

const leadSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    date: { type: String, required: true },
    time: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    eventType: { type: String, enum: EVENT_TYPES, default: 'Other' },
    legacyEventType: { type: String, default: '' },
    outcome: { type: String, enum: OUTCOMES, default: '' },
    followup: { type: String, default: '' },
    notes: { type: String, default: '' },
    exec: { type: String, default: '' },
    execLabel: { type: String, default: '' },
    flag: { type: String, enum: FLAGS, default: '' },
    adminComment: { type: String, default: '' },
    importedBy: { type: String, default: '' },
    legacyId: { type: String, index: true },
  },
  { timestamps: true },
)

leadSchema.index({ propertyId: 1, exec: 1, date: -1 })

leadSchema.index({ propertyId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: 'string' } } })

export const Lead = model('Lead', leadSchema)
