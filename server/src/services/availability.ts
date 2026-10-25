import { Booking } from '../models/Booking.js'
import { Property } from '../models/Property.js'

const DAY = 86_400_000

const addDays = (ymd: string, n: number) =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)

export interface Held {
  checkinDate: string
  checkoutDate?: string | null
  units?: string[] | null
}

export interface FreeDate {
  date: string
  /** Which parts are still open. Empty at a project that is booked whole. */
  units: string[]
}

/**
 * The days a booking actually occupies.
 *
 * A stay that runs 14th to 15th holds the night of the 14th and is gone by 10am on the
 * 15th, so the 15th is free for the next check-in that afternoon — the same handover the
 * clash check already allows. A single-day event holds only its own day.
 */
export function heldDates(b: Held): string[] {
  const start = b.checkinDate
  const end = b.checkoutDate && b.checkoutDate > start ? addDays(b.checkoutDate, -1) : start
  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

/**
 * What is still sellable across a window.
 *
 * A project with no parts gives a date with an empty unit list, meaning the whole place
 * is open. A split project gives the parts nobody has taken, so a date half sold still
 * shows up with the villa that is left.
 */
export function freeDatesIn(from: string, to: string, projectUnits: string[], held: Held[]): FreeDate[] {
  const takenByDate = new Map<string, Set<string>>()
  const wholeByDate = new Set<string>()

  for (const b of held) {
    const units = b.units ?? []
    for (const date of heldDates(b)) {
      // No units means the booking took everything, at a split project or otherwise.
      if (!units.length) { wholeByDate.add(date); continue }
      if (!takenByDate.has(date)) takenByDate.set(date, new Set())
      for (const u of units) takenByDate.get(date)!.add(u)
    }
  }

  const out: FreeDate[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (wholeByDate.has(date)) continue
    if (!projectUnits.length) {
      if (!takenByDate.has(date)) out.push({ date, units: [] })
      continue
    }
    const taken = takenByDate.get(date) ?? new Set()
    const free = projectUnits.filter((u) => !taken.has(u))
    if (free.length) out.push({ date, units: free })
  }
  return out
}

/** Reads the bookings and the project's parts, then works out what is still open. */
export async function freeDates(scope: Record<string, unknown>, propertyId: string | null, from: string, to: string) {
  const project = propertyId ? await Property.findById(propertyId).select('units') : null
  const bookings = await Booking.find({
    ...scope,
    checkinDate: { $lte: to },
    $or: [{ checkoutDate: { $gte: from } }, { checkoutDate: '', checkinDate: { $gte: from } }],
  }).select('checkinDate checkoutDate units').lean<Held[]>()

  return freeDatesIn(from, to, project?.units ?? [], bookings)
}
