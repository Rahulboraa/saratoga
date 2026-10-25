import { describe, it, expect } from 'vitest'
import { sharesUnit, conflicts, conflictIdSet } from '../lib/overlap.js'

/** An afternoon-to-late-night event, which is what most same-day bookings are. */
const day = (checkinDate: string, units?: string[]) => ({
  checkinDate, checkoutDate: checkinDate, checkinTime: '15:00', checkoutTime: '23:00', units,
})

describe('sharing a villa', () => {
  it('two bookings in different villas do not share', () => {
    expect(sharesUnit(day('2026-11-01', ['Villa 1']), day('2026-11-01', ['Villa 2']))).toBe(false)
  })

  it('the same villa shares', () => {
    expect(sharesUnit(day('2026-11-01', ['Villa 1']), day('2026-11-01', ['Villa 1']))).toBe(true)
  })

  it('a whole-place booking stands against every villa', () => {
    // Empty means the guest took everything, so nothing else can be sold that day.
    expect(sharesUnit(day('2026-11-01', []), day('2026-11-01', ['Villa 2']))).toBe(true)
    expect(sharesUnit(day('2026-11-01', ['Villa 2']), day('2026-11-01', []))).toBe(true)
  })

  it('treats a booking written before the split as the whole place', () => {
    // Those rows carry no villa at all. Reading them as "one villa" would let the other
    // be sold over a booking that in fact had the run of the property.
    expect(sharesUnit(day('2026-11-01'), day('2026-11-01', ['Villa 1']))).toBe(true)
    expect(sharesUnit(day('2026-11-01', null as never), day('2026-11-01', ['Villa 1']))).toBe(true)
  })

  it('shares when the lists only partly meet', () => {
    expect(sharesUnit(day('2026-11-01', ['Villa 1', 'Villa 2']), day('2026-11-01', ['Villa 2']))).toBe(true)
  })
})

describe('conflicts', () => {
  it('lets two villas be sold to different guests on one date', () => {
    expect(conflicts(day('2026-11-01', ['Villa 1']), day('2026-11-01', ['Villa 2']))).toBe(false)
  })

  it('refuses the same villa twice on one date', () => {
    expect(conflicts(day('2026-11-01', ['Villa 1']), day('2026-11-01', ['Villa 1']))).toBe(true)
  })

  it('refuses a villa against a whole-place booking', () => {
    expect(conflicts(day('2026-11-01', []), day('2026-11-01', ['Villa 1']))).toBe(true)
  })

  it('still allows the same villa on different dates', () => {
    expect(conflicts(day('2026-11-01', ['Villa 1']), day('2026-11-05', ['Villa 1']))).toBe(false)
  })

  it('keeps the checkout-to-checkin handover clear', () => {
    // One leaves at 10:00 and the next arrives at 15:00, which was never a clash and
    // must not become one now that villas are involved.
    const out = { checkinDate: '2026-11-01', checkoutDate: '2026-11-02', checkoutTime: '10:00', units: ['Villa 1'] }
    const next = { checkinDate: '2026-11-02', checkoutDate: '2026-11-03', checkinTime: '15:00', units: ['Villa 1'] }
    expect(conflicts(out, next)).toBe(false)
  })
})

describe('flagging clashes across a list', () => {
  it('flags only the pair that wants the same villa', () => {
    const out = conflictIdSet([
      { id: 'a', ...day('2026-11-01', ['Villa 1']) },
      { id: 'b', ...day('2026-11-01', ['Villa 2']) },
      { id: 'c', ...day('2026-11-01', ['Villa 1']) },
    ])
    expect([...out].sort()).toEqual(['a', 'c'])
  })

  it('flags everything against a whole-place booking', () => {
    const out = conflictIdSet([
      { id: 'all', ...day('2026-11-01', []) },
      { id: 'one', ...day('2026-11-01', ['Villa 1']) },
      { id: 'two', ...day('2026-11-01', ['Villa 2']) },
    ])
    expect([...out].sort()).toEqual(['all', 'one', 'two'])
  })

  it('leaves a project that was never split exactly as it was', () => {
    // Every booking carries no villa, so each pair that overlaps is still a clash.
    const out = conflictIdSet([
      { id: 'x', ...day('2026-11-01') },
      { id: 'y', ...day('2026-11-01') },
      { id: 'z', ...day('2026-12-01') },
    ])
    expect([...out].sort()).toEqual(['x', 'y'])
  })
})
