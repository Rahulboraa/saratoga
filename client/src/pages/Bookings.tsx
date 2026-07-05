import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Pencil, Trash2, Wallet, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtMoney, fmtDate, fmtMonth, PURPOSE_COLORS, STATUS_VARIANT } from '@/lib/format'
import { PURPOSES, type Booking } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import BookingSheet from '@/components/BookingSheet'
import PaymentPanel from '@/components/PaymentPanel'
import ConfirmDelete from '@/components/ConfirmDelete'
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
  const queryClient = useQueryClient()

  const [q, setQ] = useState('')
  const [month, setMonth] = useState('all')
  const [status, setStatus] = useState('all')
  const [purpose, setPurpose] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Booking | null>(null)
  const [payFor, setPayFor] = useState<string | null>(null)
  const [external, setExternal] = useState<Booking | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const focus = searchParams.get('focus')
    if (!focus) return
    setSearchParams({}, { replace: true })
    api<Booking>(`/bookings/${focus}`)
      .then((b) => {
        setExternal(b)
        if (isAdmin) setPayFor(b.id)
        else if (canEdit) { setEditing(b); setSheetOpen(true) }
        else setQ(b.guest)
      })
      .catch(() => toast.error('Booking not found'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (q) params.set('q', q)
  if (month !== 'all') params.set('month', month)
  if (isAdmin && status !== 'all') params.set('status', status)
  if (purpose !== 'all') params.set('purpose', purpose)

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', params.toString()],
    queryFn: () => api<BookingsResponse>(`/bookings?${params}`),
    placeholderData: keepPreviousData,
  })

  const deleteBooking = useMutation({
    mutationFn: (id: string) => api(`/bookings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Booking deleted')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const resetPage = () => setPage(1)
  const payBooking = payFor ? (data?.rows ?? []).find((b) => b.id === payFor) ?? (external?.id === payFor ? external : null) : null

  const actions = (b: Booking) => (
    <div className="flex justify-end gap-1">
      {isAdmin && (
        <Button variant="ghost" size="icon-sm" title="Payments" onClick={() => setPayFor(b.id)}>
          <Wallet className="size-5" />
        </Button>
      )}
      {canEdit && (
        <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => { setEditing(b); setSheetOpen(true) }}>
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
        <div className="whitespace-nowrap">
          {fmtDate(b.checkinDate)}
          {b.checkoutDate !== b.checkinDate && <div className="text-[11px] text-muted-foreground">→ {fmtDate(b.checkoutDate)}</div>}
        </div>
      ),
    },
    {
      id: 'guest',
      header: 'Guest',
      cell: ({ row: { original: b } }) => (
        <div>
          <div className="font-medium">{b.guest}</div>
          {b.phone && <div className="text-[11px] text-muted-foreground">{b.phone}</div>}
        </div>
      ),
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
    { id: 'type', header: 'Type', cell: ({ row: { original: b } }) => purposePill(b) },
    {
      id: 'pax',
      header: 'Pax',
      cell: ({ row: { original: b } }) => <span className="block max-w-28 truncate">{b.pax || '—'}</span>,
    },
    ...(isAdmin
      ? ([{
          id: 'status',
          header: 'Status',
          cell: ({ row: { original: b } }) => <Badge variant={STATUS_VARIANT[b.status ?? 'pending']} withDot>{b.status}</Badge>,
        }] satisfies ColumnDef<Booking>[])
      : []),
    { id: 'actions', header: '', cell: ({ row: { original: b } }) => actions(b) },
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
            {canEdit && <Button onClick={() => { setEditing(null); setSheetOpen(true) }}>New booking</Button>}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <Input
          placeholder="Search guest or phone…"
          value={q}
          onChange={(e) => { setQ(e.target.value); resetPage() }}
          className="h-9 w-full sm:w-64"
        />
        <Select value={month} onValueChange={(v) => { setMonth(v); resetPage() }}>
          <SelectTrigger className="h-9 w-[calc(50%-6px)] sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {(data?.months ?? []).map((m) => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        {isAdmin && (
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
        rowClassName={(b) => cn(b.overlap && 'border-l-2 border-l-destructive', isAdmin && b.status === 'pending' && 'bg-destructive/5')}
        empty={<EmptyState icon={CalendarDays} message="No bookings found" description="Try adjusting your search or filters." />}
        renderCard={(b) => (
          <Card className={cn('py-3', b.overlap && 'border-l-2 border-l-destructive')}>
            <CardContent className="space-y-2 px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold">{b.guest}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtDate(b.checkinDate)}{b.checkoutDate !== b.checkinDate && ` → ${fmtDate(b.checkoutDate)}`}
                    {b.pax && ` · ${b.pax}`}
                  </div>
                </div>
                {purposePill(b)}
              </div>
              {isAdmin && (
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

      <BookingSheet open={sheetOpen} onClose={() => setSheetOpen(false)} booking={editing} />
      {payBooking && <PaymentPanel booking={payBooking} onClose={() => setPayFor(null)} />}
    </div>
  )
}
