import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Pencil, Trash2, Wallet, Receipt, IndianRupee, Layers } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { fmtMoney, fmtDate, fmtMonth, todayYmd, STATUS_VARIANT } from '@/lib/format'
import { EXPENSE_CATS, type Expense, type ExpensePayment, type ExpenseSummary } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import StatCard from '@/components/StatCard'
import ConfirmDelete from '@/components/ConfirmDelete'
import EmptyState from '@/components/EmptyState'
import { DataTable, type Paged } from '@/components/DataTable'
import ExportButton from '@/components/ExportButton'
import { PageHeader } from '@/components/PageHeader'
import { DatePicker } from '@/components/DatePicker'
import { PLChart } from '@/components/charts'

type ExpensesResponse = Paged<Expense> & { months: string[] }

interface ExpenseForm {
  date: string
  cat: string
  desc: string
  amount: number
  vendor: string
  notes: string
}

function ExpenseSheet({ open, onClose, expense }: { open: boolean; onClose: () => void; expense?: Expense | null }) {
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

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{expense ? 'Edit expense' : 'Add expense'}</SheetTitle>
          <SheetDescription>Record partial payments against it after saving.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit((v) => save.mutate({ ...v, amount: +v.amount }))} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <div className="space-y-2">
                <Label>Date *</Label>
                <DatePicker value={watch('date')} onChange={(v) => setValue('date', v)} />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={watch('cat')} onValueChange={(v) => setValue('cat', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Description *</Label>
                <Input {...register('desc', { required: true })} aria-invalid={!!errors.desc} />
              </div>
              <div className="space-y-2">
                <Label>Total bill amount *</Label>
                <Input type="number" min="0" {...register('amount', { required: true, min: 0 })} />
              </div>
              <div className="space-y-2">
                <Label>To / vendor</Label>
                <Input {...register('vendor')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} {...register('notes')} />
            </div>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>Save expense</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function ExpensePayPanel({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [payDate, setPayDate] = useState(todayYmd())

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
      date: payDate, amount: Number(fd.get('amount')), method: fd.get('method'),
      to: fd.get('to'), by: fd.get('by'), notes: fd.get('notes'),
    })
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Payments · {expense.desc}</SheetTitle>
          <SheetDescription>{fmtDate(expense.date)} · {expense.cat}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-border/60 p-2 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Bill</div>
              <div className="text-[15px] font-semibold tabular-nums">{fmtMoney(expense.amount)}</div>
            </div>
            <div className="rounded-lg border border-border/60 p-2 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Paid</div>
              <div className="text-[15px] font-semibold tabular-nums text-success">{fmtMoney(paid)}</div>
            </div>
            <div className="rounded-lg border border-border/60 p-2 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Due</div>
              <div className={`text-[15px] font-semibold tabular-nums ${due > 0 ? 'text-destructive' : 'text-success'}`}>{fmtMoney(due)}</div>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>

          {showForm ? (
            <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border/60 p-3 shadow-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <DatePicker value={payDate} onChange={setPayDate} />
                </div>
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input name="amount" type="number" min="1" required autoFocus />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Input name="method" placeholder="UPI / Cash" />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input name="to" />
                </div>
                <div className="space-y-2">
                  <Label>By</Label>
                  <Input name="by" />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input name="notes" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={add.isPending}>Add payment</Button>
              </div>
            </form>
          ) : (
            <Button onClick={() => { setPayDate(todayYmd()); setShowForm(true) }}>+ Record payment</Button>
          )}

          {payments.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
              <Wallet className="size-5" /> No payments yet
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2.5 text-[13px] shadow-sm">
                  <div>
                    <span className="font-semibold tabular-nums">{fmtMoney(p.amount)}</span>
                    <span className="text-muted-foreground"> · {fmtDate(p.date)}{p.method && ` · ${p.method}`}{p.to && ` · to ${p.to}`}</span>
                  </div>
                  <ConfirmDelete
                    title="Delete this payment?"
                    onConfirm={() => remove.mutate(p.id)}
                    trigger={<Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-5" /></Button>}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function Expenses() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState('all')
  const [cat, setCat] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [payFor, setPayFor] = useState<string | null>(null)

  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (month !== 'all') params.set('month', month)
  if (cat !== 'all') params.set('cat', cat)

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', params.toString()],
    queryFn: () => api<ExpensesResponse>(`/expenses?${params}`),
    placeholderData: keepPreviousData,
  })

  const { data: summary } = useQuery({
    queryKey: ['expenses', 'summary', month],
    queryFn: () => api<ExpenseSummary>(`/expenses/summary${month !== 'all' ? `?month=${month}` : ''}`),
  })

  const deleteExpense = useMutation({
    mutationFn: (id: string) => api(`/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Expense deleted')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const resetPage = () => setPage(1)
  const plSeries = (summary?.plSeries ?? []).map((p) => ({ ...p, label: fmtMonth(p.month) }))
  const payExpense = payFor ? (data?.rows ?? []).find((e) => e.id === payFor) ?? null : null

  const actions = (e: Expense) => (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon-sm" title="Payments" onClick={() => setPayFor(e.id)}>
        <Wallet className="size-5" />
      </Button>
      <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => { setEditing(e); setSheetOpen(true) }}>
        <Pencil className="size-5" />
      </Button>
      <ConfirmDelete
        title={`Delete expense "${e.desc}"?`}
        description="Its payment records will also be deleted."
        onConfirm={() => deleteExpense.mutate(e.id)}
        trigger={<Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-5" /></Button>}
      />
    </div>
  )

  const columns: ColumnDef<Expense>[] = [
    { id: 'date', header: 'Date', cell: ({ row: { original: e } }) => <span className="whitespace-nowrap">{fmtDate(e.date)}</span> },
    { id: 'cat', header: 'Category', cell: ({ row: { original: e } }) => <Badge variant="secondary">{e.cat}</Badge> },
    {
      id: 'desc',
      header: 'Description',
      cell: ({ row: { original: e } }) => (
        <div className="max-w-48">
          <div className="truncate font-medium">{e.desc}</div>
          {e.vendor && <div className="truncate text-[11px] text-muted-foreground">{e.vendor}</div>}
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Bill',
      meta: { headClass: 'text-right', cellClass: 'text-right tabular-nums' },
      cell: ({ row: { original: e } }) => fmtMoney(e.amount),
    },
    {
      id: 'paid',
      header: 'Paid',
      meta: { headClass: 'text-right', cellClass: 'text-right tabular-nums text-success' },
      cell: ({ row: { original: e } }) => fmtMoney(e.paid),
    },
    {
      id: 'due',
      header: 'Due',
      meta: { headClass: 'text-right', cellClass: 'text-right tabular-nums' },
      cell: ({ row: { original: e } }) => <span className={e.due > 0 ? 'text-destructive' : 'text-success'}>{fmtMoney(e.due)}</span>,
    },
    { id: 'status', header: 'Status', cell: ({ row: { original: e } }) => <Badge variant={STATUS_VARIANT[e.status]} withDot>{e.status}</Badge> },
    { id: 'actions', header: '', cell: ({ row: { original: e } }) => actions(e) },
  ]

  return (
    <div>
      <PageHeader
        title="Expenses & P&L"
        description="Bills, payments and monthly profit"
        actions={
          <>
            {(() => {
              const p = new URLSearchParams()
              if (month !== 'all') p.set('month', month)
              if (cat !== 'all') p.set('cat', cat)
              return <ExportButton path="/export/expenses" name="expenses" params={p} />
            })()}
            <Button onClick={() => { setEditing(null); setSheetOpen(true) }}>+ Add expense</Button>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Receipt} tint="info" label="Total Bill" value={fmtMoney(summary?.totalBill)} />
        <StatCard icon={Wallet} tint="success" label="Total Paid" value={fmtMoney(summary?.totalPaid)} />
        <StatCard icon={IndianRupee} tint={(summary?.totalDue ?? 0) > 0 ? 'destructive' : 'foreground'} label="Total Due" value={fmtMoney(summary?.totalDue)} />
        <StatCard icon={Layers} tint="purple" label="Categories" value={summary?.categories.length ?? 0} />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-5">
        {(summary?.categories ?? []).map((c) => (
          <Card key={c.cat} className="py-3">
            <CardContent className="px-4">
              <div className="text-[13px] font-medium">{c.cat}</div>
              <div className="text-xs text-muted-foreground">{c.count} expenses</div>
              <div className="mt-1 text-[15px] font-semibold tabular-nums">{fmtMoney(c.amount)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-[15px]">Monthly P&L</CardTitle></CardHeader>
        <CardContent>
          <PLChart data={plSeries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-[15px]">P&L by month</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto px-0">
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
                  <TableCell className="text-right tabular-nums">{fmtMoney(p.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(p.expenses)}</TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${p.profit >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtMoney(p.profit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.margin}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mb-5 mt-8 flex flex-wrap gap-3">
        <Select value={month} onValueChange={(v) => { setMonth(v); resetPage() }}>
          <SelectTrigger className="h-10 w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {(data?.months ?? []).map((m) => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={(v) => { setCat(v); resetPage() }}>
          <SelectTrigger className="h-10 w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
        empty={<EmptyState icon={Receipt} message="No expenses recorded" />}
        renderCard={(e) => (
          <Card className="py-3">
            <CardContent className="space-y-2 px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold">{e.desc}</div>
                  <div className="text-[11px] text-muted-foreground">{fmtDate(e.date)}{e.vendor && ` · ${e.vendor}`}</div>
                </div>
                <Badge variant="secondary">{e.cat}</Badge>
              </div>
              <div className="flex items-center justify-between text-[13px] tabular-nums">
                <span>{fmtMoney(e.amount)} <span className="text-muted-foreground">bill</span></span>
                <span className={e.due > 0 ? 'text-destructive' : 'text-success'}>
                  {fmtMoney(e.due)} <span className="text-muted-foreground">due</span>
                </span>
                <Badge variant={STATUS_VARIANT[e.status]} withDot>{e.status}</Badge>
              </div>
              <div className="flex justify-end gap-1 border-t pt-2">{actions(e)}</div>
            </CardContent>
          </Card>
        )}
      />

      <ExpenseSheet open={sheetOpen} onClose={() => setSheetOpen(false)} expense={editing} />
      {payExpense && <ExpensePayPanel expense={payExpense} onClose={() => setPayFor(null)} />}
    </div>
  )
}
