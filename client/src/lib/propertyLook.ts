/**
 * A property's colour. One is derived from its id when none is set, so every property
 * looks distinct from the day it is created without anyone having to pick.
 */
const PALETTE = [
  '#2563eb', '#0d9488', '#c2410c', '#7c3aed',
  '#be123c', '#4d7c0f', '#0369a1', '#a16207',
]

export function propertyColor(property?: { id: string; color?: string } | null) {
  if (!property) return '#64748b'
  if (property.color) return property.color
  let hash = 0
  for (const ch of property.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}
