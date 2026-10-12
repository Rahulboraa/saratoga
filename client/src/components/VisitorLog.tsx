import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Trash2, Users2, CornerDownRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtDate, nowHm } from '@/lib/format'
import { VISITOR_TYPES, type Visitor } from '@/types'

interface VisitorsResponse extends Paged<Visitor> {
  dates: string[]
}
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type Paged } from '@/components/DataTable'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import VisitorSheet from '@/components/VisitorSheet'
import { DateRangePicker, type DateRange } from '@/components/DatePicker'
import ExportButton from '@/components/ExportButton'
import ConfirmDelete from '@/components/ConfirmDelete'
import EmptyState from '@/components/EmptyState'
import { PageHeader, SectionHeader } from '@/components/PageHeader'

export default function VisitorLog({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [range, setRange] = useState<DateRange | null>(null)
  const [type, setType] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Visitor | null>(null)

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (q) params.set('q', q)
  if (range) { params.set('from', range.from); params.set('to', range.to) }
  if (type !== 'all') params.set('type', type)

  const { data, isLoading } = useQuery({
    queryKey: ['visitors', params.toString()],
    queryFn: () => api<VisitorsResponse>(`/visitors?${params}`),
    placeholderData: keepPreviousData,
  })

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

  const actions = (v: Visitor) => (
    <div className="flex justify-end gap-1">
      {!v.outTime && (
        <Button variant="outline" size="sm" onClick={() => markOut.mutate(v.id)}>Mark out</Button>
      )}
      <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(v); setDialogOpen(true) }}>
        <Pencil className="size-5" />
      </Button>
      {isAdmin && (
        <ConfirmDelete
          title={`Delete entry for ${v.name}?`}
          onConfirm={() => deleteVisitor.mutate(v.id)}
          trigger={<Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive"><Trash2 className="size-5" /></Button>}
        />
      )}
    </div>
  )

  // The follow-up note belongs with the remark: together they are the whole story of
  // the visit, and reading them is the reason to open this page at all.
  const remarkCell = (v: Visitor) => (
    !v.remarks && !v.fuRemark ? <span className="text-muted-foreground">—</span> : (
      <div className="max-w-72 space-y-0.5">
        {v.remarks && <div className="line-clamp-2" title={v.remarks}>{v.remarks}</div>}
        {v.fuRemark && (
          <div className="flex items-start gap-1 text-info" title={v.fuRemark}>
            <CornerDownRight className="mt-0.5 size-3.5 shrink-0" />
            <span className="line-clamp-2">{v.fuRemark}</span>
          </div>
        )}
      </div>
    )
  )

  const columns: ColumnDef<Visitor>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: ({ row: { original: v } }) => <span className="whitespace-nowrap">{fmtDate(v.date)}</span>,
    },
    {
      id: 'visitor',
      header: 'Visitor',
      cell: ({ row: { original: v } }) => (
        <div>
          <div className="font-medium">{v.name}</div>
          {v.phone && <div className="text-[11px] text-muted-foreground">{v.phone}</div>}
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row: { original: v } }) => (
        <div className="flex flex-wrap items-center gap-1">
          {v.type && <Badge variant="outline">{v.type}</Badge>}
          {v.fuStatus && <Badge variant="info" withDot>{v.fuStatus}</Badge>}
        </div>
      ),
    },
    {
      id: 'purpose',
      header: 'Purpose',
      cell: ({ row: { original: v } }) =>
        v.purpose
          ? <span className="block max-w-48 truncate" title={v.purpose}>{v.purpose}</span>
          : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'inout',
      header: 'In / Out',
      cell: ({ row: { original: v } }) => (
        <span className="whitespace-nowrap tabular-nums">
          {v.inTime || '—'} <span className="text-muted-foreground">→</span>{' '}
          {v.outTime || <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    { id: 'remarks', header: 'Remarks', cell: ({ row: { original: v } }) => remarkCell(v) },
    {
      id: 'by',
      header: 'Logged by',
      cell: ({ row: { original: v } }) =>
        v.loggedBy || <span className="text-muted-foreground">—</span>,
    },
    { id: 'actions', header: 'Action', meta: { headClass: 'text-right' }, cell: ({ row: { original: v } }) => actions(v) },
  ]

  return (
    <div>
      {embedded ? (
        <SectionHeader
          title="Visitor Log"
          actions={<Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>Log visitor</Button>}
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
                if (range) { p.set('from', range.from); p.set('to', range.to) }
                return <ExportButton path="/export/visitors" name="visitors" params={p} />
              })()}
              <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>Log visitor</Button>
            </>
          }
        />
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        <Input placeholder="Search name, phone, purpose…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="h-10 w-full sm:w-64" />
        <DateRangePicker
          value={range}
          onChange={(r) => { setRange(r); setPage(1) }}
          className="h-10 w-[calc(50%-6px)] sm:w-64"
        />
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1) }}>
          <SelectTrigger className="h-10 w-[calc(50%-6px)] sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {VISITOR_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.rows}
        total={data?.total ?? 0}
        page={data?.page ?? page}
        limit={data?.limit ?? limit}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1) }}
        isLoading={isLoading}
        empty={<EmptyState icon={Users2} message="No visitor records yet" />}
        renderCard={(v) => (
          <Card className="py-3">
            <CardContent className="space-y-2 px-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold">{v.name}</span>
                <span className="text-[12px] text-muted-foreground">{v.phone}</span>
                {v.type && <Badge variant="outline">{v.type}</Badge>}
                {v.fuStatus && <Badge variant="info" withDot>{v.fuStatus}</Badge>}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {fmtDate(v.date)}
                {v.purpose && <span> · {v.purpose}</span>}
                <span> · In {v.inTime || '—'} · Out {v.outTime || '—'}</span>
                {v.loggedBy && <span> · by {v.loggedBy}</span>}
              </div>
              {(v.remarks || v.fuRemark) && <div className="text-[13px]">{remarkCell(v)}</div>}
              {actions(v)}
            </CardContent>
          </Card>
        )}
      />

      <VisitorSheet open={dialogOpen} onClose={() => setDialogOpen(false)} visitor={editing} />
    </div>
  )
}
