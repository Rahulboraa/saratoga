import { describe, it, expect } from 'vitest'
import { buildConfirmation, nightsLabel, paxCount } from '../services/confirmation.js'

const property = {
  name: 'Saratoga',
  inclusions: 'glasshouse table and chairs (30 chairs)\n15kva generator',
  exclusions: 'decor\nbar tender\nice',
  confirmationNotes: '20% to be cleared 1 week prior.\n(+) ₹2,500 extra labour for dinner served after 1:00 AM',
}

const booking = {
  guest: 'Sid',
  phone: '9654326020',
  checkinDate: '2026-11-23',
  checkoutDate: '2026-11-25',
  checkinTime: '12:00',
  checkoutTime: '08:00',
  pax: '100',
  breakdown: { venue: 110000, catering: 150000, security: 15000 },
  collected: 30000,
  due: 245000,
}

describe('nightsLabel', () => {
  it('joins two nights, which is how dates get quoted', () => {
    expect(nightsLabel('2026-11-23', '2026-11-25')).toBe('23 & 24 November')
  })

  it('is a single date for a same-day booking', () => {
    expect(nightsLabel('2026-11-23', '2026-11-23')).toBe('23 November')
    expect(nightsLabel('2026-11-23', '')).toBe('23 November')
  })

  it('is a single date for one night', () => {
    expect(nightsLabel('2026-11-23', '2026-11-24')).toBe('23 November')
  })

  it('uses a range beyond two nights', () => {
    expect(nightsLabel('2026-11-23', '2026-11-27')).toBe('23–26 November')
  })

  it('spells out both months when the stay crosses one', () => {
    expect(nightsLabel('2026-11-30', '2026-12-03')).toBe('30 November – 2 December')
  })
})

describe('paxCount', () => {
  it('reads the number out of free text', () => {
    expect(paxCount('100')).toBe(100)
    expect(paxCount('100 guests')).toBe(100)
    expect(paxCount('approx 80 pax')).toBe(80)
  })

  it('is null when there is no number', () => {
    expect(paxCount('')).toBeNull()
    expect(paxCount('TBC')).toBeNull()
  })
})

describe('buildConfirmation', () => {
  it('reads like the message the team already sends', () => {
    expect(buildConfirmation(booking, property)).toBe(
      [
        '*Sid* | 23 & 24 November',
        '9654326020',
        '',
        'Pax : 100',
        'Check in : 12:00',
        'Check out : 08:00 (25 Nov)',
        '',
        'Rent : ₹1,10,000',
        'Dinner : ₹1,500/- per pax (100 pax = ₹1,50,000)',
        'Security : ₹15,000 (refundable)',
        'Advance received : ₹30,000',
        'Balance : ₹2,45,000',
        '',
        'Inclusions: glasshouse table and chairs (30 chairs), 15kva generator',
        '',
        'Exclusions: decor, bar tender, ice',
        '',
        '20% to be cleared 1 week prior.',
        '(+) ₹2,500 extra labour for dinner served after 1:00 AM',
      ].join('\n'),
    )
  })

  it('quotes catering as a total when it does not divide by the head count', () => {
    const out = buildConfirmation({ ...booking, breakdown: { catering: 145050 }, pax: '100' }, property)
    expect(out).toContain('Dinner : ₹1,45,050')
    expect(out).not.toContain('per pax')
  })

  it('leaves out charges that are not on the booking', () => {
    const out = buildConfirmation({ ...booking, breakdown: { venue: 50000 } }, property)
    expect(out).toContain('Rent : ₹50,000')
    expect(out).not.toContain('Dinner')
    expect(out).not.toContain('Security')
  })

  it('omits the checkout date for a same-day booking', () => {
    const out = buildConfirmation({ ...booking, checkoutDate: '2026-11-23' }, property)
    expect(out).toContain('Check out : 08:00\n')
    expect(out).not.toContain('(23 Nov)')
  })

  it('says nothing about money not yet taken or already settled', () => {
    const out = buildConfirmation({ ...booking, collected: 0, due: 0 }, property)
    expect(out).not.toContain('Advance received')
    expect(out).not.toContain('Balance')
  })

  it('works for a property that has set no inclusions or notes', () => {
    const bare = { name: 'X', inclusions: '', exclusions: '', confirmationNotes: '' }
    const out = buildConfirmation(booking, bare)
    expect(out).not.toContain('Inclusions')
    expect(out).not.toContain('Exclusions')
    expect(out.endsWith('Balance : ₹2,45,000')).toBe(true)
  })
})
