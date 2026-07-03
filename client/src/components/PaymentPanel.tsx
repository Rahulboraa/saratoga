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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ConfirmDelete from '@/components/ConfirmDelete'
import EmptyState from '@/components/EmptyState'

export default function PaymentPanel({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

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
      date: fd.get('date'), amount: Number(fd.get('amount')), method: fd.get('method'),
      dest: fd.get('dest'), by: fd.get('by'), notes: fd.get('notes'),
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>💳 {booking.guest}</DialogTitle>
          <p className="text-sm text-muted-foreground">{fmtDate(booking.checkinDate)} · {booking.purpose}</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border p-2">
            <div className="text-xs text-muted-foreground">Bill</div>
            <div className="font-bold">{fmtMoney(amount)}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-xs text-muted-foreground">Paid</div>
            <div className="font-bold text-emerald-600">{fmtMoney(paid)}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-xs text-muted-foreground">Due</div>
            <div className={`font-bold ${due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtMoney(due)}</div>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-accent">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>

        {payments.length === 0 ? (
          <EmptyState icon={Wallet} message="No payments recorded yet" />
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                <div>
                  <span className="font-semibold">{fmtMoney(p.amount)}</span>
                  <span className="text-muted-foreground"> · {fmtDate(p.date)}{p.method && ` · ${p.method}`}{p.by && ` · by ${p.by}`}</span>
                  {p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}
                </div>
                <ConfirmDelete
                  title="Delete this payment?"
                  onConfirm={() => deletePayment.mutate(p.id)}
                  trigger={<Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-600"><Trash2 className="size-4" /></Button>}
                />
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <form onSubmit={onSubmit} className="space-y-3 rounded-lg border p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input name="date" type="date" defaultValue={todayYmd()} required />
              </div>
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input name="amount" type="number" min="1" required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Input name="method" placeholder="UPI / Cash / Bank" />
              </div>
              <div className="space-y-1.5">
                <Label>Destination</Label>
                <Input name="dest" placeholder="Account / Paytm" />
              </div>
              <div className="space-y-1.5">
                <Label>Paid By</Label>
                <Input name="by" />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input name="notes" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={addPayment.isPending}>Add Payment</Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setShowForm(true)}>+ Record Payment</Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
