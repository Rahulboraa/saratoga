import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import mongoose from 'mongoose'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: err.message })
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
