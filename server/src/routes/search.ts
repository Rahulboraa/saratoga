import { Router } from 'express'
import { Booking } from '../models/Booking.js'
import { Lead } from '../models/Lead.js'
import { Visitor } from '../models/Visitor.js'
import { requireRole } from '../middleware/auth.js'

export const searchRouter = Router()
searchRouter.use(requireRole('admin', 'manager', 'sales'))

searchRouter.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  if (!q) return res.json({ bookings: [], leads: [], visitors: [] })
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

  const leadFilter: Record<string, unknown> = { $or: [{ name: rx }, { phone: rx }] }
  if (req.user.role === 'sales') leadFilter.exec = req.user.username

  const [bookings, leads, visitors] = await Promise.all([
    Booking.find({ $or: [{ guest: rx }, { phone: rx }] }).select('guest phone checkinDate purpose').sort({ checkinDate: -1 }).limit(5),
    Lead.find(leadFilter).select('name phone eventType outcome').sort({ date: -1 }).limit(5),
    Visitor.find({ $or: [{ name: rx }, { phone: rx }] }).select('name phone purpose date').sort({ date: -1 }).limit(5),
  ])

  res.json({
    bookings: bookings.map((b) => ({ id: b.id, guest: b.guest, phone: b.phone, checkinDate: b.checkinDate, purpose: b.purpose })),
    leads: leads.map((l) => ({ id: l.id, name: l.name, phone: l.phone, outcome: l.outcome })),
    visitors: visitors.map((v) => ({ id: v.id, name: v.name, phone: v.phone, date: v.date })),
  })
})
