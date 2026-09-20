import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtMoney, fmtDate } from '@/lib/format'
import type { InvoicePayload } from '@/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1.5 ${strong ? 'text-[15px] font-semibold' : 'text-[13px]'}`}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export default function Invoice() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api<InvoicePayload>(`/bookings/${id}/invoice`),
  })

  const issue = useMutation({
    mutationFn: () => api<InvoicePayload>(`/bookings/${id}/invoice`, { method: 'POST' }),
    onSuccess: (fresh) => {
      queryClient.setQueryData(['invoice', id], fresh)
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success(`Invoice ${fresh.invoiceNo} issued`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not issue invoice'),
  })

  if (isLoading || !data) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
  }

  const { booking, property } = data
  const issued = !!data.invoiceNo
  const gstPct = Math.round(data.gstRate * 100)
  const balance = data.total - data.received

  return (
    <div>
      {/* Controls are screen-only; the sheet below is what reaches the paper. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1.5 size-4" /> Back
        </Button>
        <div className="flex-1" />
        {!issued && user?.role === 'admin' && (
          <Button size="sm" onClick={() => issue.mutate()} disabled={issue.isPending}>
            Issue invoice
          </Button>
        )}
        <Button size="sm" variant={issued ? 'default' : 'outline'} onClick={() => window.print()}>
          <Printer className="mr-1.5 size-4" /> Print / Save PDF
        </Button>
      </div>

      {!issued && (
        <p className="mb-4 rounded-lg border border-dashed px-4 py-2.5 text-[13px] text-muted-foreground print:hidden">
          This is a draft. Issuing assigns the next invoice number for {property.name} — numbers must run
          consecutively, so only issue when you are ready to send it.
        </p>
      )}

      <div className="mx-auto max-w-3xl rounded-xl border border-border/60 bg-card p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight">{property.name}</h1>
            {property.address && <p className="mt-1 max-w-xs text-[12px] text-muted-foreground">{property.address}</p>}
            {property.location && !property.address && <p className="mt-1 text-[12px] text-muted-foreground">{property.location}</p>}
            {property.gstin && <p className="mt-1 text-[12px] text-muted-foreground">GSTIN: {property.gstin}</p>}
          </div>
          <div className="text-right">
            <div className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
              {issued ? 'Tax Invoice' : 'Draft Invoice'}
            </div>
            {issued ? (
              <>
                <div className="mt-1 text-[15px] font-bold">{data.invoiceNo}</div>
                <div className="text-[12px] text-muted-foreground">{fmtDate(data.invoiceDate)}</div>
              </>
            ) : (
              <div className="mt-1 text-[13px] text-muted-foreground">Not yet issued</div>
            )}
          </div>
        </div>

        <div className="grid gap-4 border-b py-5 sm:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Billed to</div>
            <div className="mt-1 text-[15px] font-semibold">{booking.guest}</div>
            {booking.phone && <div className="text-[12px] text-muted-foreground">{booking.phone}</div>}
          </div>
          <div className="sm:text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Event</div>
            <div className="mt-1 text-[13px]">{booking.purpose}</div>
            <div className="text-[12px] text-muted-foreground">
              {fmtDate(booking.checkinDate)}
              {booking.checkoutDate && booking.checkoutDate !== booking.checkinDate && ` → ${fmtDate(booking.checkoutDate)}`}
            </div>
            {booking.pax && <div className="text-[12px] text-muted-foreground">{booking.pax}</div>}
          </div>
        </div>

        <table className="w-full border-collapse py-5 text-[13px]">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 text-left font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i.label} className="border-b border-border/40">
                <td className="py-2">{i.label}</td>
                <td className="py-2 text-right tabular-nums">{fmtMoney(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-5 max-w-xs">
          <Row label="Taxable value" value={fmtMoney(data.taxable)} />
          <Row label={`CGST ${gstPct / 2}%`} value={fmtMoney(data.cgst)} />
          <Row label={`SGST ${gstPct / 2}%`} value={fmtMoney(data.sgst)} />
          {data.licence > 0 && <Row label="Licence fee (no GST)" value={fmtMoney(data.licence)} />}
          {data.security > 0 && <Row label="Security deposit (refundable)" value={fmtMoney(data.security)} />}
          <div className="mt-1.5 border-t pt-1.5">
            <Row label="Total" value={fmtMoney(data.total)} strong />
          </div>
          {data.received > 0 && (
            <>
              <Row label="Received" value={fmtMoney(data.received)} />
              <div className="border-t pt-1.5">
                <Row label="Balance due" value={fmtMoney(balance)} strong />
              </div>
            </>
          )}
        </div>

        <p className="mt-8 border-t pt-4 text-[11px] leading-relaxed text-muted-foreground">
          GST charged at {gstPct}% on the taxable value. The licence fee is recovered at actuals and the
          security deposit is refundable, so neither attracts GST. This is a computer-generated invoice.
        </p>
      </div>
    </div>
  )
}
