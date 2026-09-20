import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { stampExistingRecords } from '../services/migrations.js'

/**
 * One-off: everything that existed before properties belongs to the original villa.
 * Safe to re-run — it only touches rows that have no property yet. The same work is
 * available to an admin in the app, on the Properties page.
 */
await connectDb()
const { property, counts } = await stampExistingRecords()
console.log(`default property: ${property.name} (${property.id})`)
for (const [label, n] of Object.entries(counts)) console.log(`${label}: ${n}`)

await mongoose.disconnect()
console.log('migration complete')
