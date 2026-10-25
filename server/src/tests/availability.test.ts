import { describe, it, expect } from 'vitest'
import { heldDates, freeDatesIn } from '../services/availability.js'

describe('the days a booking holds', () => {
  it('holds the nights, not the morning it leaves', () => {
    // Out by 10am on the 16th, so the 16th is free for that afternoon's check-in.
    expect(heldDates({ checkinDate: '2026-10-14', checkoutDate: '2026-10-16' }))
      .toEqual(['2026-10-14', '2026-10-15'])
  })

  it('holds the single day of a same-day event', () => {
    expect(heldDates({ checkinDate: '2026-10-14', checkoutDate: '2026-10-14' })).toEqual(['2026-10-14'])
    expect(heldDates({ checkinDate: '2026-10-14' })).toEqual(['2026-10-14'])
  })

  it('holds a blank checkout as one day', () => {
    expect(heldDates({ checkinDate: '2026-10-14', checkoutDate: '' })).toEqual(['2026-10-14'])
  })
})

describe('what is still free', () => {
  const OCT = ['2026-10-01', '2026-10-05'] as const

  it('lists every open day at a project booked whole', () => {
    const out = freeDatesIn('2026-10-01', '2026-10-03', [], [
      { checkinDate: '2026-10-02', checkoutDate: '2026-10-03' },
    ])
    // The 2nd is held; the 3rd is the morning it leaves, so it is open again.
    expect(out.map((f) => f.date)).toEqual(['2026-10-01', '2026-10-03'])
    expect(out[0].units).toEqual([])
  })

  it('keeps a half-sold day, showing the villa that is left', () => {
    const out = freeDatesIn('2026-10-01', '2026-10-01', ['Villa 1', 'Villa 2'], [
      { checkinDate: '2026-10-01', checkoutDate: '2026-10-01', units: ['Villa 1'] },
    ])
    expect(out).toEqual([{ date: '2026-10-01', units: ['Villa 2'] }])
  })

  it('drops a day where both villas went', () => {
    const out = freeDatesIn('2026-10-01', '2026-10-01', ['Villa 1', 'Villa 2'], [
      { checkinDate: '2026-10-01', checkoutDate: '2026-10-01', units: ['Villa 1'] },
      { checkinDate: '2026-10-01', checkoutDate: '2026-10-01', units: ['Villa 2'] },
    ])
    expect(out).toEqual([])
  })

  it('drops a day someone took whole', () => {
    const out = freeDatesIn('2026-10-01', '2026-10-01', ['Villa 1', 'Villa 2'], [
      { checkinDate: '2026-10-01', checkoutDate: '2026-10-01', units: [] },
    ])
    expect(out).toEqual([])
  })

  it('treats a booking written before the split as taking everything', () => {
    // Those rows carry no villa, and reading them as "one villa" would offer the other
    // on a date that in fact had the run of the property.
    const out = freeDatesIn('2026-10-01', '2026-10-01', ['Villa 1', 'Villa 2'], [
      { checkinDate: '2026-10-01', checkoutDate: '2026-10-01' },
    ])
    expect(out).toEqual([])
  })

  it('reads a run of nights across a month boundary', () => {
    const out = freeDatesIn('2026-10-30', '2026-11-02', [], [
      { checkinDate: '2026-10-29', checkoutDate: '2026-11-01' },
    ])
    // Held the nights of 29, 30 and 31; free again from the 1st.
    expect(out.map((f) => f.date)).toEqual(['2026-11-01', '2026-11-02'])
  })

  it('leaves an empty window empty', () => {
    expect(freeDatesIn(OCT[1], OCT[0], [], [])).toEqual([])
  })
})
