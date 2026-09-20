import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { backfillVisitorTypes } from '../services/migrations.js'

/**
 * Visitor type used to be inferred from the free-text purpose. This reads that text
 * once and stores a real type, so the filter stops guessing. Safe to re-run.
 */
// Pass --redo-other to also re-read visitors an earlier pass dumped into Other.
await connectDb()
const counts = await backfillVisitorTypes({ redoOther: process.argv.includes('--redo-other') })
for (const [type, n] of Object.entries(counts)) console.log(`${type}: ${n}`)

await mongoose.disconnect()
console.log('backfill complete')
