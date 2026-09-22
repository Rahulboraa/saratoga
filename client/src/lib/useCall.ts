import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { CallRecord, Lead } from '@/types'

/**
 * A browser cannot place a call, watch it connect, or read how long it lasted — those are
 * native permissions no web app is given. What it can do is open the dialer, note when it
 * did, and time how long it was in the background before the caller came back.
 *
 * That interval is not the call duration: it also covers dialling and ringing, and it
 * overruns if they put the phone down and wander off. It is offered as a starting number
 * for the caller to correct, and stored as `estimated` so nobody reads it as carrier data.
 */
export function useCall() {
  const [pending, setPending] = useState<{ call: CallRecord; lead: Lead } | null>(null)
  const [awaySec, setAwaySec] = useState(0)
  const leftAt = useRef<number | null>(null)

  useEffect(() => {
    if (!pending) return

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        // Only the first departure counts; a notification pulled down mid-call is not a new call.
        if (leftAt.current === null) leftAt.current = Date.now()
        return
      }
      if (leftAt.current === null) return
      setAwaySec(Math.round((Date.now() - leftAt.current) / 1000))
      leftAt.current = null
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pending])

  /** Opens the phone's dialer and starts a record for it. */
  const start = useCallback(async (lead: Lead) => {
    const startedAt = new Date().toISOString()
    leftAt.current = null
    setAwaySec(0)
    const call = await api<CallRecord>(`/calls/lead/${lead.id}`, { body: { startedAt } })
    setPending({ call, lead })
    window.location.href = `tel:${lead.phone.replace(/[^\d+]/g, '')}`
    return call
  }, [])

  const clear = useCallback(() => {
    setPending(null)
    setAwaySec(0)
    leftAt.current = null
  }, [])

  /** Drops the record for a call that was never actually placed. */
  const discard = useCallback(async () => {
    if (pending) await api(`/calls/${pending.call.id}`, { method: 'DELETE' }).catch(() => {})
    clear()
  }, [pending, clear])

  return { pending, awaySec, start, clear, discard }
}
