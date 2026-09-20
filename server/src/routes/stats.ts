import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import { dashboardStats, incentiveStats } from '../services/stats.js'
import { accountReport } from '../services/accounts.js'

export const statsRouter = Router()

statsRouter.get('/dashboard', requireRole('admin', 'manager', 'sales'), async (req, res) => {
  res.json(await dashboardStats(req.user.role, req.scope.filter))
})

statsRouter.get('/accounts', requireRole('admin'), async (req, res) => {
  const { month, account } = req.query as Record<string, string | undefined>
  res.json(await accountReport(req.scope.filter, month, account))
})

statsRouter.get('/incentives', requireRole('admin'), async (req, res) => {
  // Slabs run per property, so a combined view would invent a figure nobody is owed.
  if (!req.scope.propertyId) return res.status(400).json({ error: 'Select a property to view incentives' })
  const month = req.query.month ? String(req.query.month) : undefined
  res.json(await incentiveStats(req.scope.filter, month))
})
