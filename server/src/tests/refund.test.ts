import { describe, it, expect } from 'vitest'
import { withFinance, type PaymentTotals } from '../services/finance.js'

// Rent 75,000 with a 10,000 refundable deposit noted against it.
const booking = { _id: 'b1', amount: 75000, breakdown: { security: 10000 } }
const sums = (collected: number, refunded = 0) =>
  new Map<string, PaymentTotals>([['b1', { collected, refunded }]])

describe('the security deposit', () => {
  it('is no part of what the guest owes', () => {
    // Deposits are held, not earned. Counting one made the booking look 10,000 short.
    expect(withFinance(booking, new Map()).due).toBe(75000)
  })

  it('leaves a booking settled once the rent is paid', () => {
    const out = withFinance(booking, sums(75000))
    expect(out.due).toBe(0)
    expect(out.status).toBe('paid')
  })

  it('does not inflate what was collected', () => {
    const out = withFinance(booking, sums(75000))
    expect(out.collected).toBe(75000)
  })
})

describe('refunds', () => {
  it('reduces what is owed when money is handed back', () => {
    // 50,000 booking, paid in full, 20,000 returned: 30,000 kept and nothing outstanding.
    const out = withFinance({ _id: 'b1', amount: 50000 }, sums(30000, 20000))
    expect(out.due).toBe(0)
    expect(out.refunded).toBe(20000)
  })

  it('still shows a real balance when one is outstanding', () => {
    const out = withFinance(booking, sums(50000))
    expect(out.due).toBe(25000)
    expect(out.status).toBe('partial')
  })

  it('shows a booking holding more than it is worth as a negative balance', () => {
    // Bookings taken before deposits were kept out of the ledger have the deposit inside
    // their payments. Showing that as zero would hide money being held.
    const out = withFinance(booking, sums(85000))
    expect(out.due).toBe(-10000)
  })

  it('counts a booking with no payments as pending', () => {
    const out = withFinance(booking, new Map())
    expect(out.collected).toBe(0)
    expect(out.status).toBe('pending')
  })

  it('keeps legacy receipts working', () => {
    const out = withFinance({ ...booking, legacyReceived: 75000 }, new Map())
    expect(out.collected).toBe(75000)
    expect(out.due).toBe(0)
  })
})
