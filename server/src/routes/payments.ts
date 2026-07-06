import { Router } from 'express'
import { Payment } from '../models/Payment.js'
import { requireRole } from '../middleware/auth.js'
import { paymentSchema } from '../validation/schemas.js'
import { serializePayment } from '../lib/sanitize.js'

export const paymentsRouter = Router()
paymentsRouter.use(requireRole('admin', 'manager'))

paymentsRouter.patch('/:id', async (req, res) => {
  const body = paymentSchema.partial().parse(req.body)
  const payment = await Payment.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true })
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  res.json(serializePayment(payment.toObject()))
})

paymentsRouter.delete('/:id', async (req, res) => {
  const payment = await Payment.findByIdAndDelete(req.params.id)
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  res.json({ ok: true })
})
