import { useEffect, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, ArrowDown, ArrowUpDown } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useProperty } from '@/lib/property'
import { fmtMoney, fmtDate, fmtMonth, currentMonth, PURPOSE_COLORS, STATUS_VARIANT } from '@/lib/format'
import { PURPOSES, type Booking } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBookingActions } from '@/lib/useBookingActions'
import EmptyState from '@/components/EmptyState'
import { DataTable, type Paged } from '@/components/DataTable'
import ExportButton from '@/components/ExportButton'
import { PageHeader } from '@/components/PageHeader'
import { cn } from '@/lib/utils'

type BookingsResponse = Paged<Booking> & { months: string[] }

export default function Bookings() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canEdit = isAdmin || user?.role === 'manager'
  const canMoney = canEdit

  const [q, setQ] = useState('')
  // Opens on this month — that is the window the team works in day to day.
  const [month, setMonth] = useState(currentMonth())
  const [status, setStatus] = useState('all')
  const [purpose, setPurpose] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sort, setSort] = useState<'checkinDate' | 'createdAt'>('checkinDate')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const { actions, panels, openEdit } = useBookingActions()
  const { active } = useProperty()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const focus = searchParams.get('focus')
    if (!focus) return
    setSearchParams({}, { replace: true })
    api<Booking>(`/bookings/${focus}`)
      .then((b) => {
        // The list opens on the current month, so move it to the month this booking is
        // in — otherwise closing the sheet leaves no trace of what was just opened.
        setMonth(b.checkinDate.slice(0, 7))
        // Opening a booking from the calendar, search or Upcoming means editing it.
        // Payments have their own button on the row.
        if (canEdit) openEdit(b)
        else setQ(b.guest)
      })
      .catch(() => toast.error('Booking not found'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (q) params.set('q', q)
  if (month !== 'all') params.set('month', month)
  if (canMoney && status !== 'all') params.set('status', status)
  if (purpose !== 'all') params.set('purpose', purpose)
  params.set('sort', sort)
  params.set('dir', dir)

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', params.toString()],
    queryFn: () => api<BookingsResponse>(`/bookings?${params}`),
    placeholderData: keepPreviousData,
  })

  // The server only lists months that have bookings, so the current one is added
  // explicitly — otherwise the default selection would show a blank trigger.
  const monthOptions = [...new Set([currentMonth(), ...(data?.months ?? [])])].sort().reverse()

  const resetPage = () => setPage(1)

  const showParts =
    !!active?.units?.length || (data?.rows ?? []).some((b) => b.units?.length)

  // Clicking the column already sorted flips it; clicking another starts newest-first,
  // which is what you want from a date either way.
  function sortBy(column: 'checkinDate' | 'createdAt') {
    if (sort === column) setDir(dir === 'desc' ? 'asc' : 'desc')
    else { setSort(column); setDir('desc') }
    resetPage()
  }

  const sortHeader = (column: 'checkinDate' | 'createdAt', label: string) => (
    <button
      type="button"
      onClick={() => sortBy(column)}
      className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
    >
      {label}
      {sort === column
        ? <ArrowDown className={`size-3.5 transition-transform ${dir === 'asc' ? 'rotate-180' : ''}`} />
        : <ArrowUpDown className="size-3.5 opacity-40" />}
    </button>
  )

  const purposePill = (b: Booking) => (
    <span className="whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-medium" style={{ background: `${PURPOSE_COLORS[b.purpose]}1c`, color: PURPOSE_COLORS[b.purpose] }}>
      {b.purpose}
    </span>
  )

  const columns: ColumnDef<Booking>[] = [
    {
      id: 'date',
      header: () => sortHeader('checkinDate', 'Date'),
      cell: ({ row: { original: b } }) => (
        <div className="whitespace-nowrap">
          {fmtDate(b.checkinDate)}
          {b.checkoutDate !== b.checkinDate && <div className="text-[11px] text-muted-foreground">→ {fmtDate(b.checkoutDate)}</div>}
        </div>
      ),
    },
    ...(canEdit
      ? [{
          id: 'booked',
          header: () => sortHeader('createdAt', 'Booked On'),
          cell: ({ row: { original: b } }: { row: { original: Booking } }) => (
            <span className="whitespace-nowrap text-[12px] text-muted-foreground">{fmtDate(b.createdAt)}</span>
          ),
        } as ColumnDef<Booking>]
      : []),
    {
      id: 'guest',
      header: 'Client',
      // The name is the obvious thing to reach for to open a booking, and Upcoming
      // already behaves this way — here it did nothing at all.
      cell: ({ row: { original: b } }) => (
        <div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => openEdit(b)}
              className="text-left font-medium underline-offset-2 hover:text-primary hover:underline"
            >
              {b.guest}
            </button>
          ) : (
            <div className="font-medium">{b.guest}</div>
          )}
          {b.phone && <div className="text-[11px] text-muted-foreground">{b.phone}</div>}
        </div>
      ),
    },
    ...(canMoney
      ? ([
          {
            id: 'amount',
            header: 'Amount',
            meta: { headClass: 'text-right', cellClass: 'text-right tabular-nums' },
            cell: ({ row: { original: b } }) => fmtMoney(b.amount),
          },
          {
            id: 'received',
            header: 'Received',
            meta: { headClass: 'text-right', cellClass: 'text-right tabular-nums text-success' },
            cell: ({ row: { original: b } }) => fmtMoney(b.collected),
          },
          {
            id: 'due',
            header: 'Due',
            meta: { headClass: 'text-right', cellClass: 'text-right tabular-nums' },
            cell: ({ row: { original: b } }) => (
              <span className={(b.due ?? 0) > 0 ? 'text-destructive' : 'text-success'}>{fmtMoney(b.due)}</span>
            ),
          },
        ] satisfies ColumnDef<Booking>[])
      : []),
    // Only worth a column where something can actually be split. At a project booked
    // whole it would be a column of dashes, and in the all-projects view it still earns
    // its place as soon as one booking on screen names a part.
    ...(showParts
      ? ([{
          id: 'part',
          header: 'Part',
          cell: ({ row: { original: b } }) =>
            b.units?.length
              ? <span className="whitespace-nowrap text-[12px]">{b.units.join(' + ')}</span>
              : <span className="text-[12px] text-muted-foreground">Entire</span>,
        }] satisfies ColumnDef<Booking>[])
      : []),
    { id: 'type', header: 'Type', cell: ({ row: { original: b } }) => purposePill(b) },
    {
      id: 'pax',
      header: 'Pax',
      cell: ({ row: { original: b } }) => <span className="block max-w-28 truncate">{b.pax || '—'}</span>,
    },
    ...(canMoney
      ? ([{
          id: 'status',
          header: 'Status',
          cell: ({ row: { original: b } }) => <Badge variant={STATUS_VARIANT[b.status ?? 'pending']} withDot>{b.status}</Badge>,
        }] satisfies ColumnDef<Booking>[])
      : []),
    { id: 'actions', header: 'Action', meta: { headClass: 'text-right' }, cell: ({ row: { original: b } }) => actions(b) },
  ]

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Every event with payment status and conflicts"
        actions={
          <>
            {isAdmin && (() => {
              const p = new URLSearchParams()
              if (q) p.set('q', q)
              if (month !== 'all') p.set('month', month)
              if (status !== 'all') p.set('status', status)
              if (purpose !== 'all') p.set('purpose', purpose)
              return <ExportButton path="/export/bookings" name="bookings" params={p} />
            })()}
            {canEdit && <Button onClick={() => openEdit(null)}>New booking</Button>}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <Input
          placeholder="Search client or phone…"
          value={q}
          onChange={(e) => { setQ(e.target.value); resetPage() }}
          className="h-9 w-full sm:w-64"
        />
        <Select value={month} onValueChange={(v) => { setMonth(v); resetPage() }}>
          <SelectTrigger className="h-9 w-[calc(50%-6px)] sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {monthOptions.map((m) => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        {canMoney && (
          <Select value={status} onValueChange={(v) => { setStatus(v); resetPage() }}>
            <SelectTrigger className="h-9 w-[calc(50%-6px)] sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={purpose} onValueChange={(v) => { setPurpose(v); resetPage() }}>
          <SelectTrigger className="h-9 w-[calc(50%-6px)] sm:w-64"><SelectValue /></SelectTrigger>
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
        rowClassName={(b) => cn(b.overlap && 'border-l-2 border-l-destructive', canMoney && b.status === 'pending' && 'bg-destructive/5')}
        empty={<EmptyState icon={CalendarDays} message="No bookings found" description="Try adjusting your search or filters." />}
        renderCard={(b) => (
          <Card className={cn('py-3', b.overlap && 'border-l-2 border-l-destructive')}>
            <CardContent className="space-y-2 px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  {canEdit ? (
                    <button type="button" onClick={() => openEdit(b)} className="text-left text-[13px] font-semibold underline-offset-2 hover:text-primary hover:underline">
                      {b.guest}
                    </button>
                  ) : (
                    <div className="text-[13px] font-semibold">{b.guest}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    {fmtDate(b.checkinDate)}{b.checkoutDate !== b.checkinDate && ` → ${fmtDate(b.checkoutDate)}`}
                    {b.pax && ` · ${b.pax}`}
                    {b.units?.length ? ` · ${b.units.join(' + ')}` : ''}
                  </div>
                </div>
                {purposePill(b)}
              </div>
              {canMoney && (
                <div className="flex items-center justify-between text-[13px] tabular-nums">
                  <span>{fmtMoney(b.amount)} <span className="text-muted-foreground">bill</span></span>
                  <span className={(b.due ?? 0) > 0 ? 'text-destructive' : 'text-success'}>
                    {fmtMoney(b.due)} <span className="text-muted-foreground">due</span>
                  </span>
                  <Badge variant={STATUS_VARIANT[b.status ?? 'pending']} withDot>{b.status}</Badge>
                </div>
              )}
              {(canEdit || isAdmin) && <div className="flex justify-end gap-1 border-t pt-2">{actions(b)}</div>}
            </CardContent>
          </Card>
        )}
      />

      {panels}
    </div>
  )
}
