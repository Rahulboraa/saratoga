import { Lead } from '../models/Lead.js'
import { istYmd } from '../lib/dates.js'

const DAY = 86_400_000

export interface CalledLead {
  exec?: string | null
  execLabel?: string | null
  outcome?: string | null
  calledAt: Date
}

export interface CallActivity {
  from: string
  to: string
  execs: { exec: string; execLabel: string; total: number }[]
  perDay: ({ date: string } & Record<string, string | number>)[]
  perOutcome: ({ outcome: string } & Record<string, string | number>)[]
}

/**
 * Who worked what, day by day and outcome by outcome.
 *
 * Days are bucketed in IST, since that is the working day the team is being measured on.
 * A lead carries only the time its outcome was last set, so a lead called twice counts
 * once, on the later day: this measures leads worked, not call attempts.
 */
export function summarizeCalls(rows: CalledLead[], from: Date, to: Date): CallActivity {
  const labels = new Map<string, string>()
  const perDay = new Map<string, Record<string, number>>()
  const perOutcome = new Map<string, Record<string, number>>()
  const totals = new Map<string, number>()

  for (const l of rows) {
    const exec = l.exec || 'unassigned'
    labels.set(exec, l.execLabel || (l.exec ? l.exec : 'Unassigned'))
    totals.set(exec, (totals.get(exec) ?? 0) + 1)

    const bump = (into: Map<string, Record<string, number>>, key: string) => {
      const row = into.get(key) ?? {}
      row[exec] = (row[exec] ?? 0) + 1
      into.set(key, row)
    }
    bump(perDay, istYmd(l.calledAt))
    bump(perOutcome, l.outcome || 'No outcome')
  }

  // Every day in the window, so a day nobody called reads as a gap in the chart
  // rather than being quietly skipped over.
  const days: CallActivity['perDay'] = []
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
    const date = istYmd(new Date(t))
    days.push({ date, ...(perDay.get(date) ?? {}) })
  }

  const sum = (row: Record<string, unknown>, skip: string) =>
    Object.entries(row).reduce((s, [k, v]) => (k === skip ? s : s + Number(v)), 0)

  return {
    from: istYmd(from),
    to: istYmd(to),
    execs: [...totals.entries()]
      .map(([exec, total]) => ({ exec, execLabel: labels.get(exec) ?? exec, total }))
      .sort((a, b) => b.total - a.total || a.execLabel.localeCompare(b.execLabel)),
    perDay: days,
    perOutcome: [...perOutcome.entries()]
      .map(([outcome, byExec]) => ({ outcome, ...byExec }))
      .sort((a, b) => sum(b, 'outcome') - sum(a, 'outcome')),
  }
}

export async function callActivity(scope: Record<string, unknown>, days = 14) {
  const to = new Date()
  const from = new Date(to.getTime() - (days - 1) * DAY)
  from.setHours(0, 0, 0, 0)

  const rows = await Lead.find({ ...scope, calledAt: { $gte: from } })
    .select('exec execLabel outcome calledAt')
    .lean<CalledLead[]>()

  return summarizeCalls(rows, from, to)
}
