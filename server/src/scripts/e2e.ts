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
import { Booking } from '../models/Booking.js'

const target = process.env.MONGODB_URI ?? ''
if (!/test|e2e|scratch/i.test(target)) {
  throw new Error(`Refusing to wipe "${target}". Point MONGODB_URI at a scratch database.`)
}

await connectDb()
const db = mongoose.connection.db!
for (const c of await db.collections()) await c.deleteMany({})

const [a, b] = await Property.create([
  // A is registered and raises tax invoices; B is not, which is what 5d turns on.
  { name: 'Villa A', invoicePrefix: 'VA', gstin: '09AAACH7409R1ZZ' },
  { name: 'Villa B', invoicePrefix: 'VB' },
])
const hash = await bcrypt.hash('pass1234', 10)
await User.create([
  { username: 'admin', passwordHash: hash, name: 'Admin', role: 'admin', active: true, propertyId: null },
  { username: 'mgra', passwordHash: hash, name: 'Mgr A', role: 'manager', active: true, propertyId: a._id },
  { username: 'mgrb', passwordHash: hash, name: 'Mgr B', role: 'manager', active: true, propertyId: b._id },
  { username: 'orphan', passwordHash: hash, name: 'Orphan', role: 'manager', active: true, propertyId: null },
  { username: 'salesa', passwordHash: hash, name: 'Sales A', role: 'sales', active: true, propertyId: a._id },
  { username: 'salesb', passwordHash: hash, name: 'Sales B', role: 'sales', active: true, propertyId: b._id },
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

console.log('\n3b. The booking list sorts by event date or by when it was booked')
// A booking taken late for an early date is the case the two sorts disagree on, and the
// only one that proves the booked-on sort is reading its own field.
// Straight through the driver: mongoose strips createdAt out of an update, timestamps
// option or not, so the planted date would silently never land.
await db.collection('bookings').updateOne(
  { _id: new mongoose.Types.ObjectId(String(sameDay.body.id)) },
  { $set: { createdAt: new Date('2026-01-01') } },
)
const byEvent = await call(admin, '/bookings?month=2026-11&sort=checkinDate&dir=asc', { property: A })
const eventOrder = byEvent.body.rows?.map((r: { checkinDate: string }) => r.checkinDate)
check('event date ascending runs 15th then 28th', String(eventOrder) === '2026-11-15,2026-11-28', JSON.stringify(eventOrder))
const byBooked = await call(admin, '/bookings?month=2026-11&sort=createdAt&dir=asc', { property: A })
const bookedOrder = byBooked.body.rows?.map((r: { checkinDate: string }) => r.checkinDate)
check('booked-on ascending puts the long-booked 28th first', String(bookedOrder) === '2026-11-28,2026-11-15', JSON.stringify(bookedOrder))
const byBookedDesc = await call(admin, '/bookings?month=2026-11&sort=createdAt&dir=desc', { property: A })
const descOrder = byBookedDesc.body.rows?.map((r: { checkinDate: string }) => r.checkinDate)
check('and descending flips it back', String(descOrder) === '2026-11-15,2026-11-28', JSON.stringify(descOrder))
const badSort = await call(admin, '/bookings?month=2026-11&sort=amount&dir=desc', { property: A })
check('an unknown sort falls back to the event date rather than erroring', badSort.status === 200 && badSort.body.rows?.length === 2, String(badSort.status))

console.log('\n3c. A project split into two villas')
await Property.updateOne({ _id: b._id }, { units: ['Villa 1', 'Villa 2'] })
const v1 = await call(admin, '/bookings', { property: B, body: { guest: 'Villa 1 guest', phone: '81', checkinDate: '2027-02-14', checkoutDate: '2027-02-15', units: ['Villa 1'], breakdown: { venue: 50000 } } })
check('one villa can be booked', v1.status === 201, JSON.stringify(v1.body))
const v2 = await call(admin, '/bookings', { property: B, body: { guest: 'Villa 2 guest', phone: '82', checkinDate: '2027-02-14', checkoutDate: '2027-02-15', units: ['Villa 2'], breakdown: { venue: 50000 } } })
check('the other villa sells the same night to someone else', v2.status === 201, JSON.stringify(v2.body))
const sameVilla = await call(admin, '/bookings', { property: B, body: { guest: 'Villa 1 again', phone: '83', checkinDate: '2027-02-14', checkoutDate: '2027-02-15', units: ['Villa 1'], breakdown: { venue: 50000 } } })
check('but the same villa cannot be sold twice', sameVilla.status === 409, String(sameVilla.status))
const whole = await call(admin, '/bookings', { property: B, body: { guest: 'Whole place', phone: '84', checkinDate: '2027-02-14', checkoutDate: '2027-02-15', units: [], breakdown: { venue: 90000 } } })
check('and the whole place is refused while either villa is taken', whole.status === 409, String(whole.status))

const freeNight = await call(admin, '/bookings', { property: B, body: { guest: 'Whole place', phone: '84', checkinDate: '2027-03-10', checkoutDate: '2027-03-11', units: [], breakdown: { venue: 90000 } } })
check('the whole place books on a free night', freeNight.status === 201, JSON.stringify(freeNight.body))
const underWhole = await call(admin, '/bookings', { property: B, body: { guest: 'Squeeze in', phone: '85', checkinDate: '2027-03-10', checkoutDate: '2027-03-11', units: ['Villa 1'], breakdown: { venue: 40000 } } })
check('and then no single villa can be sold under it', underWhole.status === 409, String(underWhole.status))

const typo = await call(admin, '/bookings', { property: B, body: { guest: 'Typo', phone: '86', checkinDate: '2027-04-01', units: ['Villa 3'], breakdown: { venue: 10000 } } })
check('a villa the project does not have is refused', typo.status === 400, JSON.stringify(typo.body))
const notSplit = await call(admin, '/bookings', { property: A, body: { guest: 'Wrong project', phone: '87', checkinDate: '2027-04-01', units: ['Villa 1'], breakdown: { venue: 10000 } } })
check('and so is naming a villa at a project that is not split', notSplit.status === 400, JSON.stringify(notSplit.body))

const moved = await call(admin, `/bookings/${v1.body.id}`, { property: B, method: 'PATCH', body: { checkinDate: '2027-02-20', checkoutDate: '2027-02-21' } })
check('moving one villa\'s dates does not collide with the other', moved.status === 200, JSON.stringify(moved.body))

// These were only ever about who can book what. Leaving them in would move every money
// figure the later sections check.
for (const id of [v1.body.id, v2.body.id, freeNight.body.id]) {
  await call(admin, `/bookings/${id}`, { property: B, method: 'DELETE' })
}
await Property.updateOne({ _id: b._id }, { units: [] })

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
// This booking was paid in the previous section, so it is already a numbered invoice.
const issued = await call(admin, `/bookings/${bookA.body.id}/invoice`, { property: A })
check('a paid booking is already a tax invoice', issued.body.kind === 'Tax Invoice' && issued.body.invoiceNo === 'VA/2026-27/001', JSON.stringify({ k: issued.body.kind, n: issued.body.invoiceNo }))
check('GST is 18% split in two', issued.body.taxable === 27000 && issued.body.cgst === 2430 && issued.body.sgst === 2430, JSON.stringify({ t: issued.body.taxable, c: issued.body.cgst, s: issued.body.sgst }))
const reissued = await call(admin, `/bookings/${bookA.body.id}/invoice`, { property: A, method: 'POST' })
check('issuing again keeps the same number', reissued.body.invoiceNo === 'VA/2026-27/001', String(reissued.body.invoiceNo))
const issuedB = await call(admin, `/bookings/${bookB.body.id}/invoice`, { property: B, method: 'POST' })
check('B has its own series', issuedB.body.invoiceNo === 'VB/2026-27/001', String(issuedB.body.invoiceNo))

console.log('\n5c. Billing details and invoice branding')
check('an invoice bills the guest when no company is given', issued.body.booking.billingName === 'Guest A', String(issued.body.booking.billingName))
check('the villa name is used until a legal name is set', issued.body.property.name === 'Villa A', String(issued.body.property.name))

const b2b = await call(admin, '/bookings', {
  property: A,
  body: {
    guest: 'Ravi', phone: '98', checkinDate: '2026-12-10', breakdown: { venue: 10000 },
    billingName: 'Acme Pvt Ltd', billingGstin: '09aaach7409r1zz', billingAddress: 'Plot 4\nNoida',
  },
})
await Property.updateOne({ _id: a._id }, {
  legalName: 'Saratõga INC', invoiceHeader: 'care@saratoga.in', invoiceFooter: 'Bank: HDFC\nA/c 123',
})
const b2bInv = await call(admin, `/bookings/${b2b.body.id}/invoice`, { property: A })
check('the company is billed, not the guest', b2bInv.body.booking.billingName === 'Acme Pvt Ltd', String(b2bInv.body.booking.billingName))
check("the guest's GSTIN is upper-cased", b2bInv.body.booking.billingGstin === '09AAACH7409R1ZZ', String(b2bInv.body.booking.billingGstin))
check('the billing address carries its line breaks', b2bInv.body.booking.billingAddress === 'Plot 4\nNoida', JSON.stringify(b2bInv.body.booking.billingAddress))
check('the legal name replaces the villa name', b2bInv.body.property.name === 'Saratõga INC', String(b2bInv.body.property.name))
check('header and footer reach the invoice', b2bInv.body.property.header === 'care@saratoga.in' && b2bInv.body.property.footer === 'Bank: HDFC\nA/c 123', JSON.stringify({ h: b2bInv.body.property.header, f: b2bInv.body.property.footer }))
const b2bEdit = await call(admin, `/bookings/${b2b.body.id}`, { property: A })
check('billing details come back when editing', b2bEdit.body.billingName === 'Acme Pvt Ltd' && b2bEdit.body.billingGstin === '09AAACH7409R1ZZ', JSON.stringify({ n: b2bEdit.body.billingName, g: b2bEdit.body.billingGstin }))

console.log('\n5d. GST follows the project, and the toggle overrides it')
// B has no GSTIN, so its bookings start untaxed rather than charging tax nobody can remit.
const unregBooking = await call(admin, '/bookings', { property: B, body: { guest: 'Unreg', phone: '97', checkinDate: '2026-12-20', breakdown: { venue: 20000 } } })
const unregInv = await call(admin, `/bookings/${unregBooking.body.id}/invoice`, { property: B })
check('an unregistered project bills without GST by default', unregInv.body.gstEnabled === false && unregInv.body.cgst === 0, JSON.stringify({ g: unregInv.body.gstEnabled, c: unregInv.body.cgst }))
check('and the document is not called a tax invoice', unregInv.body.kind !== 'Tax Invoice', String(unregInv.body.kind))

const forcedOn = await call(admin, `/bookings/${unregBooking.body.id}/invoice`, { property: B, method: 'PATCH', body: { gstEnabled: true } })
check('but it can still be switched on by hand', forcedOn.body.gstEnabled === true && forcedOn.body.cgst === 1800, JSON.stringify({ g: forcedOn.body.gstEnabled, c: forcedOn.body.cgst }))
const forcedOff = await call(admin, `/bookings/${unregBooking.body.id}/invoice`, { property: B, method: 'PATCH', body: { gstEnabled: false } })
check('and off again', forcedOff.body.gstEnabled === false && forcedOff.body.total === 20000, JSON.stringify({ g: forcedOff.body.gstEnabled, t: forcedOff.body.total }))

// A is registered, so its bookings are taxed from the start.
const regBooking = await call(admin, '/bookings', { property: A, body: { guest: 'Reg', phone: '96', checkinDate: '2026-12-21', breakdown: { venue: 20000 } } })
const regInv = await call(admin, `/bookings/${regBooking.body.id}/invoice`, { property: A })
check('a registered project charges GST by default', regInv.body.gstEnabled === true && regInv.body.cgst === 1800, JSON.stringify({ g: regInv.body.gstEnabled, c: regInv.body.cgst }))

console.log('\n5a. The security deposit stays out of the money')
const depBooking = await call(admin, '/bookings', { property: A, body: { guest: 'Deposit', phone: '8', checkinDate: '2026-12-28', breakdown: { venue: 40000, security: 10000 } } })
const depRow = await call(admin, `/bookings/${depBooking.body.id}`, { property: A })
check('the booking is worth the rent, not rent plus deposit', depRow.body.due === 40000, String(depRow.body.due))
await call(admin, `/bookings/${depBooking.body.id}/payments`, { property: A, body: { date: '2026-12-01', amount: 40000, dest: 'HDFC' } })
const depPaid = await call(admin, `/bookings/${depBooking.body.id}`, { property: A })
check('paying the rent settles it', depPaid.body.due === 0 && depPaid.body.status === 'paid', JSON.stringify({ due: depPaid.body.due, s: depPaid.body.status }))
const depInv = await call(admin, `/bookings/${depBooking.body.id}/invoice`, { property: A })
check('the invoice lists the deposit but does not add it in', depInv.body.security === 10000 && depInv.body.total === 40000 + 7200, JSON.stringify({ sec: depInv.body.security, total: depInv.body.total }))

console.log('\n5b. Proforma becomes an invoice when money arrives')
const quoteBooking = await call(admin, '/bookings', { property: A, body: { guest: 'Quote only', phone: '7', checkinDate: '2026-12-20', breakdown: { venue: 10000 } } })
const quote = await call(admin, `/bookings/${quoteBooking.body.id}/invoice`, { property: A })
check('an unpaid booking is a proforma', quote.body.kind === 'Proforma Invoice' && quote.body.invoiceNo === '', JSON.stringify(quote.body.kind))
const gstOff = await call(admin, `/bookings/${quoteBooking.body.id}/invoice`, { property: A, method: 'PATCH', body: { gstEnabled: false } })
check('GST can be switched off', gstOff.body.gstEnabled === false && gstOff.body.cgst === 0 && gstOff.body.total === 10000, JSON.stringify({ g: gstOff.body.gstEnabled, t: gstOff.body.total }))
const gstOn = await call(admin, `/bookings/${quoteBooking.body.id}/invoice`, { property: A, method: 'PATCH', body: { gstEnabled: true } })
check('and back on', gstOn.body.gstEnabled === true && gstOn.body.total === 11800, JSON.stringify(gstOn.body.total))
await call(admin, `/bookings/${quoteBooking.body.id}/payments`, { property: A, body: { date: '2026-12-01', amount: 5000, dest: 'HDFC' } })
const afterPay = await call(admin, `/bookings/${quoteBooking.body.id}/invoice`, { property: A })
check('a payment turns it into a tax invoice', afterPay.body.kind === 'Tax Invoice' && !!afterPay.body.invoiceNo, JSON.stringify({ k: afterPay.body.kind, n: afterPay.body.invoiceNo }))
await call(admin, `/bookings/${quoteBooking.body.id}/payments`, { property: A, body: { date: '2026-12-02', amount: 1000, dest: 'HDFC' } })
const afterSecond = await call(admin, `/bookings/${quoteBooking.body.id}/invoice`, { property: A })
check('a second payment does not take another number', afterSecond.body.invoiceNo === afterPay.body.invoiceNo, String(afterSecond.body.invoiceNo))
check('terms come through for printing', Array.isArray(afterPay.body.property.terms) && afterPay.body.property.terms.length > 0, String(afterPay.body.property.terms?.length))

console.log('\n5c. WhatsApp confirmation')
await call(admin, `/properties/${A}`, { method: 'PATCH', body: {
  inclusions: 'glasshouse table and chairs\n15kva generator',
  exclusions: 'decor\nbar tender',
  confirmationNotes: '20% to be cleared 1 week prior.',
} })
const conf = await call(admin, `/bookings/${bookA.body.id}/confirmation`, { property: A })
check('confirmation is built from the booking', conf.status === 200 && conf.body.text.includes('Guest A'), String(conf.status))
check('it carries the rent recorded on the booking', conf.body.text.includes('Rent : ₹27,000'), JSON.stringify(conf.body.text?.slice(0, 80)))
check("it carries the property's inclusions and notes", conf.body.text.includes('15kva generator') && conf.body.text.includes('20% to be cleared'), 'missing property text')
check('it returns the number to send to', conf.body.phone === '1', String(conf.body.phone))
const confB = await call(mgrA, `/bookings/${bookB.body.id}/confirmation`)
check("a manager cannot pull another property's confirmation", confB.status === 404, String(confB.status))

console.log('\n6. Investments')
await call(admin, '/investments', { property: A, body: { partner: 'Rahul', date: '2026-04-01', kind: 'Investment', amount: 500000 } })
await call(admin, '/investments', { property: A, body: { partner: 'Rahul', date: '2026-06-01', kind: 'Withdrawal', amount: 100000 } })
await call(admin, '/investments', { property: A, body: { partner: 'Akhil', date: '2026-05-01', kind: 'Investment', amount: 200000 } })
await call(admin, '/investments', { property: B, body: { partner: 'Someone else', date: '2026-05-01', kind: 'Investment', amount: 900000 } })
const invA = await call(admin, '/investments', { property: A })
check('A has two partners, B is not mixed in', invA.body.partners?.length === 2, JSON.stringify(invA.body.partners?.map((p: Json) => p.partner)))
check('net and share are right', invA.body.partners?.[0]?.net === 400000 && invA.body.partners?.[0]?.share === 66.7, JSON.stringify(invA.body.partners?.[0]))

console.log('\n6b. An investment entry can be corrected')
const entry = await call(admin, '/investments', { property: A, body: { partner: 'Typo', date: '2026-07-01', kind: 'Investment', amount: 111, mode: 'Csh' } })
const fixed = await call(admin, `/investments/${entry.body.id}`, { method: 'PATCH', body: { partner: 'Rahul', amount: 50000, mode: 'Cash', kind: 'Withdrawal' } })
check('partner, amount, mode and type can all be corrected', fixed.status === 200
  && fixed.body.partner === 'Rahul' && fixed.body.amount === 50000
  && fixed.body.mode === 'Cash' && fixed.body.kind === 'Withdrawal', JSON.stringify(fixed.body))
const afterEdit = await call(admin, '/investments', { property: A })
const rahul = afterEdit.body.partners?.find((p: Json) => p.partner === 'Rahul')
check('the corrected figure lands in the ledger', rahul && rahul.withdrawn === 150000, JSON.stringify(rahul))
check('the mistyped partner is gone from the ledger', !afterEdit.body.partners?.some((p: Json) => p.partner === 'Typo'), 'Typo still listed')
const crossEdit = await call(mgrA, `/investments/${entry.body.id}`, { method: 'PATCH', body: { amount: 1 } })
check('a manager cannot touch investments at all', crossEdit.status === 403, String(crossEdit.status))

console.log('\n6bb. Who a lead can be assigned to')
// mgrA manages property A; sales users belong to one property each.
const execsA = await call(admin, '/users/execs', { property: A })
const namesA = (execsA.body as Json[]).map((u: Json) => u.username)
check('managers are not offered as sales people', !namesA.includes('mgra') && !namesA.includes('mgrb'), JSON.stringify(namesA))
check("another property's people are not offered", !namesA.includes('salesb'), JSON.stringify(namesA))

console.log('\n6c. Unassigned leads')
for (let i = 0; i < 30; i++) {
  await call(admin, '/leads', { property: A, body: { date: '2026-10-01', name: `Lead ${i}`, phone: `90000000${String(i).padStart(2, '0')}`, exec: '' } })
}
const un = await call(admin, '/leads/unassigned', { property: A })
check('the batch is 25, not 10', un.body.rows?.length === 25, String(un.body.rows?.length))
check('the real total comes with it', un.body.total === 30, String(un.body.total))
await call(admin, '/leads/assign', { property: A, body: { ids: un.body.rows.map((l: Json) => l.id), exec: 'mgra' } })
const after = await call(admin, '/leads/unassigned', { property: A })
check('assigning a batch drops the total, so progress shows', after.body.total === 5, String(after.body.total))
check('and refills with what is left', after.body.rows?.length === 5, String(after.body.rows?.length))

console.log('\n6e. The date a customer wants')
const oct23 = await call(admin, '/leads', { property: A, body: { date: '2026-09-01', name: 'Wants 23 Oct', phone: '9301', exec: 'mgra', wantedFrom: '2026-10-23' } })
check('a single date is stored as a one-day range', oct23.body.wantedFrom === '2026-10-23' && oct23.body.wantedTo === '2026-10-23', JSON.stringify({ f: oct23.body.wantedFrom, t: oct23.body.wantedTo }))
await call(admin, '/leads', { property: A, body: { date: '2026-09-02', name: 'Wants Oct', phone: '9302', exec: 'mgra', wantedFrom: '2026-10-01', wantedTo: '2026-10-31' } })
await call(admin, '/leads', { property: A, body: { date: '2026-09-03', name: 'Wants Dec', phone: '9303', exec: 'mgra', wantedFrom: '2026-12-31' } })
const reversed = await call(admin, '/leads', { property: A, body: { date: '2026-09-04', name: 'Backwards', phone: '9304', wantedFrom: '2026-10-20', wantedTo: '2026-10-10' } })
check('a backwards range is refused', reversed.status === 400, String(reversed.status))

const octLeads = await call(admin, '/leads/wanted?month=2026-10', { property: A })
const octNames = (octLeads.body.rows ?? []).map((l: Json) => l.name).sort()
check('asking for October finds the exact date and the whole-month one', String(octNames) === 'Wants 23 Oct,Wants Oct', JSON.stringify(octNames))
check('and not the December lead', !octNames.includes('Wants Dec'), JSON.stringify(octNames))
const oneDay = await call(admin, '/leads/wanted?from=2026-10-23&to=2026-10-23', { property: A })
const dayNames = (oneDay.body.rows ?? []).map((l: Json) => l.name).sort()
check('a cancelled day finds whoever wanted it', String(dayNames) === 'Wants 23 Oct,Wants Oct', JSON.stringify(dayNames))
const quietDay = await call(admin, '/leads/wanted?from=2026-10-05&to=2026-10-05', { property: A })
check('a day only the month lead covers still matches it', (quietDay.body.rows ?? []).length === 1, JSON.stringify(quietDay.body.rows?.map((l: Json) => l.name)))
const badWindow = await call(admin, '/leads/wanted', { property: A })
check('asking with no window at all is refused', badWindow.status === 400, String(badWindow.status))
const salesWanted = await call(await login('salesa'), '/leads/wanted?month=2026-10', { property: A })
check('a sales exec sees only their own in that list', (salesWanted.body.rows ?? []).length === 0, JSON.stringify(salesWanted.body.rows?.length))
await call(admin, `/leads/${oct23.body.id}`, { property: A, method: 'PATCH', body: { outcome: 'Converted' } })
const afterBooked = await call(admin, '/leads/wanted?month=2026-10', { property: A })
check('someone who already booked drops off the pitch list', !(afterBooked.body.rows ?? []).some((l: Json) => l.name === 'Wants 23 Oct'), JSON.stringify((afterBooked.body.rows ?? []).map((l: Json) => l.name)))
await call(admin, `/leads/${oct23.body.id}`, { property: A, method: 'PATCH', body: { outcome: '' } })

console.log('\n6g. Editing one field leaves the rest alone')
const rich = await call(admin, '/leads', { property: A, body: {
  date: '2026-09-05', name: 'Full record', phone: '9305', exec: 'mgra', flag: 'good',
  followup: '2026-10-10', notes: 'Wants lawn side, budget 2L', adminComment: 'VIP',
  wantedFrom: '2026-11-05', wantedTo: '2026-11-06',
} })
check('a lead can be written with everything filled in', rich.status === 201, JSON.stringify(rich.body))
// Exactly what the Converted tick in the CRM sends.
const ticked = await call(admin, `/leads/${rich.body.id}`, { property: A, method: 'PATCH', body: { outcome: 'Converted' } })
check('the tick sets the outcome', ticked.body.outcome === 'Converted', String(ticked.body.outcome))
check('and keeps the remarks', ticked.body.notes === 'Wants lawn side, budget 2L', JSON.stringify(ticked.body.notes))
check('and keeps the executive', ticked.body.exec === 'mgra' && ticked.body.execLabel === 'Mgr A', JSON.stringify({ e: ticked.body.exec, l: ticked.body.execLabel }))
check('and keeps the follow-up date', ticked.body.followup === '2026-10-10', String(ticked.body.followup))
check('and keeps the flag and admin note', ticked.body.flag === 'good' && ticked.body.adminComment === 'VIP', JSON.stringify({ f: ticked.body.flag, a: ticked.body.adminComment }))
check('and keeps the dates they wanted', ticked.body.wantedFrom === '2026-11-05' && ticked.body.wantedTo === '2026-11-06', JSON.stringify({ f: ticked.body.wantedFrom, t: ticked.body.wantedTo }))
// Clearing a field on purpose must still work.
const cleared = await call(admin, `/leads/${rich.body.id}`, { property: A, method: 'PATCH', body: { followup: '' } })
check('a field sent blank is still cleared', cleared.body.followup === '' && cleared.body.notes === 'Wants lawn side, budget 2L', JSON.stringify({ f: cleared.body.followup, n: cleared.body.notes }))

console.log('\n6f. Conversations that went quiet')
// These were written seconds ago, so nothing is quiet yet. Age them through the driver,
// since mongoose will not let createdAt be set on an update.
await db.collection('leads').updateMany(
  { phone: { $in: ['9301', '9302', '9303'] } },
  { $set: { createdAt: new Date(Date.now() - 10 * 86_400_000) } },
)
const quiet = await call(admin, '/leads/quiet?days=1', { property: A })
const quietNames = (quiet.body ?? []).map((l: Json) => l.name)
check('leads nobody has touched show up', quietNames.length > 0, JSON.stringify(quietNames.slice(0, 4)))
const dated = quietNames.filter((n: string) => String(n).startsWith('Wants'))
// Soonest first by the start of what they asked for. The 23 Oct lead is absent on
// purpose: it was worked on a moment ago in 6e, so it is not a quiet conversation.
check('the nearest date leads the list', String(dated) === 'Wants Oct,Wants Dec', JSON.stringify(dated))
check('a lead worked on just now is not quiet', !quietNames.includes('Wants 23 Oct'), JSON.stringify(quietNames.slice(0, 5)))
await call(admin, `/leads/${oct23.body.id}`, { property: A, method: 'PATCH', body: { date: '2026-09-01', name: 'Wants 23 Oct', phone: '9301', outcome: 'Converted' } })
const afterClose = await call(admin, '/leads/quiet?days=1', { property: A })
check('a closed lead drops out of it', !(afterClose.body ?? []).some((l: Json) => l.name === 'Wants 23 Oct'), JSON.stringify((afterClose.body ?? []).map((l: Json) => l.name).slice(0, 4)))

console.log('\n6d. Call logs follow the same walls as leads')
const salesA = await login('salesa')
const mine = await call(admin, '/leads', { property: A, body: { date: '2026-10-02', name: 'Mine', phone: '9111111111', exec: 'salesa' } })
const theirs = await call(admin, '/leads', { property: A, body: { date: '2026-10-02', name: 'Theirs', phone: '9222222222', exec: 'mgra' } })

const started = await call(salesA, `/calls/lead/${mine.body.id}`, { property: A, body: {} })
check('a sales exec can log a call on their own lead', started.status === 201, JSON.stringify(started.body))
const poach = await call(salesA, `/calls/lead/${theirs.body.id}`, { property: A, body: {} })
check("but not on someone else's lead", poach.status === 403, String(poach.status))
// A sales exec's property comes from their token, so naming another one in the header
// changes nothing: the call is still filed under theirs rather than refused or leaked.
const crossProperty = await call(salesA, `/calls/lead/${mine.body.id}`, { property: B, body: {} })
check('asking for another property does not move the call', crossProperty.status === 201, String(crossProperty.status))

const finished = await call(salesA, `/calls/${started.body.id}`, { property: A, method: 'PATCH', body: { outcome: 'connected', durationSec: 95, durationSource: 'manual' } })
check('the outcome and duration save', finished.body.outcome === 'connected' && finished.body.durationSec === 95, JSON.stringify(finished.body))
check('a typed duration is not marked estimated', finished.body.durationSource === 'manual', String(finished.body.durationSource))

const mgrCalls = await call(mgrA, '/calls', { property: A })
check("a manager sees their property's calls", mgrCalls.body?.length === 2, JSON.stringify(mgrCalls.body?.length))
const salesBCalls = await call(await login('salesb'), '/calls', { property: B })
check('and none of them reached property B', salesBCalls.body?.length === 0, JSON.stringify(salesBCalls.body))
const statsForSales = await call(salesA, '/calls/stats', { property: A })
check('call stats stay with admin and manager', statsForSales.status === 403, String(statsForSales.status))
const stats = await call(mgrA, '/calls/stats', { property: A })
check('talk time counts the connected call', stats.body?.[0]?.talkTimeSec === 95, JSON.stringify(stats.body))

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

console.log('\n8b. Property look')
const look = await call(admin, `/properties/${A}`, { method: 'PATCH', body: { imageUrl: 'https://example.com/villa.jpg', color: '#2563eb' } })
check('photo and colour can be set', look.body.imageUrl === 'https://example.com/villa.jpg' && look.body.color === '#2563eb', JSON.stringify(look.body.imageUrl))
const badUrl = await call(admin, `/properties/${A}`, { method: 'PATCH', body: { imageUrl: 'javascript:alert(1)' } })
check('a non-http photo URL is refused', badUrl.status === 400, String(badUrl.status))
const badColor = await call(admin, `/properties/${A}`, { method: 'PATCH', body: { color: 'red' } })
check('a colour has to be a hex value', badColor.status === 400, String(badColor.status))
const clearUrl = await call(admin, `/properties/${A}`, { method: 'PATCH', body: { imageUrl: '' } })
check('the photo can be cleared', clearUrl.status === 200 && clearUrl.body.imageUrl === '', String(clearUrl.status))

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

// Exactly what the Mark out button sends. Before updates were narrowed to what was
// actually sent, this one field wiped the purpose, remarks and follow-up alongside it.
const vendor = await call(admin, '/visitors', { property: A, body: {
  date: '2026-11-12', name: 'Prakash tent house', phone: '9810855731', type: 'Vendor',
  purpose: '04/10/26 catering', inTime: '16:33', remarks: 'Lawn side setup',
  fuStatus: 'Hold', fuRemark: 'Quote pending',
} })
const out = await call(admin, `/visitors/${vendor.body.id}`, { property: A, method: 'PATCH', body: { outTime: '19:20' } })
check('marking out records the time', out.body.outTime === '19:20', String(out.body.outTime))
check('and keeps the purpose', out.body.purpose === '04/10/26 catering', JSON.stringify(out.body.purpose))
check('and keeps the in time', out.body.inTime === '16:33', String(out.body.inTime))
check('and keeps the remarks and follow-up', out.body.remarks === 'Lawn side setup' && out.body.fuRemark === 'Quote pending', JSON.stringify({ r: out.body.remarks, f: out.body.fuRemark }))
check('and does not reset the visitor type to Guest', out.body.type === 'Vendor', String(out.body.type))

console.log(`\n${pass} passed, ${fail} failed`)
server.close()
await mongoose.disconnect()
process.exit(fail ? 1 : 0)
