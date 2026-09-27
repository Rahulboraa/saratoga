import { Router } from 'express'
import { Booking } from '../models/Booking.js'
import { Payment } from '../models/Payment.js'
import { requireRole } from '../middleware/auth.js'
import { bookingAdminSchema, paymentSchema } from '../validation/schemas.js'
import { serializeBooking, serializeCalendarBooking, serializePayment } from '../lib/sanitize.js'
import { overlaps, overlapIdSet } from '../lib/overlap.js'
import { paymentSums, withFinance } from '../services/finance.js'
import { scoped, writeProperty } from '../middleware/scope.js'
import { Property } from '../models/Property.js'
import { invoiceLines, nextInvoiceNo, GST_RATE } from '../services/invoice.js'
import { buildConfirmation } from '../services/confirmation.js'
import { todayYmd } from '../lib/dates.js'

export const bookingsRouter = Router()

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function findConflicts(
  candidate: { checkinDate: string; checkoutDate?: string; checkinTime?: string; checkoutTime?: string },
  propertyId: string,
  excludeId?: string,
) {
  const all = await Booking.find({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    propertyId,
  }).select('guest checkinDate checkoutDate checkinTime checkoutTime')
  return all.filter((b) => overlaps(candidate, b))
}

bookingsRouter.get('/', requireRole('admin', 'manager', 'sales'), async (req, res) => {
  const { month, status, purpose, q } = req.query as Record<string, string | undefined>
  if (status && req.user.role !== 'admin') return res.status(400).json({ error: 'Invalid filter' })
  const page = Math.max(parseInt(String(req.query.page)) || 1, 1)
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 100)

  const filter: Record<string, unknown> = scoped(req)
  if (month) filter.checkinDate = { $regex: `^${escapeRegex(month)}` }
  if (purpose) filter.purpose = purpose
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ guest: rx }, { phone: rx }]
  }

  const isAdmin = req.user.role !== 'sales'
  const query = Booking.find(filter).sort({ checkinDate: -1, checkinTime: -1 })
  if (!isAdmin) query.select('-breakdown -amount -legacyReceived -dest')
  const bookings = await query

  const allSpans = await Booking.find(scoped(req)).select('checkinDate checkoutDate checkinTime checkoutTime')
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
  const isAdmin = req.user.role !== 'sales'
  const { q, purpose } = req.query as Record<string, string | undefined>
  const filter: Record<string, unknown> = scoped(req, { checkinDate: { $gte: today } })
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

  const allSpans = await Booking.find(scoped(req)).select('checkinDate checkoutDate checkinTime checkoutTime')
  const overlapIds = overlapIdSet(allSpans.map((b) => ({ ...b.toObject(), id: b.id })))

  let rows = bookings.map((b) => ({ ...b.toObject(), id: b.id, overlap: overlapIds.has(b.id) }))
  if (isAdmin) {
    const sums = await paymentSums(bookings.map((b) => b._id))
    rows = rows.map((r) => ({ ...r, ...withFinance(r as never, sums) }))
  }
  res.json({ rows: rows.map((r) => serializeBooking(r, req.user.role)), total, page, limit })
})

// Compact list for pickers (e.g. mapping an expense to an event). Declared before
// '/:id' so it is not swallowed by the id route.
bookingsRouter.get('/options', requireRole('admin', 'manager'), async (req, res) => {
  const bookings = await Booking.find(scoped(req))
    .select('guest checkinDate')
    .sort({ checkinDate: -1 })
    .limit(500)
  res.json(bookings.map((b) => ({ id: b.id, guest: b.guest, checkinDate: b.checkinDate })))
})

bookingsRouter.get('/calendar', async (req, res) => {
  const month = String(req.query.month || '')
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month required (YYYY-MM)' })
  const start = `${month}-01`
  const end = `${month}-31`
  const bookings = await Booking.find(scoped(req, {
    checkinDate: { $lte: end },
    $or: [
      { checkoutDate: { $gte: start } },
      { checkoutDate: '', checkinDate: { $gte: start, $lte: end } },
    ],
  }))
    .select('guest checkinDate checkoutDate checkinTime checkoutTime pax purpose')
    .sort({ checkinDate: 1 })
  const overlapIds = overlapIdSet(bookings.map((b) => ({ ...b.toObject(), id: b.id })))
  res.json(bookings.map((b) => serializeCalendarBooking({ ...b.toObject(), id: b.id, overlap: overlapIds.has(b.id) })))
})

bookingsRouter.get('/:id', requireRole('admin', 'manager', 'sales'), async (req, res) => {
  const isAdmin = req.user.role !== 'sales'
  const query = Booking.findOne(scoped(req, { _id: req.params.id }))
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
  const schema = bookingAdminSchema
  const { allowOverlap, ...body } = schema.parse(req.body)
  const propertyId = writeProperty(req, res)
  if (!propertyId) return
  if (!allowOverlap) {
    const conflicts = await findConflicts(body, propertyId)
    if (conflicts.length) {
      return res.status(409).json({
        error: 'Booking overlaps existing bookings',
        conflicts: conflicts.map((c) => ({ guest: c.guest, checkinDate: c.checkinDate, checkoutDate: c.checkoutDate })),
      })
    }
  }
  const booking = await Booking.create({ ...body, propertyId, createdBy: req.user.username })
  res.status(201).json(serializeBooking({ ...booking.toObject(), id: booking.id }, req.user.role))
})

bookingsRouter.patch('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const schema = bookingAdminSchema
  const { allowOverlap, ...body } = schema.partial().parse(req.body)
  const booking = await Booking.findOne(scoped(req, { _id: req.params.id }))
  if (!booking) return res.status(404).json({ error: 'Booking not found' })

  const merged = {
    checkinDate: body.checkinDate ?? booking.checkinDate,
    checkoutDate: body.checkoutDate ?? booking.checkoutDate,
    checkinTime: body.checkinTime ?? booking.checkinTime,
    checkoutTime: body.checkoutTime ?? booking.checkoutTime,
  }
  if (!allowOverlap) {
    const conflicts = await findConflicts(merged, String(booking.propertyId), booking.id)
    if (conflicts.length) {
      return res.status(409).json({
        error: 'Booking overlaps existing bookings',
        conflicts: conflicts.map((c) => ({ guest: c.guest, checkinDate: c.checkinDate, checkoutDate: c.checkoutDate })),
      })
    }
  }
  booking.set(body)
  await booking.save()
  const sums = req.user.role !== 'sales' ? await paymentSums([booking._id]) : new Map<string, number>()
  const row = { ...booking.toObject(), id: booking.id, ...(req.user.role !== 'sales' ? withFinance(booking, sums) : {}) }
  res.json(serializeBooking(row, req.user.role))
})

bookingsRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const booking = await Booking.findOneAndDelete(scoped(req, { _id: req.params.id }))
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  await Payment.deleteMany({ bookingId: booking._id })
  res.json({ ok: true })
})

/** Everything the printable invoice needs. `invoiceNo` is empty until it is issued. */
async function invoicePayload(req: Parameters<typeof scoped>[0], id: string) {
  const booking = await Booking.findOne(scoped(req, { _id: id }))
  if (!booking) return null
  const property = await Property.findById(booking.propertyId)
  const sums = await paymentSums([booking._id])
  const lines = invoiceLines(booking)
  const received = (booking.legacyReceived ?? 0) + (sums.get(String(booking._id)) ?? 0)
  return {
    invoiceNo: booking.invoiceNo,
    invoiceDate: booking.invoiceDate,
    gstRate: GST_RATE,
    // Until it is issued the document is a proforma, which doubles as the quote sent
    // before anyone has paid. A tax invoice is only a tax invoice if it carries tax.
    kind: booking.invoiceNo ? (lines.gstEnabled ? 'Tax Invoice' : 'Invoice') : 'Proforma Invoice',
    booking: {
      id: booking.id, guest: booking.guest, phone: booking.phone,
      checkinDate: booking.checkinDate, checkoutDate: booking.checkoutDate,
      checkinTime: booking.checkinTime, checkoutTime: booking.checkoutTime,
      pax: booking.pax, purpose: booking.purpose,
    },
    property: {
      name: property?.name ?? '', address: property?.address ?? '',
      location: property?.location ?? '', gstin: property?.gstin ?? '',
      terms: (property?.invoiceTerms ?? '').split('\n').map((t) => t.trim()).filter(Boolean),
    },
    ...lines,
    received,
  }
}

/** Turns a booking's proforma into a numbered invoice. No-op once it already has a number. */
export async function issueInvoice(booking: InstanceType<typeof Booking>) {
  if (booking.invoiceNo) return booking.invoiceNo
  const date = todayYmd()
  booking.invoiceNo = await nextInvoiceNo(String(booking.propertyId), date)
  booking.invoiceDate = date
  await booking.save()
  return booking.invoiceNo
}

// The WhatsApp confirmation, built from the booking so the figures cannot drift.
bookingsRouter.get('/:id/confirmation', requireRole('admin', 'manager'), async (req, res) => {
  const booking = await Booking.findOne(scoped(req, { _id: req.params.id }))
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const property = await Property.findById(booking.propertyId)
  const sums = await paymentSums([booking._id])
  const collected = (booking.legacyReceived ?? 0) + (sums.get(String(booking._id)) ?? 0)
  const payable = booking.amount + (booking.breakdown?.license ?? 0) + (booking.breakdown?.security ?? 0)

  res.json({
    phone: booking.phone,
    text: buildConfirmation(
      { ...booking.toObject(), collected, due: Math.max(payable - collected, 0) },
      {
        name: property?.name ?? '',
        inclusions: property?.inclusions ?? '',
        exclusions: property?.exclusions ?? '',
        confirmationNotes: property?.confirmationNotes ?? '',
      },
    ),
  })
})

bookingsRouter.get('/:id/invoice', requireRole('admin', 'manager'), async (req, res) => {
  const payload = await invoicePayload(req, String(req.params.id))
  if (!payload) return res.status(404).json({ error: 'Booking not found' })
  res.json(payload)
})

bookingsRouter.patch('/:id/invoice', requireRole('admin'), async (req, res) => {
  const booking = await Booking.findOne(scoped(req, { _id: req.params.id }))
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (typeof req.body?.gstEnabled === 'boolean') {
    booking.gstEnabled = req.body.gstEnabled
    await booking.save()
  }
  res.json(await invoicePayload(req, String(req.params.id)))
})

// Issuing burns a serial number, so it is a deliberate action, not a side effect of viewing.
bookingsRouter.post('/:id/invoice', requireRole('admin'), async (req, res) => {
  const booking = await Booking.findOne(scoped(req, { _id: req.params.id }))
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  await issueInvoice(booking)
  res.json(await invoicePayload(req, String(req.params.id)))
})

bookingsRouter.get('/:id/payments', requireRole('admin', 'manager'), async (req, res) => {
  const payments = await Payment.find(scoped(req, { bookingId: req.params.id })).sort({ date: 1 })
  res.json(payments.map((p) => serializePayment(p.toObject())))
})

bookingsRouter.post('/:id/payments', requireRole('admin', 'manager'), async (req, res) => {
  const booking = await Booking.findOne(scoped(req, { _id: req.params.id }))
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const body = paymentSchema.parse(req.body)
  const payment = await Payment.create({ ...body, bookingId: booking._id, propertyId: booking.propertyId })
  // Money in means the booking is real, so the proforma becomes the sales invoice.
  // A refund (negative) is not a first payment, so it never triggers this.
  if (body.amount > 0) await issueInvoice(booking)
  res.status(201).json(serializePayment(payment.toObject()))
})
