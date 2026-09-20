import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import { migrationStatus, stampExistingRecords, backfillVisitorTypes } from '../services/migrations.js'

export const maintenanceRouter = Router()
maintenanceRouter.use(requireRole('admin'))

maintenanceRouter.get('/status', async (_req, res) => {
  res.json(await migrationStatus())
})

// One-time data migration, safe to repeat: it only fills in what is still missing.
maintenanceRouter.post('/migrate', async (_req, res) => {
  const stamped = await stampExistingRecords()
  const visitorTypes = await backfillVisitorTypes()
  res.json({ ...stamped, visitorTypes, status: await migrationStatus() })
})
