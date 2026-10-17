/**
 * One list for a lead's event type and a booking's purpose. They describe the same thing
 * — what the event is — and keeping them apart meant a lead could not be compared with
 * the booking it turned into, which is the whole point of recording it.
 */
export const EVENT_TYPES = [
  'Birthday/Anniversary',
  'Corporate Party',
  'Kitty / Private Party',
  'Wedding/Pre-wedding',
  'Shoot',
  'Stays',
  'Other',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

/**
 * What the old, separate lists become. "Party" has no home here: it covered birthdays,
 * kitty parties and corporate alike, and nothing recorded says which — so it lands in
 * Other rather than inventing a figure for next year's targeting to rest on.
 */
export const LEGACY_EVENT_TYPES: Record<string, EventType> = {
  // bookings
  'Party': 'Other',
  'Kids Birthday': 'Birthday/Anniversary',
  'Pre-wedding': 'Wedding/Pre-wedding',
  // leads
  'Kitty Party': 'Kitty / Private Party',
  'Birthday / Anniversary / Milestone': 'Birthday/Anniversary',
  'Corporate / Office Party': 'Corporate Party',
  'Wedding / Engagement': 'Wedding/Pre-wedding',
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Keywords, most specific first. Several names contain "party", so a bare "party" must
 * not be allowed to land on one of them by substring luck — it falls through to Other,
 * which is the same call the migration makes and for the same reason.
 */
const KEYWORDS: [EventType, string[]][] = [
  // Only "kitty": Meta's private_celebrations is a catch-all meaning some celebration
  // or other, so matching "private" would file every one of them here on no evidence.
  ['Kitty / Private Party', ['kitty']],
  ['Corporate Party', ['corporate', 'office', 'company', 'team', 'offsite', 'conference']],
  ['Wedding/Pre-wedding', ['wedding', 'prewedding', 'engagement', 'roka', 'sangeet', 'mehendi', 'haldi']],
  ['Birthday/Anniversary', ['birthday', 'bday', 'anniversary', 'milestone']],
  ['Shoot', ['shoot', 'shooting', 'photography', 'filming', 'podcast', 'webseries']],
  ['Stays', ['stay', 'stays', 'overnight', 'staycation']],
]

/**
 * Best reading of a free-text event type — a spreadsheet column, a Meta lead export, or
 * one of the old list values. Anything unreadable becomes Other rather than a guess.
 */
export function eventTypeFrom(value: unknown): EventType {
  const raw = String(value ?? '').trim()
  if (!raw) return 'Other'

  const exact = EVENT_TYPES.find((t) => norm(t) === norm(raw))
  if (exact) return exact

  const legacy = LEGACY_EVENT_TYPES[raw]
  if (legacy) return legacy

  const text = norm(raw)
  for (const [type, words] of KEYWORDS) {
    if (words.some((w) => text.includes(w))) return type
  }
  return 'Other'
}
