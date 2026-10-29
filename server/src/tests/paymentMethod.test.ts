import { describe, it, expect } from 'vitest'
import { isCash, countsForInvoice } from '../lib/paymentMethod.js'

describe('recognising cash', () => {
  it('reads the fixed list', () => {
    expect(isCash('Cash')).toBe(true)
    expect(isCash('UPI')).toBe(false)
    expect(isCash('Bank transfer')).toBe(false)
  })

  it('reads what people typed into the old free-text box', () => {
    expect(isCash('CASH')).toBe(true)
    expect(isCash('cash payment')).toBe(true)
    expect(isCash('paid cash')).toBe(true)
    expect(isCash('nakad')).toBe(true)
  })

  it('does not mistake other methods for cash', () => {
    expect(isCash('gpay')).toBe(false)
    expect(isCash('phonepe')).toBe(false)
    expect(isCash('NEFT')).toBe(false)
    expect(isCash('')).toBe(false)
  })
})

describe('what puts a booking on the invoice series', () => {
  it('bank money does', () => {
    expect(countsForInvoice('UPI')).toBe(true)
    expect(countsForInvoice('Bank transfer')).toBe(true)
    expect(countsForInvoice('Cheque')).toBe(true)
  })

  it('cash does not', () => {
    // A serial raised against cash has to be answered for in a return.
    expect(countsForInvoice('Cash')).toBe(false)
    expect(countsForInvoice('cash')).toBe(false)
  })

  it('an unrecorded method does not either', () => {
    // A missing number can be issued by hand; one wrongly in the series cannot be
    // taken back out of it.
    expect(countsForInvoice('')).toBe(false)
    expect(countsForInvoice(undefined)).toBe(false)
    expect(countsForInvoice('   ')).toBe(false)
  })
})
