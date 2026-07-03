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
