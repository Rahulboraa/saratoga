import type { Request, Response, NextFunction } from 'express'
import { Types } from 'mongoose'
import { Property } from '../models/Property.js'

export interface Scope {
  /** The property this request is pinned to, or null when an admin is viewing all of them. */
  propertyId: string | null
  /** Ready-made Mongo filter: `{}` for an all-properties admin view. */
  filter: Record<string, unknown>
}

declare module 'express-serve-static-core' {
  interface Request {
    scope: Scope
  }
}

function requested(req: Request) {
  const header = req.headers['x-property']
  const raw = Array.isArray(header) ? header[0] : header ?? (req.query.property as string | undefined)
  const value = String(raw ?? '').trim()
  return value && value !== 'all' ? value : ''
}

/**
 * Resolves which property the request may touch. Non-admins are locked to their own
 * property and cannot widen it; admins pick one with the `x-property` header, or see all.
 */
export async function resolveScope(req: Request, res: Response, next: NextFunction) {
  if (req.user.role !== 'admin') {
    if (!req.user.propertyId) return res.status(403).json({ error: 'No property assigned. Ask an admin to assign one.' })
    req.scope = { propertyId: req.user.propertyId, filter: { propertyId: new Types.ObjectId(req.user.propertyId) } }
    return next()
  }

  const wanted = requested(req)
  if (!wanted) {
    req.scope = { propertyId: null, filter: {} }
    return next()
  }
  if (!Types.ObjectId.isValid(wanted)) return res.status(400).json({ error: 'Invalid property' })
  if (!(await Property.exists({ _id: wanted }))) return res.status(404).json({ error: 'Property not found' })
  req.scope = { propertyId: wanted, filter: { propertyId: new Types.ObjectId(wanted) } }
  next()
}

/** Merges a route's own filter with the caller's property scope. */
export function scoped(req: Request, filter: Record<string, unknown> = {}) {
  return { ...filter, ...req.scope.filter }
}

/**
 * The property a new record belongs to. An admin looking at all properties has to pick
 * one before writing, so rows can never land without an owner.
 */
export function writeProperty(req: Request, res: Response): string | null {
  if (req.scope.propertyId) return req.scope.propertyId
  res.status(400).json({ error: 'Select a property before adding records' })
  return null
}
