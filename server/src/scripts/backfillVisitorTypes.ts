import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { Visitor, VISITOR_TYPES } from '../models/Visitor.js'

/**
 * Visitor type used to be inferred from the free-text purpose. This reads that text
 * once and stores a real type, so the filter stops guessing. Safe to re-run.
 */
await connectDb()

const visitors = await Visitor.find({ $or: [{ type: { $exists: false } }, { type: null }] })
console.log(`${visitors.length} visitors without a type`)

const counts = new Map<string, number>()
for (const v of visitors) {
  const purpose = (v.purpose ?? '').toLowerCase()
  const match = VISITOR_TYPES.find((t) => t !== 'Other' && purpose.includes(t.toLowerCase()))
  const type = match ?? (purpose ? 'Other' : 'Guest')
  await Visitor.updateOne({ _id: v._id }, { $set: { type } })
  counts.set(type, (counts.get(type) ?? 0) + 1)
}
for (const [type, n] of counts) console.log(`  ${type}: ${n}`)

await mongoose.disconnect()
console.log('backfill complete')
