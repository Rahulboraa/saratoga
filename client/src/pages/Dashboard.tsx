import { useQuery } from '@tanstack/react-query'
import { CalendarDays, IndianRupee, Wallet, AlertCircle, CalendarClock, Layers, TriangleAlert, Download } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { todayYmd } from '@/lib/format'
import { RevenueChart, PLChart, CountChart, TrendChart, DonutChart } from '@/components/charts'
import { api, apiDownload } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtMoney, fmtLakh, fmtDate, fmtMonth, PURPOSE_COLORS, chartWindow } from '@/lib/format'
import StatCard from '@/components/StatCard'
import { PageHeader } from '@/components/PageHeader'
import MonthCalendar from '@/components/MonthCalendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardStats } from '@/types'

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-[15px]">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [exporting, setExporting] = useState(false)
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

  const series = chartWindow(data.monthlySeries ?? []).map((p) => ({ ...p, label: fmtMonth(p.month) }))
  const countSeries = chartWindow(data.bookingsPerMonth).map((p) => ({ ...p, label: fmtMonth(p.month) }))

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Bookings, collections and activity"
        actions={isAdmin && (
          <Button
            variant="outline"
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              try {
                await apiDownload('/export', `saratoga-export-${todayYmd()}.xlsx`)
                toast.success('Excel downloaded')
              } catch {
                toast.error('Export failed')
              } finally {
                setExporting(false)
              }
            }}
          >
            <Download className="size-5" /> {exporting ? 'Exporting…' : 'Download Excel'}
          </Button>
        )}
      />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
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

      {data.conflicts.length > 0 && (
        <Card className="mb-8 border-destructive/25 bg-destructive/5 py-4">
          <CardContent className="px-5">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-destructive">
              <TriangleAlert className="size-5" />
              {data.overlapCount} overlapping booking{data.overlapCount > 1 ? 's' : ''}
            </div>
            <div className="space-y-1">
              {data.conflicts.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-x-2 text-[13px]">
                  <span className="font-medium">{c.guest}</span>
                  <span className="text-muted-foreground">
                    {fmtDate(c.checkinDate)} {c.checkinTime} → {c.checkoutDate !== c.checkinDate ? `${fmtDate(c.checkoutDate)} ` : ''}{c.checkoutTime} · {c.purpose}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {data.purposeBreakdown.map((p) => {
          const color = PURPOSE_COLORS[p.purpose]
          return (
            <Card key={p.purpose} className="py-3">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]"
                    style={{ background: `color-mix(in oklch, ${color}, var(--background) 88%)` }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                  </span>
                  {p.purpose}
                </div>
                <div className="mt-1.5 text-[15px] font-semibold leading-tight">
                  {p.count} <span className="text-xs font-medium text-muted-foreground">events</span>
                </div>
                {p.booked !== undefined && (
                  <>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {fmtLakh(p.booked)} booked · {fmtLakh(p.collected ?? 0)} in
                    </div>
                    <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-muted">
                      <div
                        className="chart-bar-h h-full rounded-full"
                        style={{ width: `${p.booked > 0 ? Math.min(Math.round(((p.collected ?? 0) / p.booked) * 100), 100) : 0}%`, background: `color-mix(in oklch, ${color}, white 25%)` }}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {isAdmin && (
          <ChartCard title="Monthly revenue"><RevenueChart data={series} /></ChartCard>
        )}
        {isAdmin && (
          <ChartCard title="Monthly P&L"><PLChart data={series} /></ChartCard>
        )}
        <ChartCard title="Bookings per month"><CountChart data={countSeries} /></ChartCard>
        {isAdmin && (
          <ChartCard title="Payment trend"><TrendChart data={series} /></ChartCard>
        )}
        <MonthCalendar />
        <Card className="h-full">
          <CardHeader><CardTitle className="text-[15px]">Bookings by type</CardTitle></CardHeader>
          <CardContent className="flex h-full flex-col items-center justify-center gap-8 py-6 sm:flex-row">
            <div className="animate-fade-in shrink-0">
              <DonutChart
                data={data.purposeBreakdown.map((p) => ({ label: p.purpose, value: p.count, color: PURPOSE_COLORS[p.purpose] }))}
                size={210}
                thickness={22}
                centerLabel={String(data.totalBookings)}
                centerSubLabel="events"
              />
            </div>
            <div className="w-full max-w-[260px] space-y-3.5">
              {data.purposeBreakdown
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((p, i) => (
                  <div key={p.purpose}>
                    <div className="mb-1.5 flex items-center justify-between text-[12px]">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <span className="h-2 w-2 rounded-[3px]" style={{ background: PURPOSE_COLORS[p.purpose] }} />
                        {p.purpose}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        <span className="font-semibold text-foreground">{p.count}</span> · {Math.round((p.count / Math.max(data.totalBookings, 1)) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="chart-bar-h h-full rounded-full"
                        style={{
                          width: `${(p.count / Math.max(data.totalBookings, 1)) * 100}%`,
                          background: PURPOSE_COLORS[p.purpose],
                          animationDelay: `${i * 70}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
