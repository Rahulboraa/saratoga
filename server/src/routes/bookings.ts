import { Router } from 'express'
import { Booking } from '../models/Booking.js'
import { Payment } from '../models/Payment.js'
import { requireRole } from '../middleware/auth.js'
import { bookingAdminSchema, bookingManagerSchema, paymentSchema } from '../validation/schemas.js'
import { serializeBooking, serializeCalendarBooking, serializePayment } from '../lib/sanitize.js'
import { overlaps, overlapIdSet } from '../lib/overlap.js'
import { paymentSums, withFinance } from '../services/finance.js'

export const bookingsRouter = Router()

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function findConflicts(candidate: { checkinDate: string; checkoutDate?: string; checkinTime?: string; checkoutTime?: string }, excludeId?: string) {
  const all = await Booking.find(excludeId ? { _id: { $ne: excludeId } } : {})
    .select('guest checkinDate checkoutDate checkinTime checkoutTime')
  return all.filter((b) => overlaps(candidate, b))
}

bookingsRouter.get('/', requireRole('admin', 'manager', 'sales'), async (req, res) => {
  const { month, status, purpose, q } = req.query as Record<string, string | undefined>
  if (status && req.user.role !== 'admin') return res.status(400).json({ error: 'Invalid filter' })
  const page = Math.max(parseInt(String(req.query.page)) || 1, 1)
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 10, 1), 100)

  const filter: Record<string, unknown> = {}
  if (month) filter.checkinDate = { $regex: `^${escapeRegex(month)}` }
  if (purpose) filter.purpose = purpose
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ guest: rx }, { phone: rx }]
  }

  const isAdmin = req.user.role === 'admin'
  const query = Booking.find(filter).sort({ checkinDate: -1, checkinTime: -1 })
  if (!isAdmin) query.select('-breakdown -amount -legacyReceived -dest')
  const bookings = await query

  const allSpans = await Booking.find().select('checkinDate checkoutDate checkinTime checkoutTime')
  const overlapIds = overlapIdSet(allSpans.map((b) => ({ ...b.toObject(), id: b.id })))
  const months = [...new Set(allSpans.map((b) => b.checkinDate.slice(0, 7)))].sort().reverse()

  let rows = bookings.map((b) => ({ ...b.toObject(), id: b.id, overlap: overlapIds.has(b.id) }))
  if (isAdmin) {
    const sums = await paymentSums(bookings.map((b) => b._id))
    rows = rows.map((r) => ({ ...r, ...withFinance(r as never, sums) }))
    if (status) rows = rows.filter((r) => (r as { status?: string }).status === status)
  }
  const total = rows.length
  rows = rows.slice((page - 1) * limit, page * limit)
  res.json({ rows: rows.map((r) => serializeBooking(r, req.user.role)), total, page, limit, months })
})

bookingsRouter.get('/upcoming', requireRole('admin', 'manager', 'sales'), async (req, res) => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const isAdmin = req.user.role === 'admin'
  const { q, purpose } = req.query as Record<string, string | undefined>
  const filter: Record<string, unknown> = { checkinDate: { $gte: today } }
  if (purpose) filter.purpose = purpose
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ guest: rx }, { phone: rx }]
  }
  const page = Math.max(parseInt(String(req.query.page)) || 1, 1)
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 100)
  const total = await Booking.countDocuments(filter)
  const query = Booking.find(filter).sort({ checkinDate: 1, checkinTime: 1 }).skip((page - 1) * limit).limit(limit)
  if (!isAdmin) query.select('-breakdown -amount -legacyReceived -dest')
  const bookings = await query

  const allSpans = await Booking.find().select('checkinDate checkoutDate checkinTime checkoutTime')
  const overlapIds = overlapIdSet(allSpans.map((b) => ({ ...b.toObject(), id: b.id })))

  let rows = bookings.map((b) => ({ ...b.toObject(), id: b.id, overlap: overlapIds.has(b.id) }))
  if (isAdmin) {
    const sums = await paymentSums(bookings.map((b) => b._id))
    rows = rows.map((r) => ({ ...r, ...withFinance(r as never, sums) }))
  }
  res.json({ rows: rows.map((r) => serializeBooking(r, req.user.role)), total, page, limit })
})

bookingsRouter.get('/calendar', async (req, res) => {
  const month = String(req.query.month || '')
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month required (YYYY-MM)' })
  const start = `${month}-01`
  const end = `${month}-31`
  const bookings = await Booking.find({ checkinDate: { $lte: end }, checkoutDate: { $gte: start } })
    .select('guest checkinDate checkoutDate checkinTime checkoutTime pax purpose')
    .sort({ checkinDate: 1 })
  const overlapIds = overlapIdSet(bookings.map((b) => ({ ...b.toObject(), id: b.id })))
  res.json(bookings.map((b) => serializeCalendarBooking({ ...b.toObject(), id: b.id, overlap: overlapIds.has(b.id) })))
})

bookingsRouter.get('/:id', requireRole('admin', 'manager', 'sales'), async (req, res) => {
  const isAdmin = req.user.role === 'admin'
  const query = Booking.findById(req.params.id)
  if (!isAdmin) query.select('-breakdown -amount -legacyReceived -dest')
  const booking = await query
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  let row: Record<string, unknown> = { ...booking.toObject(), id: booking.id }
  if (isAdmin) {
    const sums = await paymentSums([booking._id])
    row = { ...row, ...withFinance(booking, sums) }
  }
  res.json(serializeBooking(row, req.user.role))
})

bookingsRouter.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const schema = req.user.role === 'admin' ? bookingAdminSchema : bookingManagerSchema
  const { allowOverlap, ...body } = schema.parse(req.body)
  if (!allowOverlap) {
    const conflicts = await findConflicts(body)
    if (conflicts.length) {
      return res.status(409).json({
        error: 'Booking overlaps existing bookings',
        conflicts: conflicts.map((c) => ({ guest: c.guest, checkinDate: c.checkinDate, checkoutDate: c.checkoutDate })),
      })
    }
  }
  const booking = await Booking.create({ ...body, createdBy: req.user.username })
  res.status(201).json(serializeBooking({ ...booking.toObject(), id: booking.id }, req.user.role))
})

bookingsRouter.patch('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const schema = req.user.role === 'admin' ? bookingAdminSchema : bookingManagerSchema
  const { allowOverlap, ...body } = schema.partial().parse(req.body)
  const booking = await Booking.findById(req.params.id)
  if (!booking) return res.status(404).json({ error: 'Booking not found' })

  const merged = {
    checkinDate: body.checkinDate ?? booking.checkinDate,
    checkoutDate: body.checkoutDate ?? booking.checkoutDate,
    checkinTime: body.checkinTime ?? booking.checkinTime,
    checkoutTime: body.checkoutTime ?? booking.checkoutTime,
  }
  if (!allowOverlap) {
    const conflicts = await findConflicts(merged, booking.id)
    if (conflicts.length) {
      return res.status(409).json({
        error: 'Booking overlaps existing bookings',
        conflicts: conflicts.map((c) => ({ guest: c.guest, checkinDate: c.checkinDate, checkoutDate: c.checkoutDate })),
      })
    }
  }
  booking.set(body)
  await booking.save()
  const sums = req.user.role === 'admin' ? await paymentSums([booking._id]) : new Map<string, number>()
  const row = { ...booking.toObject(), id: booking.id, ...(req.user.role === 'admin' ? withFinance(booking, sums) : {}) }
  res.json(serializeBooking(row, req.user.role))
})

bookingsRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const booking = await Booking.findByIdAndDelete(req.params.id)
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  await Payment.deleteMany({ bookingId: booking._id })
  res.json({ ok: true })
})

bookingsRouter.get('/:id/payments', requireRole('admin'), async (req, res) => {
  const payments = await Payment.find({ bookingId: req.params.id }).sort({ date: 1 })
  res.json(payments.map((p) => serializePayment(p.toObject())))
})

bookingsRouter.post('/:id/payments', requireRole('admin'), async (req, res) => {
  const booking = await Booking.findById(req.params.id)
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const body = paymentSchema.parse(req.body)
  const payment = await Payment.create({ ...body, bookingId: booking._id })
  res.status(201).json(serializePayment(payment.toObject()))
})
