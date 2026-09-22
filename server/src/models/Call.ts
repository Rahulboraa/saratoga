import { Schema, model } from 'mongoose'

/** What came of the call. `connected` is the only one that counts as a conversation. */
export const CALL_OUTCOMES = ['connected', 'no-answer', 'busy', 'wrong-number', 'cancelled'] as const

/**
 * How the duration was arrived at. A phone dialled from the browser cannot report the
 * carrier's call time, so the app measures how long it was in the background instead and
 * marks it `estimated`. A telephony provider reporting real seconds would be `carrier`.
 */
export const DURATION_SOURCES = ['estimated', 'manual', 'carrier'] as const

const callSchema = new Schema(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    exec: { type: String, required: true, index: true },
    execLabel: { type: String, default: '' },
    phone: { type: String, default: '' },
    startedAt: { type: Date, required: true },
    // Null until the caller comes back and logs how it went.
    outcome: { type: String, enum: CALL_OUTCOMES, default: null },
    durationSec: { type: Number, default: 0, min: 0 },
    durationSource: { type: String, enum: DURATION_SOURCES, default: 'estimated' },
    notes: { type: String, default: '' },
    recordingUrl: { type: String, default: '' },
  },
  { timestamps: true },
)

callSchema.index({ propertyId: 1, exec: 1, startedAt: -1 })

export const Call = model('Call', callSchema)
