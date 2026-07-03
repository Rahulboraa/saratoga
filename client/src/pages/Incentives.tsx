import { useState } from 'react'
import { Coins } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import { api } from '@/lib/api'
import { fmtMoney, fmtLakh, fmtMonth } from '@/lib/format'
import type { IncentiveStats } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'

const tooltipStyle = { background: '#fff', border: '1px solid hsl(240 6% 90%)', borderRadius: 8, fontSize: 12, color: 'hsl(240 8% 12%)' }

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
        description="Effective April 2026 · Deepak: slab on collected sales · Akhil: 5% of profit above ₹5L"
        actions={<Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All-time</SelectItem>
            {data.trend.map((t) => <SelectItem key={t.month} value={t.month}>{fmtMonth(t.month)}</SelectItem>)}
          </SelectContent>
        </Select>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="px-5 py-4">
            <div className="text-[13px] font-medium">Deepak — Sales Incentive</div>
            <div className="mt-2 text-[30px] font-semibold tracking-tight tabular-nums leading-none">{fmtMoney(sel.deepak)}</div>
            <div className="mt-1 text-xs text-muted-foreground">on {fmtMoney(sel.sales)} collected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-5 py-4">
            <div className="text-[13px] font-medium">Akhil — Profit Share</div>
            <div className="mt-2 text-[30px] font-semibold tracking-tight tabular-nums leading-none">{fmtMoney(sel.akhil)}</div>
            <div className="mt-1 text-xs text-muted-foreground">on {fmtMoney(sel.profit)} profit</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-[15px]">Incentive Slabs</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Rule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Deepak</TableCell>
                <TableCell>First ₹5L @ 1% · Next ₹5L @ 1.5% · Above ₹10L @ 3% (on monthly collected sales)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Akhil</TableCell>
                <TableCell>5% of monthly profit above ₹5L threshold (no incentive up to ₹5L)</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-[15px]">Monthly Incentive Trend</CardTitle></CardHeader>
        <CardContent className="h-64">
          {trend.length === 0 ? (
            <EmptyState icon={Coins} message="No incentive data yet" description="Incentives apply from April 2026 onward." />
          ) : (
            <ResponsiveContainer>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtLakh} tick={{ fontSize: 11 }} width={52} />
                <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="deepak" name="Deepak" fill="#3266ad" radius={[3, 3, 0, 0]} />
                <Bar dataKey="akhil" name="Akhil" fill="#1D9E75" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {trend.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-[15px]">Month-wise Breakdown</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Sales Collected</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Deepak</TableHead>
                  <TableHead className="text-right">Akhil</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trend.map((t) => (
                  <TableRow key={t.month}>
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
