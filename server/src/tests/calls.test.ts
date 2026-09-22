import { describe, it, expect, vi } from 'vitest'

const calls: Record<string, unknown>[] = []
vi.mock('../models/Call.js', () => ({
  CALL_OUTCOMES: ['connected', 'no-answer', 'busy', 'wrong-number', 'cancelled'],
  DURATION_SOURCES: ['estimated', 'manual', 'carrier'],
  Call: {
    find: (filter: Record<string, unknown>) => ({
      select: () => {
        const range = filter.startedAt as { $gte: Date; $lt: Date } | undefined
        const rows = range
          ? calls.filter((c) => {
              const d = c.startedAt as Date
              return d >= range.$gte && d < range.$lt
            })
          : calls
        return Promise.resolve(rows)
      },
    }),
  },
}))

const { callStats } = await import('../services/calls.js')

function seed(rows: Record<string, unknown>[]) {
  calls.length = 0
  calls.push(...rows)
}

describe('callStats', () => {
  it('counts calls and connect rate per exec', async () => {
    seed([
      { exec: 'deepak', execLabel: 'Deepak', outcome: 'connected', durationSec: 120, startedAt: new Date('2026-09-02') },
      { exec: 'deepak', execLabel: 'Deepak', outcome: 'no-answer', durationSec: 0, startedAt: new Date('2026-09-03') },
      { exec: 'simran', execLabel: 'Simran', outcome: 'connected', durationSec: 300, startedAt: new Date('2026-09-04') },
    ])
    const rows = await callStats({})
    expect(rows[0]).toMatchObject({ exec: 'deepak', calls: 2, connected: 1, talkTimeSec: 120, connectRate: 50 })
    expect(rows[1]).toMatchObject({ exec: 'simran', calls: 1, connected: 1, talkTimeSec: 300, connectRate: 100 })
  })

  it('counts talk time only for calls that connected', async () => {
    // A ringing phone is not a conversation, whatever seconds got recorded against it.
    seed([
      { exec: 'deepak', execLabel: 'Deepak', outcome: 'no-answer', durationSec: 45, startedAt: new Date('2026-09-02') },
      { exec: 'deepak', execLabel: 'Deepak', outcome: 'connected', durationSec: 60, startedAt: new Date('2026-09-02') },
    ])
    const rows = await callStats({})
    expect(rows[0].talkTimeSec).toBe(60)
  })

  it('leaves a call still waiting on its outcome out of the connected count', async () => {
    seed([{ exec: 'deepak', execLabel: 'Deepak', outcome: null, durationSec: 0, startedAt: new Date('2026-09-02') }])
    const rows = await callStats({})
    expect(rows[0]).toMatchObject({ calls: 1, connected: 0, connectRate: 0 })
  })

  it('narrows to a month', async () => {
    seed([
      { exec: 'deepak', execLabel: 'Deepak', outcome: 'connected', durationSec: 60, startedAt: new Date('2026-09-15') },
      { exec: 'deepak', execLabel: 'Deepak', outcome: 'connected', durationSec: 60, startedAt: new Date('2026-10-15') },
    ])
    expect((await callStats({}, '2026-09'))[0].calls).toBe(1)
    expect((await callStats({}))[0].calls).toBe(2)
  })

  it('is empty when nobody has called', async () => {
    seed([])
    expect(await callStats({})).toEqual([])
  })
})
