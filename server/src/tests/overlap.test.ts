import { describe, it, expect } from 'vitest'
import { overlaps, overlapIdSet } from '../lib/overlap.js'

const bk = (checkinDate: string, checkoutDate: string, checkinTime = '15:00', checkoutTime = '10:00') =>
  ({ checkinDate, checkoutDate, checkinTime, checkoutTime })

describe('overlaps', () => {
  it('detects overnight collision', () => {
    expect(overlaps(bk('2026-08-15', '2026-08-16'), bk('2026-08-15', '2026-08-16'))).toBe(true)
    expect(overlaps(bk('2026-08-15', '2026-08-17'), bk('2026-08-16', '2026-08-18'))).toBe(true)
  })

  it('allows back-to-back (checkout 10:00, next checkin 15:00)', () => {
    expect(overlaps(bk('2026-08-15', '2026-08-16'), bk('2026-08-16', '2026-08-17'))).toBe(false)
  })

  it('allows same-day multi-bookings with default times (legacy behavior)', () => {
    expect(overlaps(bk('2026-08-15', '2026-08-15'), bk('2026-08-15', '2026-08-15'))).toBe(false)
  })

  it('detects same-day time collision', () => {
    expect(overlaps(bk('2026-08-15', '2026-08-15', '10:00', '14:00'), bk('2026-08-15', '2026-08-15', '12:00', '16:00'))).toBe(true)
    expect(overlaps(bk('2026-08-15', '2026-08-15', '10:00', '12:00'), bk('2026-08-15', '2026-08-15', '12:00', '16:00'))).toBe(false)
  })
})

describe('overlapIdSet', () => {
  it('flags only conflicting bookings', () => {
    const set = overlapIdSet([
      { id: 'a', ...bk('2026-08-15', '2026-08-16') },
      { id: 'b', ...bk('2026-08-15', '2026-08-16') },
      { id: 'c', ...bk('2026-08-20', '2026-08-21') },
    ])
    expect(set.has('a')).toBe(true)
    expect(set.has('b')).toBe(true)
    expect(set.has('c')).toBe(false)
  })
})
