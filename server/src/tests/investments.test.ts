import { describe, it, expect, vi } from 'vitest'

const entries: { partner: string; kind: string; amount: number; date: string }[] = []

vi.mock('../models/Investment.js', () => ({
  INVESTMENT_KINDS: ['Investment', 'Withdrawal'],
  Investment: { find: () => ({ select: () => Promise.resolve(entries) }) },
}))

const { partnerLedger } = await import('../services/investments.js')

function seed(rows: typeof entries) {
  entries.length = 0
  entries.push(...rows)
}

describe('partnerLedger', () => {
  it('nets withdrawals against investments', async () => {
    seed([
      { partner: 'Rahul', kind: 'Investment', amount: 500_000, date: '2026-04-01' },
      { partner: 'Rahul', kind: 'Withdrawal', amount: 100_000, date: '2026-06-01' },
      { partner: 'Akhil', kind: 'Investment', amount: 200_000, date: '2026-05-01' },
    ])
    const rows = await partnerLedger({})
    expect(rows.map((r) => r.partner)).toEqual(['Rahul', 'Akhil'])
    expect(rows[0]).toMatchObject({ invested: 500_000, withdrawn: 100_000, net: 400_000, entries: 2, lastDate: '2026-06-01' })
    expect(rows[0].share).toBe(66.7)
    expect(rows[1].share).toBe(33.3)
  })

  it('gives no share to a partner who is net negative', async () => {
    seed([
      { partner: 'Rahul', kind: 'Investment', amount: 300_000, date: '2026-04-01' },
      { partner: 'Akhil', kind: 'Withdrawal', amount: 50_000, date: '2026-05-01' },
    ])
    const rows = await partnerLedger({})
    const akhil = rows.find((r) => r.partner === 'Akhil')!
    expect(akhil.net).toBe(-50_000)
    expect(akhil.share).toBe(0)
    expect(rows.find((r) => r.partner === 'Rahul')!.share).toBe(100)
  })

  it('is empty when nothing has been invested', async () => {
    seed([])
    expect(await partnerLedger({})).toEqual([])
  })
})
