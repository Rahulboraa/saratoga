import { describe, it, expect } from 'vitest'
import { financialYear, invoiceLines, GST_RATE } from '../services/invoice.js'

const bookingWith = (breakdown: Record<string, number>) =>
  ({ breakdown } as unknown as Parameters<typeof invoiceLines>[0])

describe('financialYear', () => {
  it('runs April to March', () => {
    expect(financialYear('2026-04-01')).toBe('2026-27')
    expect(financialYear('2026-11-15')).toBe('2026-27')
    expect(financialYear('2027-03-31')).toBe('2026-27')
    expect(financialYear('2027-04-01')).toBe('2027-28')
  })

  it('rolls the century correctly', () => {
    expect(financialYear('2099-05-01')).toBe('2099-00')
  })
})

describe('invoiceLines', () => {
  it('charges GST on the service lines only', () => {
    const out = invoiceLines(bookingWith({ venue: 20_000, catering: 10_000, license: 5_000, security: 20_000 }))
    expect(out.taxable).toBe(30_000)
    expect(out.cgst).toBe(2_700)
    expect(out.sgst).toBe(2_700)
    expect(out.cgst + out.sgst).toBe(Math.round(30_000 * GST_RATE))
    // Licence and deposit ride along untaxed.
    expect(out.total).toBe(30_000 + 5_400 + 5_000 + 20_000)
  })

  it('drops zero lines', () => {
    const out = invoiceLines(bookingWith({ venue: 27_000, catering: 0, decor: 0 }))
    expect(out.items).toEqual([{ label: 'Venue rental', amount: 27_000 }])
    expect(out.total).toBe(27_000 + 4_860)
  })

  it('is empty for a booking with no charges', () => {
    const out = invoiceLines(bookingWith({}))
    expect(out.items).toEqual([])
    expect(out.total).toBe(0)
  })
})
