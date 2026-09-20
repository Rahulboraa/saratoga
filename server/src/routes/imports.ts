import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { requireRole } from '../middleware/auth.js'
import { parseFile, prepareRows, reportMapping, commitRows, IMPORT_TYPES, type ImportType } from '../services/importEngine.js'
import { writeProperty } from '../middleware/scope.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

export const importsRouter = Router()
importsRouter.use(requireRole('admin', 'manager'))

function guardType(role: string, type: ImportType, res: import('express').Response) {
  if (role !== 'admin' && type !== 'leads') {
    res.status(403).json({ error: 'Only leads can be imported by managers' })
    return false
  }
  return true
}

importsRouter.post('/preview', upload.single('file'), async (req, res) => {
  const type = z.enum(IMPORT_TYPES).parse(req.body.type) as ImportType
  if (!guardType(req.user.role, type, res)) return
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const propertyId = writeProperty(req, res)
  if (!propertyId) return
  const rawRows = parseFile(req.file.buffer)
  if (!rawRows.length) return res.status(400).json({ error: 'File has no data rows' })
  const mapping = reportMapping(type, Object.keys(rawRows[0]))
  const rows = await prepareRows(type, rawRows, propertyId)
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

importsRouter.post('/run', upload.single('file'), async (req, res) => {
  const type = z.enum(IMPORT_TYPES).parse(req.body.type) as ImportType
  if (!guardType(req.user.role, type, res)) return
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const propertyId = writeProperty(req, res)
  if (!propertyId) return
  const rawRows = parseFile(req.file.buffer)
  if (!rawRows.length) return res.status(400).json({ error: 'File has no data rows' })
  const prepared = await prepareRows(type, rawRows, propertyId)
  const result = await commitRows(type, prepared, 'skip', req.user.username, propertyId)
  const errors = prepared.filter((r) => !r.valid).slice(0, 5).map((r) => `Row ${r.index + 1}: ${r.errors[0]}`)
  res.json({ ...result, total: rawRows.length, errors })
})

const commitSchema = z.object({
  type: z.enum(IMPORT_TYPES),
  rows: z.array(z.record(z.string(), z.unknown())).min(1),
  mode: z.enum(['skip', 'update']).default('skip'),
})

importsRouter.post('/commit', async (req, res) => {
  const { type, rows, mode } = commitSchema.parse(req.body)
  const propertyId = writeProperty(req, res)
  if (!propertyId) return
  const prepared = await prepareRows(type, rows, propertyId)
  const result = await commitRows(type, prepared, mode, req.user.username, propertyId)
  res.json(result)
})
