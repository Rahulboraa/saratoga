import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import { migrationStatus, stampExistingRecords, backfillVisitorTypes } from '../services/migrations.js'

export const maintenanceRouter = Router()
maintenanceRouter.use(requireRole('admin'))

maintenanceRouter.get('/status', async (_req, res) => {
  res.json(await migrationStatus())
})

// One-time data migration, safe to repeat: it only fills in what is still missing.
maintenanceRouter.post('/migrate', async (req, res) => {
  try {
    // ?redoOther=1 re-reads visitors an earlier, blunter pass dumped into Other.
    const redoOther = String(req.query.redoOther ?? '') === '1'
    const stamped = await stampExistingRecords()
    const visitorTypes = await backfillVisitorTypes({ redoOther })
    res.json({ ...stamped, visitorTypes, status: await migrationStatus() })
  } catch (err) {
    // Admin-only, and the admin is the one who has to decide what to do about it.
    console.error('migration failed', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Migration failed' })
  }
})
