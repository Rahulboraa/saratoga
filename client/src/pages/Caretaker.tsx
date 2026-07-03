import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { fmtDate } from '@/lib/format'
import type { CalendarBooking } from '@/types'
import { CalendarDays, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import MonthCalendar from '@/components/MonthCalendar'
import VisitorLog from '@/components/VisitorLog'

export default function Caretaker() {
  const { user, logout } = useAuth()
  const [selected, setSelected] = useState<{ date: string; bookings: CalendarBooking[] } | null>(null)

  return (
    <div className="mx-auto min-h-screen max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <span className="text-lg font-bold tracking-tight">Saratoga <span className="text-[#2563eb]">Villa</span></span>
          <div className="text-xs text-muted-foreground">Caretaker · {user?.name}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => logout()}>
          Log out
        </Button>
      </header>

      <Tabs defaultValue="bookings">
        <TabsList className="w-full">
          <TabsTrigger value="bookings" className="flex-1"><CalendarDays className="size-5" /> Bookings</TabsTrigger>
          <TabsTrigger value="visitors" className="flex-1"><ClipboardList className="size-5" /> Visitor Log</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings" className="mt-4 space-y-3">
          <MonthCalendar onSelectDate={(date, bookings) => setSelected({ date, bookings })} />
          {selected && (
            <Card className="py-3">
              <CardContent className="px-4">
                <div className="mb-2 text-sm font-semibold">{fmtDate(selected.date)}</div>
                {selected.bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookings this day.</p>
                ) : (
                  <div className="space-y-2">
                    {selected.bookings.map((b) => (
                      <div key={b.id} className="rounded-lg border p-2 text-sm">
                        <div className="font-medium">{b.guest}</div>
                        <div className="text-muted-foreground">
                          {b.purpose} · In {b.checkinTime} · Out {b.checkoutTime}
                          {b.pax && ` · ${b.pax}`}
                        </div>
                      </div>
                    ))}
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
