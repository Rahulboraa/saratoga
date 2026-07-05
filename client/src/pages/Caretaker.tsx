import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { fmtDate, currentMonth, todayYmd } from '@/lib/format'
import type { CalendarBooking } from '@/types'
import { Sun, CalendarDays, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import MonthCalendar, { DayBookingCard } from '@/components/MonthCalendar'
import VisitorLog from '@/components/VisitorLog'

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
            {todayList.map((b) => <DayBookingCard key={b.id} b={b} date={today} />)}
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
            {tomorrowList.map((b) => <DayBookingCard key={b.id} b={b} date={tomorrow} />)}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-[15px] font-bold text-foreground/80">Upcoming</h2>
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
        <TabsContent value="calendar" className="mt-4">
          <MonthCalendar />
        </TabsContent>
        <TabsContent value="visitors" className="mt-4">
          <VisitorLog embedded />
        </TabsContent>
      </Tabs>
    </div>
  )
}
