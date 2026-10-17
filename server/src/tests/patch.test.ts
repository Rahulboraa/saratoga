import { describe, it, expect } from 'vitest'
import { onlySent } from '../lib/patch.js'
import { leadManagerSchema, withWantedRange } from '../validation/schemas.js'

describe('onlySent', () => {
  it('keeps only what the request carried', () => {
    expect(onlySent({ a: 1, b: '', c: '' }, { a: 1 })).toEqual({ a: 1 })
  })

  it('keeps a field that was deliberately sent blank', () => {
    // Clearing a follow-up is a real edit, so an empty value that was actually sent has
    // to survive — it is absence that must be ignored, not emptiness.
    expect(onlySent({ followup: '', notes: 'x' }, { followup: '' })).toEqual({ followup: '' })
  })

  it('survives a body that is not an object', () => {
    expect(onlySent({ a: 1 }, null)).toEqual({})
    expect(onlySent({ a: 1 }, 'nonsense')).toEqual({})
  })
})

describe('marking a lead converted', () => {
  const patch = (body: Record<string, unknown>) =>
    onlySent(withWantedRange(leadManagerSchema.partial()).parse(body), body)

  it('changes the outcome and nothing else', () => {
    // The tick in the CRM sends only this. Everything the schema defaults — notes, exec,
    // follow-up, flag, the wanted dates — used to ride along blank and wipe the record.
    expect(patch({ outcome: 'Converted' })).toEqual({ outcome: 'Converted' })
  })

  it('still writes the fields an edit does send', () => {
    const out = patch({ outcome: 'Callback', followup: '2026-10-20', notes: 'call back Monday' })
    expect(out).toEqual({ outcome: 'Callback', followup: '2026-10-20', notes: 'call back Monday' })
  })

  it('leaves the wanted dates alone when they are not part of the edit', () => {
    expect('wantedFrom' in patch({ outcome: 'Converted' })).toBe(false)
  })
})
