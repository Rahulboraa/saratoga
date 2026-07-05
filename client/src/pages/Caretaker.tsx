import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { fmtDate, currentMonth, todayYmd, PURPOSE_COLORS } from '@/lib/format'
import type { CalendarBooking } from '@/types'
import { Sun, CalendarDays, ClipboardList, ArrowDown, ArrowUp, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import MonthCalendar from '@/components/MonthCalendar'
import VisitorLog from '@/components/VisitorLog'

function fmt12(hm?: string) {
  if (!hm) return ''
  const [h, m] = hm.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number)
  const nd = new Date(y, m - 1, d + n)
  return `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`
}

function prettyDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

function onDate(b: CalendarBooking, date: string) {
  return b.checkinDate <= date && date <= (b.checkoutDate || b.checkinDate)
}

function GuestCard({ b, date }: { b: CalendarBooking; date: string }) {
  const color = PURPOSE_COLORS[b.purpose] ?? PURPOSE_COLORS.Other
  const arriving = b.checkinDate === date
  const leaving = (b.checkoutDate || b.checkinDate) === date
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[17px] font-bold">{b.guest}</span>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: `color-mix(in oklch, ${color}, white 85%)`, color: `color-mix(in oklch, ${color}, black 40%)` }}
        >
          {b.purpose}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {arriving && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[14px] font-bold text-emerald-700">
            <ArrowDown className="size-5" /> In {fmt12(b.checkinTime)}
          </span>
        )}
        {leaving && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[14px] font-bold text-orange-700">
            <ArrowUp className="size-5" /> Out {fmt12(b.checkoutTime)}
          </span>
        )}
        {!arriving && !leaving && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[14px] font-bold text-blue-700">
            Staying
          </span>
        )}
        {b.pax && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-[13px] font-semibold text-foreground/70">
            <Users className="size-4" /> {/^\d+$/.test(b.pax.trim()) ? `${b.pax.trim()} guests` : b.pax}
          </span>
        )}
      </div>
    </div>
  )
}

function TodayView() {
  const today = todayYmd()
  const thisMonth = currentMonth()
  const nextMonth = addDays(`${thisMonth}-28`, 7).slice(0, 7)
  const q1 = useQuery({ queryKey: ['calendar', thisMonth], queryFn: () => api<CalendarBooking[]>(`/bookings/calendar?month=${thisMonth}`) })
  const q2 = useQuery({ queryKey: ['calendar', nextMonth], queryFn: () => api<CalendarBooking[]>(`/bookings/calendar?month=${nextMonth}`) })
  const all = [...(q1.data ?? []), ...(q2.data ?? [])]
  const bookings = [...new Map(all.map((b) => [b.id, b])).values()]

  const tomorrow = addDays(today, 1)
  const todayList = bookings.filter((b) => onDate(b, today))
  const tomorrowList = bookings.filter((b) => onDate(b, tomorrow))
  const upcoming = Array.from({ length: 5 }, (_, i) => addDays(today, i + 2))
    .map((date) => ({ date, list: bookings.filter((b) => b.checkinDate === date) }))
    .filter((d) => d.list.length > 0)

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 flex items-baseline gap-2 text-[19px] font-bold">
          Today <span className="text-[13px] font-medium text-muted-foreground">{prettyDate(today)}</span>
        </h2>
        {todayList.length === 0 ? (
          <Card className="py-6"><CardContent className="text-center text-[15px] font-medium text-muted-foreground">No bookings today</CardContent></Card>
        ) : (
          <div className="space-y-2.5">
            {todayList.map((b) => <GuestCard key={b.id} b={b} date={today} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 flex items-baseline gap-2 text-[17px] font-bold">
          Tomorrow <span className="text-[13px] font-medium text-muted-foreground">{prettyDate(tomorrow)}</span>
        </h2>
        {tomorrowList.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">No bookings tomorrow</p>
        ) : (
          <div className="space-y-2.5">
            {tomorrowList.map((b) => <GuestCard key={b.id} b={b} date={tomorrow} />)}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-[15px] font-bold text-foreground/80">Coming days</h2>
          <Card className="py-1">
            <CardContent className="divide-y px-4">
              {upcoming.map(({ date, list }) => (
                <div key={date} className="flex items-center gap-3 py-2.5">
                  <div className="w-24 shrink-0 text-[13px] font-semibold">{prettyDate(date).split(',')[1]?.trim() ?? fmtDate(date)}</div>
                  <div className="min-w-0 flex-1 text-[14px]">
                    {list.map((b) => b.guest).join(', ')}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}

export default function Caretaker() {
  const { user, logout } = useAuth()
  const [selected, setSelected] = useState<{ date: string; bookings: CalendarBooking[] } | null>(null)

  return (
    <div className="mx-auto min-h-screen max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <span className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="text-[17px] font-semibold tracking-tight">Saratoga Villa</span>
          </span>
          <div className="text-xs text-muted-foreground">Caretaker · {user?.name}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => logout()}>
          Log out
        </Button>
      </header>

      <Tabs defaultValue="today">
        <TabsList className="h-11 w-full">
          <TabsTrigger value="today" className="flex-1 text-[14px]"><Sun className="size-5" /> Today</TabsTrigger>
          <TabsTrigger value="calendar" className="flex-1 text-[14px]"><CalendarDays className="size-5" /> Calendar</TabsTrigger>
          <TabsTrigger value="visitors" className="flex-1 text-[14px]"><ClipboardList className="size-5" /> Visitors</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4">
          <TodayView />
        </TabsContent>
        <TabsContent value="calendar" className="mt-4 space-y-3">
          <MonthCalendar onSelectDate={(date, bookings) => setSelected({ date, bookings })} />
          {selected && (
            <Card className="py-3">
              <CardContent className="px-4">
                <div className="mb-2 text-sm font-semibold">{fmtDate(selected.date)}</div>
                {selected.bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookings this day</p>
                ) : (
                  <div className="space-y-2.5">
                    {selected.bookings.map((b) => <GuestCard key={b.id} b={b} date={selected.date} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="visitors" className="mt-4">
          <VisitorLog embedded />
        </TabsContent>
      </Tabs>
    </div>
  )
}
