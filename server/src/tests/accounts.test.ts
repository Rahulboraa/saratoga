import { describe, it, expect, vi } from 'vitest'

const payments: Record<string, unknown>[] = []

const chain = (rows: unknown[]) => ({ select: () => Promise.resolve(rows) })
vi.mock('../models/Payment.js', () => ({
  Payment: {
    find: (filter: Record<string, unknown>) => {
      const rx = (filter.date as { $regex?: string })?.$regex
      const rows = rx ? payments.filter((p) => String(p.date).startsWith(rx.slice(1))) : payments
      return chain(rows)
    },
  },
}))
vi.mock('../models/Booking.js', () => ({ Booking: { find: () => chain([]) } }))

const { accountReport } = await import('../services/accounts.js')

function seed(rows: Record<string, unknown>[]) {
  payments.length = 0
  payments.push(...rows)
}

describe('accountReport', () => {
  it('groups collections by the account they landed in', async () => {
    seed([
      { id: '1', date: '2026-09-02', amount: 50_000, dest: 'HDFC', bookingId: 'b1' },
      { id: '2', date: '2026-09-10', amount: 30_000, dest: 'ICICI', bookingId: 'b2' },
      { id: '3', date: '2026-09-18', amount: 20_000, dest: 'HDFC', bookingId: 'b3' },
    ])
    const out = await accountReport({}, '2026-09')
    expect(out.total).toBe(100_000)
    expect(out.accounts[0]).toMatchObject({ account: 'HDFC', received: 70_000, count: 2, share: 70, lastDate: '2026-09-18' })
    expect(out.accounts[1]).toMatchObject({ account: 'ICICI', received: 30_000, share: 30 })
  })

  it('nets a refund off the account it came from', async () => {
    seed([
      { id: '1', date: '2026-09-02', amount: 27_000, dest: 'HDFC', bookingId: 'b1' },
      { id: '2', date: '2026-09-20', amount: -5_000, dest: 'HDFC', bookingId: 'b1' },
    ])
    const out = await accountReport({}, '2026-09')
    expect(out.accounts[0]).toMatchObject({ account: 'HDFC', received: 22_000, count: 2 })
  })

  it('buckets payments with no account under Unassigned', async () => {
    seed([{ id: '1', date: '2026-09-02', amount: 10_000, dest: '  ', bookingId: 'b1' }])
    const out = await accountReport({}, '2026-09')
    expect(out.accounts[0].account).toBe('Unassigned')
  })

  it('filters the payment list to one account without changing the totals', async () => {
    seed([
      { id: '1', date: '2026-09-02', amount: 50_000, dest: 'HDFC', bookingId: 'b1' },
      { id: '2', date: '2026-09-10', amount: 30_000, dest: 'ICICI', bookingId: 'b2' },
    ])
    const out = await accountReport({}, '2026-09', 'ICICI')
    expect(out.total).toBe(80_000)
    expect(out.payments).toHaveLength(1)
    expect(out.payments[0].account).toBe('ICICI')
  })
})
