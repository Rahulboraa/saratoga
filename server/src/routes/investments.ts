import { Router } from 'express'
import { Investment } from '../models/Investment.js'
import { requireRole } from '../middleware/auth.js'
import { investmentSchema } from '../validation/schemas.js'
import { scoped, writeProperty } from '../middleware/scope.js'
import { partnerLedger } from '../services/investments.js'

export const investmentsRouter = Router()
investmentsRouter.use(requireRole('admin'))

const shape = (i: InstanceType<typeof Investment>) => ({
  id: i.id, partner: i.partner, date: i.date, kind: i.kind,
  amount: i.amount, mode: i.mode, notes: i.notes, by: i.by,
})

investmentsRouter.get('/', async (req, res) => {
  const { partner } = req.query as Record<string, string | undefined>
  const filter = scoped(req, partner ? { partner } : {})
  const rows = await Investment.find(filter).sort({ date: -1, createdAt: -1 })
  res.json({
    rows: rows.map(shape),
    partners: await partnerLedger(scoped(req)),
  })
})

investmentsRouter.post('/', async (req, res) => {
  const body = investmentSchema.parse(req.body)
  const propertyId = writeProperty(req, res)
  if (!propertyId) return
  const entry = await Investment.create({ ...body, propertyId, by: body.by || req.user.name })
  res.status(201).json(shape(entry))
})

investmentsRouter.patch('/:id', async (req, res) => {
  const body = investmentSchema.partial().parse(req.body)
  const entry = await Investment.findOneAndUpdate(scoped(req, { _id: req.params.id }), body, { new: true, runValidators: true })
  if (!entry) return res.status(404).json({ error: 'Entry not found' })
  res.json(shape(entry))
})

investmentsRouter.delete('/:id', async (req, res) => {
  const entry = await Investment.findOneAndDelete(scoped(req, { _id: req.params.id }))
  if (!entry) return res.status(404).json({ error: 'Entry not found' })
  res.json({ ok: true })
})
