import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Pencil, Trash2, CheckCircle2, PhoneCall, CalendarClock, AlertCircle, UserX, Lock, TriangleAlert, CircleAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtDate, todayYmd } from '@/lib/format'
import { EVENT_TYPES, OUTCOMES, LEAD_FLAGS, type Lead, type ExecReportRow } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import StatCard from '@/components/StatCard'
import LeadSheet from '@/components/LeadSheet'
import ConfirmDelete from '@/components/ConfirmDelete'
import EmptyState from '@/components/EmptyState'
import { DataTable, type Paged } from '@/components/DataTable'
import ExportButton from '@/components/ExportButton'
import { PageHeader } from '@/components/PageHeader'

const OUTCOME_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'purple'> = {
  'Interested': 'success',
  'Not Interested': 'destructive',
  'Callback': 'warning',
  'Converted': 'purple',
}

interface LeadSummary {
  total: number
  converted: number
  callbacks: number
  overdue: number
  unassigned: number
}

interface UnassignedLead {
  id: string
  name: string
  phone: string
  eventType: string
}

function FlagChip({ flag }: { flag?: string }) {
  const meta = LEAD_FLAGS.find((f) => f.value === flag)
  if (!meta) return null
  const icon =
    flag === 'good' ? <CheckCircle2 className="size-3.5 text-success" /> :
    flag === 'escalate' ? <CircleAlert className="size-3.5 text-destructive" /> :
    <TriangleAlert className="size-3.5 text-warning" />
  return <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px]">{icon}{meta.label}</span>
}

export default function Leads() {
  const { user } = useAuth()
  const isManager = user?.role === 'admin' || user?.role === 'manager'
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()

  const [q, setQ] = useState('')
  const [outcome, setOutcome] = useState('all')
  const [exec, setExec] = useState('all')
  const [eventType, setEventType] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [showReport, setShowReport] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)

  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (q) params.set('q', q)
  if (outcome !== 'all') params.set('outcome', outcome === 'none' ? '' : outcome)
  if (exec !== 'all') params.set('exec', exec)
  if (eventType !== 'all') params.set('eventType', eventType)

  const { data, isLoading } = useQuery({
    queryKey: ['leads', params.toString()],
    queryFn: () => api<Paged<Lead>>(`/leads?${params}`),
    placeholderData: keepPreviousData,
  })

  const { data: summary } = useQuery({
    queryKey: ['leads', 'summary'],
    queryFn: () => api<LeadSummary>('/leads/summary'),
  })

  const { data: overdueLeads = [] } = useQuery({
    queryKey: ['leads', 'overdue'],
    queryFn: () => api<Lead[]>('/leads/overdue'),
  })

  const { data: unassignedLeads = [] } = useQuery({
    queryKey: ['leads', 'unassigned'],
    queryFn: () => api<UnassignedLead[]>('/leads/unassigned'),
    enabled: isManager,
  })

  const { data: execs = [] } = useQuery({
    queryKey: ['execs'],
    queryFn: () => api<{ username: string; name: string }[]>('/users/execs'),
    enabled: isManager,
  })

  const { data: report = [] } = useQuery({
    queryKey: ['leads', 'report'],
    queryFn: () => api<ExecReportRow[]>('/leads/report'),
    enabled: isManager && showReport,
  })

  const today = todayYmd()
  const resetPage = () => setPage(1)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['leads'] })

  const assign = useMutation({
    mutationFn: ({ ids, exec }: { ids: string[]; exec: string }) => api('/leads/assign', { body: { ids, exec } }),
    onSuccess: () => {
      invalidate()
      toast.success('Assigned')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const markConverted = useMutation({
    mutationFn: (id: string) => api(`/leads/${id}`, { method: 'PATCH', body: { outcome: 'Converted' } }),
    onSuccess: () => {
      invalidate()
      toast.success('Marked converted')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const deleteLead = useMutation({
    mutationFn: (id: string) => api(`/leads/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast.success('Lead deleted')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  function exportReportCsv() {
    const header = 'Executive,Calls,Interested,Callbacks,Converted,Conversion %\n'
    const body = report.map((r) => [r.execLabel, r.calls, r.interested, r.callbacks, r.converted, r.conversionRate].join(',')).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'exec-report.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const isOverdue = (l: Lead) => !!l.followup && l.followup < today && l.outcome !== 'Converted' && l.outcome !== 'Not Interested'

  const actions = (l: Lead) => (
    <div className="flex justify-end gap-1">
      {l.outcome !== 'Converted' && (
        <Button variant="ghost" size="icon-sm" className="text-success" title="Mark converted" onClick={() => markConverted.mutate(l.id)}>
          <CheckCircle2 className="size-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => { setEditing(l); setSheetOpen(true) }}>
        <Pencil className="size-4" />
      </Button>
      {isAdmin && (
        <ConfirmDelete
          title={`Delete lead ${l.name}?`}
          onConfirm={() => deleteLead.mutate(l.id)}
          trigger={<Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></Button>}
        />
      )}
    </div>
  )

  const columns: ColumnDef<Lead>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: ({ row: { original: l } }) => (
        <div className="whitespace-nowrap">
          {fmtDate(l.date)}
          {l.time && <div className="text-[11px] text-muted-foreground">{l.time}</div>}
        </div>
      ),
    },
    {
      id: 'lead',
      header: 'Lead',
      cell: ({ row: { original: l } }) => (
        <div>
          <div className="font-medium">{l.name}</div>
          <div className="text-[11px] text-muted-foreground">{l.phone}</div>
        </div>
      ),
    },
    { id: 'event', header: 'Event', cell: ({ row: { original: l } }) => <span className="block max-w-40 truncate">{l.eventType}</span> },
    {
      id: 'outcome',
      header: 'Outcome',
      cell: ({ row: { original: l } }) =>
        l.outcome ? <Badge variant={OUTCOME_VARIANT[l.outcome] ?? 'muted'} withDot>{l.outcome}</Badge> : <Badge variant="muted">not called</Badge>,
    },
    {
      id: 'followup',
      header: 'Follow-up',
      cell: ({ row: { original: l } }) =>
        l.followup ? (
          <span className={isOverdue(l) ? 'font-medium text-destructive' : ''}>{fmtDate(l.followup)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    ...(isManager
      ? ([
          {
            id: 'exec',
            header: 'Assigned',
            cell: ({ row: { original: l } }) => l.execLabel || <span className="text-muted-foreground">—</span>,
          },
          {
            id: 'flag',
            header: 'Flag',
            cell: ({ row: { original: l } }) => <FlagChip flag={l.flag} />,
          },
        ] satisfies ColumnDef<Lead>[])
      : []),
    { id: 'actions', header: '', cell: ({ row: { original: l } }) => actions(l) },
  ]

  return (
    <div>
      <PageHeader
        title="CRM"
        description="Leads, calls and follow-ups"
        actions={
          <>
            {isManager && (() => {
              const p = new URLSearchParams()
              if (q) p.set('q', q)
              if (outcome !== 'all') p.set('outcome', outcome === 'none' ? '' : outcome)
              if (exec !== 'all') p.set('exec', exec)
              if (eventType !== 'all') p.set('eventType', eventType)
              return <ExportButton path="/export/leads" name="leads" params={p} />
            })()}
            {isManager && (
              <Button variant="outline" onClick={() => setShowReport((s) => !s)}>Executive report</Button>
            )}
            <Button onClick={() => { setEditing(null); setSheetOpen(true) }}>+ Log call</Button>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={PhoneCall} tint="info" label="Total Leads" value={summary?.total ?? 0} />
        <StatCard icon={CheckCircle2} tint="success" label="Converted" value={summary?.converted ?? 0} />
        <StatCard icon={CalendarClock} tint="warning" label="Callbacks" value={summary?.callbacks ?? 0} hint="pending" />
        <StatCard
          icon={AlertCircle}
          tint={(summary?.overdue ?? 0) > 0 ? 'destructive' : 'foreground'}
          label="Overdue"
          value={summary?.overdue ?? 0}
          hint={(summary?.overdue ?? 0) > 0 ? <span className="font-medium text-destructive">follow-ups missed</span> : 'all on track'}
        />
        {isManager && <StatCard icon={UserX} tint="purple" label="Unassigned" value={summary?.unassigned ?? 0} />}
      </div>

      {isManager && showReport && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[15px]">Executive performance</CardTitle>
            <Button variant="outline" size="sm" onClick={exportReportCsv}>CSV</Button>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Executive</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Interested</TableHead>
                  <TableHead className="text-right">Callbacks</TableHead>
                  <TableHead className="text-right">Converted</TableHead>
                  <TableHead className="text-right">Conv. %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.map((r) => (
                  <TableRow key={r.exec}>
                    <TableCell className="font-medium">{r.execLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.calls}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.interested}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.callbacks}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.converted}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.conversionRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {overdueLeads.length > 0 && (
        <Card className="mb-6 border-destructive/25 bg-destructive/5 py-3">
          <CardContent className="px-4">
            <div className="mb-2 text-[13px] font-semibold text-destructive">
              {overdueLeads.length} overdue follow-up{overdueLeads.length > 1 ? 's' : ''}
            </div>
            <div className="space-y-1">
              {overdueLeads.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span>
                    <span className="font-medium">{l.name}</span>
                    <span className="text-muted-foreground"> · {l.phone} · was due {fmtDate(l.followup)}</span>
                  </span>
                  <Button variant="outline" size="xs" onClick={() => { setEditing(l); setSheetOpen(true) }}>Update</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isManager && unassignedLeads.length > 0 && (
        <Card className="mb-6 border-warning/25 bg-warning/5 py-3">
          <CardContent className="px-4">
            <div className="mb-2 text-[13px] font-semibold text-warning">{unassignedLeads.length} unassigned lead{unassignedLeads.length > 1 ? 's' : ''}</div>
            <div className="space-y-1.5">
              {unassignedLeads.slice(0, 5).map((l) => (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span>{l.name} · {l.phone}</span>
                  <Select onValueChange={(v) => assign.mutate({ ids: [l.id], exec: v })}>
                    <SelectTrigger className="h-7 w-36 text-[12px]"><SelectValue placeholder="Assign to…" /></SelectTrigger>
                    <SelectContent>
                      {execs.map((u) => <SelectItem key={u.username} value={u.username}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        <Input placeholder="Search name or phone…" value={q} onChange={(e) => { setQ(e.target.value); resetPage() }} className="h-10 w-full sm:w-64" />
        <Select value={outcome} onValueChange={(v) => { setOutcome(v); resetPage() }}>
          <SelectTrigger className="h-10 w-[calc(50%-6px)] sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="none">Not called yet</SelectItem>
            {OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        {isManager && (
          <Select value={exec} onValueChange={(v) => { setExec(v); resetPage() }}>
            <SelectTrigger className="h-10 w-[calc(50%-6px)] sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All execs</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {execs.map((u) => <SelectItem key={u.username} value={u.username}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={eventType} onValueChange={(v) => { setEventType(v); resetPage() }}>
          <SelectTrigger className="h-10 w-[calc(50%-6px)] sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All event types</SelectItem>
            {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
        onLimitChange={(l) => { setLimit(l); resetPage() }}
        isLoading={isLoading}
        empty={<EmptyState icon={PhoneCall} message="No leads yet" description="Import from Excel or log your first call." />}
        renderCard={(l) => (
          <Card className="py-3">
            <CardContent className="space-y-2 px-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold">{l.name}</span>
                <span className="text-[12px] text-muted-foreground">{l.phone}</span>
                {l.outcome && <Badge variant={OUTCOME_VARIANT[l.outcome] ?? 'muted'} withDot>{l.outcome}</Badge>}
                {isManager && <FlagChip flag={l.flag} />}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {fmtDate(l.date)}{l.time && ` ${l.time}`} · {l.eventType}
                {l.execLabel && ` · ${l.execLabel}`}
                {l.followup && (
                  <span className={isOverdue(l) ? 'font-medium text-destructive' : ''}> · follow-up {fmtDate(l.followup)}</span>
                )}
              </div>
              {l.notes && <div className="line-clamp-2 text-[13px]">{l.notes}</div>}
              {isManager && l.adminComment && <div className="flex items-center gap-1 text-[12px] text-warning"><Lock className="size-3" /> {l.adminComment}</div>}
              <div className="flex justify-end gap-1 border-t pt-2">{actions(l)}</div>
            </CardContent>
          </Card>
        )}
      />

      <LeadSheet open={sheetOpen} onClose={() => setSheetOpen(false)} lead={editing} />
    </div>
  )
}
