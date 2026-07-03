import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'

const SEED_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin', name: 'Admin' },
  { username: 'akhil', password: 'akhil123', role: 'manager', name: 'Akhil' },
  { username: 'simran', password: 'simran123', role: 'sales', name: 'Simran' },
  { username: 'deepak', password: 'deepak123', role: 'sales', name: 'Deepak' },
  { username: 'caretaker', password: 'villa2024', role: 'caretaker', name: 'Caretaker' },
] as const

export async function ensureSeedUsers() {
  for (const u of SEED_USERS) {
    const exists = await User.exists({ username: u.username })
    if (exists) continue
    await User.create({
      username: u.username,
      passwordHash: await bcrypt.hash(u.password, 10),
      role: u.role,
      name: u.name,
    })
    console.log(`seeded user ${u.username}`)
  }
}
