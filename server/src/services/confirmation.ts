const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const money = (n: number) => `₹${inr.format(n)}`
const parts = (ymd: string) => ymd.split('-').map(Number) as [number, number, number]
const shortDate = (ymd: string) => {
  const [, m, d] = parts(ymd)
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`
}

function addDays(ymd: string, n: number) {
  const [y, m, d] = parts(ymd)
  const date = new Date(Date.UTC(y, m - 1, d + n))
  return date.toISOString().slice(0, 10)
}

/**
 * The nights the guest actually has the place: check-in up to the day before checkout.
 * A booking that checks out the morning after two nights reads "23 & 24 November", which
 * is how the dates get quoted in conversation.
 */
export function nightsLabel(checkinDate: string, checkoutDate: string) {
  const [, ciM, ciD] = parts(checkinDate)
  const last = !checkoutDate || checkoutDate <= checkinDate ? checkinDate : addDays(checkoutDate, -1)
  const [, loM, loD] = parts(last)

  if (last === checkinDate) return `${ciD} ${MONTHS[ciM - 1]}`
  if (ciM === loM) {
    // Two consecutive nights read better joined than as a range.
    return loD - ciD === 1
      ? `${ciD} & ${loD} ${MONTHS[ciM - 1]}`
      : `${ciD}–${loD} ${MONTHS[ciM - 1]}`
  }
  return `${ciD} ${MONTHS[ciM - 1]} – ${loD} ${MONTHS[loM - 1]}`
}

/** First number in a free-text pax field, so "100 guests" and "100" both work. */
export function paxCount(pax: string) {
  const match = /\d+/.exec(pax ?? '')
  return match ? Number(match[0]) : null
}

export interface ConfirmationBooking {
  guest: string
  phone: string
  checkinDate: string
  checkoutDate: string
  checkinTime: string
  checkoutTime: string
  pax: string
  notes?: string
  breakdown?: Partial<Record<'venue' | 'catering' | 'decor' | 'music' | 'cleaning' | 'license' | 'security', number>> | null
  collected: number
  due: number
}

export interface ConfirmationProperty {
  name: string
  inclusions: string
  exclusions: string
  confirmationNotes: string
}

const lines = (block: string) => (block ?? '').split('\n').map((l) => l.trim()).filter(Boolean)

/**
 * The confirmation a guest is sent on WhatsApp. Built from the booking so the figures
 * cannot drift from what was recorded, and left as plain text so it can be edited before
 * it goes out — inclusions differ from one event to the next.
 */
export function buildConfirmation(booking: ConfirmationBooking, property: ConfirmationProperty) {
  const b = booking.breakdown ?? {}
  const out: string[] = []

  out.push(`*${booking.guest}* | ${nightsLabel(booking.checkinDate, booking.checkoutDate)}`)
  if (booking.phone) out.push(booking.phone)
  out.push('')

  if (booking.pax) out.push(`Pax : ${booking.pax}`)
  if (booking.checkinTime) out.push(`Check in : ${booking.checkinTime}`)
  if (booking.checkoutTime) {
    const sameDay = !booking.checkoutDate || booking.checkoutDate === booking.checkinDate
    out.push(`Check out : ${booking.checkoutTime}${sameDay ? '' : ` (${shortDate(booking.checkoutDate)})`}`)
  }
  out.push('')

  const pax = paxCount(booking.pax)
  const charge = (label: string, amount: number | undefined, suffix = '') => {
    if (!amount) return
    out.push(`${label} : ${money(amount)}${suffix}`)
  }

  charge('Rent', b.venue)
  if (b.catering) {
    // Catering is quoted per head when it divides cleanly; otherwise the total stands alone.
    const perPax = pax && b.catering % pax === 0 ? b.catering / pax : null
    out.push(perPax
      ? `Dinner : ${money(perPax)}/- per pax (${pax} pax = ${money(b.catering)})`
      : `Dinner : ${money(b.catering)}`)
  }
  charge('Decor', b.decor)
  charge('Led wall / speaker', b.music)
  charge('Cleaning', b.cleaning)
  charge('License', b.license)
  charge('Security', b.security, ' (refundable)')

  if (booking.collected > 0) out.push(`Advance received : ${money(booking.collected)}`)
  if (booking.due > 0) out.push(`Balance : ${money(booking.due)}`)

  const inclusions = lines(property.inclusions)
  const exclusions = lines(property.exclusions)
  const notes = lines(property.confirmationNotes)

  // What was agreed for this booking sits with the figures it qualifies — a line like
  // "200 per pax if outside vendor" belongs next to the charges, not after the boilerplate.
  if (booking.notes) out.push('', booking.notes)

  if (inclusions.length) out.push('', `Inclusions: ${inclusions.join(', ')}`)
  if (exclusions.length) out.push('', `Exclusions: ${exclusions.join(', ')}`)
  if (notes.length) out.push('', ...notes)

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
