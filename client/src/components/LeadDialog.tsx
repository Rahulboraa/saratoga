import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { todayYmd, nowHm } from '@/lib/format'
import { EVENT_TYPES, OUTCOMES, LEAD_FLAGS, type Lead } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface FormValues {
  date: string
  time: string
  name: string
  phone: string
  eventType: string
  outcome: string
  followup: string
  notes: string
  exec: string
  flag: string
  adminComment: string
}

function toForm(l?: Lead | null): FormValues {
  return {
    date: l?.date ?? todayYmd(),
    time: l?.time ?? nowHm(),
    name: l?.name ?? '',
    phone: l?.phone ?? '',
    eventType: l?.eventType ?? 'Other',
    outcome: l?.outcome || 'none',
    followup: l?.followup ?? '',
    notes: l?.notes ?? '',
    exec: l?.exec || 'none',
    flag: l?.flag || 'none',
    adminComment: l?.adminComment ?? '',
  }
}

export default function LeadDialog({ open, onClose, lead }: { open: boolean; onClose: () => void; lead?: Lead | null }) {
  const { user } = useAuth()
  const isManager = user?.role === 'admin' || user?.role === 'manager'
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: toForm(lead),
  })

  useEffect(() => {
    if (open) reset(toForm(lead))
  }, [open, lead, reset])

  const { data: execs = [] } = useQuery({
    queryKey: ['execs'],
    queryFn: () => api<{ username: string; name: string }[]>('/users/execs'),
    enabled: open && isManager,
  })

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      lead ? api<Lead>(`/leads/${lead.id}`, { method: 'PATCH', body }) : api<Lead>('/leads', { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success(lead ? 'Lead updated' : 'Call logged')
      onClose()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Save failed'),
  })

  const onSubmit = handleSubmit((v) => {
    const body: Record<string, unknown> = {
      date: v.date, time: v.time, name: v.name, phone: v.phone, eventType: v.eventType,
      outcome: v.outcome === 'none' ? '' : v.outcome, followup: v.followup, notes: v.notes,
    }
    if (isManager) {
      body.exec = v.exec === 'none' ? '' : v.exec
      body.flag = v.flag === 'none' ? '' : v.flag
      body.adminComment = v.adminComment
    }
    save.mutate(body)
  })

  const eventType = watch('eventType')
  const outcome = watch('outcome')
  const exec = watch('exec')
  const flag = watch('flag')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead ? '✏️ Edit Lead' : '📞 Log Call'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" {...register('date', { required: true })} aria-invalid={!!errors.date} />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" {...register('time')} />
            </div>
            <div className="space-y-1.5">
              <Label>Lead Name *</Label>
              <Input {...register('name', { required: true })} aria-invalid={!!errors.name} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input {...register('phone', { required: true })} inputMode="tel" aria-invalid={!!errors.phone} />
            </div>
            <div className="space-y-1.5">
              <Label>Event Type</Label>
              <Select value={eventType} onValueChange={(v) => setValue('eventType', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Call Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setValue('outcome', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Not called yet —</SelectItem>
                  {OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Next Follow-up Date</Label>
              <Input type="date" {...register('followup')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes / Remarks</Label>
            <Textarea rows={2} {...register('notes')} />
          </div>
          {isManager && (
            <div className="grid grid-cols-1 gap-3 rounded-lg border bg-accent/30 p-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Assign To</Label>
                <Select value={exec} onValueChange={(v) => setValue('exec', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Unassigned —</SelectItem>
                    {execs.map((u) => <SelectItem key={u.username} value={u.username}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Flag</Label>
                <Select value={flag} onValueChange={(v) => setValue('flag', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {LEAD_FLAGS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Internal Comment <span className="text-muted-foreground">(not visible to exec)</span></Label>
                <Textarea rows={2} {...register('adminComment')} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
