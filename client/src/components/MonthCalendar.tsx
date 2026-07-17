import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ArrowDown, ArrowUp, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { currentMonth, todayYmd, fmtDate, PURPOSE_COLORS } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { CalendarBooking } from '@/types'

function fmt12(hm?: string) {
  if (!hm) return ''
  const [h, m] = hm.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export function DayBookingCard({ b, date, onOpen }: { b: CalendarBooking; date: string; onOpen?: () => void }) {
  const color = PURPOSE_COLORS[b.purpose] ?? PURPOSE_COLORS.Other
  const arriving = b.checkinDate === date
  const leaving = (b.checkoutDate || b.checkinDate) === date
  const multiDay = b.checkoutDate && b.checkoutDate !== b.checkinDate
  return (
    <div
      className={cn('rounded-xl border border-border/70 bg-card p-3.5 shadow-sm', onOpen && 'cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/40')}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[16px] font-bold">{b.guest}</span>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: `color-mix(in oklch, ${color}, var(--background) 85%)`, color: `color-mix(in oklch, ${color}, var(--foreground) 40%)` }}
        >
          {b.purpose}
        </span>
      </div>
      {multiDay && (
        <div className="mt-1 text-[12px] text-muted-foreground">
          {fmtDate(b.checkinDate)} → {fmtDate(b.checkoutDate)}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {arriving && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[13px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <ArrowDown className="size-4" /> In {fmt12(b.checkinTime)}
          </span>
        )}
        {leaving && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[13px] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
            <ArrowUp className="size-4" /> Out {fmt12(b.checkoutTime)}
          </span>
        )}
        {!arriving && !leaving && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[13px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            Staying
          </span>
        )}
        {b.pax && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-[12px] font-semibold text-foreground/70">
            <Users className="size-4" /> {/^\d+$/.test(b.pax.trim()) ? `${b.pax.trim()} guests` : b.pax}
          </span>
        )}
      </div>
    </div>
  )
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtTime(hm: string | undefined) {
  if (!hm) return ''
  const [h, m] = hm.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`
}

export default function MonthCalendar({ onSelectDate }: { onSelectDate?: (date: string, bookings: CalendarBooking[]) => void }) {
  const [month, setMonth] = useState(currentMonth())
  const [selected, setSelected] = useState<string | null>(null)
  const { user } = useAuth()
  const navigate = useNavigate()
  const canOpen = user?.role === 'admin' || user?.role === 'manager'
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
  const leading = first.getDay()
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7

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
        <div className="overflow-hidden rounded-lg border border-border/70">
          <div className="grid grid-cols-7 border-b border-border/70 bg-muted/40">
            {DOW.map((d) => (
              <div key={d} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }).map((_, i) => {
              const dayNum = i - leading + 1
              if (dayNum < 1 || dayNum > daysInMonth) {
                return <div key={`sp${i}`} className={cn('min-h-20 bg-muted/20 md:min-h-24', i % 7 !== 0 && 'border-l border-border/50', i >= 7 && 'border-t border-border/50')} />
              }
              const date = `${month}-${String(dayNum).padStart(2, '0')}`
              const dayBookings = byDate.get(date) ?? []
              const hasOverlap = dayBookings.some((b) => b.overlap)
              const isToday = date === today
              // Split-day view: which half of the day is occupied.
              // checkout = morning busy (top half) → afternoon free; checkin = evening busy (bottom half) → morning free.
              const full = dayBookings.filter((b) => date > b.checkinDate && date < (b.checkoutDate || b.checkinDate))
              const checkin = dayBookings.filter((b) => date === b.checkinDate)
              const checkout = dayBookings.filter((b) => date === (b.checkoutDate || b.checkinDate) && date !== b.checkinDate)
              const col = (b?: CalendarBooking) => (b ? (PURPOSE_COLORS[b.purpose] ?? PURPOSE_COLORS.Other) : '#888')
              const tint = (c: string) => `color-mix(in oklch, ${c}, var(--background) 82%)`
              const first = (b: CalendarBooking) => b.guest.split(' ')[0]
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => { setSelected(date); onSelectDate?.(date, dayBookings) }}
                  className={cn(
                    'relative flex min-h-[64px] flex-col overflow-hidden p-1 text-left align-top transition-colors md:min-h-24',
                    i % 7 !== 0 && 'border-l border-border/50',
                    i >= 7 && 'border-t border-border/50',
                    'cursor-pointer hover:bg-accent/40',
                    isToday && 'ring-1 ring-inset ring-primary/60',
                  )}
                >
                  {full.length > 0 && (
                    <span className="pointer-events-none absolute inset-0" style={{ background: tint(col(full[0])) }} />
                  )}
                  {checkout.length > 0 && (
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 border-b border-dashed" style={{ background: tint(col(checkout[0])), borderColor: col(checkout[0]) }} />
                  )}
                  {checkin.length > 0 && (
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 border-t border-dashed" style={{ background: tint(col(checkin[0])), borderColor: col(checkin[0]) }} />
                  )}

                  <span className="relative z-10 flex items-center justify-between">
                    <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold', isToday ? 'bg-primary text-primary-foreground' : 'text-foreground/70')}>
                      {dayNum}
                    </span>
                    {hasOverlap && <span className="h-1.5 w-1.5 rounded-full bg-destructive" title="Overlapping bookings" />}
                  </span>

                  <span className="relative z-10 mt-0.5 flex flex-1 flex-col">
                    {checkout.length > 0 && (
                      <span className="truncate text-[9.5px] font-bold leading-tight" style={{ color: col(checkout[0]) }}>
                        ↑ Out {fmtTime(checkout[0].checkoutTime)}{checkout.length > 1 ? ` +${checkout.length - 1}` : ''}
                      </span>
                    )}
                    <span className="mt-auto flex flex-col gap-0.5">
                      {full.slice(0, 1).map((b) => (
                        <span key={b.id} className="flex items-center gap-1 truncate text-[9.5px] font-semibold leading-tight" style={{ color: col(b) }}>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: col(b) }} />
                          <span className="truncate">{first(b)}{full.length > 1 ? ` +${full.length - 1}` : ''}</span>
                        </span>
                      ))}
                      {checkin.length > 0 && (
                        <>
                          <span className="truncate text-[9.5px] font-bold leading-tight" style={{ color: col(checkin[0]) }}>
                            ↓ In {fmtTime(checkin[0].checkinTime)}
                          </span>
                          <span className="truncate text-[9px] leading-tight text-muted-foreground">
                            {first(checkin[0])}{checkin.length > 1 ? ` +${checkin.length - 1}` : ''}
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1">
          {Object.entries(PURPOSE_COLORS).map(([purpose, color]) => (
            <span key={purpose} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
              {purpose}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-3.5 w-4 rounded-[3px] border border-border" style={{ background: 'linear-gradient(to bottom, color-mix(in oklch, var(--foreground), transparent 78%) 50%, transparent 50%)' }} />
            Checkout (morning)
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-3.5 w-4 rounded-[3px] border border-border" style={{ background: 'linear-gradient(to top, color-mix(in oklch, var(--foreground), transparent 78%) 50%, transparent 50%)' }} />
            Check-in (evening)
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            Overlap
          </span>
        </div>
      </CardContent>
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" size="sm" className="flex w-full flex-col gap-0 p-0">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle>{selected ? fmtDate(selected) : ''}</SheetTitle>
            <SheetDescription>
              {selected
                ? `${(byDate.get(selected) ?? []).length || 'No'} booking${(byDate.get(selected) ?? []).length === 1 ? '' : 's'} this day`
                : ''}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
            {selected && (byDate.get(selected) ?? []).map((b) => (
              <DayBookingCard key={b.id} b={b} date={selected} onOpen={canOpen ? () => navigate(`/bookings?focus=${b.id}`) : undefined} />
            ))}
            {selected && (byDate.get(selected) ?? []).length === 0 && (
              <p className="pt-4 text-center text-sm text-muted-foreground">No bookings this day</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  )
}
