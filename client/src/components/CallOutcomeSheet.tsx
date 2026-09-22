import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import type { CallOutcome, CallRecord, Lead } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: 'connected', label: 'Spoke to them' },
  { value: 'no-answer', label: 'No answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'wrong-number', label: 'Wrong number' },
  { value: 'cancelled', label: "Didn't call" },
]

function mmss(sec: number) {
  return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`
}

/**
 * Shown when the caller returns from the dialer. The seconds are prefilled from how long
 * the app was in the background, which is a starting point, not a measurement — so the
 * field stays editable and says where the number came from.
 */
export default function CallOutcomeSheet({
  pending, awaySec, onDone, onDiscard,
}: {
  pending: { call: CallRecord; lead: Lead } | null
  awaySec: number
  onDone: () => void
  onDiscard: () => void
}) {
  const queryClient = useQueryClient()
  const [seconds, setSeconds] = useState(0)
  const [edited, setEdited] = useState(false)

  useEffect(() => {
    if (!edited) setSeconds(awaySec)
  }, [awaySec, edited])

  useEffect(() => {
    if (!pending) { setSeconds(0); setEdited(false) }
  }, [pending])

  const save = useMutation({
    mutationFn: ({ outcome }: { outcome: CallOutcome }) =>
      api(`/calls/${pending!.call.id}`, {
        method: 'PATCH',
        body: {
          outcome,
          durationSec: outcome === 'connected' ? seconds : 0,
          durationSource: edited ? 'manual' : 'estimated',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Call logged')
      onDone()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not log the call'),
  })

  return (
    <Sheet open={!!pending} onOpenChange={(o) => !o && onDiscard()}>
      <SheetContent side="bottom" className="gap-0 p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>How did the call go?</SheetTitle>
          <SheetDescription>
            {pending?.lead.name} · {pending?.lead.phone}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <Label>Time on the call</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={seconds}
                onChange={(e) => { setEdited(true); setSeconds(Math.max(0, Number(e.target.value) || 0)) }}
                className="w-28"
              />
              <span className="text-[13px] text-muted-foreground">seconds · {mmss(seconds)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {edited
                ? 'Your figure — saved as entered.'
                : 'Taken from how long the app was in the background, so it includes ringing. Correct it if it is off.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <Button
                key={o.value}
                variant={o.value === 'connected' ? 'default' : 'outline'}
                disabled={save.isPending}
                onClick={() => save.mutate({ outcome: o.value })}
              >
                {o.label}
              </Button>
            ))}
          </div>

          <Button variant="ghost" className="w-full" onClick={onDiscard} disabled={save.isPending}>
            Discard this call
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
