import { writeFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { Booking } from '../models/Booking.js'
import { Lead } from '../models/Lead.js'
import { EVENT_TYPES, LEGACY_EVENT_TYPES } from '../models/eventTypes.js'

/**
 * Moves bookings and leads onto the shared event-type list.
 *
 * Writes every old value to a file before changing anything: 97 bookings were recorded
 * as "Party", which covered birthdays, kitty parties and corporate alike, and nothing
 * else on those records says which. They become "Other" rather than being assigned a
 * type nobody can stand behind — and the backup means that call can be revisited.
 */
await connectDb()

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const backupPath = `event-types-before-${stamp}.json`

const [bookings, leads] = await Promise.all([
  Booking.find().select('purpose').lean(),
  Lead.find().select('eventType').lean(),
])

writeFileSync(backupPath, JSON.stringify({
  takenAt: new Date().toISOString(),
  bookings: bookings.map((b) => ({ id: String(b._id), purpose: b.purpose })),
  leads: leads.map((l) => ({ id: String(l._id), eventType: l.eventType })),
}, null, 2))
console.log(`backup written: ${backupPath} (${bookings.length} bookings, ${leads.length} leads)`)

const known = new Set<string>(EVENT_TYPES)

async function migrate(label: string, rows: { _id: unknown; value: string }[], apply: (id: unknown, to: string) => Promise<unknown>) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const from = row.value ?? ''
    if (known.has(from)) continue
    const to = LEGACY_EVENT_TYPES[from] ?? 'Other'
    await apply(row._id, to)
    counts.set(`${from || '(blank)'} → ${to}`, (counts.get(`${from || '(blank)'} → ${to}`) ?? 0) + 1)
  }
  console.log(`\n${label}:`)
  if (!counts.size) console.log('  nothing to change')
  for (const [move, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${move}`)
}

await migrate(
  'bookings',
  bookings.map((b) => ({ _id: b._id, value: b.purpose as string })),
  (id, to) => Booking.updateOne({ _id: id }, { $set: { purpose: to } }),
)
await migrate(
  'leads',
  leads.map((l) => ({ _id: l._id, value: l.eventType as string })),
  (id, to) => Lead.updateOne({ _id: id }, { $set: { eventType: to } }),
)

await mongoose.disconnect()
console.log('\nmigration complete')
