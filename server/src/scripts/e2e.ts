/**
 * End-to-end check of property isolation and the features built on it, against a real
 * MongoDB. Needs a local mongod; it wipes whatever database MONGODB_URI points at, so
 * point it at a scratch one:
 *
 *   MONGODB_URI="mongodb://127.0.0.1:27017/saratoga_e2e" npm run test:e2e -w server
 *
 * Kept out of `npm test`, which stays database-free.
 */
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { createApp } from '../app.js'
import { connectDb } from '../db.js'
import { User } from '../models/User.js'
import { Property } from '../models/Property.js'

const target = process.env.MONGODB_URI ?? ''
if (!/test|e2e|scratch/i.test(target)) {
  throw new Error(`Refusing to wipe "${target}". Point MONGODB_URI at a scratch database.`)
}

await connectDb()
const db = mongoose.connection.db!
for (const c of await db.collections()) await c.deleteMany({})

const [a, b] = await Property.create([
  { name: 'Villa A', invoicePrefix: 'VA' },
  { name: 'Villa B', invoicePrefix: 'VB' },
])
const hash = await bcrypt.hash('pass1234', 10)
await User.create([
  { username: 'admin', passwordHash: hash, name: 'Admin', role: 'admin', active: true, propertyId: null },
  { username: 'mgra', passwordHash: hash, name: 'Mgr A', role: 'manager', active: true, propertyId: a._id },
  { username: 'mgrb', passwordHash: hash, name: 'Mgr B', role: 'manager', active: true, propertyId: b._id },
  { username: 'orphan', passwordHash: hash, name: 'Orphan', role: 'manager', active: true, propertyId: null },
])

const server = createApp().listen(5199)
const base = 'http://127.0.0.1:5199/api'

// Responses are poked at loosely: this checks behaviour, not response types.
type Json = Record<string, any>

let pass = 0, fail = 0
function check(name: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  ok   ${name}`) }
  else { fail++; console.log(`  FAIL ${name} ${detail}`) }
}

async function login(username: string) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'pass1234' }),
  })
  return res.ok ? (await res.json()).token as string : ''
}

async function call(token: string, path: string, opts: { method?: string; body?: unknown; property?: string } = {}) {
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.property ? { 'x-property': opts.property } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  return { status: res.status, body: (await res.json().catch(() => null)) as Json }
}

const admin = await login('admin')
const mgrA = await login('mgra')
const mgrB = await login('mgrb')
const orphan = await login('orphan')
const A = String(a._id), B = String(b._id)

console.log('\n1. Writes land in the selected property')
const bookA = await call(admin, '/bookings', { property: A, body: { guest: 'Guest A', phone: '1', checkinDate: '2026-11-15', checkoutDate: '2026-11-16', breakdown: { venue: 27000 } } })
check('admin creates a booking in A', bookA.status === 201, JSON.stringify(bookA.body))
const bookB = await call(admin, '/bookings', { property: B, body: { guest: 'Guest B', phone: '2', checkinDate: '2026-11-15', checkoutDate: '2026-11-16', breakdown: { venue: 50000 } } })
check('same dates in B are not a conflict', bookB.status === 201, JSON.stringify(bookB.body))
const clash = await call(admin, '/bookings', { property: A, body: { guest: 'Clash', phone: '3', checkinDate: '2026-11-15', checkoutDate: '2026-11-16', breakdown: { venue: 1000 } } })
check('same dates inside A are a conflict', clash.status === 409, String(clash.status))
const noProp = await call(admin, '/bookings', { body: { guest: 'Nowhere', phone: '4', checkinDate: '2026-12-01', breakdown: { venue: 1000 } } })
check('writing with no property selected is refused', noProp.status === 400, String(noProp.status))

console.log('\n2. A manager sees only their own property')
const listA = await call(mgrA, '/bookings')
check('mgrA sees 1 booking', listA.body.rows?.length === 1 && listA.body.rows[0].guest === 'Guest A', JSON.stringify(listA.body.rows?.map((r: Json) => r.guest)))
const spoof = await call(mgrA, '/bookings', { property: B })
check('mgrA cannot widen scope with the header', spoof.body.rows?.length === 1 && spoof.body.rows[0].guest === 'Guest A', JSON.stringify(spoof.body.rows?.map((r: Json) => r.guest)))
const cross = await call(mgrA, `/bookings/${bookB.body.id}`)
check("mgrA gets 404 for B's booking", cross.status === 404, String(cross.status))
const bothAdmin = await call(admin, '/bookings')
check('admin with no property sees both', bothAdmin.body.rows?.length === 2, String(bothAdmin.body.rows?.length))
const orphanCall = await call(orphan, '/bookings')
check('a user with no property is refused', orphanCall.status === 403, String(orphanCall.status))

console.log('\n3. Search and calendar respect the scope')
const search = await call(mgrA, '/search?q=Guest')
check('mgrA search finds only their guest', search.body.bookings?.length === 1, JSON.stringify(search.body.bookings))
const calA = await call(mgrA, '/bookings/calendar?month=2026-11')
check('November calendar shows the booking', calA.body?.length === 1, JSON.stringify(calA.body))
const sameDay = await call(admin, '/bookings', { property: A, body: { guest: 'Same day', phone: '9', checkinDate: '2026-11-28', breakdown: { venue: 5000 } } })
const calA2 = await call(mgrA, '/bookings/calendar?month=2026-11')
check('a same-day booking (blank checkout) shows too', sameDay.status === 201 && calA2.body?.length === 2, JSON.stringify(calA2.body?.length))

console.log('\n4. Money stays inside the property')
await call(admin, `/bookings/${bookA.body.id}/payments`, { property: A, body: { date: '2026-11-01', amount: 20000, dest: 'HDFC' } })
await call(admin, `/bookings/${bookA.body.id}/payments`, { property: A, body: { date: '2026-11-05', amount: -5000, dest: 'HDFC', notes: 'Refund' } })
await call(admin, `/bookings/${bookB.body.id}/payments`, { property: B, body: { date: '2026-11-02', amount: 40000, dest: 'ICICI' } })
const accA = await call(admin, '/stats/accounts?month=2026-11', { property: A })
check('A collected 15,000 net of the refund', accA.body.total === 15000, JSON.stringify(accA.body.accounts))
check('A sees only its own account', accA.body.accounts?.length === 1 && accA.body.accounts[0].account === 'HDFC', JSON.stringify(accA.body.accounts))
const dashAdminA = await call(admin, '/stats/dashboard', { property: A })
check('admin dashboard for A counts only A', dashAdminA.body.totalBooked === 32000, String(dashAdminA.body.totalBooked))
const dashAdminAll = await call(admin, '/stats/dashboard')
check('admin dashboard with no property counts both', dashAdminAll.body.totalBooked === 82000, String(dashAdminAll.body.totalBooked))
const dashA = await call(mgrA, '/stats/dashboard')
check('manager gets no money figures at all', dashA.body.totalBooked === undefined && dashA.body.totalBookings === 2, JSON.stringify({ booked: dashA.body.totalBooked, count: dashA.body.totalBookings }))

console.log('\n5. Invoices')
const draft = await call(admin, `/bookings/${bookA.body.id}/invoice`, { property: A })
check('draft has no number yet', draft.body.invoiceNo === '', JSON.stringify(draft.body.invoiceNo))
check('GST is 18% split in two', draft.body.taxable === 27000 && draft.body.cgst === 2430 && draft.body.sgst === 2430, JSON.stringify({ t: draft.body.taxable, c: draft.body.cgst, s: draft.body.sgst }))
const issued = await call(admin, `/bookings/${bookA.body.id}/invoice`, { property: A, method: 'POST' })
check('issuing assigns VA/2026-27/001', issued.body.invoiceNo === 'VA/2026-27/001', String(issued.body.invoiceNo))
const reissued = await call(admin, `/bookings/${bookA.body.id}/invoice`, { property: A, method: 'POST' })
check('issuing again keeps the same number', reissued.body.invoiceNo === 'VA/2026-27/001', String(reissued.body.invoiceNo))
const issuedB = await call(admin, `/bookings/${bookB.body.id}/invoice`, { property: B, method: 'POST' })
check('B has its own series', issuedB.body.invoiceNo === 'VB/2026-27/001', String(issuedB.body.invoiceNo))

console.log('\n6. Investments')
await call(admin, '/investments', { property: A, body: { partner: 'Rahul', date: '2026-04-01', kind: 'Investment', amount: 500000 } })
await call(admin, '/investments', { property: A, body: { partner: 'Rahul', date: '2026-06-01', kind: 'Withdrawal', amount: 100000 } })
await call(admin, '/investments', { property: A, body: { partner: 'Akhil', date: '2026-05-01', kind: 'Investment', amount: 200000 } })
await call(admin, '/investments', { property: B, body: { partner: 'Someone else', date: '2026-05-01', kind: 'Investment', amount: 900000 } })
const invA = await call(admin, '/investments', { property: A })
check('A has two partners, B is not mixed in', invA.body.partners?.length === 2, JSON.stringify(invA.body.partners?.map((p: Json) => p.partner)))
check('net and share are right', invA.body.partners?.[0]?.net === 400000 && invA.body.partners?.[0]?.share === 66.7, JSON.stringify(invA.body.partners?.[0]))

console.log('\n7. Incentives need one property')
const incAll = await call(admin, '/stats/incentives?month=all')
check('incentives refuse an all-properties view', incAll.status === 400, String(incAll.status))
const incA = await call(admin, '/stats/incentives?month=all', { property: A })
check('incentives work for one property', incA.status === 200, String(incA.status))

console.log('\n8. Expense mapped to a booking')
const exp = await call(admin, '/expenses', { property: A, body: { date: '2026-11-16', cat: 'Catering', desc: 'Dinner', amount: 9000, bookingId: bookA.body.id } })
check('expense maps to a booking in the same property', exp.status === 201, JSON.stringify(exp.body))
const badExp = await call(admin, '/expenses', { property: A, body: { date: '2026-11-16', cat: 'Catering', desc: 'Cross', amount: 100, bookingId: bookB.body.id } })
check("cannot map to another property's booking", badExp.status === 400, String(badExp.status))
const expList = await call(admin, '/expenses', { property: A })
check('expense row names the booking', expList.body.rows?.[0]?.bookingLabel?.includes('Guest A'), JSON.stringify(expList.body.rows?.[0]?.bookingLabel))

console.log('\n9. Expense categories')
const cats = await call(admin, '/expense-categories')
check('defaults are seeded on first read', cats.body.some((c: Json) => c.name === 'Catering'), String(cats.body?.length))
const catering = cats.body.find((c: Json) => c.name === 'Catering')
check('usage count reflects the expense filed earlier', catering?.inUse === 1, JSON.stringify(catering))
const added = await call(admin, '/expense-categories', { body: { name: 'Gardening' } })
check('a category can be added', added.status === 201, String(added.status))
const dupe = await call(admin, '/expense-categories', { body: { name: 'Gardening' } })
check('duplicates are refused', dupe.status === 409, String(dupe.status))
const renamed = await call(admin, `/expense-categories/${catering.id}`, { method: 'PATCH', body: { name: 'Food & Catering' } })
check('renaming works', renamed.status === 200 && renamed.body.name === 'Food & Catering', JSON.stringify(renamed.body))
const movedExpense = await call(admin, '/expenses', { property: A })
check('the rename carried the existing expense across', movedExpense.body.rows?.[0]?.cat === 'Food & Catering', JSON.stringify(movedExpense.body.rows?.[0]?.cat))
const delUsed = await call(admin, `/expense-categories/${catering.id}`, { method: 'DELETE' })
check('a category in use cannot be deleted', delUsed.status === 409, String(delUsed.status))
const delFree = await call(admin, `/expense-categories/${added.body.id}`, { method: 'DELETE' })
check('an unused category can be deleted', delFree.status === 200, String(delFree.status))
const badCat = await call(admin, '/expenses', { property: A, body: { date: '2026-11-17', cat: 'Nonsense', desc: 'x', amount: 10 } })
check('an unknown category is refused', badCat.status === 400, String(badCat.status))

console.log('\n10. Visitors')
await call(admin, '/visitors', { property: A, body: { date: '2026-11-10', name: 'Courier', phone: '1', type: 'Delivery', purpose: 'Amazon' } })
await call(admin, '/visitors', { property: A, body: { date: '2026-11-11', name: 'Guest', phone: '2', type: 'Guest', purpose: 'Site tour' } })
const vAll = await call(mgrA, '/visitors')
check('both visitors listed', vAll.body.rows?.length === 2, String(vAll.body.rows?.length))
const vDel = await call(mgrA, '/visitors?type=Delivery')
check('type filter works on the stored field', vDel.body.rows?.length === 1 && vDel.body.rows[0].name === 'Courier', JSON.stringify(vDel.body.rows?.map((r: Json) => r.name)))

console.log(`\n${pass} passed, ${fail} failed`)
server.close()
await mongoose.disconnect()
process.exit(fail ? 1 : 0)
