interface Span {
  checkinDate: string
  checkoutDate?: string
  checkinTime?: string
  checkoutTime?: string
}

export function spanOf(b: Span): [string, string] {
  const start = `${b.checkinDate}T${b.checkinTime || '15:00'}`
  const end = `${b.checkoutDate || b.checkinDate}T${b.checkoutTime || '10:00'}`
  return [start, end]
}

export function overlaps(a: Span, b: Span) {
  const [aStart, aEnd] = spanOf(a)
  const [bStart, bEnd] = spanOf(b)
  return aStart < bEnd && bStart < aEnd
}

export function overlapIdSet<T extends Span & { id: string }>(bookings: T[]): Set<string> {
  const out = new Set<string>()
  const sorted = [...bookings].sort((x, y) => spanOf(x)[0].localeCompare(spanOf(y)[0]))
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (spanOf(sorted[j])[0] >= spanOf(sorted[i])[1]) break
      if (overlaps(sorted[i], sorted[j])) {
        out.add(sorted[i].id)
        out.add(sorted[j].id)
      }
    }
  }
  return out
}

interface Occupancy extends Span {
  /** Which units this booking takes. Empty means the whole project. */
  units?: string[] | null
}

/**
 * Whether two bookings are after the same space.
 *
 * An empty list means the whole project, so it stands against everything — that covers
 * both a guest taking the entire place and every booking written before a project was
 * split into units.
 */
export function sharesUnit(a: Occupancy, b: Occupancy) {
  const left = a.units ?? []
  const right = b.units ?? []
  if (!left.length || !right.length) return true
  return left.some((unit) => right.includes(unit))
}

/** Two bookings clash only when they want the same space at the same time. */
export function conflicts(a: Occupancy, b: Occupancy) {
  return overlaps(a, b) && sharesUnit(a, b)
}

/**
 * Bookings that collide with another. Same sweep as before, but two bookings sitting on
 * the same dates in different villas are no longer a collision.
 */
export function conflictIdSet<T extends Occupancy & { id: string }>(bookings: T[]): Set<string> {
  const out = new Set<string>()
  const sorted = [...bookings].sort((x, y) => spanOf(x)[0].localeCompare(spanOf(y)[0]))
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (spanOf(sorted[j])[0] >= spanOf(sorted[i])[1]) break
      if (conflicts(sorted[i], sorted[j])) {
        out.add(sorted[i].id)
        out.add(sorted[j].id)
      }
    }
  }
  return out
}
