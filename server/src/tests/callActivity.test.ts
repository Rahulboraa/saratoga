import { describe, it, expect } from 'vitest'
import { summarizeCalls, type CalledLead } from '../services/callActivity.js'

const lead = (exec: string, outcome: string, calledAt: string): CalledLead => ({
  exec, execLabel: exec[0].toUpperCase() + exec.slice(1), outcome, calledAt: new Date(calledAt),
})

const window = (from: string, to: string) => [new Date(from), new Date(to)] as const

describe('summarizeCalls', () => {
  it('counts each executive per day', () => {
    const [from, to] = window('2026-10-10T00:00:00+05:30', '2026-10-11T23:59:00+05:30')
    const a = summarizeCalls([
      lead('deepak', 'Interested', '2026-10-10T11:00:00+05:30'),
      lead('deepak', 'Callback', '2026-10-10T15:00:00+05:30'),
      lead('simran', 'Converted', '2026-10-11T12:00:00+05:30'),
    ], from, to)

    expect(a.perDay).toEqual([
      { date: '2026-10-10', deepak: 2 },
      { date: '2026-10-11', simran: 1 },
    ])
    expect(a.execs).toEqual([
      { exec: 'deepak', execLabel: 'Deepak', total: 2 },
      { exec: 'simran', execLabel: 'Simran', total: 1 },
    ])
  })

  it('buckets a late-night call into the Indian working day, not the UTC one', () => {
    // 1am IST on the 11th is still 7:30pm UTC on the 10th — the team worked the 11th.
    const [from, to] = window('2026-10-11T00:00:00+05:30', '2026-10-11T23:59:00+05:30')
    const a = summarizeCalls([lead('deepak', 'Interested', '2026-10-11T01:00:00+05:30')], from, to)
    expect(a.perDay).toEqual([{ date: '2026-10-11', deepak: 1 }])
  })

  it('keeps a day nobody called as an empty bar', () => {
    const [from, to] = window('2026-10-10T00:00:00+05:30', '2026-10-12T23:59:00+05:30')
    const a = summarizeCalls([lead('deepak', 'Interested', '2026-10-12T11:00:00+05:30')], from, to)
    expect(a.perDay.map((d) => d.date)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12'])
    expect(a.perDay[0]).toEqual({ date: '2026-10-10' })
  })

  it('compares executives within each outcome, busiest outcome first', () => {
    const [from, to] = window('2026-10-10T00:00:00+05:30', '2026-10-10T23:59:00+05:30')
    const a = summarizeCalls([
      lead('deepak', 'Did Not Pick', '2026-10-10T11:00:00+05:30'),
      lead('deepak', 'Did Not Pick', '2026-10-10T12:00:00+05:30'),
      lead('simran', 'Did Not Pick', '2026-10-10T13:00:00+05:30'),
      lead('simran', 'Converted', '2026-10-10T14:00:00+05:30'),
    ], from, to)

    expect(a.perOutcome).toEqual([
      { outcome: 'Did Not Pick', deepak: 2, simran: 1 },
      { outcome: 'Converted', simran: 1 },
    ])
  })

  it('names an unassigned lead rather than dropping it', () => {
    const [from, to] = window('2026-10-10T00:00:00+05:30', '2026-10-10T23:59:00+05:30')
    const a = summarizeCalls(
      [{ exec: '', execLabel: '', outcome: 'Interested', calledAt: new Date('2026-10-10T11:00:00+05:30') }],
      from, to,
    )
    expect(a.execs).toEqual([{ exec: 'unassigned', execLabel: 'Unassigned', total: 1 }])
  })
})
