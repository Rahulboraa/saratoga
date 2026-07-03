import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ComposedChart, Line, CartesianGrid,
} from 'recharts'
import { CalendarDays, IndianRupee, Wallet, AlertCircle, CalendarClock, Layers } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtMoney, fmtLakh, fmtDate, fmtMonth, PURPOSE_COLORS, STATUS_VARIANT } from '@/lib/format'
import StatCard from '@/components/StatCard'
import { PageHeader } from '@/components/PageHeader'
import MonthCalendar from '@/components/MonthCalendar'
import EmptyState from '@/components/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { DashboardStats } from '@/types'

const tooltipStyle = { background: '#fff', border: '1px solid hsl(240 6% 90%)', borderRadius: 8, fontSize: 12, color: 'hsl(240 8% 12%)' }

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-64">{children}</CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => api<DashboardStats>('/stats/dashboard'),
  })

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    )
  }

  const series = (data.monthlySeries ?? []).map((p) => ({ ...p, label: fmtMonth(p.month) }))
  const countSeries = data.bookingsPerMonth.map((p) => ({ ...p, label: fmtMonth(p.month) }))

  return (
    <div>
      <PageHeader title="Dashboard" description="Bookings, collections and activity at a glance" />
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {isAdmin ? (
          <>
            <StatCard icon={IndianRupee} tint="info" label="Total Booked" value={fmtMoney(data.totalBooked)} hint={`${data.totalBookings} bookings`} />
            <StatCard
              icon={Wallet}
              tint="success"
              label="Collected"
              value={fmtMoney(data.totalCollected)}
              hint={data.totalBooked ? `${Math.round(((data.totalCollected ?? 0) / data.totalBooked) * 100)}% of booked` : '—'}
            />
            <StatCard icon={AlertCircle} tint="destructive" label="Outstanding" value={fmtMoney(data.outstanding)} hint={`${data.upcomingUnpaid} upcoming unpaid`} />
            <StatCard icon={Layers} tint="purple" label="Total Events" value={data.totalBookings} hint={`${data.uniqueDates} unique dates`} />
            <StatCard
              icon={CalendarClock}
              tint="warning"
              label="Upcoming"
              value={data.upcomingCount}
              hint={data.overlapCount ? <span className="font-medium text-destructive">{data.overlapCount} overlaps</span> : 'no overlaps'}
            />
          </>
        ) : (
          <>
            <StatCard icon={Layers} tint="purple" label="Total Events" value={data.totalBookings} hint={`${data.uniqueDates} unique dates`} />
            <StatCard icon={CalendarClock} tint="info" label="Upcoming" value={data.upcomingCount} />
            <StatCard icon={CalendarDays} tint="success" label="This Month" value={countSeries.at(-1)?.count ?? 0} hint="bookings" />
            <StatCard
              icon={AlertCircle}
              tint={data.overlapCount ? 'destructive' : 'foreground'}
              label="Overlaps"
              value={data.overlapCount}
              hint={data.overlapCount ? <span className="font-medium text-destructive">needs attention</span> : 'all clear'}
            />
            <StatCard icon={Layers} label="Event Types" value={data.purposeBreakdown.length} />
          </>
        )}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {data.purposeBreakdown.map((p) => (
          <Card key={p.purpose} className="py-3">
            <CardContent className="px-4">
              <div className="flex items-center gap-1.5 text-[13px] font-medium">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: PURPOSE_COLORS[p.purpose] }} />
                {p.purpose}
              </div>
              <div className="text-xs text-muted-foreground">{p.count} events</div>
              {p.booked !== undefined && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {fmtLakh(p.booked)} booked · {fmtLakh(p.collected ?? 0)} in
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {isAdmin && (
          <ChartCard title="Monthly Revenue — Booked vs Collected">
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtLakh} tick={{ fontSize: 11 }} width={52} />
                <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="booked" name="Booked" fill="#B5D4F4" radius={[3, 3, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="#3266ad" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        {isAdmin && (
          <ChartCard title="Monthly P&L">
            <ResponsiveContainer>
              <ComposedChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtLakh} tick={{ fontSize: 11 }} width={52} />
                <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="collected" name="Revenue" fill="#3266ad" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#E8877A" radius={[3, 3, 0, 0]} />
                <Line dataKey="profit" name="Profit" stroke="#1D9E75" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <ChartCard title="Bookings Per Month">
          <ResponsiveContainer>
            <BarChart data={countSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Bookings" fill="#7B6EF6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        {isAdmin && (
          <ChartCard title="Payment Trend — Collected vs Pending">
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtLakh} tick={{ fontSize: 11 }} width={52} />
                <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="collected" name="Collected" stackId="a" fill="#3266ad" />
                <Bar dataKey="pending" name="Pending" stackId="a" fill="#F7C1C1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <MonthCalendar />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Upcoming Bookings</CardTitle></CardHeader>
        <CardContent>
          {data.upcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} message="No upcoming bookings" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Pax</TableHead>
                    {isAdmin && <TableHead className="text-right">Amount</TableHead>}
                    {isAdmin && <TableHead>Status</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.upcoming.map((b) => (
                    <TableRow key={b.id} className={cn(b.overlap && 'border-l-2 border-l-red-500')}>
                      <TableCell className="whitespace-nowrap">{fmtDate(b.checkinDate)}</TableCell>
                      <TableCell className="font-medium">{b.guest}</TableCell>
                      <TableCell>
                        <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: `${PURPOSE_COLORS[b.purpose]}22`, color: PURPOSE_COLORS[b.purpose] }}>
                          {b.purpose}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-32 truncate">{b.pax || '—'}</TableCell>
                      {isAdmin && <TableCell className="text-right">{fmtMoney(b.amount)}</TableCell>}
                      {isAdmin && (
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[b.status ?? 'pending']} withDot>{b.status}</Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
