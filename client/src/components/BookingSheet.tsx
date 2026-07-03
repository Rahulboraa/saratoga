import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtMoney, fmtDate, todayYmd } from '@/lib/format'
import { PURPOSES, SOURCES, type Booking } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker, TimeSelect } from '@/components/DatePicker'

interface Conflict { guest: string; checkinDate: string; checkoutDate: string }

interface FormValues {
  guest: string
  phone: string
  checkinDate: string
  checkoutDate: string
  checkinTime: string
  checkoutTime: string
  pax: string
  purpose: string
  source: string
  dest: string
  notes: string
  venue: number
  catering: number
  decor: number
  music: number
  cleaning: number
  license: number
  security: number
}

const MONEY_FIELDS = ['venue', 'catering', 'decor', 'music', 'cleaning'] as const

function toForm(b?: Booking | null): FormValues {
  return {
    guest: b?.guest ?? '',
    phone: b?.phone ?? '',
    checkinDate: b?.checkinDate ?? todayYmd(),
    checkoutDate: b?.checkoutDate ?? '',
    checkinTime: b?.checkinTime ?? '15:00',
    checkoutTime: b?.checkoutTime ?? '10:00',
    pax: b?.pax ?? '',
    purpose: b?.purpose ?? 'Other',
    source: b?.source ?? 'none',
    dest: b?.dest ?? '',
    notes: b?.notes ?? '',
    venue: b?.breakdown?.venue ?? 0,
    catering: b?.breakdown?.catering ?? 0,
    decor: b?.breakdown?.decor ?? 0,
    music: b?.breakdown?.music ?? 0,
    cleaning: b?.breakdown?.cleaning ?? 0,
    license: b?.breakdown?.license ?? 0,
    security: b?.breakdown?.security ?? 0,
  }
}

export default function BookingSheet({ open, onClose, booking }: { open: boolean; onClose: () => void; booking?: Booking | null }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null)
  const { register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: toForm(booking),
  })

  useEffect(() => {
    if (open) {
      reset(toForm(booking))
      setConflicts(null)
    }
  }, [open, booking, reset])

  const money = watch(MONEY_FIELDS as unknown as (keyof FormValues)[])
  const total = useMemo(() => money.reduce((s: number, v) => s + (Number(v) || 0), 0), [money])
  const [purpose, source, checkinDate, checkoutDate, checkinTime, checkoutTime] = [
    watch('purpose'), watch('source'), watch('checkinDate'), watch('checkoutDate'), watch('checkinTime'), watch('checkoutTime'),
  ]

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      booking
        ? api<Booking>(`/bookings/${booking.id}`, { method: 'PATCH', body: payload })
        : api<Booking>('/bookings', { body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success(booking ? 'Booking updated' : 'Booking created')
      onClose()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflicts((err.data as { conflicts: Conflict[] }).conflicts)
      } else {
        toast.error(err instanceof Error ? err.message : 'Save failed')
      }
    },
  })

  function buildPayload(v: FormValues, allowOverlap: boolean) {
    const base: Record<string, unknown> = {
      guest: v.guest, phone: v.phone, checkinDate: v.checkinDate, checkoutDate: v.checkoutDate,
      checkinTime: v.checkinTime || '15:00', checkoutTime: v.checkoutTime || '10:00',
      pax: v.pax, purpose: v.purpose, source: v.source === 'none' ? '' : v.source, notes: v.notes, allowOverlap,
    }
    if (isAdmin) {
      base.dest = v.dest
      base.breakdown = {
        venue: +v.venue || 0, catering: +v.catering || 0, decor: +v.decor || 0, music: +v.music || 0,
        cleaning: +v.cleaning || 0, license: +v.license || 0, security: +v.security || 0,
      }
    }
    return base
  }

  const onSubmit = handleSubmit((v) => save.mutate(buildPayload(v, false)))
  const onSubmitForced = handleSubmit((v) => save.mutate(buildPayload(v, true)))

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{booking ? 'Edit booking' : 'New booking'}</SheetTitle>
          <SheetDescription>{booking ? `Editing ${booking.guest}` : 'Add an event booking'}</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Guest name *</Label>
                <Input {...register('guest', { required: true })} aria-invalid={!!errors.guest} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...register('phone')} inputMode="tel" />
              </div>
              <div className="space-y-1.5">
                <Label>Check-in date *</Label>
                <DatePicker value={checkinDate} onChange={(v) => setValue('checkinDate', v)} />
              </div>
              <div className="space-y-1.5">
                <Label>Check-out date</Label>
                <DatePicker value={checkoutDate} onChange={(v) => setValue('checkoutDate', v)} clearable placeholder="Same day" />
              </div>
              <div className="space-y-1.5">
                <Label>Check-in time</Label>
                <TimeSelect value={checkinTime} onChange={(v) => setValue('checkinTime', v)} />
              </div>
              <div className="space-y-1.5">
                <Label>Check-out time</Label>
                <TimeSelect value={checkoutTime} onChange={(v) => setValue('checkoutTime', v)} />
              </div>
              <div className="space-y-1.5">
                <Label>Pax / location</Label>
                <Input {...register('pax')} placeholder="30 / Sector 150 Noida" />
              </div>
              <div className="space-y-1.5">
                <Label>Purpose</Label>
                <Select value={purpose} onValueChange={(v) => setValue('purpose', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={source} onValueChange={(v) => setValue('source', v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                <div className="space-y-1.5">
                  <Label>Payment destination</Label>
                  <Input {...register('dest')} placeholder="HDFC / Paytm ID" />
                </div>
              )}
            </div>

            {isAdmin && (
              <>
                <Separator />
                <div>
                  <div className="mb-3 text-[13px] font-semibold">Amount breakdown</div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {MONEY_FIELDS.map((f) => (
                      <div key={f} className="space-y-1.5">
                        <Label className="capitalize">{f === 'venue' ? 'Venue rental' : f}</Label>
                        <Input type="number" min="0" {...register(f)} />
                      </div>
                    ))}
                    <div className="space-y-1.5">
                      <Label>Total</Label>
                      <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-[13px] font-semibold tabular-nums text-primary">
                        {fmtMoney(total)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>License</Label>
                      <Input type="number" min="0" {...register('license')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Security deposit</Label>
                      <Input type="number" min="0" {...register('security')} />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Notes / inclusions</Label>
              <Textarea rows={3} {...register('notes')} />
            </div>

            {conflicts && (
              <div className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-[13px]">
                <div className="font-semibold text-warning">Dates overlap with existing booking{conflicts.length > 1 ? 's' : ''}:</div>
                <ul className="mt-1 list-inside list-disc">
                  {conflicts.map((c, i) => (
                    <li key={i}>{c.guest} — {fmtDate(c.checkinDate)}{c.checkoutDate !== c.checkinDate && ` → ${fmtDate(c.checkoutDate)}`}</li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setConflicts(null)}>Change dates</Button>
                  <Button type="button" size="sm" onClick={onSubmitForced} disabled={isSubmitting}>Save anyway</Button>
                </div>
              </div>
            )}
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !!conflicts}>
              {isSubmitting ? 'Saving…' : 'Save booking'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
