import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { backfillVisitorTypes } from '../services/migrations.js'

/**
 * Visitor type used to be inferred from the free-text purpose. This reads that text
 * once and stores a real type, so the filter stops guessing. Safe to re-run.
 */
await connectDb()
const counts = await backfillVisitorTypes()
for (const [type, n] of Object.entries(counts)) console.log(`${type}: ${n}`)

await mongoose.disconnect()
console.log('backfill complete')
