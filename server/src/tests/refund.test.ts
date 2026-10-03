import { describe, it, expect } from 'vitest'
import { withFinance, type PaymentTotals } from '../services/finance.js'

const booking = { _id: 'b1', amount: 75000, breakdown: { security: 10000 } }
const sums = (collected: number, refunded: number) =>
  new Map<string, PaymentTotals>([['b1', { collected, refunded }]])

describe('refunding a security deposit', () => {
  it('leaves a fully settled booking settled', () => {
    // Paid 85,000 in full, then the 10,000 deposit handed back as the terms promise.
    const out = withFinance(booking, sums(75000, 10000))
    expect(out.collected).toBe(75000)
    expect(out.refunded).toBe(10000)
    expect(out.due).toBe(0)
    expect(out.status).toBe('paid')
  })

  it('does not reinstate the deposit as money owed', () => {
    // The bug: payable still counted the deposit while collected was net of the refund,
    // so handing it back made a paid booking show 10,000 outstanding.
    expect(withFinance(booking, sums(75000, 10000)).due).not.toBe(10000)
  })

  it('still shows a real balance when one is outstanding', () => {
    // Paid 50,000 of 85,000, nothing refunded.
    const out = withFinance(booking, sums(50000, 0))
    expect(out.due).toBe(35000)
    expect(out.status).toBe('partial')
  })

  it('handles a partial refund against an unpaid balance', () => {
    // Took 60,000, gave 5,000 back; 85,000 − 5,000 owed, 55,000 held.
    const out = withFinance(booking, sums(55000, 5000))
    expect(out.due).toBe(25000)
  })

  it('counts a booking with no payments as pending', () => {
    const out = withFinance(booking, new Map())
    expect(out.collected).toBe(0)
    expect(out.due).toBe(85000)
    expect(out.status).toBe('pending')
  })

  it('keeps legacy receipts working alongside refunds', () => {
    const out = withFinance({ ...booking, legacyReceived: 85000 }, sums(-10000, 10000))
    expect(out.collected).toBe(75000)
    expect(out.due).toBe(0)
  })
})
