import { Lead, CLOSED_OUTCOMES } from '../models/Lead.js'

const DAY = 86_400_000

export interface DatedLead {
  wantedFrom?: string | null
  calledAt?: Date | null
  createdAt?: Date | null
}

/**
 * Mongo filter for every lead whose wanted range touches the window asked about.
 * Two ranges overlap when each starts on or before the other ends, which is one
 * comparison per end rather than a case for each way they can sit against each other.
 */
export function wantedWithin(from: string, to: string) {
  return { wantedFrom: { $ne: '', $lte: to }, wantedTo: { $gte: from } }
}

/** The whole of a month, as the range a lead's dates are compared against. */
export function monthWindow(month: string) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

/** When a lead was last worked: the outcome stamp, or failing that when it arrived. */
export function lastTouched(lead: DatedLead) {
  return lead.calledAt ?? lead.createdAt ?? null
}

/**
 * Quiet leads, soonest event first.
 *
 * A lead with no date goes to the back rather than the front: an empty string sorts
 * before every real date, so left alone the ones nobody can act on would lead the list.
 */
export function byUrgency<T extends DatedLead>(leads: T[]): T[] {
  return [...leads].sort((a, b) => {
    const af = a.wantedFrom || ''
    const bf = b.wantedFrom || ''
    if (!af && !bf) {
      const at = lastTouched(a)?.getTime() ?? 0
      const bt = lastTouched(b)?.getTime() ?? 0
      return at - bt
    }
    if (!af) return 1
    if (!bf) return -1
    return af < bf ? -1 : af > bf ? 1 : 0
  })
}

/**
 * Conversations that stopped. Not the same as an overdue follow-up, which only finds
 * leads somebody remembered to put a date against — this finds the ones that simply
 * went quiet, which is how most of them end.
 */
export async function quietLeads(
  scope: Record<string, unknown>,
  { days = 3, limit = 50, today = new Date() } = {},
) {
  const cutoff = new Date(today.getTime() - days * DAY)
  const leads = await Lead.find({
    ...scope,
    outcome: { $nin: CLOSED_OUTCOMES },
    $or: [{ calledAt: { $lte: cutoff } }, { calledAt: null, createdAt: { $lte: cutoff } }],
  }).limit(limit * 4)

  return byUrgency(leads).slice(0, limit)
}
