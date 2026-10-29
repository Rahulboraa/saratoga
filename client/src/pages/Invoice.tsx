import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtMoney, fmtDate } from '@/lib/format'
import { propertyColor } from '@/lib/propertyLook'
import { amountInWords } from '@/lib/amountInWords'
import type { InvoicePayload } from '@/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? 'py-1 text-[15px] font-semibold' : 'py-1 text-[13.5px]'}`}>
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
        className="mx-auto max-w-3xl overflow-hidden bg-card shadow-sm print:shadow-none"
      >
        <div
          data-invoice-masthead
          className="flex flex-wrap items-end justify-between gap-6 px-10 py-6"
          style={{ background: accent, color: 'white' }}
        >
          <div className="min-w-0">
            <h1 className="text-[29px] font-semibold leading-none tracking-[-0.02em]">{property.name}</h1>
            <div className="mt-3 space-y-0.5 text-[12px] leading-snug opacity-85">
              {property.address && <p className="max-w-[38ch] whitespace-pre-line">{property.address}</p>}
              {property.location && !property.address && <p>{property.location}</p>}
              {property.header && <p className="max-w-[38ch] whitespace-pre-line">{property.header}</p>}
              {property.gstin && <p className="pt-0.5 tabular-nums">GSTIN {property.gstin}</p>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-85">{data.kind}</div>
            {issued ? (
              <>
                <div className="mt-2 text-[22px] font-semibold leading-none tabular-nums tracking-tight">
                  {data.invoiceNo}
                </div>
                <div className="mt-1.5 text-[12px] opacity-85">{fmtDate(data.invoiceDate)}</div>
              </>
            ) : (
              <div className="mt-1.5 max-w-[22ch] text-[12px] leading-snug opacity-85">
                Quotation — not yet a tax invoice
              </div>
            )}
          </div>
        </div>

        <div className="px-10 pb-7 pt-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div data-invoice-label className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Billed to
              </div>
              <div className="mt-2 text-[16px] font-semibold">{booking.billingName || booking.guest}</div>
              <div className="mt-1 space-y-0.5 text-[12.5px] leading-snug text-muted-foreground">
                {booking.billingAddress && <p className="max-w-[34ch] whitespace-pre-line">{booking.billingAddress}</p>}
                {booking.billingGstin && <p className="tabular-nums">GSTIN {booking.billingGstin}</p>}
                {booking.phone && <p className="tabular-nums">{booking.phone}</p>}
              </div>
            </div>
            <div className="sm:text-right">
              <div data-invoice-label className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Event
              </div>
              <div className="mt-2 text-[16px] font-semibold">{booking.purpose}</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">
                {fmtDate(booking.checkinDate)}
                {booking.checkoutDate && booking.checkoutDate !== booking.checkinDate && ` — ${fmtDate(booking.checkoutDate)}`}
              </div>
            </div>
          </div>

          <table className="mt-7 w-full border-collapse text-[13.5px]">
            <thead>
              <tr data-invoice-head className="border-b-2" style={{ borderColor: accent }}>
                <th className="pb-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Description
                </th>
                <th className="pb-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.label} className="border-b border-border/50">
                  <td className="py-2.5">{i.label}</td>
                  <td className="py-2.5 text-right tabular-nums">{fmtMoney(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div data-invoice-totals className="ml-auto mt-4 w-full max-w-[18rem]">
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

            <div className="mt-2 border-t border-foreground/20 pt-2">
              <Row label="Total" value={fmtMoney(data.total)} strong />
            </div>
            {data.received > 0 && <Row label="Received" value={fmtMoney(data.received)} />}
          </div>

          {data.received > 0 && (
            <div
              data-invoice-due
              className="ml-auto mt-3 flex w-full max-w-[18rem] items-baseline justify-between gap-4 px-5 py-3.5"
              style={{ background: accent, color: 'white' }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-90">Balance due</span>
              <span className="text-[23px] font-semibold leading-none tabular-nums tracking-[-0.02em]">
                {fmtMoney(balance)}
              </span>
            </div>
          )}

          {/* Stating the figure in words is how an invoice is read and checked here. */}
          <div className="ml-auto mt-2 w-full max-w-[18rem] text-right text-[11.5px] font-semibold leading-snug text-foreground">
            {amountInWords(data.received > 0 ? balance : data.total)}
          </div>

          {property.terms.length > 0 && (
            <div className="mt-8 border-t border-border/60 pt-4">
              <div data-invoice-label className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Terms
              </div>
              <ul data-invoice-terms className="mt-2 space-y-1">
                {property.terms.map((t) => (
                  <li key={t} className="flex gap-2 text-[12px] leading-relaxed text-muted-foreground">
                    <span aria-hidden className="select-none" style={{ color: accent }}>•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(data.gstEnabled || property.footer) && (
            <div className="mt-4 space-y-2 border-t border-border/60 pt-4 text-[12px] leading-relaxed text-muted-foreground">
              {data.gstEnabled && (
                <p className="max-w-[72ch]">
                  GST charged at {gstPct}% on the taxable value. The licence fee is recovered at actuals
                  and the security deposit is refundable, so neither attracts GST.
                </p>
              )}
              {property.footer && <p className="whitespace-pre-line">{property.footer}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
