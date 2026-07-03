import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtMoney, fmtDate, fmtMonth, PURPOSE_COLORS, STATUS_BADGE } from '@/lib/format'
import { PURPOSES, type Booking } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import BookingDialog from '@/components/BookingDialog'
import PaymentPanel from '@/components/PaymentPanel'
import ConfirmDelete from '@/components/ConfirmDelete'
import EmptyState from '@/components/EmptyState'
import { cn } from '@/lib/utils'

export default function Bookings() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canEdit = isAdmin || user?.role === 'manager'
  const queryClient = useQueryClient()

  const [q, setQ] = useState('')
  const [month, setMonth] = useState('all')
  const [status, setStatus] = useState('all')
  const [purpose, setPurpose] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Booking | null>(null)
  const [payFor, setPayFor] = useState<string | null>(null)

  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (month !== 'all') params.set('month', month)
  if (isAdmin && status !== 'all') params.set('status', status)
  if (purpose !== 'all') params.set('purpose', purpose)

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', params.toString()],
    queryFn: () => api<Booking[]>(`/bookings?${params}`),
  })

  const { data: allBookings } = useQuery({
    queryKey: ['bookings', ''],
    queryFn: () => api<Booking[]>('/bookings'),
  })

  const months = useMemo(() => {
    const set = new Set((allBookings ?? []).map((b) => b.checkinDate.slice(0, 7)))
    return [...set].sort().reverse()
  }, [allBookings])

  const deleteBooking = useMutation({
    mutationFn: (id: string) => api(`/bookings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Booking deleted')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const payBooking = payFor ? (bookings ?? []).find((b) => b.id === payFor) ?? null : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">All Bookings</h1>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>+ New Booking</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search guest or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[calc(50%-4px)] sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {months.map((m) => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={purpose} onValueChange={setPurpose}>
          <SelectTrigger className="w-[calc(50%-4px)] sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {PURPOSES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !bookings?.length ? (
        <EmptyState icon="📅" message="No bookings match your filters." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Guest</TableHead>
                  {isAdmin && <TableHead className="text-right">Amount</TableHead>}
                  {isAdmin && <TableHead className="text-right">Received</TableHead>}
                  {isAdmin && <TableHead className="text-right">Due</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Pax</TableHead>
                  {isAdmin && <TableHead>Status</TableHead>}
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow
                    key={b.id}
                    className={cn(
                      b.overlap && 'border-l-2 border-l-red-500',
                      isAdmin && b.status === 'pending' && 'bg-red-50/60',
                    )}
                  >
                    <TableCell className="whitespace-nowrap">
                      {fmtDate(b.checkinDate)}
                      {b.checkoutDate !== b.checkinDate && <div className="text-xs text-muted-foreground">→ {fmtDate(b.checkoutDate)}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{b.guest}</div>
                      {b.phone && <div className="text-xs text-muted-foreground">{b.phone}</div>}
                    </TableCell>
                    {isAdmin && <TableCell className="text-right">{fmtMoney(b.amount)}</TableCell>}
                    {isAdmin && <TableCell className="text-right text-emerald-600">{fmtMoney(b.collected)}</TableCell>}
                    {isAdmin && (
                      <TableCell className={cn('text-right', (b.due ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600')}>
                        {fmtMoney(b.due)}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs" style={{ background: `${PURPOSE_COLORS[b.purpose]}22`, color: PURPOSE_COLORS[b.purpose] }}>
                        {b.purpose}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-28 truncate text-sm">{b.pax || '—'}</TableCell>
                    {isAdmin && (
                      <TableCell><Badge variant="outline" className={STATUS_BADGE[b.status ?? 'pending']}>{b.status}</Badge></TableCell>
                    )}
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="size-7" title="Payments" onClick={() => setPayFor(b.id)}>
                            <Wallet className="size-4" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="size-7" title="Edit" onClick={() => { setEditing(b); setDialogOpen(true) }}>
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <ConfirmDelete
                            title={`Delete booking for ${b.guest}?`}
                            description="All payment records for this booking will also be deleted."
                            onConfirm={() => deleteBooking.mutate(b.id)}
                            trigger={<Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-600"><Trash2 className="size-4" /></Button>}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {bookings.map((b) => (
              <Card key={b.id} className={cn('py-3', b.overlap && 'border-l-2 border-l-red-500')}>
                <CardContent className="space-y-2 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{b.guest}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(b.checkinDate)}{b.checkoutDate !== b.checkinDate && ` → ${fmtDate(b.checkoutDate)}`}
                        {b.pax && ` · ${b.pax}`}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-xs" style={{ background: `${PURPOSE_COLORS[b.purpose]}22`, color: PURPOSE_COLORS[b.purpose] }}>
                      {b.purpose}
                    </span>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center justify-between text-sm">
                      <span>{fmtMoney(b.amount)} <span className="text-muted-foreground">bill</span></span>
                      <span className={cn((b.due ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600')}>
                        {fmtMoney(b.due)} <span className="text-muted-foreground">due</span>
                      </span>
                      <Badge variant="outline" className={STATUS_BADGE[b.status ?? 'pending']}>{b.status}</Badge>
                    </div>
                  )}
                  {(canEdit || isAdmin) && (
                    <div className="flex justify-end gap-1 border-t pt-2">
                      {isAdmin && <Button variant="outline" size="sm" onClick={() => setPayFor(b.id)}><Wallet className="size-3.5" /> Payments</Button>}
                      {canEdit && <Button variant="outline" size="sm" onClick={() => { setEditing(b); setDialogOpen(true) }}><Pencil className="size-3.5" /> Edit</Button>}
                      {isAdmin && (
                        <ConfirmDelete
                          title={`Delete booking for ${b.guest}?`}
                          onConfirm={() => deleteBooking.mutate(b.id)}
                          trigger={<Button variant="outline" size="sm" className="text-red-600"><Trash2 className="size-3.5" /></Button>}
                        />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <BookingDialog open={dialogOpen} onClose={() => setDialogOpen(false)} booking={editing} />
      {payBooking && <PaymentPanel booking={payBooking} onClose={() => setPayFor(null)} />}
    </div>
  )
}
