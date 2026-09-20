import { Router } from 'express'
import { z } from 'zod'
import { Property } from '../models/Property.js'
import { User } from '../models/User.js'
import { requireRole } from '../middleware/auth.js'

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  location: z.string().trim().max(120).default(''),
  address: z.string().trim().max(300).default(''),
  gstin: z.string().trim().max(20).default(''),
  invoicePrefix: z.string().trim().max(10).default('INV'),
  invoiceTerms: z.string().max(4000).optional(),
})

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  location: z.string().trim().max(120).optional(),
  active: z.boolean().optional(),
  address: z.string().trim().max(300).optional(),
  gstin: z.string().trim().max(20).optional(),
  invoicePrefix: z.string().trim().max(10).optional(),
  invoiceTerms: z.string().max(4000).optional(),
})

const shape = (p: {
  id: string; name: string; location: string; active: boolean
  address: string; gstin: string; invoicePrefix: string; invoiceTerms: string
}) => ({
  id: p.id, name: p.name, location: p.location, active: p.active,
  address: p.address, gstin: p.gstin, invoicePrefix: p.invoicePrefix,
  invoiceTerms: p.invoiceTerms,
})

export const propertiesRouter = Router()

// Every signed-in user needs the list to render the switcher; non-admins only ever get their own.
propertiesRouter.get('/', async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { _id: req.user.propertyId }
  const properties = await Property.find(filter).sort({ name: 1 })
  res.json(properties.map(shape))
})

propertiesRouter.use(requireRole('admin'))

propertiesRouter.post('/', async (req, res) => {
  const body = createSchema.parse(req.body)
  if (await Property.exists({ name: body.name })) {
    return res.status(409).json({ error: 'A property with that name already exists' })
  }
  const property = await Property.create(body)
  res.status(201).json(shape(property))
})

propertiesRouter.patch('/:id', async (req, res) => {
  const body = updateSchema.parse(req.body)
  const property = await Property.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true })
  if (!property) return res.status(404).json({ error: 'Property not found' })
  res.json(shape(property))
})

propertiesRouter.delete('/:id', async (req, res) => {
  const assigned = await User.countDocuments({ propertyId: req.params.id })
  if (assigned > 0) {
    return res.status(409).json({ error: `${assigned} user(s) are still assigned to this property` })
  }
  const property = await Property.findByIdAndDelete(req.params.id)
  if (!property) return res.status(404).json({ error: 'Property not found' })
  res.json({ ok: true })
})
