import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { currentMonth, todayYmd, PURPOSE_COLORS } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CalendarBooking } from '@/types'

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthCalendar({ onSelectDate }: { onSelectDate?: (date: string, bookings: CalendarBooking[]) => void }) {
  const [month, setMonth] = useState(currentMonth())
  const { data: bookings = [] } = useQuery({
    queryKey: ['calendar', month],
    queryFn: () => api<CalendarBooking[]>(`/bookings/calendar?month=${month}`),
  })

  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const daysInMonth = new Date(y, m, 0).getDate()
  const today = todayYmd()
  const label = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const byDate = new Map<string, CalendarBooking[]>()
  for (const b of bookings) {
    let d = b.checkinDate
    while (d <= (b.checkoutDate || b.checkinDate)) {
      if (d.startsWith(month)) {
        if (!byDate.has(d)) byDate.set(d, [])
        byDate.get(d)!.push(b)
      }
      const [dy, dm, dd] = d.split('-').map(Number)
      const next = new Date(dy, dm - 1, dd + 1)
      d = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
    }
  }
  const eventCount = new Set(bookings.map((b) => b.id)).size

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-[15px]">{label}</CardTitle>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {eventCount > 0 ? `${eventCount} event${eventCount > 1 ? 's' : ''} this month` : 'No events this month'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            <ChevronLeft className="size-5" />
          </Button>
          <Button variant="outline" size="sm" className="h-7" onClick={() => setMonth(currentMonth())}>Today</Button>
          <Button variant="outline" size="icon-sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7">
          {DOW.map((d) => (
            <div key={d} className="pb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>
          ))}
          {Array.from({ length: first.getDay() }).map((_, i) => <div key={`sp${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, '0')}`
            const dayBookings = byDate.get(date) ?? []
            const hasOverlap = dayBookings.some((b) => b.overlap)
            const isToday = date === today
            const busy = dayBookings.length > 0
            return (
              <button
                key={date}
                type="button"
                onClick={() => onSelectDate?.(date, dayBookings)}
                title={dayBookings.map((b) => b.guest).join(', ') || undefined}
                className={cn(
                  'group relative flex h-11 flex-col items-center justify-center rounded-lg transition-colors md:h-12',
                  onSelectDate ? 'cursor-pointer hover:bg-accent' : busy && 'hover:bg-accent/60',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-[13px] transition-colors',
                    isToday && 'bg-primary font-semibold text-primary-foreground shadow-sm',
                    !isToday && hasOverlap && 'bg-destructive/10 font-semibold text-destructive',
                    !isToday && !hasOverlap && busy && 'bg-primary/10 font-semibold text-primary',
                    !isToday && !busy && 'text-foreground/80',
                  )}
                >
                  {i + 1}
                </span>
                <span className="absolute bottom-0.5 flex gap-0.5">
                  {dayBookings.slice(0, 3).map((b) => (
                    <span
                      key={b.id}
                      className="h-1 w-1 rounded-full"
                      style={{ background: PURPOSE_COLORS[b.purpose] ?? PURPOSE_COLORS.Other }}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="flex size-4 items-center justify-center rounded-full bg-primary/10">
              <span className="size-1.5 rounded-full bg-primary" />
            </span>
            Booked
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="flex size-4 items-center justify-center rounded-full bg-destructive/10">
              <span className="size-1.5 rounded-full bg-destructive" />
            </span>
            Overlap
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="flex size-4 items-center justify-center rounded-full bg-primary">
              <span className="size-1.5 rounded-full bg-white" />
            </span>
            Today
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
