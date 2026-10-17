import { describe, it, expect } from 'vitest'
import { leadCommonSchema, leadManagerSchema, withWantedRange } from '../validation/schemas.js'

const base = { date: '2026-10-01', name: 'A', phone: '9' }

describe('the date a customer wants', () => {
  it('accepts a single date', () => {
    const out = withWantedRange(leadCommonSchema).parse({ ...base, wantedFrom: '2026-10-23' })
    expect(out.wantedFrom).toBe('2026-10-23')
  })

  it('accepts a range, for "the 14th or 15th"', () => {
    const out = withWantedRange(leadCommonSchema).parse({ ...base, wantedFrom: '2026-10-14', wantedTo: '2026-10-15' })
    expect([out.wantedFrom, out.wantedTo]).toEqual(['2026-10-14', '2026-10-15'])
  })

  it('accepts a whole month, for "sometime in October"', () => {
    const out = withWantedRange(leadCommonSchema).parse({ ...base, wantedFrom: '2026-10-01', wantedTo: '2026-10-31' })
    expect([out.wantedFrom, out.wantedTo]).toEqual(['2026-10-01', '2026-10-31'])
  })

  it('lets a lead be saved with no date at all', () => {
    // Plenty of enquiries never name one, and refusing those would stop the team
    // recording them, which costs more than the missing date.
    const out = withWantedRange(leadCommonSchema).parse(base)
    expect([out.wantedFrom, out.wantedTo]).toEqual(['', ''])
  })

  it('refuses a range that ends before it starts', () => {
    expect(() => withWantedRange(leadCommonSchema).parse({ ...base, wantedFrom: '2026-10-20', wantedTo: '2026-10-10' })).toThrow()
  })

  it('survives .partial(), which is how an edit is saved', () => {
    // zod refuses .partial() on a schema that already carries a refinement, so applying
    // it afterwards is what keeps editing a lead working at all.
    const patch = withWantedRange(leadManagerSchema.partial())
    expect(patch.parse({ outcome: 'Callback' }).outcome).toBe('Callback')
    expect(patch.parse({ wantedFrom: '2026-10-14', wantedTo: '2026-10-15' }).wantedTo).toBe('2026-10-15')
    expect(() => patch.parse({ wantedFrom: '2026-10-20', wantedTo: '2026-10-10' })).toThrow()
  })

  it('still extends into the manager schema', () => {
    // leadManagerSchema builds on the refined common schema; if the refinement broke
    // extension, every manager-side save would fail.
    const out = withWantedRange(leadManagerSchema).parse({ ...base, exec: 'bittu', wantedFrom: '2026-10-23' })
    expect(out.exec).toBe('bittu')
    expect(out.wantedFrom).toBe('2026-10-23')
  })
})

describe('finding everyone who wanted a date', () => {
  it('matches a range that overlaps the window at either end', async () => {
    const { wantedWithin } = await import('../services/leadDates.js')
    const f = wantedWithin('2026-10-01', '2026-10-31')
    expect(f.wantedFrom.$lte).toBe('2026-10-31')
    expect(f.wantedTo.$gte).toBe('2026-10-01')
    // A lead with no date must never be swept into the list.
    expect(f.wantedFrom.$ne).toBe('')
  })

  it('reads a month as its real last day', async () => {
    const { monthWindow } = await import('../services/leadDates.js')
    expect(monthWindow('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(monthWindow('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    // 2028 is a leap year; a hardcoded 28th would quietly drop the 29th.
    expect(monthWindow('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(monthWindow('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
  })
})

describe('ordering quiet leads', () => {
  it('puts the nearest event first', async () => {
    const { byUrgency } = await import('../services/leadDates.js')
    const out = byUrgency([
      { wantedFrom: '2027-03-10' },
      { wantedFrom: '2026-10-23' },
      { wantedFrom: '2026-12-31' },
    ])
    expect(out.map((l) => l.wantedFrom)).toEqual(['2026-10-23', '2026-12-31', '2027-03-10'])
  })

  it('sends leads with no date to the back, not the front', async () => {
    // '' sorts before every real date, so left alone the ones nobody can act on would
    // head the list and bury the urgent ones.
    const { byUrgency } = await import('../services/leadDates.js')
    const out = byUrgency([
      { wantedFrom: '' },
      { wantedFrom: '2026-10-23' },
      { wantedFrom: '' },
      { wantedFrom: '2026-11-02' },
    ])
    expect(out.map((l) => l.wantedFrom)).toEqual(['2026-10-23', '2026-11-02', '', ''])
  })

  it('orders the dateless ones by how long they have been quiet', async () => {
    const { byUrgency } = await import('../services/leadDates.js')
    const out = byUrgency([
      { wantedFrom: '', calledAt: new Date('2026-10-15') },
      { wantedFrom: '', calledAt: new Date('2026-10-01') },
    ])
    expect(out[0].calledAt).toEqual(new Date('2026-10-01'))
  })

  it('falls back to when the lead arrived if it was never called', async () => {
    const { lastTouched } = await import('../services/leadDates.js')
    expect(lastTouched({ createdAt: new Date('2026-10-05') })).toEqual(new Date('2026-10-05'))
    expect(lastTouched({ calledAt: new Date('2026-10-09'), createdAt: new Date('2026-10-05') }))
      .toEqual(new Date('2026-10-09'))
    expect(lastTouched({})).toBeNull()
  })
})

describe('importing the date a customer wants', () => {
  it('reads a Date Wanted column from a sheet', async () => {
    const { mapRow, normalizeRow } = await import('../services/importEngine.js')
    const row = normalizeRow('leads', mapRow('leads', {
      Name: 'Asha', phone_number: '9876543210', Date: '2026-09-01', 'Date Wanted': '2026-10-23',
    })) as Record<string, string>
    expect(row.wantedFrom).toBe('2026-10-23')
    // Only one date on the sheet still means a range, as it does everywhere else.
    expect(row.wantedTo).toBe('2026-10-23')
  })

  it('reads a range when the sheet carries both ends', async () => {
    const { mapRow, normalizeRow } = await import('../services/importEngine.js')
    const row = normalizeRow('leads', mapRow('leads', {
      Name: 'Asha', phone_number: '9', Date: '2026-09-01',
      'Event Date': '2026-10-14', 'Wanted To': '2026-10-15',
    })) as Record<string, string>
    expect([row.wantedFrom, row.wantedTo]).toEqual(['2026-10-14', '2026-10-15'])
  })

  it('leaves both blank when the sheet has no such column', async () => {
    const { mapRow, normalizeRow } = await import('../services/importEngine.js')
    const row = normalizeRow('leads', mapRow('leads', { Name: 'Asha', phone_number: '9', Date: '2026-09-01' })) as Record<string, string>
    expect([row.wantedFrom, row.wantedTo]).toEqual(['', ''])
  })
})
