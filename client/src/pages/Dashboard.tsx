import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ComposedChart, Line, CartesianGrid,
} from 'recharts'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtMoney, fmtLakh, fmtDate, fmtMonth, PURPOSE_COLORS, STATUS_BADGE } from '@/lib/format'
import StatCard from '@/components/StatCard'
import MonthCalendar from '@/components/MonthCalendar'
import EmptyState from '@/components/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { DashboardStats } from '@/types'

const tooltipStyle = { background: 'oklch(0.195 0.015 75)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 }

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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {isAdmin ? (
          <>
            <StatCard label="Total Booked" value={fmtMoney(data.totalBooked)} sub={`${data.totalBookings} bookings`} />
            <StatCard
              label="Collected"
              value={fmtMoney(data.totalCollected)}
              sub={data.totalBooked ? `${Math.round(((data.totalCollected ?? 0) / data.totalBooked) * 100)}% of booked` : '—'}
            />
            <StatCard label="Outstanding" value={fmtMoney(data.outstanding)} sub={`${data.upcomingUnpaid} upcoming unpaid`} />
            <StatCard label="Total Events" value={data.totalBookings} sub={`${data.uniqueDates} unique dates`} />
            <StatCard
              label="Upcoming"
              value={data.upcomingCount}
              sub={data.overlapCount ? <span className="text-red-400">⚠️ {data.overlapCount} overlaps</span> : 'no overlaps'}
            />
          </>
        ) : (
          <>
            <StatCard label="Total Events" value={data.totalBookings} sub={`${data.uniqueDates} unique dates`} />
            <StatCard label="Upcoming" value={data.upcomingCount} />
            <StatCard label="This Month" value={countSeries.at(-1)?.count ?? 0} sub="bookings" />
            <StatCard
              label="Overlaps"
              value={data.overlapCount}
              sub={data.overlapCount ? <span className="text-red-400">needs attention</span> : 'all clear'}
            />
            <StatCard label="Event Types" value={data.purposeBreakdown.length} />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {data.purposeBreakdown.map((p) => (
          <Card key={p.purpose} className="border-l-4 py-3" style={{ borderLeftColor: PURPOSE_COLORS[p.purpose] }}>
            <CardContent className="px-4">
              <div className="text-sm font-semibold">{p.purpose}</div>
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

      <div className="grid gap-4 lg:grid-cols-2">
        {isAdmin && (
          <ChartCard title="Monthly Revenue — Booked vs Collected">
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
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
            <EmptyState icon="📅" message="No upcoming bookings" />
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
                          <Badge variant="outline" className={STATUS_BADGE[b.status ?? 'pending']}>{b.status}</Badge>
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
