import { Schema, model } from 'mongoose'

export const ROLES = ['admin', 'manager', 'sales', 'caretaker'] as const
export type Role = (typeof ROLES)[number]

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    // Admins span every property; everyone else is pinned to exactly one.
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', default: null, index: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const User = model('User', userSchema)
