import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig,
} from '@/components/ui/chart'
import { fmtLakh, fmtMoney } from '@/lib/format'

const CHART_CLASS = 'aspect-auto h-64 w-full'

const moneyTooltip = (
  <ChartTooltip content={<ChartTooltipContent formatter={(value, name, item) => (
    <>
      <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: (item as { color?: string }).color }} />
      <span className="text-muted-foreground">{String(name)}</span>
      <span className="ml-auto font-mono font-medium tabular-nums text-foreground">{fmtMoney(Number(value))}</span>
    </>
  )} />} />
)

const grid = <CartesianGrid strokeDasharray="3 3" vertical={false} />
const xAxis = <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
const moneyYAxis = <YAxis tickFormatter={fmtLakh} tickLine={false} axisLine={false} width={52} />

export interface MoneyPoint {
  label: string
  booked?: number
  collected?: number
  pending?: number
  expenses?: number
  profit?: number
  revenue?: number
}

const revenueConfig = {
  booked: { label: 'Booked', color: 'hsl(217 91% 82%)' },
  collected: { label: 'Collected', color: 'hsl(221.2 83.2% 53.3%)' },
} satisfies ChartConfig

export function RevenueChart({ data }: { data: MoneyPoint[] }) {
  return (
    <ChartContainer config={revenueConfig} className={CHART_CLASS}>
      <BarChart data={data}>
        {grid}{xAxis}{moneyYAxis}
        {moneyTooltip}
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="booked" fill="var(--color-booked)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="collected" fill="var(--color-collected)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

const plConfig = {
  revenue: { label: 'Revenue', color: 'hsl(221.2 83.2% 53.3%)' },
  expenses: { label: 'Expenses', color: 'hsl(6 78% 71%)' },
  profit: { label: 'Profit', color: 'hsl(142 65% 40%)' },
} satisfies ChartConfig

export function PLChart({ data }: { data: MoneyPoint[] }) {
  const rows = data.map((d) => ({ ...d, revenue: d.revenue ?? d.collected ?? 0 }))
  return (
    <ChartContainer config={plConfig} className={CHART_CLASS}>
      <ComposedChart data={rows}>
        {grid}{xAxis}{moneyYAxis}
        {moneyTooltip}
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[3, 3, 0, 0]} />
        <Line dataKey="profit" stroke="var(--color-profit)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-profit)' }} />
      </ComposedChart>
    </ChartContainer>
  )
}

const countConfig = {
  count: { label: 'Bookings', color: 'hsl(270 75% 60%)' },
} satisfies ChartConfig

export function CountChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ChartContainer config={countConfig} className={CHART_CLASS}>
      <BarChart data={data}>
        {grid}{xAxis}
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

const trendConfig = {
  collected: { label: 'Collected', color: 'hsl(221.2 83.2% 53.3%)' },
  pending: { label: 'Pending', color: 'hsl(0 72% 87%)' },
} satisfies ChartConfig

export function TrendChart({ data }: { data: MoneyPoint[] }) {
  return (
    <ChartContainer config={trendConfig} className={CHART_CLASS}>
      <BarChart data={data}>
        {grid}{xAxis}{moneyYAxis}
        {moneyTooltip}
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="collected" stackId="a" fill="var(--color-collected)" />
        <Bar dataKey="pending" stackId="a" fill="var(--color-pending)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

const incentiveConfig = {
  deepak: { label: 'Deepak', color: 'hsl(221.2 83.2% 53.3%)' },
  akhil: { label: 'Akhil', color: 'hsl(142 65% 40%)' },
} satisfies ChartConfig

export function IncentiveTrendChart({ data }: { data: { label: string; deepak: number; akhil: number }[] }) {
  return (
    <ChartContainer config={incentiveConfig} className={CHART_CLASS}>
      <BarChart data={data}>
        {grid}{xAxis}{moneyYAxis}
        {moneyTooltip}
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="deepak" fill="var(--color-deepak)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="akhil" fill="var(--color-akhil)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
