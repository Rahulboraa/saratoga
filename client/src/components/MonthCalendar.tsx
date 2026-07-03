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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{label}</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-7" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-7" onClick={() => setMonth(currentMonth())}>Today</Button>
          <Button variant="outline" size="icon" className="size-7" onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {DOW.map((d) => (
            <div key={d} className="pb-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">{d}</div>
          ))}
          {Array.from({ length: first.getDay() }).map((_, i) => <div key={`sp${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, '0')}`
            const dayBookings = byDate.get(date) ?? []
            const hasOverlap = dayBookings.some((b) => b.overlap)
            return (
              <button
                key={date}
                onClick={() => onSelectDate?.(date, dayBookings)}
                className={cn(
                  'flex min-h-12 flex-col items-center rounded-md border border-transparent p-1 text-xs transition-colors md:min-h-16',
                  date === today && 'border-primary/50 font-bold',
                  dayBookings.length > 0 && !hasOverlap && 'bg-primary/10',
                  hasOverlap && 'bg-red-50 border-red-300',
                  onSelectDate && 'cursor-pointer hover:bg-accent',
                )}
              >
                <span>{i + 1}</span>
                <span className="mt-auto flex flex-wrap justify-center gap-0.5">
                  {dayBookings.slice(0, 3).map((b) => (
                    <span
                      key={b.id}
                      className="size-1.5 rounded-full"
                      style={{ background: PURPOSE_COLORS[b.purpose] ?? PURPOSE_COLORS.Other }}
                    />
                  ))}
                  {dayBookings.length > 3 && <span className="text-[9px] leading-none text-muted-foreground">+{dayBookings.length - 3}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
