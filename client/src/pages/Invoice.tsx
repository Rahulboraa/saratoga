import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtMoney, fmtDate } from '@/lib/format'
import { propertyColor } from '@/lib/propertyLook'
import type { InvoicePayload } from '@/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

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

  const setGst = useMutation({
    mutationFn: (gstEnabled: boolean) =>
      api<InvoicePayload>(`/bookings/${id}/invoice`, { method: 'PATCH', body: { gstEnabled } }),
    onSuccess: (fresh) => queryClient.setQueryData(['invoice', id], fresh),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not change GST'),
  })

  if (isLoading || !data) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
  }

  const { booking, property } = data
  // The project's own colour, used sparingly: a financial document should be read, not
  // decorated, so it marks the edge, the labels and the line that carries the total.
  const accent = propertyColor({ id: property.id, color: property.color })
  const issued = !!data.invoiceNo
  const gstPct = Math.round(data.gstRate * 100)
  const balance = data.total - data.received
  const isAdmin = user?.role === 'admin'

  return (
    <div>
      {/* Controls are screen-only; the sheet below is what reaches the paper. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1.5 size-4" /> Back
        </Button>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Switch
              id="gst"
              checked={data.gstEnabled}
              onCheckedChange={(v) => setGst.mutate(v)}
              disabled={setGst.isPending}
            />
            <Label htmlFor="gst" className="cursor-pointer text-[13px]">Charge GST</Label>
          </div>
        )}
        <div className="flex-1" />
        {!issued && isAdmin && (
          <Button size="sm" onClick={() => issue.mutate()} disabled={issue.isPending}>
            Convert to {data.gstEnabled ? 'tax invoice' : 'invoice'}
          </Button>
        )}
        <Button size="sm" variant={issued ? 'default' : 'outline'} onClick={() => window.print()}>
          <Printer className="mr-1.5 size-4" /> Print / Save PDF
        </Button>
      </div>

      {!issued && (
        <p className="mb-4 rounded-lg border border-dashed px-4 py-2.5 text-[13px] text-muted-foreground print:hidden">
          A proforma — send it as the quote. It becomes a numbered invoice on its own as soon as a payment
          is recorded against this booking, or now if you convert it by hand. Numbers run consecutively for
          {' '}{property.name}, so one is only taken when the invoice is real.
        </p>
      )}

      <div
        data-invoice
        className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm print:border-0 print:shadow-none"
      >
        <div data-invoice-rule className="h-1.5 w-full" style={{ background: accent }} />
        <div className="p-8 print:p-0 print:pt-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight" style={{ color: accent }}>{property.name}</h1>
            {property.address && <p className="mt-1 max-w-xs text-[12px] text-muted-foreground">{property.address}</p>}
            {property.location && !property.address && <p className="mt-1 text-[12px] text-muted-foreground">{property.location}</p>}
            {property.gstin && <p className="mt-1 text-[12px] text-muted-foreground">GSTIN: {property.gstin}</p>}
            {property.header && (
              <p className="mt-1 max-w-xs whitespace-pre-line text-[12px] text-muted-foreground">{property.header}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
              {data.kind}
            </div>
            {issued ? (
              <>
                <div className="mt-1 text-[15px] font-bold">{data.invoiceNo}</div>
                <div className="text-[12px] text-muted-foreground">{fmtDate(data.invoiceDate)}</div>
              </>
            ) : (
              <div className="mt-1 text-[13px] text-muted-foreground">Quotation · not yet a tax invoice</div>
            )}
          </div>
        </div>

        <div className="grid gap-4 border-b py-5 sm:grid-cols-2">
          <div>
            <div data-invoice-label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>Billed to</div>
            <div className="mt-1 text-[15px] font-semibold">{booking.billingName || booking.guest}</div>
            {booking.billingAddress && (
              <div className="mt-0.5 max-w-xs whitespace-pre-line text-[12px] text-muted-foreground">{booking.billingAddress}</div>
            )}
            {booking.billingGstin && (
              <div className="mt-0.5 text-[12px] text-muted-foreground">GSTIN: {booking.billingGstin}</div>
            )}
            {booking.phone && <div className="text-[12px] text-muted-foreground">{booking.phone}</div>}
          </div>
          <div className="sm:text-right">
            <div data-invoice-label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>Event</div>
            <div className="mt-1 text-[13px]">{booking.purpose}</div>
            <div className="text-[12px] text-muted-foreground">
              {fmtDate(booking.checkinDate)}
              {booking.checkoutDate && booking.checkoutDate !== booking.checkinDate && ` → ${fmtDate(booking.checkoutDate)}`}
            </div>
          </div>
        </div>

        <table className="w-full border-collapse py-5 text-[13px]">
          <thead>
            <tr
              data-invoice-head
              className="text-[11px] uppercase tracking-wider"
              style={{ background: `color-mix(in oklch, ${accent}, white 90%)`, color: accent }}
            >
              <th className="rounded-l-md px-3 py-2 text-left font-semibold">Description</th>
              <th className="rounded-r-md px-3 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i.label} className="border-b border-border/40">
                <td className="px-3 py-2">{i.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div data-invoice-totals className="ml-auto mt-5 max-w-xs">
          <Row label={data.gstEnabled ? 'Taxable value' : 'Subtotal'} value={fmtMoney(data.taxable)} />
          {data.gstEnabled && (
            <>
              <Row label={`CGST ${gstPct / 2}%`} value={fmtMoney(data.cgst)} />
              <Row label={`SGST ${gstPct / 2}%`} value={fmtMoney(data.sgst)} />
            </>
          )}
          {data.licence > 0 && <Row label="Licence fee (no GST)" value={fmtMoney(data.licence)} />}
          {data.security > 0 && <Row label="Security deposit (refundable)" value={fmtMoney(data.security)} />}
          {data.refunded > 0 && <Row label="Less: refunded" value={`− ${fmtMoney(data.refunded)}`} />}
          <div
            data-invoice-total
            className="mt-2 rounded-md px-3 py-1.5"
            style={{ background: `color-mix(in oklch, ${accent}, white 90%)`, color: accent }}
          >
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

        {property.terms.length > 0 && (
          <div className="mt-8 border-t pt-4">
            <div data-invoice-label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>Terms</div>
            <ul data-invoice-terms className="mt-2 space-y-1">
              {property.terms.map((t) => (
                <li key={t} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
                  <span aria-hidden>•</span><span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(data.gstEnabled || property.footer) && (
          <div className="mt-4 space-y-2 border-t pt-4 text-[11px] leading-relaxed text-muted-foreground">
            {/* Only said where tax was actually charged. An invoice that carries none is
                simply not a tax invoice, and does not need to announce it. */}
            {data.gstEnabled && (
              <p>
                GST charged at {gstPct}% on the taxable value. The licence fee is recovered at actuals
                and the security deposit is refundable, so neither attracts GST.
              </p>
            )}
            {/* Bank details or a signature block run to several lines, so keep the breaks. */}
            {property.footer && <p className="whitespace-pre-line">{property.footer}</p>}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
