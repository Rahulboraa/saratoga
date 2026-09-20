import { Investment } from '../models/Investment.js'

export interface PartnerRow {
  partner: string
  invested: number
  withdrawn: number
  net: number
  share: number
  entries: number
  lastDate: string
}

/**
 * Per-partner standing for a property: what went in, what came back out, and each
 * partner's share of the net capital currently in the business.
 */
export async function partnerLedger(scope: Record<string, unknown>): Promise<PartnerRow[]> {
  const entries = await Investment.find(scope).select('partner kind amount date')

  const byPartner = new Map<string, PartnerRow>()
  for (const e of entries) {
    if (!byPartner.has(e.partner)) {
      byPartner.set(e.partner, { partner: e.partner, invested: 0, withdrawn: 0, net: 0, share: 0, entries: 0, lastDate: '' })
    }
    const row = byPartner.get(e.partner)!
    if (e.kind === 'Withdrawal') row.withdrawn += e.amount
    else row.invested += e.amount
    row.entries++
    if (e.date > row.lastDate) row.lastDate = e.date
  }

  const rows = [...byPartner.values()]
  for (const row of rows) row.net = row.invested - row.withdrawn
  // Share is of positive net capital; a partner who has taken more out than they put in
  // holds no share, and would otherwise skew the total.
  const totalNet = rows.reduce((sum, r) => sum + Math.max(r.net, 0), 0)
  for (const row of rows) {
    row.share = totalNet > 0 ? Math.round((Math.max(row.net, 0) / totalNet) * 1000) / 10 : 0
  }
  return rows.sort((a, b) => b.net - a.net)
}
