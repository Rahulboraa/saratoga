import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { connectDb } from '../db.js'
import { Booking } from '../models/Booking.js'
import { Payment } from '../models/Payment.js'
import { Expense } from '../models/Expense.js'
import { ExpensePayment } from '../models/ExpensePayment.js'

const FILE = process.argv[2]
const DRY = process.env.DRY_RUN === '1'
if (!FILE) throw new Error('usage: tsx importClientXlsx.ts <file.xlsx>')

const s2d = (n: number) => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10)
const f2t = (f: number) => {
  const m = Math.round(f * 24 * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const num = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v)) || 0)
const str = (v: unknown) => String(v ?? '').trim()

const wb = XLSX.read(readFileSync(FILE))
const rows = (n: string) =>
  (XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }) as unknown[][])
    .slice(1)
    .filter((r) => r.some((c) => c !== ''))

const PURPOSES = new Set(['Party', 'Shoot', 'Pre-wedding', 'Kids Birthday', 'Other'])
const SOURCES = new Set(['Airbnb', 'Direct', 'Referral'])

const bookings = rows('Bookings').map((r) => {
  const venue = num(r[9]), catering = num(r[10]), decor = num(r[11]), music = num(r[12]), cleaning = num(r[13])
  const amount = num(r[14])
  const sum = venue + catering + decor + music + cleaning
  const breakdown = {
    venue: sum === 0 && amount > 0 ? amount : sum !== amount ? Math.max(venue + amount - sum, 0) : venue,
    catering, decor, music, cleaning,
    license: num(r[15]), security: num(r[16]),
  }
  return {
    legacyId: `bk-${r[0]}`,
    guest: str(r[1]) || 'Unknown',
    phone: str(r[2]),
    checkinDate: s2d(num(r[3])),
    checkoutDate: r[4] ? s2d(num(r[4])) : '',
    ...(typeof r[5] === 'number' ? { checkinTime: f2t(r[5]) } : {}),
    ...(typeof r[6] === 'number' ? { checkoutTime: f2t(r[6]) } : {}),
    pax: str(r[8]),
    purpose: PURPOSES.has(str(r[7])) ? str(r[7]) : 'Other',
    source: SOURCES.has(str(r[17])) ? str(r[17]) : '',
    dest: str(r[18]),
    notes: str(r[19]),
    breakdown,
    _sheetAmount: amount,
  }
})

const payRows = rows('Payments').map((r) => ({
  legacyId: `pay-${r[0]}`,
  bookingLegacy: `bk-${r[1]}`,
  bookingNum: num(r[1]),
  guest: str(r[2]),
  date: s2d(num(r[3])),
  amount: num(r[4]),
  method: { cash: 'Cash', upi: 'UPI' }[str(r[5]).toLowerCase()] ?? str(r[5]),
  dest: str(r[6]),
  notes: str(r[7]),
  by: str(r[8]),
}))

const expRows = rows('Expenses').map((r) => ({
  legacyId: `exp-${r[0]}`,
  date: s2d(num(r[1])),
  cat: str(r[2]),
  desc: str(r[3]) || 'Imported',
  amount: num(r[4]),
  vendor: str(r[5]),
  by: str(r[6]),
  notes: str(r[7]),
}))

const bkIds = new Set(bookings.map((b) => b.legacyId))
const orphans = payRows.filter((p) => !bkIds.has(p.bookingLegacy))
for (const p of orphans) {
  bookings.push({
    legacyId: `${p.bookingLegacy}-stub`,
    guest: p.by || p.guest || 'Unknown',
    phone: '',
    checkinDate: p.date,
    checkoutDate: '',
    pax: '',
    purpose: 'Other',
    source: '',
    dest: p.dest,
    notes: `Imported: booking was deleted in sheet, payment retained. ${p.notes}`.trim(),
    breakdown: { venue: p.amount, catering: 0, decor: 0, music: 0, cleaning: 0, license: 0, security: 0 },
    _sheetAmount: p.amount,
  })
  p.bookingLegacy = `${p.bookingLegacy}-stub`
}

const bookedTotal = bookings.reduce((s, b) => s + b.breakdown.venue + b.breakdown.catering + b.breakdown.decor + b.breakdown.music + b.breakdown.cleaning, 0)
const sheetBooked = bookings.reduce((s, b) => s + b._sheetAmount, 0)
console.log(`bookings: ${bookings.length} (incl ${orphans.length} stubs) | computed booked ₹${bookedTotal} vs sheet ₹${sheetBooked}`)
console.log(`payments: ${payRows.length} | total ₹${payRows.reduce((s, p) => s + p.amount, 0)}`)
console.log(`expenses: ${expRows.length} | total ₹${expRows.reduce((s, e) => s + e.amount, 0)}`)
const amountMismatch = bookings.filter((b) => b.breakdown.venue + b.breakdown.catering + b.breakdown.decor + b.breakdown.music + b.breakdown.cleaning !== b._sheetAmount)
console.log(`amount mismatches after adjust: ${amountMismatch.length}`)

if (DRY) {
  console.log('DRY RUN — nothing written')
  process.exit(0)
}

await connectDb()

let n = 0
for (const { _sheetAmount, ...b } of bookings) {
  void _sheetAmount
  const doc = await Booking.findOne({ legacyId: b.legacyId })
  if (doc) { doc.set(b); await doc.save() } else { await Booking.create(b as Parameters<typeof Booking.create>[0]) }
  n++
}
console.log('bookings upserted:', n)

const map = new Map<string, string>()
for (const b of await Booking.find({ legacyId: { $regex: '^bk-' } }, { legacyId: 1 })) map.set(b.legacyId!, b.id)

n = 0
for (const p of payRows) {
  const bookingId = map.get(p.bookingLegacy)
  if (!bookingId) { console.log('SKIP payment, no booking:', p.legacyId); continue }
  await Payment.updateOne(
    { legacyId: p.legacyId },
    { $set: { bookingId, date: p.date, amount: p.amount, method: p.method, dest: p.dest, by: p.by, notes: p.notes } },
    { upsert: true },
  )
  n++
}
console.log('payments upserted:', n)

n = 0
for (const e of expRows) {
  const doc = await Expense.findOneAndUpdate({ legacyId: e.legacyId }, { $set: e }, { upsert: true, new: true })
  await ExpensePayment.updateOne(
    { legacyId: `${e.legacyId}-paid` },
    { $set: { expenseId: doc._id, date: e.date, amount: e.amount, method: '', to: e.vendor, by: e.by, notes: 'Imported: assumed settled (legacy sheet has no payment records)' } },
    { upsert: true },
  )
  n++
}
console.log('expenses upserted (marked paid):', n)
process.exit(0)
