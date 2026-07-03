import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { User } from '../models/User.js'
import { requireAuth, signToken, type AuthUser } from '../middleware/auth.js'

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false })

const loginSchema = z.object({
  username: z.string().min(1).transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1),
})

export const authRouter = Router()

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = loginSchema.parse(req.body)
  const user = await User.findOne({ username, active: true }).select('+passwordHash')
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid username or password' })
  }
  const authUser: AuthUser = { id: user.id, username: user.username, name: user.name, role: user.role }
  res.json({ token: signToken(authUser), user: authUser })
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})
