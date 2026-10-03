import { describe, it, expect } from 'vitest'
import { bookingAdminSchema, leadManagerSchema } from '../validation/schemas.js'

describe('editing a record written before the event type lists merged', () => {
  const booking = {
    guest: 'Old', phone: '1', checkinDate: '2026-10-03', checkoutDate: '2026-10-04',
  }

  it('accepts a legacy purpose instead of refusing the save', () => {
    // These are on 125 live bookings. Rejecting them made an old booking uneditable.
    for (const [from, to] of [
      ['Party', 'Other'],
      ['Kids Birthday', 'Birthday/Anniversary'],
      ['Pre-wedding', 'Wedding/Pre-wedding'],
    ]) {
      const out = bookingAdminSchema.parse({ ...booking, purpose: from })
      expect(out.purpose, `${from} should save as ${to}`).toBe(to)
    }
  })

  it('still accepts the current list unchanged', () => {
    for (const t of ['Kitty Party', 'Stays', 'Shoot', 'Corporate Party']) {
      expect(bookingAdminSchema.parse({ ...booking, purpose: t }).purpose).toBe(t)
    }
  })

  it('falls back to Other for a missing or unreadable type', () => {
    expect(bookingAdminSchema.parse(booking).purpose).toBe('Other')
    expect(bookingAdminSchema.parse({ ...booking, purpose: 'nonsense' }).purpose).toBe('Other')
  })

  it('leaves the type alone on a partial update that does not mention it', () => {
    // A PATCH carries only what changed. Defaulting here would reset the event type of
    // every booking edited for an unrelated reason.
    const patched = bookingAdminSchema.partial().parse({ guest: 'Renamed' })
    expect('purpose' in patched).toBe(false)
  })

  it('does the same for a lead', () => {
    const lead = { date: '2026-10-03', name: 'X', phone: '1' }
    expect(leadManagerSchema.parse({ ...lead, eventType: 'Wedding / Engagement' }).eventType).toBe('Wedding/Pre-wedding')
    expect(leadManagerSchema.parse(lead).eventType).toBe('Other')
  })
})
