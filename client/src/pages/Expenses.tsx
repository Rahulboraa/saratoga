import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Pencil, Trash2, Wallet, Receipt, IndianRupee, Layers } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { fmtMoney, fmtDate, fmtMonth, todayYmd, STATUS_VARIANT, chartWindow } from '@/lib/format'
import type { Expense, ExpensePayment, ExpenseSummary } from '@/types'
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
import ExpenseCategoriesDialog, { useExpenseCategories } from '@/components/ExpenseCategories'

type ExpensesResponse = Paged<Expense> & { months: string[] }

interface ExpenseForm {
  date: string
  cat: string
  desc: string
  amount: number
  vendor: string
  notes: string
  bookingId: string
}

const NO_BOOKING = 'none'

function ExpenseSheet({ open, onClose, expense }: { open: boolean; onClose: () => void; expense?: Expense | null }) {
  const queryClient = useQueryClient()
  const { data: categories = [] } = useExpenseCategories()
  const { data: bookingOptions = [] } = useQuery({
    queryKey: ['bookings', 'options'],
    queryFn: () => api<{ id: string; guest: string; checkinDate: string }[]>('/bookings/options'),
    enabled: open,
    staleTime: 60_000,
  })
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<ExpenseForm>({
    values: {
      date: expense?.date ?? todayYmd(),
      cat: expense?.cat ?? 'Other',
      desc: expense?.desc ?? '',
      amount: expense?.amount ?? 0,
      vendor: expense?.vendor ?? '',
      notes: expense?.notes ?? '',
      bookingId: expense?.bookingId ?? NO_BOOKING,
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
      <SheetContent side="right" size="md" className="flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{expense ? 'Edit expense' : 'Add expense'}</SheetTitle>
          <SheetDescription>Record partial payments against it after saving.</SheetDescription>
        </SheetHeader>
        <form
          onSubmit={handleSubmit((v) => save.mutate({
            ...v,
            amount: +v.amount,
            bookingId: v.bookingId === NO_BOOKING ? null : v.bookingId,
          }))}
          className="flex min-h-0 flex-1 flex-col"
        >
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
                    {categories
                      // A switched-off category stays selectable on the expense already using it.
                      .filter((c) => c.active || c.name === expense?.cat)
                      .map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Description *</Label>
                <Input {...register('desc', { required: true })} aria-invalid={!!errors.desc} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>For booking</Label>
                <Select value={watch('bookingId')} onValueChange={(v) => setValue('bookingId', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BOOKING}>Not tied to a booking</SelectItem>
                    {bookingOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.guest} · {fmtDate(b.checkinDate)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Leave as is for running costs like salary or electricity.</p>
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
      <SheetContent side="right" size="md" className="flex w-full flex-col gap-0 p-0">
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
            <Button onClick={() => { setPayDate(todayYmd()); setShowForm(true) }}>Record payment</Button>
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
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  // Retired categories stay in the filter so their history is still reachable.
  const { data: filterCategories = [] } = useExpenseCategories()
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
          {e.bookingLabel && <div className="truncate text-[11px] text-primary">for {e.bookingLabel}</div>}
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
    { id: 'actions', header: 'Action', meta: { headClass: 'text-right' }, cell: ({ row: { original: e } }) => actions(e) },
  ]

  return (
    <div>
      <PageHeader
        title="Expenses & P&L"
        description="Bills, payments and monthly profit"
        actions={
          <>
            <Select value={month} onValueChange={(v) => { setMonth(v); resetPage() }}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {(data?.months ?? []).map((m) => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
              </SelectContent>
            </Select>
            {(() => {
              const p = new URLSearchParams()
              if (month !== 'all') p.set('month', month)
              if (cat !== 'all') p.set('cat', cat)
              return <ExportButton path="/export/expenses" name="expenses" params={p} />
            })()}
            <Button variant="outline" onClick={() => setCategoriesOpen(true)}>Categories</Button>
            <Button onClick={() => { setEditing(null); setSheetOpen(true) }}>Add expense</Button>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Receipt} tint="info" label="Total Bill" value={fmtMoney(summary?.totalBill)} />
        <StatCard icon={Wallet} tint="success" label="Total Paid" value={fmtMoney(summary?.totalPaid)} />
        <StatCard icon={IndianRupee} tint={(summary?.totalDue ?? 0) > 0 ? 'destructive' : 'foreground'} label="Total Due" value={fmtMoney(summary?.totalDue)} />
        <StatCard icon={Layers} tint="purple" label="Categories" value={summary?.categories.length ?? 0} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-[15px]">Spend by category</CardTitle></CardHeader>
          <CardContent className="flex h-full flex-col justify-center space-y-4 pb-6">
            {(() => {
              const cats = (summary?.categories ?? []).slice().sort((a, b) => b.amount - a.amount)
              const max = Math.max(...cats.map((c) => c.amount), 1)
              const palette = ['hsl(217 91% 60%)', 'hsl(248 85% 66%)', 'hsl(173 66% 42%)', 'hsl(152 60% 44%)', 'hsl(25 95% 53%)', 'hsl(0 79% 63%)', 'hsl(330 77% 60%)', 'hsl(199 89% 48%)', 'hsl(43 90% 50%)', 'hsl(220 15% 60%)']
              const stripes = (color: string) => `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 8px)`
              return cats.map((c, i) => {
                const color = palette[i % palette.length]
                return (
                  <div key={c.cat}>
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className="font-medium">{c.cat}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {c.count} · <span className="font-semibold text-foreground">{fmtMoney(c.amount)}</span>
                      </span>
                    </div>
                    <div className="flex h-5 w-full">
                      <div
                        className="chart-bar-h h-full"
                        style={{ width: `${(c.amount / max) * 100}%`, background: stripes(color), animationDelay: `${i * 50}ms` }}
                      />
                      <div
                        className="h-full flex-1"
                        style={{ background: stripes(`color-mix(in oklch, ${color}, var(--background) 82%)`) }}
                      />
                    </div>
                  </div>
                )
              })
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-[15px]">Monthly P&L</CardTitle></CardHeader>
          <CardContent>
            <PLChart data={chartWindow(summary?.plSeries ?? []).map((p) => ({ ...p, label: fmtMonth(p.month) }))} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-[15px]">P&L by month</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Booked</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Profit / Loss</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Cumulative Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                let cum = 0
                return plSeries.map((p) => {
                  cum += p.profit
                  return (
                    <TableRow key={p.month}>
                      <TableCell>{p.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(p.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(p.expenses)}</TableCell>
                      <TableCell className={`text-right font-medium tabular-nums ${p.profit >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtMoney(p.profit)}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center justify-end gap-2">
                          <span className="tabular-nums">{p.margin}%</span>
                          <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${Math.min(Math.max(p.margin, 0), 100)}%`,
                                background: p.margin >= 0 ? 'hsl(152 60% 44%)' : 'hsl(0 79% 63%)',
                              }}
                            />
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-medium tabular-nums ${cum >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtMoney(cum)}</TableCell>
                    </TableRow>
                  )
                })
              })()}
              {plSeries.length > 0 && (
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(plSeries.reduce((s, p) => s + p.revenue, 0))}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(plSeries.reduce((s, p) => s + p.expenses, 0))}</TableCell>
                  <TableCell className={`text-right tabular-nums ${plSeries.reduce((s, p) => s + p.profit, 0) >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtMoney(plSeries.reduce((s, p) => s + p.profit, 0))}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(() => { const rev = plSeries.reduce((s, p) => s + p.revenue, 0); return rev > 0 ? `${Math.round((plSeries.reduce((s, p) => s + p.profit, 0) / rev) * 100)}%` : '—' })()}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${plSeries.reduce((s, p) => s + p.profit, 0) >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtMoney(plSeries.reduce((s, p) => s + p.profit, 0))}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mb-5 mt-8 flex flex-wrap gap-3">
        <Select value={cat} onValueChange={(v) => { setCat(v); resetPage() }}>
          <SelectTrigger className="h-10 w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {filterCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
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
      <ExpenseCategoriesDialog open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      {payExpense && <ExpensePayPanel expense={payExpense} onClose={() => setPayFor(null)} />}
    </div>
  )
}
