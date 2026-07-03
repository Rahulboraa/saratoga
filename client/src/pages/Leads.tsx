import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Download, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Skeleton } from '@/components/ui/skeleton'
import StatCard from '@/components/StatCard'
import LeadDialog from '@/components/LeadDialog'
import ConfirmDelete from '@/components/ConfirmDelete'
import EmptyState from '@/components/EmptyState'

const OUTCOME_BADGE: Record<string, string> = {
  'Interested': 'bg-emerald-50 text-emerald-600',
  'Not Interested': 'bg-red-50 text-red-600',
  'Callback': 'bg-amber-50 text-amber-700',
  'Converted': 'bg-blue-50 text-blue-700',
}

function flagLabel(flag?: string) {
  return LEAD_FLAGS.find((f) => f.value === flag)?.label ?? ''
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
  const [showReport, setShowReport] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)

  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (outcome !== 'all') params.set('outcome', outcome === 'none' ? '' : outcome)
  if (exec !== 'all') params.set('exec', exec)
  if (eventType !== 'all') params.set('eventType', eventType)

  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads', params.toString()],
    queryFn: () => api<Lead[]>(`/leads?${params}`),
  })

  const { data: allLeads = [] } = useQuery({
    queryKey: ['leads', ''],
    queryFn: () => api<Lead[]>('/leads'),
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
  const summary = useMemo(() => ({
    total: allLeads.length,
    converted: allLeads.filter((l) => l.outcome === 'Converted').length,
    callbacks: allLeads.filter((l) => l.outcome === 'Callback' && (!l.followup || l.followup >= today)).length,
    overdue: allLeads.filter((l) => l.followup && l.followup < today && l.outcome !== 'Converted' && l.outcome !== 'Not Interested').length,
    unassigned: allLeads.filter((l) => !l.exec).length,
  }), [allLeads, today])

  const unassignedLeads = useMemo(() => allLeads.filter((l) => !l.exec), [allLeads])

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
      toast.success('Marked converted 🎉')
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">CRM — Leads & Calls</h1>
        <div className="flex flex-wrap gap-2">
          {isManager && (
            <Button variant="outline" onClick={() => setShowReport((s) => !s)}>📈 Exec Report</Button>
          )}
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>+ Log Call</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total Leads" value={summary.total} />
        <StatCard label="Converted" value={summary.converted} />
        <StatCard label="Callbacks" value={summary.callbacks} sub="pending" />
        <StatCard
          label="Overdue"
          value={summary.overdue}
          sub={summary.overdue > 0 ? <span className="text-red-600">follow-ups missed</span> : 'all on track'}
        />
        {isManager && <StatCard label="Unassigned" value={summary.unassigned} />}
      </div>

      {isManager && showReport && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">📈 Sales Executive Performance</CardTitle>
            <Button variant="outline" size="sm" onClick={exportReportCsv}><Download className="size-4" /> CSV</Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
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
                    <TableCell className="text-right">{r.calls}</TableCell>
                    <TableCell className="text-right">{r.interested}</TableCell>
                    <TableCell className="text-right">{r.callbacks}</TableCell>
                    <TableCell className="text-right">{r.converted}</TableCell>
                    <TableCell className="text-right">{r.conversionRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {isManager && unassignedLeads.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 py-3">
          <CardContent className="px-4">
            <div className="mb-2 text-sm font-semibold text-amber-700">⚠️ {unassignedLeads.length} unassigned lead{unassignedLeads.length > 1 ? 's' : ''}</div>
            <div className="space-y-1.5">
              {unassignedLeads.slice(0, 5).map((l) => (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{l.name} · {l.phone}</span>
                  <Select onValueChange={(v) => assign.mutate({ ids: [l.id], exec: v })}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Assign to…" /></SelectTrigger>
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

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search name or phone…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-56" />
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="w-[calc(50%-4px)] sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="none">Not called yet</SelectItem>
            {OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        {isManager && (
          <Select value={exec} onValueChange={setExec}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All execs</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {execs.map((u) => <SelectItem key={u.username} value={u.username}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-[calc(50%-4px)] sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All event types</SelectItem>
            {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : !leads?.length ? (
        <EmptyState icon="📞" message='No leads yet. Import from Excel or click "+ Log Call"' />
      ) : (
        <div className="space-y-2">
          {leads.map((l) => {
            const overdue = l.followup && l.followup < today && l.outcome !== 'Converted' && l.outcome !== 'Not Interested'
            return (
              <Card key={l.id} className="py-3">
                <CardContent className="px-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{l.name}</span>
                        <span className="text-sm text-muted-foreground">{l.phone}</span>
                        {l.outcome && <Badge variant="outline" className={OUTCOME_BADGE[l.outcome]}>{l.outcome}</Badge>}
                        {isManager && l.flag && <span className="text-sm">{flagLabel(l.flag)}</span>}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {fmtDate(l.date)}{l.time && ` ${l.time}`} · {l.eventType}
                        {l.execLabel && <span> · 👤 {l.execLabel}</span>}
                        {l.followup && (
                          <span className={overdue ? 'font-medium text-red-600' : ''}>
                            {' '}· follow-up {fmtDate(l.followup)}{overdue && ' ⚠️'}
                          </span>
                        )}
                      </div>
                      {l.notes && <div className="mt-1 line-clamp-2 text-sm">{l.notes}</div>}
                      {isManager && l.adminComment && (
                        <div className="mt-1 text-sm text-amber-700">🔒 {l.adminComment}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {l.outcome !== 'Converted' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-emerald-600"
                          onClick={() => markConverted.mutate(l.id)}
                          title="Mark converted"
                        >
                          <CheckCircle2 className="size-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(l); setDialogOpen(true) }}>
                        <Pencil className="size-4" />
                      </Button>
                      {isAdmin && (
                        <ConfirmDelete
                          title={`Delete lead ${l.name}?`}
                          onConfirm={() => deleteLead.mutate(l.id)}
                          trigger={<Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-red-600"><Trash2 className="size-4" /></Button>}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <LeadDialog open={dialogOpen} onClose={() => setDialogOpen(false)} lead={editing} />
    </div>
  )
}
