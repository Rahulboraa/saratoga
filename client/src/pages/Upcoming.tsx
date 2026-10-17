import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { CalendarClock, Share2, Copy, Download } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtMoney, fmtDate, todayYmd, PURPOSE_COLORS, STATUS_VARIANT } from '@/lib/format'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { PURPOSES, type Booking } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import EmptyState from '@/components/EmptyState'
import { DataTable, type Paged } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'
import { useBookingActions } from '@/lib/useBookingActions'
import ExportButton from '@/components/ExportButton'
import { cn } from '@/lib/utils'


function shortDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * Every upcoming booking, not just the page on screen. The share image was built from a
 * single page of 20, so anything past that was quietly left out of what got sent.
 */
async function fetchAllUpcoming(q: string, purpose: string) {
  const rows: Booking[] = []
  const pageSize = 100 // the server's ceiling for one request
  for (let page = 1; ; page++) {
    const p = new URLSearchParams({ page: String(page), limit: String(pageSize) })
    if (q) p.set('q', q)
    if (purpose !== 'all') p.set('purpose', purpose)
    const res = await api<Paged<Booking>>(`/bookings/upcoming?${p}`)
    rows.push(...res.rows)
    // Stop on the last page, and on an empty one so a miscount cannot spin forever.
    if (res.rows.length === 0 || rows.length >= res.total) return rows
  }
}

async function generateImage(rows: Booking[]) {
  const W = 940
  const rowH = 36
  const top = 78
  const H = top + 34 + rows.length * rowH + 26
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  const font = (spec: string) => { ctx.font = `${spec} "Geist Variable", ui-sans-serif, sans-serif` }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#0f172a'
  font('600 18px')
  ctx.fillText('Saratoga Villa · Upcoming bookings', 28, 36)
  ctx.fillStyle = '#64748b'
  font('400 12px')
  ctx.fillText(`${fmtDate(todayYmd())} · next ${rows.length} booking${rows.length === 1 ? '' : 's'}`, 28, 56)

  // Phone sits last: it is looked up when someone needs to call, not scanned down the list.
  const col = { date: 28, guest: 173, type: 323, pax: 438, ci: 518, co: 578, phone: 640 }
  ctx.fillStyle = '#94a3b8'
  font('600 10.5px')
  const headerY = top + 8
  ctx.fillText('DATE', col.date, headerY)
  ctx.fillText('GUEST', col.guest, headerY)
  ctx.fillText('TYPE', col.type, headerY)
  ctx.fillText('PAX', col.pax, headerY)
  ctx.fillText('IN', col.ci, headerY)
  ctx.fillText('OUT', col.co, headerY)
  ctx.fillText('PHONE', col.phone, headerY)

  rows.forEach((b, i) => {
    const y = top + 34 + i * rowH
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(28, y - 24)
    ctx.lineTo(W - 28, y - 24)
    ctx.stroke()
    ctx.fillStyle = '#334155'
    font('400 13px')
    const range = b.checkoutDate && b.checkoutDate !== b.checkinDate
      ? `${shortDate(b.checkinDate)} → ${fmtDate(b.checkoutDate)}`
      : fmtDate(b.checkinDate)
    ctx.fillText(range, col.date, y)
    ctx.fillStyle = '#0f172a'
    font('600 13px')
    // Trim anything that would run into the next column rather than overlap it.
    const fit = (text: string, width: number) => {
      let out = text
      while (ctx.measureText(out).width > width && out.length > 3) out = out.slice(0, -1)
      return out === text ? text : `${out}…`
    }
    ctx.fillText(fit(b.guest, col.type - col.guest - 16), col.guest, y)
    ctx.fillStyle = '#334155'
    font('400 13px')
    ctx.fillText(fit(b.purpose || '—', col.pax - col.type - 16), col.type, y)
    ctx.fillText(fit(b.pax || '—', col.ci - col.pax - 16), col.pax, y)
    ctx.fillText(b.checkinTime || '—', col.ci, y)
    ctx.fillText(b.checkoutTime || '—', col.co, y)
    ctx.fillText(b.phone || '—', col.phone, y)
  })

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return null
  return { blob, dataUrl: canvas.toDataURL('image/png') }
}

export default function Upcoming() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canOpen = isAdmin || user?.role === 'manager'
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [purpose, setPurpose] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sharing, setSharing] = useState(false)
  const [shareImg, setShareImg] = useState<{ blob: Blob; dataUrl: string } | null>(null)
  // The same set of actions as the Bookings list: it is the same booking, and saving
  // invalidates the 'bookings' key this list sits under, so it refreshes itself.
  const { actions, panels } = useBookingActions()

  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (q) params.set('q', q)
  if (purpose !== 'all') params.set('purpose', purpose)

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', 'upcoming', params.toString()],
    queryFn: () => api<Paged<Booking>>(`/bookings/upcoming?${params}`),
    placeholderData: keepPreviousData,
  })

  const resetPage = () => setPage(1)

  const purposePill = (b: Booking) => (
    <span className="whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-medium" style={{ background: `${PURPOSE_COLORS[b.purpose]}1c`, color: PURPOSE_COLORS[b.purpose] }}>
      {b.purpose}
    </span>
  )

  const columns: ColumnDef<Booking>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: ({ row: { original: b } }) => (
        <div className="whitespace-nowrap font-medium">
          {fmtDate(b.checkinDate)}
          {b.checkoutDate !== b.checkinDate && <div className="text-[11px] font-normal text-muted-foreground">→ {fmtDate(b.checkoutDate)}</div>}
        </div>
      ),
    },
    {
      id: 'guest',
      header: 'Client',
      cell: ({ row: { original: b } }) => (
        <div>
          <div
            className={cn('font-medium', canOpen && 'cursor-pointer underline-offset-2 hover:text-primary hover:underline')}
            onClick={canOpen ? () => navigate(`/bookings?focus=${b.id}`) : undefined}
          >
            {b.guest}
          </div>
          {b.phone && <div className="text-[11px] text-muted-foreground">{b.phone}</div>}
        </div>
      ),
    },
    {
      id: 'times',
      header: 'Times',
      cell: ({ row: { original: b } }) => <span className="whitespace-nowrap text-muted-foreground">{b.checkinTime} → {b.checkoutTime}</span>,
    },
    { id: 'type', header: 'Type', cell: ({ row: { original: b } }) => purposePill(b) },
    {
      id: 'pax',
      header: 'Pax',
      cell: ({ row: { original: b } }) => <span className="block max-w-28 truncate">{b.pax || '—'}</span>,
    },
    ...(canOpen
      ? ([
          {
            id: 'amount',
            header: 'Amount',
            meta: { headClass: 'text-right', cellClass: 'text-right tabular-nums' },
            cell: ({ row: { original: b } }) => fmtMoney(b.amount),
          },
          {
            id: 'due',
            header: 'Due',
            meta: { headClass: 'text-right', cellClass: 'text-right tabular-nums' },
            cell: ({ row: { original: b } }) => (
              <span className={(b.due ?? 0) > 0 ? 'text-destructive' : 'text-success'}>{fmtMoney(b.due)}</span>
            ),
          },
          {
            id: 'status',
            header: 'Status',
            cell: ({ row: { original: b } }) => <Badge variant={STATUS_VARIANT[b.status ?? 'pending']} withDot>{b.status}</Badge>,
          },
        ] satisfies ColumnDef<Booking>[])
      : []),
    ...(canOpen
      ? [{
          id: 'actions',
          header: 'Action',
          meta: { headClass: 'text-right' },
          cell: ({ row: { original: b } }: { row: { original: Booking } }) => actions(b),
        } satisfies ColumnDef<Booking>]
      : []),
  ]

  return (
    <div>
      <PageHeader
        title="Upcoming"
        description="Next events at the villa, soonest first"
        actions={
          <div className="flex gap-2">
          {canOpen && (() => {
            const p = new URLSearchParams({ upcoming: '1' })
            if (q) p.set('q', q)
            if (purpose !== 'all') p.set('purpose', purpose)
            return <ExportButton path="/export/bookings" name="upcoming-bookings" params={p} />
          })()}
          <Button
            variant="outline"
            disabled={sharing}
            onClick={async () => {
              setSharing(true)
              try {
                const rows = await fetchAllUpcoming(q, purpose)
                if (rows.length === 0) return void toast.error('No upcoming bookings to share')
                const img = await generateImage(rows)
                if (!img) return
                const file = new File([img.blob], `upcoming-bookings-${todayYmd()}.png`, { type: 'image/png' })
                const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent)
                if (isMobile && navigator.canShare?.({ files: [file] })) {
                  await navigator.share({ files: [file], title: 'Upcoming bookings' }).catch(() => {})
                } else {
                  setShareImg(img)
                }
              } finally {
                setSharing(false)
              }
            }}
          >
            <Share2 className="size-5" /> {sharing ? 'Preparing…' : 'Share'}
          </Button>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <Input placeholder="Search client or phone…" value={q} onChange={(e) => { setQ(e.target.value); resetPage() }} className="h-10 w-full sm:w-64" />
        <Select value={purpose} onValueChange={(v) => { setPurpose(v); resetPage() }}>
          <SelectTrigger className="h-10 w-[calc(50%-6px)] sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {PURPOSES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.rows}
        total={data?.total ?? 0}
        page={data?.page ?? page}
        limit={data?.limit ?? limit}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); resetPage() }}
        isLoading={isLoading}
        rowClassName={(b) => cn(b.overlap && 'border-l-2 border-l-destructive')}
        empty={<EmptyState icon={CalendarClock} message="No upcoming bookings" description="New bookings will show up here." />}
        renderCard={(b) => (
          <Card className={cn('py-3', b.overlap && 'border-l-2 border-l-destructive')}>
            <CardContent className="space-y-1.5 px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold">{b.guest}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtDate(b.checkinDate)}{b.checkoutDate !== b.checkinDate && ` → ${fmtDate(b.checkoutDate)}`} · {b.checkinTime}
                  </div>
                </div>
                {purposePill(b)}
              </div>
              {canOpen && (
                <div className="flex items-center justify-between text-[13px] tabular-nums">
                  <span>{fmtMoney(b.amount)}</span>
                  <Badge variant={STATUS_VARIANT[b.status ?? 'pending']} withDot>{b.status}</Badge>
                </div>
              )}
              {canOpen && <div className="flex justify-end gap-1 border-t pt-2">{actions(b)}</div>}
            </CardContent>
          </Card>
        )}
      />

      {panels}

      <Dialog open={!!shareImg} onOpenChange={(o) => !o && setShareImg(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Share upcoming bookings</DialogTitle></DialogHeader>
          {shareImg && (
            <img src={shareImg.dataUrl} alt="Upcoming bookings" className="max-h-[55vh] w-full rounded-lg border object-contain" />
          )}
          <DialogFooter className="flex-row justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!shareImg) return
                const a = document.createElement('a')
                a.href = shareImg.dataUrl
                a.download = `upcoming-bookings-${todayYmd()}.png`
                a.click()
                toast.success('Image downloaded')
              }}
            >
              <Download className="size-5" /> Download
            </Button>
            <Button
              onClick={async () => {
                if (!shareImg) return
                try {
                  await navigator.clipboard.write([new ClipboardItem({ 'image/png': shareImg.blob })])
                  toast.success('Image copied')
                } catch {
                  toast.error('Copy failed — use Download instead')
                }
              }}
            >
              <Copy className="size-5" /> Copy image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
