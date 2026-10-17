import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Landmark, X } from 'lucide-react'
import { api } from '@/lib/api'
import { fmtMoney, fmtDate, fmtMonth, currentMonth } from '@/lib/format'
import type { AccountReport } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/EmptyState'
import StatCard from '@/components/StatCard'
import { PageHeader } from '@/components/PageHeader'

export default function Accounts() {
  const [month, setMonth] = useState(currentMonth())
  const [account, setAccount] = useState<string | null>(null)

  const params = new URLSearchParams({ month })
  if (account) params.set('account', account)

  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'accounts', params.toString()],
    queryFn: () => api<AccountReport>(`/stats/accounts?${params}`),
  })

  const monthOptions = [...new Set([currentMonth(), ...(data?.months ?? [])])].sort().reverse()
  const accounts = data?.accounts ?? []
  const payments = data?.payments ?? []

  return (
    <div>
      <PageHeader title="Accounts" description="Payments received, by the account they landed in" />

      <div className="mb-5 flex flex-wrap gap-3">
        <Select value={month} onValueChange={(v) => { setMonth(v); setAccount(null) }}>
          <SelectTrigger className="h-9 w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {monthOptions.map((m) => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        {account && (
          <Button variant="outline" size="sm" className="h-9" onClick={() => setAccount(null)}>
            <X className="mr-1.5 size-4" /> {account}
          </Button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard icon={Banknote} tint="success" label="Received" value={fmtMoney(data?.total ?? 0)} hint={month === 'all' ? 'All time' : fmtMonth(month)} />
        <StatCard icon={Landmark} tint="info" label="Accounts used" value={String(accounts.length)} />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={Banknote} message="No payments in this period" description="Pick another month to see where money came in." />
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-[15px]">By account</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                    <TableHead className="text-right">Last received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => (
                    <TableRow
                      key={a.account}
                      className={`cursor-pointer ${account === a.account ? 'bg-accent/50' : ''}`}
                      onClick={() => setAccount(account === a.account ? null : a.account)}
                    >
                      <TableCell className="font-medium">{a.account}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmtMoney(a.received)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{a.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.share}%</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtDate(a.lastDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">
                {account ? `Payments into ${account}` : 'All payments'}
                <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                  {payments.length >= 200 ? 'latest 200' : `${payments.length} shown`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Received by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(p.date)}</TableCell>
                      <TableCell className="font-medium">{p.guest || '—'}</TableCell>
                      <TableCell><Badge variant="secondary">{p.account}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{p.method || '—'}</TableCell>
                      <TableCell className={`text-right tabular-nums ${p.amount < 0 ? 'text-destructive' : ''}`}>
                        {fmtMoney(p.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.by || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
