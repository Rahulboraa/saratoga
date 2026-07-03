import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { requireRole } from '../middleware/auth.js'
import { parseFile, prepareRows, reportMapping, commitRows, IMPORT_TYPES, type ImportType } from '../services/importEngine.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

export const importsRouter = Router()
importsRouter.use(requireRole('admin'))

importsRouter.post('/preview', upload.single('file'), async (req, res) => {
  const type = z.enum(IMPORT_TYPES).parse(req.body.type) as ImportType
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const rawRows = parseFile(req.file.buffer)
  if (!rawRows.length) return res.status(400).json({ error: 'File has no data rows' })
  const mapping = reportMapping(type, Object.keys(rawRows[0]))
  const rows = await prepareRows(type, rawRows)
  res.json({
    mapping,
    rows,
    summary: {
      total: rows.length,
      valid: rows.filter((r) => r.valid).length,
      invalid: rows.filter((r) => !r.valid).length,
      duplicates: rows.filter((r) => r.duplicate).length,
    },
  })
})

const commitSchema = z.object({
  type: z.enum(IMPORT_TYPES),
  rows: z.array(z.record(z.string(), z.unknown())).min(1),
  mode: z.enum(['skip', 'update']).default('skip'),
})

importsRouter.post('/commit', async (req, res) => {
  const { type, rows, mode } = commitSchema.parse(req.body)
  const prepared = await prepareRows(type, rows)
  const result = await commitRows(type, prepared, mode, req.user.username)
  res.json(result)
})
