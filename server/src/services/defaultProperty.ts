import { Property } from '../models/Property.js'

export const DEFAULT_PROPERTY_NAME = 'Saratoga Villa'

/**
 * The property every pre-multi-property record belongs to. Created on demand so a fresh
 * database, a seed run and the migration all land on the same row.
 */
export async function ensureDefaultProperty() {
  const existing = await Property.findOne({ name: DEFAULT_PROPERTY_NAME })
  if (existing) return existing
  const anyProperty = await Property.findOne().sort({ createdAt: 1 })
  if (anyProperty) return anyProperty
  return Property.create({ name: DEFAULT_PROPERTY_NAME })
}
