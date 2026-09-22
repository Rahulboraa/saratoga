import { Router } from 'express'
import { Call } from '../models/Call.js'
import { Lead } from '../models/Lead.js'
import { requireRole } from '../middleware/auth.js'
import { callFinishSchema, callStartSchema } from '../validation/schemas.js'
import { scoped, writeProperty } from '../middleware/scope.js'
import { callStats } from '../services/calls.js'

export const callsRouter = Router()
callsRouter.use(requireRole('admin', 'manager', 'sales'))

const shape = (c: InstanceType<typeof Call>) => ({
  id: c.id,
  leadId: String(c.leadId),
  exec: c.exec,
  execLabel: c.execLabel,
  phone: c.phone,
  startedAt: c.startedAt.toISOString(),
  outcome: c.outcome,
  durationSec: c.durationSec,
  durationSource: c.durationSource,
  notes: c.notes,
  recordingUrl: c.recordingUrl,
})

/** A sales exec only ever sees their own calls, the way they only see their own leads. */
function ownScope(req: Parameters<typeof scoped>[0], extra: Record<string, unknown> = {}) {
  return scoped(req, req.user.role === 'sales' ? { ...extra, exec: req.user.username } : extra)
}

callsRouter.get('/', async (req, res) => {
  const { leadId } = req.query as Record<string, string | undefined>
  const calls = await Call.find(ownScope(req, leadId ? { leadId } : {}))
    .sort({ startedAt: -1 })
    .limit(200)
  res.json(calls.map(shape))
})

callsRouter.get('/stats', requireRole('admin', 'manager'), async (req, res) => {
  const month = req.query.month ? String(req.query.month) : undefined
  res.json(await callStats(req.scope.filter, month))
})

// Logged when the dialer is opened. The call itself happens on the phone, outside the app.
callsRouter.post('/lead/:leadId', async (req, res) => {
  const body = callStartSchema.parse(req.body)
  const propertyId = writeProperty(req, res)
  if (!propertyId) return

  const lead = await Lead.findOne(scoped(req, { _id: req.params.leadId }))
  if (!lead) return res.status(404).json({ error: 'Lead not found' })
  if (req.user.role === 'sales' && lead.exec !== req.user.username) {
    return res.status(403).json({ error: 'That lead is assigned to someone else' })
  }

  const call = await Call.create({
    propertyId,
    leadId: lead._id,
    exec: req.user.username,
    execLabel: req.user.name,
    phone: lead.phone,
    startedAt: body.startedAt ?? new Date(),
  })
  res.status(201).json(shape(call))
})

// Filled in when the caller comes back to the app and says how it went.
callsRouter.patch('/:id', async (req, res) => {
  const body = callFinishSchema.parse(req.body)
  const call = await Call.findOne(ownScope(req, { _id: req.params.id }))
  if (!call) return res.status(404).json({ error: 'Call not found' })
  call.set(body)
  await call.save()
  res.json(shape(call))
})

// A call the dialer never actually placed should not sit in the record as a real attempt.
callsRouter.delete('/:id', async (req, res) => {
  const call = await Call.findOneAndDelete(ownScope(req, { _id: req.params.id }))
  if (!call) return res.status(404).json({ error: 'Call not found' })
  res.json({ ok: true })
})
