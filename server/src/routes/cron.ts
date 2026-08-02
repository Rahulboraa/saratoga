import { Router } from 'express'
import { buildWorkbook, buildRawJson, sendBackupEmail } from '../services/backup.js'

export const cronRouter = Router()

// Backup emails are paused along with the app (see SERVICE_HOLD in client/src/main.tsx).
// Set to false to resume; the Vercel cron entry also needs restoring in vercel.json.
const BACKUP_PAUSED = true

// Triggered by Vercel Cron (sends Authorization: Bearer $CRON_SECRET).
// Also allows manual trigger with the same header for testing.
cronRouter.get('/backup', async (req, res) => {
  if (BACKUP_PAUSED) return res.status(503).json({ error: 'Backups paused' })
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const [xlsx, json] = await Promise.all([buildWorkbook(), buildRawJson()])
    await sendBackupEmail(xlsx, json)
    res.json({ ok: true, sentAt: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Backup failed' })
  }
})
