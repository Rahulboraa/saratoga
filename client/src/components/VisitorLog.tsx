import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Pencil, Trash2, Users2, ChevronLeft, ChevronRight, CornerDownRight } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtDate, nowHm } from '@/lib/format'
import type { Visitor } from '@/types'

interface VisitorsResponse {
  rows: Visitor[]
  total: number
  page: number
  limit: number
  dates: string[]
}
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import VisitorSheet from '@/components/VisitorSheet'
import ExportButton from '@/components/ExportButton'
import ConfirmDelete from '@/components/ConfirmDelete'
import EmptyState from '@/components/EmptyState'
import { PageHeader, SectionHeader } from '@/components/PageHeader'

export default function VisitorLog({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [date, setDate] = useState('all')
  const [type, setType] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Visitor | null>(null)

  const [page, setPage] = useState(1)
  const limit = 20

  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (q) params.set('q', q)
  if (date !== 'all') params.set('date', date)
  if (type !== 'all') params.set('type', type)

  const { data, isLoading } = useQuery({
    queryKey: ['visitors', params.toString()],
    queryFn: () => api<VisitorsResponse>(`/visitors?${params}`),
    placeholderData: keepPreviousData,
  })

  const dates = data?.dates ?? []
  const pageCount = Math.max(Math.ceil((data?.total ?? 0) / limit), 1)

  const grouped = useMemo(() => {
    const map = new Map<string, Visitor[]>()
    for (const v of data?.rows ?? []) {
      if (!map.has(v.date)) map.set(v.date, [])
      map.get(v.date)!.push(v)
    }
    return [...map.entries()]
  }, [data])

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
          actions={
            <>
              {(user?.role === 'admin' || user?.role === 'manager') && (() => {
                const p = new URLSearchParams()
                if (q) p.set('q', q)
                if (date !== 'all') p.set('date', date)
                return <ExportButton path="/export/visitors" name="visitors" params={p} />
              })()}
              <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>+ Log visitor</Button>
            </>
          }
        />
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Search name, phone, purpose…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="w-full sm:w-64" />
        <Select value={date} onValueChange={(v) => { setDate(v); setPage(1) }}>
          <SelectTrigger className="w-[calc(50%-4px)] sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dates</SelectItem>
            {dates.map((d) => <SelectItem key={d} value={d}>{fmtDate(d)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1) }}>
          <SelectTrigger className="w-[calc(50%-4px)] sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {['Guest', 'Vendor', 'Delivery', 'Staff', 'Other'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                      {v.fuRemark && <div className="mt-1 flex items-center gap-1 text-sm text-info"><CornerDownRight className="size-3.5" /> {v.fuRemark}</div>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!v.outTime && (
                        <Button variant="outline" size="sm" onClick={() => markOut.mutate(v.id)}>
                          Mark out
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(v); setDialogOpen(true) }}>
                        <Pencil className="size-4" />
                      </Button>
                      {isAdmin && (
                        <ConfirmDelete
                          title={`Delete entry for ${v.name}?`}
                          onConfirm={() => deleteVisitor.mutate(v.id)}
                          trigger={<Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></Button>}
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

      {(data?.total ?? 0) > limit && (
        <div className="flex items-center justify-between">
          <div className="text-[13px] text-muted-foreground">
            Page <span className="font-medium text-foreground">{page}</span> of {pageCount} · {data?.total} entries
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <VisitorSheet open={dialogOpen} onClose={() => setDialogOpen(false)} visitor={editing} />
    </div>
  )
}
