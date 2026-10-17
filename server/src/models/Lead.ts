import { Schema, model } from 'mongoose'
import { EVENT_TYPES } from './eventTypes.js'

export { EVENT_TYPES } from './eventTypes.js'
// '' is a lead nobody has called yet. 'Did Not Pick' is one that was called and did not
// answer — a distinction worth keeping, because the second still owes a call back.
export const OUTCOMES = [
  '',
  'Did Not Pick',
  'Interested',
  'Planning to Visit',
  'Callback',
  'Converted',
  'Not Interested',
  'Out of Budget',
  'Venue is Small',
  'Sold Out',
] as const

/** Outcomes that leave the lead still needing a call. */
export const OPEN_OUTCOMES = ['', 'Did Not Pick', 'Interested', 'Planning to Visit', 'Callback'] as const

/** Outcomes that close a lead: no further calling will change them. */
export const CLOSED_OUTCOMES = ['Converted', 'Not Interested', 'Out of Budget', 'Venue is Small', 'Sold Out'] as const
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
    // The date the customer wants, not the day they enquired. Held as a range because
    // people ask for "sometime in October" or "the 14th or 15th" far more often than for
    // one fixed day; a single date is simply a range of one.
    wantedFrom: { type: String, default: '' },
    wantedTo: { type: String, default: '' },
    notes: { type: String, default: '' },
    exec: { type: String, default: '' },
    execLabel: { type: String, default: '' },
    flag: { type: String, enum: FLAGS, default: '' },
    adminComment: { type: String, default: '' },
    importedBy: { type: String, default: '' },
    legacyId: { type: String, index: true },
    // When the outcome was last recorded — the closest thing to when the lead was called.
    calledAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
)

// Stamped here rather than at each call site so every route that records an outcome —
// the edit sheet, the convert button — dates it without having to remember.
leadSchema.pre('save', function () {
  if (this.isModified('outcome') && this.outcome) this.calledAt = new Date()
  // One date given means a one-day range, so every query can treat the two fields alike
  // instead of each one checking whether an end date happens to be there.
  if (this.wantedFrom && !this.wantedTo) this.wantedTo = this.wantedFrom
  if (this.wantedTo && !this.wantedFrom) this.wantedFrom = this.wantedTo
})

leadSchema.index({ propertyId: 1, exec: 1, date: -1 })
// Finding everyone who wanted a date reads both ends of the range.
leadSchema.index({ propertyId: 1, wantedFrom: 1, wantedTo: 1 })

leadSchema.index({ propertyId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: 'string' } } })

export const Lead = model('Lead', leadSchema)
