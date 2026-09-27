import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import type { Booking } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * The confirmation is generated from the booking, then left editable: inclusions and
 * one-off terms differ from event to event, and the person sending it knows which.
 */
export default function ConfirmationDialog({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const [text, setText] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['confirmation', booking?.id],
    queryFn: () => api<{ text: string; phone: string }>(`/bookings/${booking!.id}/confirmation`),
    enabled: !!booking,
  })

  useEffect(() => { if (data) setText(data.text) }, [data])
  useEffect(() => { if (!booking) setText('') }, [booking])

  function openWhatsApp() {
    // A number with no country code is assumed Indian, which is every guest so far.
    const digits = (data?.phone ?? '').replace(/\D/g, '')
    const to = digits.length === 10 ? `91${digits}` : digits
    const url = to
      ? `https://wa.me/${to}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener')
  }

  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send confirmation</DialogTitle>
          <DialogDescription>
            Check it over before sending — you can edit anything here without changing the booking.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-72" />
        ) : (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            className="font-mono text-[12px] leading-relaxed"
          />
        )}

        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text)
                toast.success('Copied')
              } catch {
                toast.error('Copy failed')
              }
            }}
          >
            <Copy className="size-5" /> Copy
          </Button>
          <Button onClick={openWhatsApp} disabled={!text}>
            <MessageCircle className="size-5" /> WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
