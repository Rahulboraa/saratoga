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
import { requireAuth } from './middleware/auth.js'
import { errorHandler } from './middleware/error.js'

const clientDist = path.resolve(fileURLToPath(import.meta.url), '../../../client/dist')

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', authRouter)
  app.use('/api/users', requireAuth, usersRouter)
  app.use('/api/bookings', requireAuth, bookingsRouter)
  app.use('/api/payments', requireAuth, paymentsRouter)
  app.use('/api/expenses', requireAuth, expensesRouter)
  app.use('/api/expense-payments', requireAuth, expensePaymentsRouter)
  app.use('/api/visitors', requireAuth, visitorsRouter)
  app.use('/api/leads', requireAuth, leadsRouter)
  app.use('/api/stats', requireAuth, statsRouter)
  app.use('/api/import', requireAuth, importsRouter)
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

  app.use(express.static(clientDist))
  app.get('*splat', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))

  app.use(errorHandler)
  return app
}
