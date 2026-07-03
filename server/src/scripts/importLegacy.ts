import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { env } from '../env.js'
import { prepareRows, commitRows, type ImportType } from '../services/importEngine.js'

const url = env.LEGACY_SHEET_URL
if (!url) throw new Error('LEGACY_SHEET_URL not set')

await connectDb()

for (const type of ['bookings', 'payments', 'expenses', 'visitors'] as ImportType[]) {
  const res = await fetch(`${url}?type=${type}`)
  const json = (await res.json()) as { ok: boolean; rows?: Record<string, unknown>[]; error?: string }
  if (!json.ok) {
    console.error(`${type}: pull failed — ${json.error ?? 'unknown error'}`)
    continue
  }
  const rows = json.rows ?? []
  const prepared = await prepareRows(type, rows)
  const invalidRows = prepared.filter((r) => !r.valid)
  for (const r of invalidRows.slice(0, 5)) console.warn(`${type} row ${r.index}: ${r.errors.join('; ')}`)
  const result = await commitRows(type, prepared, 'update', 'legacy-import')
  console.log(`${type}: pulled ${rows.length} → inserted ${result.inserted}, updated ${result.updated}, skipped ${result.skipped}, invalid ${result.invalid}`)
}

await mongoose.disconnect()
