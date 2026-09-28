import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, MessageCircle, Pencil, Trash2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Booking } from '@/types'
import { Button } from '@/components/ui/button'
import ConfirmDelete from '@/components/ConfirmDelete'
import BookingSheet from '@/components/BookingSheet'
import ConfirmationDialog from '@/components/ConfirmationDialog'
import PaymentPanel from '@/components/PaymentPanel'

/**
 * The row of things you can do to a booking, plus the panels they open. Shared so
 * Bookings and Upcoming offer the same set — they are the same booking, and a list that
 * quietly drops half the buttons sends people hunting for the other screen.
 *
 * The page renders `panels` once and calls `actions(booking)` per row, so there is a
 * single sheet and dialog rather than one per row.
 */
export function useBookingActions() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canEdit = isAdmin || user?.role === 'manager'
  const canMoney = canEdit

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState<Booking | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirming, setConfirming] = useState<Booking | null>(null)
  const [paying, setPaying] = useState<Booking | null>(null)

  const deleteBooking = useMutation({
    mutationFn: (id: string) => api(`/bookings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Booking deleted')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const openEdit = (b: Booking | null) => { setEditing(b); setSheetOpen(true) }

  const actions = (b: Booking) => (
    <div className="flex justify-end gap-1">
      {canMoney && (
        <Button variant="ghost" size="icon-sm" title="Payments" onClick={() => setPaying(b)}>
          <Wallet className="size-5" />
        </Button>
      )}
      {canEdit && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-success"
          title="Send confirmation on WhatsApp"
          onClick={() => setConfirming(b)}
        >
          <MessageCircle className="size-5" />
        </Button>
      )}
      {canEdit && (
        <Button
          variant="ghost"
          size="icon-sm"
          title={b.invoiceNo ? `Invoice ${b.invoiceNo}` : 'Invoice'}
          onClick={() => navigate(`/bookings/${b.id}/invoice`)}
        >
          <FileText className={`size-5 ${b.invoiceNo ? 'text-primary' : ''}`} />
        </Button>
      )}
      {canEdit && (
        <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => openEdit(b)}>
          <Pencil className="size-5" />
        </Button>
      )}
      {isAdmin && (
        <ConfirmDelete
          title={`Delete booking for ${b.guest}?`}
          description="All payment records for this booking will also be deleted."
          onConfirm={() => deleteBooking.mutate(b.id)}
          trigger={<Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-5" /></Button>}
        />
      )}
    </div>
  )

  const panels = (
    <>
      <BookingSheet open={sheetOpen} onClose={() => setSheetOpen(false)} booking={editing} />
      <ConfirmationDialog booking={confirming} onClose={() => setConfirming(null)} />
      {paying && <PaymentPanel booking={paying} onClose={() => setPaying(null)} />}
    </>
  )

  return { actions, panels, openEdit, isAdmin, canEdit, canMoney }
}
