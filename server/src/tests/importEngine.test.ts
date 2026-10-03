import { describe, it, expect } from 'vitest'
import { mapRow, normalizeRow } from '../services/importEngine.js'
import { normalizeDate, normalizeNumber } from '../lib/dates.js'

describe('normalizeDate', () => {
  it('handles formats', () => {
    expect(normalizeDate('2026-08-15')).toBe('2026-08-15')
    expect(normalizeDate('15/08/2026')).toBe('2026-08-15')
    expect(normalizeDate('2026-08-15T10:00:00Z')).toBe('2026-08-15')
    expect(normalizeDate(46249)).toBe('2026-08-15')
    expect(normalizeDate('')).toBe('')
  })
})

describe('normalizeNumber', () => {
  it('strips currency formatting', () => {
    expect(normalizeNumber('₹50,000')).toBe(50000)
    expect(normalizeNumber('1,20,000')).toBe(120000)
    expect(normalizeNumber('abc')).toBe(0)
    expect(normalizeNumber(750.5)).toBe(750.5)
  })
})

describe('booking import', () => {
  it('maps legacy sheet columns and computes fields', () => {
    const raw = {
      id: 42, guest: 'Sharma', phone: '9876543210', date: '15/08/2026', checkout: '',
      checkinTime: '15:00', checkoutTime: '10:00', purpose: 'party', source: 'airbnb',
      venue: '₹40,000', catering: 10000, received: 5000,
    }
    const out = normalizeRow('bookings', mapRow('bookings', raw)) as Record<string, unknown>
    expect(out.legacyId).toBe('42')
    expect(out.checkinDate).toBe('2026-08-15')
    // A bare "party" says nothing about which kind, so it lands on Other.
    expect(out.purpose).toBe('Other')
    expect(out.source).toBe('Airbnb')
    expect((out.breakdown as Record<string, number>).venue).toBe(40000)
    expect(out.legacyReceived).toBe(5000)
  })

  it('round-trips normalized data (commit re-validation)', () => {
    const first = normalizeRow('bookings', mapRow('bookings', { guest: 'G', date: '2026-08-15', venue: 100 }))
    const second = normalizeRow('bookings', mapRow('bookings', first))
    expect(second).toEqual(first)
  })
})

describe('lead import', () => {
  it('maps legacy CRM columns and merges extras into notes', () => {
    const raw = {
      Name: 'Priya', phone_number: 'p:+918076031930', email: 'p@x.com', state: 'Delhi',
      'Family_gathering_/party': 'Wedding / Engagement', 'Remark 1': 'call evening',
    }
    const out = normalizeRow('leads', mapRow('leads', raw)) as Record<string, unknown>
    expect(out.phone).toBe('+918076031930')
    expect(out.eventType).toBe('Wedding/Pre-wedding')
    expect(out.notes).toContain('call evening')
    expect(out.notes).toContain('Email: p@x.com')
    expect(out.notes).toContain('State: Delhi')
  })

  it('normalizes emoji flags', () => {
    const out = normalizeRow('leads', mapRow('leads', { name: 'X', phone: '9', date: '2026-07-01', flag: '🔴 Escalate' })) as Record<string, unknown>
    expect(out.flag).toBe('escalate')
  })
})

describe('expense import', () => {
  it('coerces category and amount', () => {
    const out = normalizeRow('expenses', mapRow('expenses', {
      date: '01/07/2026', category: 'meta ads', description: 'FB campaign', totalAmount: '₹12,000', to: 'Meta',
    })) as Record<string, unknown>
    expect(out.cat).toBe('Meta Ads')
    expect(out.amount).toBe(12000)
    expect(out.vendor).toBe('Meta')
    expect(out.date).toBe('2026-07-01')
  })
})
