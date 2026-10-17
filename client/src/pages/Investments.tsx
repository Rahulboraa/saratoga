import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, Pencil, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { fmtMoney, fmtDate, todayYmd } from '@/lib/format'
import { useProperty } from '@/lib/property'
import type { InvestmentEntry, PartnerRow } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { DatePicker } from '@/components/DatePicker'
import ConfirmDelete from '@/components/ConfirmDelete'
import EmptyState from '@/components/EmptyState'
import StatCard from '@/components/StatCard'
import { PageHeader } from '@/components/PageHeader'
import ExportButton from '@/components/ExportButton'

interface Response {
  rows: InvestmentEntry[]
  partners: PartnerRow[]
}

export default function Investments() {
  const queryClient = useQueryClient()
  const { activeId, active, canSwitch } = useProperty()
  const [addOpen, setAddOpen] = useState(false)
  // Null while recording a new entry, the entry being corrected while editing.
  const [editing, setEditing] = useState<InvestmentEntry | null>(null)
  const [kind, setKind] = useState('Investment')
  const [date, setDate] = useState(todayYmd())
  const [partner, setPartner] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['investments'],
    queryFn: () => api<Response>('/investments'),
    enabled: !!activeId,
  })

  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed')
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['investments'] })

  const addEntry = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/investments', { body }),
    onSuccess: () => {
      invalidate()
      setAddOpen(false)
      setPartner('')
      toast.success('Entry recorded')
    },
    onError,
  })

  const saveEntry = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/investments/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      invalidate()
      setAddOpen(false)
      setEditing(null)
      toast.success('Entry updated')
    },
    onError,
  })

  const removeEntry = useMutation({
    mutationFn: (id: string) => api(`/investments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast.success('Entry removed')
    },
    onError,
  })

  // Capital is held per property, so a combined view would add up unrelated pots.
  if (!activeId) {
    return (
      <div>
        <PageHeader title="Investments" description="Partner capital, tracked per project" />
        <EmptyState
          icon={Landmark}
          message="Pick a project"
          description={canSwitch
            ? 'Each property has its own partners and capital. Choose one from the switcher above.'
            : 'No project is assigned to your account yet.'}
        />
      </div>
    )
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body = {
      partner: String(fd.get('partner')).trim(),
      date,
      kind,
      amount: Number(fd.get('amount')),
      mode: fd.get('mode'),
      notes: fd.get('notes'),
    }
    if (editing) saveEntry.mutate({ id: editing.id, body })
    else addEntry.mutate(body)
  }

  function openAdd() {
    setEditing(null)
    setPartner('')
    setKind('Investment')
    setDate(todayYmd())
    setAddOpen(true)
  }

  function openEdit(entry: InvestmentEntry) {
    setEditing(entry)
    setPartner(entry.partner)
    setKind(entry.kind)
    setDate(entry.date)
    setAddOpen(true)
  }

  const partners = data?.partners ?? []
  const rows = data?.rows ?? []
  const invested = partners.reduce((s, p) => s + p.invested, 0)
  const withdrawn = partners.reduce((s, p) => s + p.withdrawn, 0)

  return (
    <div>
      <PageHeader
        title="Investments"
        description={`Partner capital in ${active?.name ?? 'this project'}`}
        actions={<>
          <ExportButton path="/export/investments" name="investments" />
          <Button onClick={openAdd}>Record entry</Button>
        </>}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={TrendingUp} tint="success" label="Total invested" value={fmtMoney(invested)} hint={`${partners.length} partner${partners.length === 1 ? '' : 's'}`} />
        <StatCard icon={TrendingDown} tint="warning" label="Withdrawn" value={fmtMoney(withdrawn)} />
        <StatCard icon={Wallet} tint="info" label="Net capital" value={fmtMoney(invested - withdrawn)} />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : partners.length === 0 ? (
        <EmptyState icon={Landmark} message="No capital recorded yet" description="Record what each partner has put into this project." />
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-[15px]">By partner</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead className="text-right">Invested</TableHead>
                    <TableHead className="text-right">Withdrawn</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                    <TableHead className="text-right">Last entry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((p) => (
                    <TableRow key={p.partner}>
                      <TableCell className="font-medium">{p.partner}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(p.invested)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.withdrawn > 0 ? fmtMoney(p.withdrawn) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmtMoney(p.net)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.share}%</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtDate(p.lastDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-[15px]">All entries</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                      <TableCell className="font-medium">{r.partner}</TableCell>
                      <TableCell>
                        <Badge variant={r.kind === 'Withdrawal' ? 'warning' : 'success'}>{r.kind}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(r.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.mode || '—'}</TableCell>
                      <TableCell className="max-w-48 truncate text-muted-foreground">{r.notes || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" title="Edit entry" onClick={() => openEdit(r)}>
                          <Pencil className="size-5" />
                        </Button>
                        <ConfirmDelete
                          title={`Remove this ${r.kind.toLowerCase()} by ${r.partner}?`}
                          onConfirm={() => removeEntry.mutate(r.id)}
                          trigger={<Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-5" /></Button>}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editing ? 'Edit entry' : 'Record entry'}</DialogTitle></DialogHeader>
          {/* Keyed on the entry so the amount, mode and notes reload when switching rows. */}
          <form key={editing?.id ?? 'new'} onSubmit={onSubmit} className="mt-2 space-y-3">
            <div className="space-y-1.5">
              <Label>Partner *</Label>
              <Input
                name="partner"
                required
                autoFocus
                list="partner-names"
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
                placeholder="Name"
              />
              <datalist id="partner-names">
                {partners.map((p) => <option key={p.partner} value={p.partner} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Investment">Investment</SelectItem>
                    <SelectItem value="Withdrawal">Withdrawal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <DatePicker value={date} onChange={setDate} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input name="amount" type="number" min="1" required defaultValue={editing?.amount ?? ''} />
              </div>
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Input name="mode" placeholder="Bank / UPI / Cash" defaultValue={editing?.mode ?? ''} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input name="notes" defaultValue={editing?.notes ?? ''} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addEntry.isPending || saveEntry.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
