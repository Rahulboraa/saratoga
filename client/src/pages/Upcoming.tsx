import { useQuery } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtMoney, fmtDate, PURPOSE_COLORS, STATUS_VARIANT } from '@/lib/format'
import type { Booking } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { cn } from '@/lib/utils'

export default function Upcoming() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', 'upcoming'],
    queryFn: () => api<Booking[]>('/bookings/upcoming'),
  })

  const purposePill = (b: Booking) => (
    <span className="whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: `${PURPOSE_COLORS[b.purpose]}1c`, color: PURPOSE_COLORS[b.purpose] }}>
      {b.purpose}
    </span>
  )

  return (
    <div>
      <PageHeader title="Upcoming" description="Next events at the villa, soonest first" />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : !bookings?.length ? (
        <EmptyState icon={CalendarClock} message="No upcoming bookings" description="New bookings will show up here." />
      ) : (
        <>
          <div className="scrollbar-thin hidden overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-14">S.No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Times</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Pax</TableHead>
                  {isAdmin && <TableHead className="text-right">Amount</TableHead>}
                  {isAdmin && <TableHead className="text-right">Due</TableHead>}
                  {isAdmin && <TableHead>Status</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b, i) => (
                  <TableRow key={b.id} className={cn(b.overlap && 'border-l-2 border-l-destructive')}>
                    <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {fmtDate(b.checkinDate)}
                      {b.checkoutDate !== b.checkinDate && <div className="text-[11px] font-normal text-muted-foreground">→ {fmtDate(b.checkoutDate)}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{b.guest}</div>
                      {b.phone && <div className="text-[11px] text-muted-foreground">{b.phone}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{b.checkinTime} → {b.checkoutTime}</TableCell>
                    <TableCell>{purposePill(b)}</TableCell>
                    <TableCell className="max-w-28 truncate">{b.pax || '—'}</TableCell>
                    {isAdmin && <TableCell className="text-right tabular-nums">{fmtMoney(b.amount)}</TableCell>}
                    {isAdmin && (
                      <TableCell className={cn('text-right tabular-nums', (b.due ?? 0) > 0 ? 'text-destructive' : 'text-success')}>
                        {fmtMoney(b.due)}
                      </TableCell>
                    )}
                    {isAdmin && <TableCell><Badge variant={STATUS_VARIANT[b.status ?? 'pending']} withDot>{b.status}</Badge></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 md:hidden">
            {bookings.map((b) => (
              <Card key={b.id} className={cn('py-3', b.overlap && 'border-l-2 border-l-destructive')}>
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
            ))}
          </div>
        </>
      )}
    </div>
  )
}
