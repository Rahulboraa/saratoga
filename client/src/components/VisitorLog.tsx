import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, LogOut, Users2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtDate, nowHm } from '@/lib/format'
import type { Visitor } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import VisitorDialog from '@/components/VisitorDialog'
import ConfirmDelete from '@/components/ConfirmDelete'
import EmptyState from '@/components/EmptyState'
import { PageHeader, SectionHeader } from '@/components/PageHeader'

export default function VisitorLog({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [date, setDate] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Visitor | null>(null)

  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (date !== 'all') params.set('date', date)

  const { data: visitors, isLoading } = useQuery({
    queryKey: ['visitors', params.toString()],
    queryFn: () => api<Visitor[]>(`/visitors?${params}`),
  })

  const { data: allVisitors } = useQuery({
    queryKey: ['visitors', ''],
    queryFn: () => api<Visitor[]>('/visitors'),
  })

  const dates = useMemo(() => [...new Set((allVisitors ?? []).map((v) => v.date))].sort().reverse(), [allVisitors])

  const grouped = useMemo(() => {
    const map = new Map<string, Visitor[]>()
    for (const v of visitors ?? []) {
      if (!map.has(v.date)) map.set(v.date, [])
      map.get(v.date)!.push(v)
    }
    return [...map.entries()]
  }, [visitors])

  const markOut = useMutation({
    mutationFn: (id: string) => api(`/visitors/${id}`, { method: 'PATCH', body: { outTime: nowHm() } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] })
      toast.success('Checkout marked')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const deleteVisitor = useMutation({
    mutationFn: (id: string) => api(`/visitors/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] })
      toast.success('Entry deleted')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  return (
    <div>
      {embedded ? (
        <SectionHeader
          title="Visitor Log"
          actions={<Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>+ Log visitor</Button>}
        />
      ) : (
        <PageHeader
          title="Visitors"
          description="Arrivals, departures and follow-ups"
          actions={<Button onClick={() => { setEditing(null); setDialogOpen(true) }}>+ Log visitor</Button>}
        />
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Search name, phone, purpose…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-64" />
        <Select value={date} onValueChange={setDate}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dates</SelectItem>
            {dates.map((d) => <SelectItem key={d} value={d}>{fmtDate(d)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : grouped.length === 0 ? (
        <EmptyState icon={Users2} message="No visitor records yet" />
      ) : (
        grouped.map(([groupDate, entries]) => (
          <div key={groupDate} className="mb-5 space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{fmtDate(groupDate)}</div>
            {entries.map((v) => (
              <Card key={v.id} className="py-3">
                <CardContent className="px-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{v.name}</span>
                        <span className="text-sm text-muted-foreground">{v.phone}</span>
                        {v.fuStatus && <Badge variant="info" withDot>{v.fuStatus}</Badge>}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {v.purpose && <span>{v.purpose} · </span>}
                        In {v.inTime || '—'} · Out {v.outTime || '—'}
                        {v.loggedBy && <span> · by {v.loggedBy}</span>}
                      </div>
                      {v.remarks && <div className="mt-1 text-sm">{v.remarks}</div>}
                      {v.fuRemark && <div className="mt-1 text-sm text-sky-700">↪ {v.fuRemark}</div>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!v.outTime && (
                        <Button variant="outline" size="sm" onClick={() => markOut.mutate(v.id)}>
                          <LogOut className="size-3.5" /> Mark out
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(v); setDialogOpen(true) }}>
                        <Pencil className="size-4" />
                      </Button>
                      {isAdmin && (
                        <ConfirmDelete
                          title={`Delete entry for ${v.name}?`}
                          onConfirm={() => deleteVisitor.mutate(v.id)}
                          trigger={<Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-red-600"><Trash2 className="size-4" /></Button>}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}

      <VisitorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} visitor={editing} />
    </div>
  )
}
