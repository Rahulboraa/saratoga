import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { IncentiveTrendChart } from '@/components/charts'
import { fmtMoney, fmtMonth, chartWindow } from '@/lib/format'
import type { IncentiveStats } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import StatCard from '@/components/StatCard'
import ExportButton from '@/components/ExportButton'
import { Coins, TrendingUp } from 'lucide-react'

export default function Incentives() {
  const [month, setMonth] = useState('all')
  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'incentives', month],
    queryFn: () => api<IncentiveStats>(`/stats/incentives?month=${month}`),
  })

  if (isLoading || !data) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
  }

  const trend = data.trend.map((t) => ({ ...t, label: fmtMonth(t.month) }))
  const sel = data.selected

  return (
    <div>
      <PageHeader
        title="Incentives"
        description="Effective April 2026 · Deepak & Akhil: slab on booked sales"
        actions={<><ExportButton path="/export/incentives" name="incentives" /><Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All-time</SelectItem>
            {data.trend.map((t) => <SelectItem key={t.month} value={t.month}>{fmtMonth(t.month)}</SelectItem>)}
          </SelectContent>
        </Select></>}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard icon={Coins} tint="info" label="Deepak · Sales Incentive" value={fmtMoney(sel.deepak)} hint={`on ${fmtMoney(sel.sales)} booked`} />
        <StatCard icon={TrendingUp} tint="success" label="Akhil · Sales Incentive" value={fmtMoney(sel.akhil)} hint={`on ${fmtMoney(sel.sales)} booked`} />
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-[15px]">Incentive slabs</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Rule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Deepak<div className="text-xs font-normal text-muted-foreground">from Jul 2026</div></TableCell>
                <TableCell>First ₹5L @ 1.5% · ₹5L–10L @ 2% · ₹10L–15L @ 3% (max ₹32,500) · above ₹15L a flat 5% of total booked sales</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Deepak<div className="text-xs font-normal text-muted-foreground">Apr–Jun 2026</div></TableCell>
                <TableCell>First ₹5L @ 1% · Next ₹5L @ 1.5% · Above ₹10L @ 3% (on monthly booked sales)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Akhil</TableCell>
                <TableCell>First ₹7.5L @ 1.5% · ₹7.5L–15L @ 2% · Above ₹15L @ 3% (on monthly booked sales)</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-[15px]">Monthly incentive trend</CardTitle></CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <EmptyState icon={Coins} message="No incentive data yet" description="Incentives apply from April 2026 onward." />
          ) : (
            <IncentiveTrendChart data={chartWindow(data.trend).map((t) => ({ ...t, label: fmtMonth(t.month) }))} />
          )}
        </CardContent>
      </Card>

      {trend.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-[15px]">Month-wise breakdown</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">S.No</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Booked Sales</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Deepak</TableHead>
                  <TableHead className="text-right">Akhil</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trend.map((t, i) => (
                  <TableRow key={t.month}>
                    <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>{t.label}</TableCell>
                    <TableCell className="text-right">{fmtMoney(t.sales)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(t.expenses)}</TableCell>
                    <TableCell className={`text-right ${t.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtMoney(t.profit)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(t.deepak)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(t.akhil)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(t.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
