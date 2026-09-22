import { Call } from '../models/Call.js'

export interface ExecCallStats {
  exec: string
  execLabel: string
  calls: number
  connected: number
  talkTimeSec: number
  connectRate: number
}

/**
 * Per-exec calling activity. Talk time counts only calls that connected — time spent
 * listening to a phone ring is not a conversation.
 */
export async function callStats(scope: Record<string, unknown>, month?: string) {
  const filter: Record<string, unknown> = { ...scope }
  if (month && month !== 'all') {
    const start = new Date(`${month}-01T00:00:00.000Z`)
    const end = new Date(start)
    end.setUTCMonth(end.getUTCMonth() + 1)
    filter.startedAt = { $gte: start, $lt: end }
  }

  const calls = await Call.find(filter).select('exec execLabel outcome durationSec')
  const byExec = new Map<string, ExecCallStats>()
  for (const c of calls) {
    if (!byExec.has(c.exec)) {
      byExec.set(c.exec, { exec: c.exec, execLabel: c.execLabel || c.exec, calls: 0, connected: 0, talkTimeSec: 0, connectRate: 0 })
    }
    const row = byExec.get(c.exec)!
    row.calls++
    if (c.outcome === 'connected') {
      row.connected++
      row.talkTimeSec += c.durationSec
    }
  }

  const rows = [...byExec.values()]
  for (const row of rows) {
    row.connectRate = row.calls ? Math.round((row.connected / row.calls) * 1000) / 10 : 0
  }
  return rows.sort((a, b) => b.calls - a.calls)
}
