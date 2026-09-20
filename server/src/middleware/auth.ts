import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../env.js'
import type { Role } from '../models/User.js'

export interface AuthUser {
  id: string
  username: string
  name: string
  role: Role
  /** null for admins, who span every property. */
  propertyId: string | null
}

declare module 'express-serve-static-core' {
  interface Request {
    user: AuthUser
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: '30d' })
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser & { iat: number; exp: number }
    req.user = {
      id: payload.id,
      username: payload.username,
      name: payload.name,
      role: payload.role,
      propertyId: payload.propertyId ?? null,
    }
    res.setHeader('x-refresh-token', signToken(req.user))
    next()
  } catch {
    return res.status(401).json({ error: 'Session expired' })
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}
