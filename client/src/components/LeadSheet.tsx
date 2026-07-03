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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DatePicker, TimeSelect } from '@/components/DatePicker'
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

export default function LeadSheet({ open, onClose, lead }: { open: boolean; onClose: () => void; lead?: Lead | null }) {
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
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{lead ? 'Edit lead' : 'Log call'}</SheetTitle>
          <SheetDescription>{lead ? `Editing ${lead.name}` : 'Record a lead or call outcome'}</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <div className="space-y-2">
              <Label>Date *</Label>
              <DatePicker value={watch('date')} onChange={(v) => setValue('date', v)} />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <TimeSelect value={watch('time')} onChange={(v) => setValue('time', v)} allowEmpty />
            </div>
            <div className="space-y-2">
              <Label>Lead Name *</Label>
              <Input {...register('name', { required: true })} aria-invalid={!!errors.name} />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input {...register('phone', { required: true })} inputMode="tel" aria-invalid={!!errors.phone} />
            </div>
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select value={eventType} onValueChange={(v) => setValue('eventType', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Call Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setValue('outcome', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Not called yet —</SelectItem>
                  {OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Next follow-up date</Label>
              <DatePicker value={watch('followup')} onChange={(v) => setValue('followup', v)} clearable placeholder="No follow-up" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes / Remarks</Label>
            <Textarea rows={2} {...register('notes')} />
          </div>
          {isManager && (
            <div className="grid grid-cols-1 gap-3 rounded-lg border bg-accent/30 p-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={exec} onValueChange={(v) => setValue('exec', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Unassigned —</SelectItem>
                    {execs.map((u) => <SelectItem key={u.username} value={u.username}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Flag</Label>
                <Select value={flag} onValueChange={(v) => setValue('flag', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {LEAD_FLAGS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Internal Comment <span className="text-muted-foreground">(not visible to exec)</span></Label>
                <Textarea rows={2} {...register('adminComment')} />
              </div>
            </div>
          )}
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>Save lead</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
