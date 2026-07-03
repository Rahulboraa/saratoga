import { useMemo, useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import { Pencil, Trash2, Wallet } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { fmtMoney, fmtLakh, fmtDate, fmtMonth, todayYmd, STATUS_BADGE } from '@/lib/format'
import { EXPENSE_CATS, type Expense, type ExpensePayment, type ExpenseSummary } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import StatCard from '@/components/StatCard'
import ConfirmDelete from '@/components/ConfirmDelete'
import EmptyState from '@/components/EmptyState'

const tooltipStyle = { background: 'oklch(0.195 0.015 75)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 }

interface ExpenseForm {
  date: string
  cat: string
  desc: string
  amount: number
  vendor: string
  notes: string
}

function ExpenseDialog({ open, onClose, expense }: { open: boolean; onClose: () => void; expense?: Expense | null }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<ExpenseForm>({
    values: {
      date: expense?.date ?? todayYmd(),
      cat: expense?.cat ?? 'Other',
      desc: expense?.desc ?? '',
      amount: expense?.amount ?? 0,
      vendor: expense?.vendor ?? '',
      notes: expense?.notes ?? '',
    },
  })

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      expense ? api(`/expenses/${expense.id}`, { method: 'PATCH', body }) : api('/expenses', { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success(expense ? 'Expense updated' : 'Expense added')
      reset()
      onClose()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Save failed'),
  })

  const cat = watch('cat')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{expense ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate({ ...v, amount: +v.amount }))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" {...register('date', { required: true })} aria-invalid={!!errors.date} />
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={cat} onValueChange={(v) => setValue('cat', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Description *</Label>
              <Input {...register('desc', { required: true })} aria-invalid={!!errors.desc} />
            </div>
            <div className="space-y-1.5">
              <Label>Total Bill Amount *</Label>
              <Input type="number" min="0" {...register('amount', { required: true, min: 0 })} />
            </div>
            <div className="space-y-1.5">
              <Label>To / Vendor</Label>
              <Input {...register('vendor')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} {...register('notes')} />
          </div>
          <p className="text-xs text-muted-foreground">You can record partial payments against this expense after saving.</p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>Save Expense</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ExpensePayPanel({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: payments = [] } = useQuery({
    queryKey: ['expense-payments', expense.id],
    queryFn: () => api<ExpensePayment[]>(`/expenses/${expense.id}/payments`),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expense-payments', expense.id] })
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
  }

  const add = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/expenses/${expense.id}/payments`, { body }),
    onSuccess: () => {
      invalidate()
      setShowForm(false)
      toast.success('Payment recorded')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api(`/expense-payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast.success('Payment deleted')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const paid = payments.reduce((s, p) => s + p.amount, 0)
  const due = expense.amount - paid
  const pct = expense.amount > 0 ? Math.min(Math.round((paid / expense.amount) * 100), 100) : 0

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    add.mutate({
      date: fd.get('date'), amount: Number(fd.get('amount')), method: fd.get('method'),
      to: fd.get('to'), by: fd.get('by'), notes: fd.get('notes'),
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>🧾 {expense.desc}</DialogTitle>
          <p className="text-sm text-muted-foreground">{fmtDate(expense.date)} · {expense.cat}</p>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border p-2">
            <div className="text-xs text-muted-foreground">Bill</div>
            <div className="font-bold">{fmtMoney(expense.amount)}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-xs text-muted-foreground">Paid</div>
            <div className="font-bold text-emerald-400">{fmtMoney(paid)}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-xs text-muted-foreground">Due</div>
            <div className={`font-bold ${due > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmtMoney(due)}</div>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-accent">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>

        {payments.length === 0 ? (
          <EmptyState icon="💳" message="No payments yet" />
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                <div>
                  <span className="font-semibold">{fmtMoney(p.amount)}</span>
                  <span className="text-muted-foreground"> · {fmtDate(p.date)}{p.method && ` · ${p.method}`}{p.to && ` · to ${p.to}`}</span>
                </div>
                <ConfirmDelete
                  title="Delete this payment?"
                  onConfirm={() => remove.mutate(p.id)}
                  trigger={<Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-400"><Trash2 className="size-4" /></Button>}
                />
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <form onSubmit={onSubmit} className="space-y-3 rounded-lg border p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input name="date" type="date" defaultValue={todayYmd()} required />
              </div>
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input name="amount" type="number" min="1" required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Input name="method" placeholder="UPI / Cash" />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input name="to" />
              </div>
              <div className="space-y-1.5">
                <Label>By</Label>
                <Input name="by" />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input name="notes" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={add.isPending}>Add Payment</Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setShowForm(true)}>+ Record Payment</Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function Expenses() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState('all')
  const [cat, setCat] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [payFor, setPayFor] = useState<string | null>(null)

  const params = new URLSearchParams()
  if (month !== 'all') params.set('month', month)
  if (cat !== 'all') params.set('cat', cat)

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', params.toString()],
    queryFn: () => api<Expense[]>(`/expenses?${params}`),
  })

  const { data: summary } = useQuery({
    queryKey: ['expenses', 'summary', month],
    queryFn: () => api<ExpenseSummary>(`/expenses/summary${month !== 'all' ? `?month=${month}` : ''}`),
  })

  const { data: allExpenses } = useQuery({
    queryKey: ['expenses', ''],
    queryFn: () => api<Expense[]>('/expenses'),
  })

  const months = useMemo(() => [...new Set((allExpenses ?? []).map((e) => e.date.slice(0, 7)))].sort().reverse(), [allExpenses])

  const deleteExpense = useMutation({
    mutationFn: (id: string) => api(`/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Expense deleted')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const plSeries = (summary?.plSeries ?? []).map((p) => ({ ...p, label: fmtMonth(p.month) }))
  const payExpense = payFor ? (expenses ?? []).find((e) => e.id === payFor) ?? null : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Expenses & P&L</h1>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>+ Add Expense</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Bill" value={fmtMoney(summary?.totalBill)} />
        <StatCard label="Total Paid" value={<span className="text-emerald-400">{fmtMoney(summary?.totalPaid)}</span>} />
        <StatCard label="Total Due" value={<span className={(summary?.totalDue ?? 0) > 0 ? 'text-red-400' : ''}>{fmtMoney(summary?.totalDue)}</span>} />
        <StatCard label="Categories" value={summary?.categories.length ?? 0} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(summary?.categories ?? []).map((c) => (
          <Card key={c.cat} className="py-3">
            <CardContent className="px-4">
              <div className="text-sm font-semibold">{c.cat}</div>
              <div className="text-xs text-muted-foreground">{c.count} expenses</div>
              <div className="mt-1 text-sm font-bold">{fmtMoney(c.amount)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Monthly P&L</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer>
            <ComposedChart data={plSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtLakh} tick={{ fontSize: 11 }} width={52} />
              <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#3266ad" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#E8877A" radius={[3, 3, 0, 0]} />
              <Line dataKey="profit" name="Profit" stroke="#1D9E75" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">P&L by Month</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Profit / Loss</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plSeries.map((p) => (
                <TableRow key={p.month}>
                  <TableCell>{p.label}</TableCell>
                  <TableCell className="text-right">{fmtMoney(p.revenue)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(p.expenses)}</TableCell>
                  <TableCell className={`text-right font-medium ${p.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMoney(p.profit)}</TableCell>
                  <TableCell className="text-right">{p.margin}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {months.map((m) => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !expenses?.length ? (
        <EmptyState icon="🧾" message="No expenses recorded" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Bill</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(e.date)}</TableCell>
                  <TableCell><Badge variant="outline">{e.cat}</Badge></TableCell>
                  <TableCell className="max-w-48">
                    <div className="truncate font-medium">{e.desc}</div>
                    {e.vendor && <div className="truncate text-xs text-muted-foreground">{e.vendor}</div>}
                  </TableCell>
                  <TableCell className="text-right">{fmtMoney(e.amount)}</TableCell>
                  <TableCell className="text-right text-emerald-400">{fmtMoney(e.paid)}</TableCell>
                  <TableCell className={`text-right ${e.due > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmtMoney(e.due)}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_BADGE[e.status]}>{e.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-7" title="Payments" onClick={() => setPayFor(e.id)}>
                        <Wallet className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" title="Edit" onClick={() => { setEditing(e); setDialogOpen(true) }}>
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDelete
                        title={`Delete expense "${e.desc}"?`}
                        description="Its payment records will also be deleted."
                        onConfirm={() => deleteExpense.mutate(e.id)}
                        trigger={<Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-400"><Trash2 className="size-4" /></Button>}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ExpenseDialog open={dialogOpen} onClose={() => setDialogOpen(false)} expense={editing} />
      {payExpense && <ExpensePayPanel expense={payExpense} onClose={() => setPayFor(null)} />}
    </div>
  )
}
