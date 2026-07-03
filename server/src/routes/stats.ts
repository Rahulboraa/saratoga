import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import { dashboardStats, incentiveStats } from '../services/stats.js'

export const statsRouter = Router()

statsRouter.get('/dashboard', requireRole('admin', 'manager', 'sales'), async (req, res) => {
  res.json(await dashboardStats(req.user.role))
})

statsRouter.get('/incentives', requireRole('admin'), async (req, res) => {
  const month = req.query.month ? String(req.query.month) : undefined
  res.json(await incentiveStats(month))
})
