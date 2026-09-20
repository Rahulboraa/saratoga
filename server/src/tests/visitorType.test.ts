import { describe, it, expect } from 'vitest'
import { visitorTypeFromPurpose } from '../lib/visitorType.js'

describe('visitorTypeFromPurpose', () => {
  it('reads the site visits this log is mostly made of', () => {
    expect(visitorTypeFromPurpose('Visit 19 september')).toBe('Guest')
    expect(visitorTypeFromPurpose('Visit for28thsep')).toBe('Guest')
    expect(visitorTypeFromPurpose('Guest visit — site tour')).toBe('Guest')
    expect(visitorTypeFromPurpose('Venue recce')).toBe('Guest')
  })

  it('treats a missing purpose as a guest', () => {
    expect(visitorTypeFromPurpose('')).toBe('Guest')
    expect(visitorTypeFromPurpose('   ')).toBe('Guest')
    expect(visitorTypeFromPurpose(null)).toBe('Guest')
    expect(visitorTypeFromPurpose(undefined)).toBe('Guest')
  })

  it('picks out deliveries, vendors and staff', () => {
    expect(visitorTypeFromPurpose('Amazon delivery')).toBe('Delivery')
    expect(visitorTypeFromPurpose('BigBasket')).toBe('Other')
    expect(visitorTypeFromPurpose('Ravi Plumber — pool pump service')).toBe('Vendor')
    expect(visitorTypeFromPurpose('Tent house crew for decor pickup')).toBe('Vendor')
    expect(visitorTypeFromPurpose('Suresh gardener')).toBe('Staff')
    expect(visitorTypeFromPurpose('Security guard replacement')).toBe('Staff')
  })

  it('prefers the more specific reading when words collide', () => {
    // "delivery" wins over "visit", so a courier is not filed as a guest.
    expect(visitorTypeFromPurpose('Visit for parcel delivery')).toBe('Delivery')
    // "plumber" wins over "visit".
    expect(visitorTypeFromPurpose('Visit by plumber')).toBe('Vendor')
  })

  it('leaves genuinely unreadable text as Other', () => {
    expect(visitorTypeFromPurpose('Official')).toBe('Other')
    expect(visitorTypeFromPurpose('xyz')).toBe('Other')
  })
})
