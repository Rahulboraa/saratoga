import { describe, it, expect } from 'vitest'
import { EVENT_TYPES, LEGACY_EVENT_TYPES } from '../models/eventTypes.js'

describe('the shared event type list', () => {
  it('is the list the client asked for, in order', () => {
    expect(EVENT_TYPES).toEqual([
      'Birthday/Anniversary',
      'Corporate Party',
      'Kitty / Private Party',
      'Wedding/Pre-wedding',
      'Shoot',
      'Stays',
      'Other',
    ])
  })

  it('maps every value the old booking and lead lists could hold', () => {
    const oldBooking = ['Party', 'Shoot', 'Pre-wedding', 'Kids Birthday', 'Other']
    const oldLead = [
      'Birthday / Anniversary / Milestone', 'Corporate / Office Party',
      'Wedding / Engagement', 'Shoot', 'Other',
    ]
    for (const value of [...oldBooking, ...oldLead]) {
      const landed = LEGACY_EVENT_TYPES[value] ?? (EVENT_TYPES as readonly string[]).includes(value) ? true : false
      expect(landed, `${value} has nowhere to go`).toBe(true)
    }
  })

  it('sends "Party" to Other rather than guessing which kind it was', () => {
    // 97 bookings carried this, covering birthdays, kitty parties and corporate alike,
    // with nothing recorded to tell them apart. Guessing would make the targeting
    // figures it feeds look authoritative while being invented.
    expect(LEGACY_EVENT_TYPES['Party']).toBe('Other')
  })

  it('keeps the unambiguous ones', () => {
    expect(LEGACY_EVENT_TYPES['Kids Birthday']).toBe('Birthday/Anniversary')
    expect(LEGACY_EVENT_TYPES['Pre-wedding']).toBe('Wedding/Pre-wedding')
    expect(LEGACY_EVENT_TYPES['Corporate / Office Party']).toBe('Corporate Party')
    expect(LEGACY_EVENT_TYPES['Wedding / Engagement']).toBe('Wedding/Pre-wedding')
  })

  it('never maps anything onto a name that is not on the list', () => {
    for (const to of Object.values(LEGACY_EVENT_TYPES)) {
      expect(EVENT_TYPES).toContain(to)
    }
  })
})

describe('eventTypeFrom', () => {
  it('reads the values on the list, however they are typed', async () => {
    const { eventTypeFrom } = await import('../models/eventTypes.js')
    expect(eventTypeFrom('Kitty / Private Party')).toBe('Kitty / Private Party')
    expect(eventTypeFrom('kitty party')).toBe('Kitty / Private Party')
    expect(eventTypeFrom('Stays')).toBe('Stays')
  })

  it('carries a stored "Kitty Party" onto the renamed entry', async () => {
    const { eventTypeFrom } = await import('../models/eventTypes.js')
    // What every existing booking and lead holds today, so the rename must not orphan them.
    expect(LEGACY_EVENT_TYPES['Kitty Party']).toBe('Kitty / Private Party')
    expect(eventTypeFrom('Kitty Party')).toBe('Kitty / Private Party')
  })

  it('leaves Meta\'s catch-all alone despite the new label', async () => {
    const { eventTypeFrom } = await import('../models/eventTypes.js')
    // "Private" is in the label now, but private_celebrations still says only that it is
    // a celebration — filing those as kitty parties would invent a figure.
    expect(eventTypeFrom('private_celebrations')).toBe('Other')
  })

  it('refuses to guess which kind of party a bare "party" was', async () => {
    const { eventTypeFrom } = await import('../models/eventTypes.js')
    // Three names on the list contain the word; picking one by substring would be luck.
    expect(eventTypeFrom('party')).toBe('Other')
    expect(eventTypeFrom('Party')).toBe('Other')
  })

  it('reads a qualified party properly', async () => {
    const { eventTypeFrom } = await import('../models/eventTypes.js')
    expect(eventTypeFrom('kitty party')).toBe('Kitty / Private Party')
    expect(eventTypeFrom('Corporate / Office Party')).toBe('Corporate Party')
    expect(eventTypeFrom('office party for 40')).toBe('Corporate Party')
  })

  it('reads the Meta lead export values', async () => {
    const { eventTypeFrom } = await import('../models/eventTypes.js')
    expect(eventTypeFrom('curated_stays')).toBe('Stays')
    expect(eventTypeFrom('brand_/_fashion_/_podcast_/_web_series_shoots')).toBe('Shoot')
    expect(eventTypeFrom('Adult Bday, catering + Decor + DJ')).toBe('Birthday/Anniversary')
    // Meta's catch-all says only that it is a celebration, not which.
    expect(eventTypeFrom('private_celebrations')).toBe('Other')
    expect(eventTypeFrom('or_just_exploring_for_a_future_celebration…')).toBe('Other')
  })

  it('is Other for blank or unreadable text', async () => {
    const { eventTypeFrom } = await import('../models/eventTypes.js')
    expect(eventTypeFrom('')).toBe('Other')
    expect(eventTypeFrom(null)).toBe('Other')
    expect(eventTypeFrom('xyz')).toBe('Other')
  })
})
