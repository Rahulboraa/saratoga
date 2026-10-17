import { describe, it, expect } from 'vitest'
import { financialYear, invoiceLines, GST_RATE } from '../services/invoice.js'

const bookingWith = (breakdown: Record<string, number>, gstEnabled = true) =>
  ({ breakdown, gstEnabled } as unknown as Parameters<typeof invoiceLines>[0])

/** A registered seller, which is what the tax cases below are about. */
const GSTIN = '09AAACH7409R1ZZ'

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
    const out = invoiceLines(bookingWith({ venue: 20_000, catering: 10_000, license: 5_000, security: 20_000 }), GSTIN)
    expect(out.taxable).toBe(30_000)
    expect(out.cgst).toBe(2_700)
    expect(out.sgst).toBe(2_700)
    expect(out.cgst + out.sgst).toBe(Math.round(30_000 * GST_RATE))
    // The licence rides along untaxed; the deposit is listed but not added in.
    expect(out.total).toBe(30_000 + 5_400 + 5_000)
    expect(out.security).toBe(20_000)
  })

  it('taxes valet like any other service line', () => {
    const out = invoiceLines(bookingWith({ venue: 20_000, valet: 5_000 }), GSTIN)
    expect(out.items.map((i) => i.label)).toContain('Valet')
    expect(out.taxable).toBe(25_000)
    expect(out.total).toBe(25_000 + 4_500)
  })

  it('drops zero lines', () => {
    const out = invoiceLines(bookingWith({ venue: 27_000, catering: 0, decor: 0 }), GSTIN)
    expect(out.items).toEqual([{ label: 'Venue rental', amount: 27_000 }])
    expect(out.total).toBe(27_000 + 4_860)
  })

  it('bills without tax when GST is switched off', () => {
    const out = invoiceLines(bookingWith({ venue: 27_000, security: 10_000 }, false), GSTIN)
    expect(out.gstEnabled).toBe(false)
    expect(out.taxable).toBe(27_000)
    expect(out.cgst).toBe(0)
    expect(out.sgst).toBe(0)
    expect(out.total).toBe(27_000)
  })

  it('treats a booking with no flag as taxed, which is the default', () => {
    const out = invoiceLines({ breakdown: { venue: 10_000 } } as never, GSTIN)
    expect(out.gstEnabled).toBe(true)
    expect(out.total).toBe(11_800)
  })

  it('is empty for a booking with no charges', () => {
    const out = invoiceLines(bookingWith({}), GSTIN)
    expect(out.items).toEqual([])
    expect(out.total).toBe(0)
  })
})

describe('an unregistered seller', () => {
  it('bills without GST even though the booking is flagged for it', () => {
    // Registration is still in process: charging tax before it exists is not an option,
    // whatever the booking was created with.
    const out = invoiceLines(bookingWith({ venue: 20_000 }))
    expect(out.gstEnabled).toBe(false)
    expect(out.cgst).toBe(0)
    expect(out.sgst).toBe(0)
    expect(out.total).toBe(20_000)
  })

  it('treats a blank GSTIN the same as none at all', () => {
    expect(invoiceLines(bookingWith({ venue: 20_000 }), '   ').gstEnabled).toBe(false)
  })

  it('charges GST the moment a GSTIN is on file', () => {
    const out = invoiceLines(bookingWith({ venue: 20_000 }), GSTIN)
    expect(out.gstEnabled).toBe(true)
    expect(out.cgst + out.sgst).toBe(3_600)
  })

  it('still reprints an issued invoice exactly as it was sent', () => {
    // The guest holds a document showing tax. A reprint that quietly dropped it would
    // not match their copy or the books.
    const issued = { breakdown: { venue: 20_000 }, gstEnabled: true, invoiceNo: 'INV/2026-27/001' }
    const out = invoiceLines(issued as never)
    expect(out.gstEnabled).toBe(true)
    expect(out.cgst + out.sgst).toBe(3_600)
  })
})
