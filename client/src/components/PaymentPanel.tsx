import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { fmtMoney, fmtDate, todayYmd } from '@/lib/format'
import type { Booking, Payment } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DatePicker } from '@/components/DatePicker'
import ConfirmDelete from '@/components/ConfirmDelete'

export default function PaymentPanel({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [payDate, setPayDate] = useState(todayYmd())

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', booking?.id],
    queryFn: () => api<Payment[]>(`/bookings/${booking!.id}/payments`),
    enabled: !!booking,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['payments', booking?.id] })
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  const addPayment = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Payment>(`/bookings/${booking!.id}/payments`, { body }),
    onSuccess: () => {
      invalidate()
      setShowForm(false)
      toast.success('Payment recorded')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const deletePayment = useMutation({
    mutationFn: (id: string) => api(`/payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast.success('Payment deleted')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  if (!booking) return null

  const paid = booking.collected ?? payments.reduce((s, p) => s + p.amount, 0)
  const amount = booking.amount ?? 0
  const due = amount - paid
  const pct = amount > 0 ? Math.min(Math.round((paid / amount) * 100), 100) : 0

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    addPayment.mutate({
      date: payDate, amount: Number(fd.get('amount')), method: fd.get('method'),
      dest: fd.get('dest'), by: fd.get('by'), notes: fd.get('notes'),
    })
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" size="md" className="flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Payments · {booking.guest}</SheetTitle>
          <SheetDescription>{fmtDate(booking.checkinDate)} · {booking.purpose}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-border/60 p-2 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Bill</div>
              <div className="text-[15px] font-semibold tabular-nums">{fmtMoney(amount)}</div>
            </div>
            <div className="rounded-lg border border-border/60 p-2 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Paid</div>
              <div className="text-[15px] font-semibold tabular-nums text-success">{fmtMoney(paid)}</div>
            </div>
            <div className="rounded-lg border border-border/60 p-2 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Due</div>
              <div className={`text-[15px] font-semibold tabular-nums ${due > 0 ? 'text-destructive' : 'text-success'}`}>{fmtMoney(due)}</div>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>

          {showForm ? (
            <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border/60 p-3 shadow-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <DatePicker value={payDate} onChange={setPayDate} />
                </div>
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input name="amount" type="number" min="1" required autoFocus />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Input name="method" placeholder="UPI / Cash / Bank" />
                </div>
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Input name="dest" placeholder="Account / Paytm" />
                </div>
                <div className="space-y-2">
                  <Label>Paid by</Label>
                  <Input name="by" />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input name="notes" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={addPayment.isPending}>Add payment</Button>
              </div>
            </form>
          ) : (
            <Button onClick={() => { setPayDate(todayYmd()); setShowForm(true) }}>Record payment</Button>
          )}

          {payments.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
              <Wallet className="size-5" /> No payments recorded yet
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2.5 text-[13px] shadow-sm">
                  <div>
                    <span className="font-semibold tabular-nums">{fmtMoney(p.amount)}</span>
                    <span className="text-muted-foreground"> · {fmtDate(p.date)}{p.method && ` · ${p.method}`}{p.by && ` · by ${p.by}`}</span>
                    {p.notes && <div className="text-[11px] text-muted-foreground">{p.notes}</div>}
                  </div>
                  <ConfirmDelete
                    title="Delete this payment?"
                    onConfirm={() => deletePayment.mutate(p.id)}
                    trigger={<Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-5" /></Button>}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
