import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import helmet from 'helmet'
import { authRouter } from './routes/auth.js'
import { usersRouter } from './routes/users.js'
import { bookingsRouter } from './routes/bookings.js'
import { paymentsRouter } from './routes/payments.js'
import { expensesRouter, expensePaymentsRouter } from './routes/expenses.js'
import { visitorsRouter } from './routes/visitors.js'
import { leadsRouter } from './routes/leads.js'
import { statsRouter } from './routes/stats.js'
import { importsRouter } from './routes/imports.js'
import { exportRouter } from './routes/exportData.js'
import { cronRouter } from './routes/cron.js'
import { searchRouter } from './routes/search.js'
import { propertiesRouter } from './routes/properties.js'
import { investmentsRouter } from './routes/investments.js'
import { maintenanceRouter } from './routes/maintenance.js'
import { expenseCategoriesRouter } from './routes/expenseCategories.js'
import { requireAuth } from './middleware/auth.js'
import { resolveScope } from './middleware/scope.js'
import { errorHandler } from './middleware/error.js'

function resolveClientDist() {
  try {
    return path.resolve(fileURLToPath(import.meta.url), '../../../client/dist')
  } catch {
    return path.resolve(process.cwd(), 'client/dist')
  }
}
const clientDist = resolveClientDist()

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/cron', cronRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/users', requireAuth, usersRouter)
  app.use('/api/properties', requireAuth, propertiesRouter)
  app.use('/api/maintenance', requireAuth, maintenanceRouter)
  app.use('/api/expense-categories', requireAuth, expenseCategoriesRouter)
  app.use('/api/bookings', requireAuth, resolveScope, bookingsRouter)
  app.use('/api/payments', requireAuth, resolveScope, paymentsRouter)
  app.use('/api/expenses', requireAuth, resolveScope, expensesRouter)
  app.use('/api/expense-payments', requireAuth, resolveScope, expensePaymentsRouter)
  app.use('/api/visitors', requireAuth, resolveScope, visitorsRouter)
  app.use('/api/leads', requireAuth, resolveScope, leadsRouter)
  app.use('/api/investments', requireAuth, resolveScope, investmentsRouter)
  app.use('/api/stats', requireAuth, resolveScope, statsRouter)
  app.use('/api/import', requireAuth, resolveScope, importsRouter)
  app.use('/api/export', requireAuth, resolveScope, exportRouter)
  app.use('/api/search', requireAuth, resolveScope, searchRouter)
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

  app.use(express.static(clientDist))
  app.get('*splat', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))

  app.use(errorHandler)
  return app
}
