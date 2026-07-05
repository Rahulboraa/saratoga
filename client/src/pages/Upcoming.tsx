import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtMoney, fmtDate, PURPOSE_COLORS, STATUS_VARIANT } from '@/lib/format'
import { PURPOSES, type Booking } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import EmptyState from '@/components/EmptyState'
import { DataTable, type Paged } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'
import { cn } from '@/lib/utils'

export default function Upcoming() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canOpen = isAdmin || user?.role === 'manager'
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [purpose, setPurpose] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

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
      header: 'Guest',
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
    ...(isAdmin
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
  ]

  return (
    <div>
      <PageHeader title="Upcoming" description="Next events at the villa, soonest first" />

      <div className="mb-5 flex flex-wrap gap-3">
        <Input placeholder="Search guest or phone…" value={q} onChange={(e) => { setQ(e.target.value); resetPage() }} className="h-10 w-full sm:w-64" />
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
              {isAdmin && (
                <div className="flex items-center justify-between text-[13px] tabular-nums">
                  <span>{fmtMoney(b.amount)}</span>
                  <Badge variant={STATUS_VARIANT[b.status ?? 'pending']} withDot>{b.status}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      />
    </div>
  )
}
