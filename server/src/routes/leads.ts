import { Router } from 'express'
import { z } from 'zod'
import { Lead } from '../models/Lead.js'
import { User } from '../models/User.js'
import { requireRole } from '../middleware/auth.js'
import { leadCommonSchema, leadManagerSchema } from '../validation/schemas.js'
import { serializeLead } from '../lib/sanitize.js'

export const leadsRouter = Router()
leadsRouter.use(requireRole('admin', 'manager', 'sales'))

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function execLabelFor(exec: string) {
  if (!exec) return ''
  const user = await User.findOne({ username: exec })
  return user?.name ?? exec
}

leadsRouter.get('/', async (req, res) => {
  const { month, outcome, exec, eventType, q } = req.query as Record<string, string | undefined>
  const filter: Record<string, unknown> = {}
  if (req.user.role === 'sales') filter.exec = req.user.username
  else if (exec === 'unassigned') filter.exec = ''
  else if (exec) filter.exec = exec
  if (month) filter.date = { $regex: `^${month.replace(/[^\d-]/g, '')}` }
  if (outcome !== undefined) filter.outcome = outcome
  if (eventType) filter.eventType = eventType
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: rx }, { phone: rx }]
  }
  const leads = await Lead.find(filter).sort({ date: -1, time: -1 })
  res.json(leads.map((l) => serializeLead(l.toObject(), req.user.role)))
})

leadsRouter.get('/report', requireRole('admin', 'manager'), async (req, res) => {
  const month = String(req.query.month || '')
  const filter = month ? { date: { $regex: `^${month.replace(/[^\d-]/g, '')}` } } : {}
  const leads = await Lead.find(filter)
  const byExec = new Map<string, { exec: string; execLabel: string; calls: number; interested: number; callbacks: number; converted: number }>()
  for (const l of leads) {
    const key = l.exec || 'unassigned'
    if (!byExec.has(key)) byExec.set(key, { exec: key, execLabel: l.execLabel || key, calls: 0, interested: 0, callbacks: 0, converted: 0 })
    const row = byExec.get(key)!
    row.calls++
    if (l.outcome === 'Interested') row.interested++
    if (l.outcome === 'Callback') row.callbacks++
    if (l.outcome === 'Converted') row.converted++
  }
  res.json([...byExec.values()].map((r) => ({
    ...r,
    conversionRate: r.calls ? Math.round((r.converted / r.calls) * 1000) / 10 : 0,
  })))
})

leadsRouter.post('/', async (req, res) => {
  if (req.user.role === 'sales') {
    const body = leadCommonSchema.parse(req.body)
    const lead = await Lead.create({ ...body, exec: req.user.username, execLabel: req.user.name })
    return res.status(201).json(serializeLead(lead.toObject(), req.user.role))
  }
  const body = leadManagerSchema.parse(req.body)
  const lead = await Lead.create({ ...body, execLabel: await execLabelFor(body.exec) })
  res.status(201).json(serializeLead(lead.toObject(), req.user.role))
})

leadsRouter.patch('/:id', async (req, res) => {
  const lead = await Lead.findById(req.params.id)
  if (!lead) return res.status(404).json({ error: 'Lead not found' })
  if (req.user.role === 'sales') {
    if (lead.exec !== req.user.username) return res.status(403).json({ error: 'Forbidden' })
    lead.set(leadCommonSchema.partial().parse(req.body))
  } else {
    const body = leadManagerSchema.partial().parse(req.body)
    lead.set(body)
    if (body.exec !== undefined) lead.execLabel = await execLabelFor(body.exec)
  }
  await lead.save()
  res.json(serializeLead(lead.toObject(), req.user.role))
})

leadsRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const lead = await Lead.findByIdAndDelete(req.params.id)
  if (!lead) return res.status(404).json({ error: 'Lead not found' })
  res.json({ ok: true })
})

const assignSchema = z.object({ ids: z.array(z.string()).min(1), exec: z.string().min(1) })

leadsRouter.post('/assign', requireRole('admin', 'manager'), async (req, res) => {
  const { ids, exec } = assignSchema.parse(req.body)
  const execLabel = await execLabelFor(exec)
  const result = await Lead.updateMany({ _id: { $in: ids } }, { exec, execLabel })
  res.json({ ok: true, assigned: result.modifiedCount })
})
