import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { migrateEventTypes } from '../services/migrations.js'

/**
 * Moves bookings and leads onto the shared event-type list. The old value is kept on
 * each record, so the call made for "Party" can be revisited. Safe to re-run — it only
 * touches records still carrying a value from the old lists.
 *
 * The same work is available to an admin in the app, on the Properties page.
 */
await connectDb()
const counts = await migrateEventTypes()
if (!Object.keys(counts).length) console.log('nothing to change')
for (const [move, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`${String(n).padStart(4)}  ${move}`)
}

await mongoose.disconnect()
console.log('migration complete')
