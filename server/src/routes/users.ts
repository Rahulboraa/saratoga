import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { User, ROLES } from '../models/User.js'
import { requireRole } from '../middleware/auth.js'
import { Property } from '../models/Property.js'
import { scoped } from '../middleware/scope.js'

const createSchema = z.object({
  username: z.string().min(2).max(30).regex(/^[a-z0-9_.-]+$/i).transform((s) => s.toLowerCase()),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(ROLES),
  propertyId: z.string().nullish(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  propertyId: z.string().nullish(),
})

/**
 * Admins float above properties; every other role must be pinned to one, otherwise they
 * would sign in with nothing to see.
 */
async function resolvePropertyId(role: string | undefined, propertyId: string | null | undefined) {
  if (role === 'admin') return null
  if (!propertyId) throw Object.assign(new Error('Pick a property for this user'), { status: 400 })
  if (!(await Property.exists({ _id: propertyId }))) {
    throw Object.assign(new Error('Property not found'), { status: 400 })
  }
  return propertyId
}

const passwordSchema = z.object({ password: z.string().min(6) })

async function isLastActiveAdmin(id: string) {
  const target = await User.findById(id)
  if (!target || target.role !== 'admin' || !target.active) return false
  const otherAdmins = await User.countDocuments({ _id: { $ne: id }, role: 'admin', active: true })
  return otherAdmins === 0
}

export const usersRouter = Router()

// Who a lead can be assigned to: the sales people of the property being looked at.
// Managers run the property rather than work the leads, and someone belonging to another
// property has no business appearing here at all.
usersRouter.get('/execs', requireRole('admin', 'manager'), async (req, res) => {
  const users = await User.find(scoped(req, { active: true, role: 'sales' })).sort({ name: 1 })
  res.json(users.map((u) => ({ username: u.username, name: u.name })))
})

usersRouter.use(requireRole('admin'))

usersRouter.get('/', async (_req, res) => {
  const users = await User.find().sort({ createdAt: 1 })
  res.json(users.map((u) => ({
    id: u.id, username: u.username, name: u.name, role: u.role, active: u.active,
    propertyId: u.propertyId ? String(u.propertyId) : null,
  })))
})

usersRouter.post('/', async (req, res) => {
  const body = createSchema.parse(req.body)
  if (await User.exists({ username: body.username })) {
    return res.status(409).json({ error: 'Username already exists' })
  }
  const propertyId = await resolvePropertyId(body.role, body.propertyId)
  const user = await User.create({
    username: body.username,
    passwordHash: await bcrypt.hash(body.password, 10),
    name: body.name,
    role: body.role,
    propertyId,
  })
  res.status(201).json({
    id: user.id, username: user.username, name: user.name, role: user.role, active: user.active,
    propertyId: user.propertyId ? String(user.propertyId) : null,
  })
})

usersRouter.patch('/:id', async (req, res) => {
  const body = updateSchema.parse(req.body)
  if (req.params.id === req.user.id && (body.role && body.role !== 'admin' || body.active === false)) {
    return res.status(400).json({ error: 'Cannot demote or deactivate yourself' })
  }
  if ((body.role && body.role !== 'admin' || body.active === false) && (await isLastActiveAdmin(req.params.id))) {
    return res.status(400).json({ error: 'Cannot remove the last active admin' })
  }
  const existing = await User.findById(req.params.id)
  if (!existing) return res.status(404).json({ error: 'User not found' })
  const nextRole = body.role ?? existing.role
  const propertyId = await resolvePropertyId(
    nextRole,
    body.propertyId !== undefined ? body.propertyId : existing.propertyId && String(existing.propertyId),
  )
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { ...body, propertyId },
    { new: true, runValidators: true },
  )
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({
    id: user.id, username: user.username, name: user.name, role: user.role, active: user.active,
    propertyId: user.propertyId ? String(user.propertyId) : null,
  })
})

usersRouter.post('/:id/password', async (req, res) => {
  const { password } = passwordSchema.parse(req.body)
  const user = await User.findByIdAndUpdate(req.params.id, { passwordHash: await bcrypt.hash(password, 10) })
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ ok: true })
})

usersRouter.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' })
  if (await isLastActiveAdmin(req.params.id)) return res.status(400).json({ error: 'Cannot remove the last active admin' })
  const user = await User.findByIdAndDelete(req.params.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ ok: true })
})
