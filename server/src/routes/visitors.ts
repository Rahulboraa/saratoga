import { Router } from 'express'
import { Visitor } from '../models/Visitor.js'
import { requireRole } from '../middleware/auth.js'
import { visitorSchema, visitorCaretakerSchema, visitorCaretakerPatchSchema } from '../validation/schemas.js'
import { serializeVisitor } from '../lib/sanitize.js'
import { todayYmd } from '../lib/dates.js'

export const visitorsRouter = Router()

const VISITOR_TYPES = ['Guest', 'Vendor', 'Delivery', 'Staff'] as const

visitorsRouter.get('/', async (req, res) => {
  const { date, q, type } = req.query as Record<string, string | undefined>
  const filter: Record<string, unknown> = {}
  if (date) filter.date = date
  if (type) {
    if (type === 'Other') filter.purpose = { $not: new RegExp(VISITOR_TYPES.join('|'), 'i') }
    else if ((VISITOR_TYPES as readonly string[]).includes(type)) filter.purpose = new RegExp(type, 'i')
  }
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ name: rx }, { phone: rx }, { purpose: rx }]
  }
  const page = Math.max(parseInt(String(req.query.page)) || 1, 1)
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 100)
  const [visitors, total, dates] = await Promise.all([
    Visitor.find(filter).sort({ date: -1, loggedAt: -1 }).skip((page - 1) * limit).limit(limit),
    Visitor.countDocuments(filter),
    Visitor.distinct('date'),
  ])
  res.json({
    rows: visitors.map((v) => serializeVisitor(v.toObject({ virtuals: true }), req.user.role)),
    total, page, limit,
    dates: (dates as string[]).sort().reverse(),
  })
})

visitorsRouter.post('/', async (req, res) => {
  const schema = req.user.role === 'caretaker' ? visitorCaretakerSchema : visitorSchema
  const body = schema.parse(req.body)
  const visitor = await Visitor.create({ ...body, date: body.date || todayYmd(), loggedBy: req.user.username })
  res.status(201).json(serializeVisitor(visitor.toObject({ virtuals: true }), req.user.role))
})

visitorsRouter.patch('/:id', async (req, res) => {
  const body = req.user.role === 'caretaker'
    ? visitorCaretakerPatchSchema.parse(req.body)
    : visitorSchema.partial().parse(req.body)
  const visitor = await Visitor.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true })
  if (!visitor) return res.status(404).json({ error: 'Visitor not found' })
  res.json(serializeVisitor(visitor.toObject({ virtuals: true }), req.user.role))
})

visitorsRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const visitor = await Visitor.findByIdAndDelete(req.params.id)
  if (!visitor) return res.status(404).json({ error: 'Visitor not found' })
  res.json({ ok: true })
})
