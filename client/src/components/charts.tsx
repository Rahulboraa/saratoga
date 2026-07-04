import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { fmtLakh, fmtMoney } from '@/lib/format'

interface Series {
  key: string
  label: string
  color: string
}

export interface MoneyPoint {
  label: string
  booked?: number
  collected?: number
  pending?: number
  expenses?: number
  profit?: number
  revenue?: number
  [key: string]: string | number | undefined
}

function Legend({ series }: { series: Series[] }) {
  return (
    <div className="mb-4 flex flex-wrap justify-end gap-x-5 gap-y-1.5">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground/80">
          <span className="h-3 w-3 rounded-[4px]" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

function Ticks({ max, fmt }: { max: number; fmt: (n: number) => string }) {
  const ticks = 4
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
      {Array.from({ length: ticks }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">
            {fmt(Math.round(max * (1 - i / (ticks - 1))))}
          </span>
          <div className="flex-1 border-t border-dashed border-border/40" />
        </div>
      ))}
    </div>
  )
}

function GroupTooltip({ label, rows }: { label: string; rows: { color: string; label: string; value: string }[] }) {
  return (
    <div className="pointer-events-none absolute -top-1 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-[12px] text-card-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
      <div className="mb-1 font-semibold">{label}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px]" style={{ background: r.color }} />
          <span className="text-muted-foreground">{r.label}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

interface BarsProps {
  data: MoneyPoint[]
  series: Series[]
  height?: number
  stacked?: boolean
  line?: Series
  fmt?: (n: number) => string
  tooltipFmt?: (n: number) => string
}

function Bars({ data, series, height = 220, stacked = false, line, fmt = fmtLakh, tooltipFmt = fmtMoney }: BarsProps) {
  const groupTotal = (d: MoneyPoint) =>
    stacked
      ? series.reduce((s, sr) => s + (Number(d[sr.key]) || 0), 0)
      : Math.max(...series.map((sr) => Number(d[sr.key]) || 0))
  const max = Math.max(...data.map(groupTotal), ...(line ? data.map((d) => Number(d[line.key]) || 0) : []), 1)

  const linePoints = line
    ? data.map((d, i) => {
        const v = Math.max(Number(d[line.key]) || 0, 0)
        return `${((i + 0.5) / data.length) * 100},${100 - (v / max) * 100}`
      }).join(' ')
    : ''

  return (
    <div className="w-full">
      <Legend series={line ? [...series, line] : series} />
      <div className="relative" style={{ height }}>
        <Ticks max={max} fmt={fmt} />
        <div className="absolute inset-0 flex items-end gap-1.5 pl-12">
          {data.map((d, i) => (
            <div key={i} className="group relative flex h-full flex-1 items-end justify-center gap-1">
              <GroupTooltip
                label={d.label}
                rows={[...series, ...(line ? [line] : [])].map((sr) => ({
                  color: sr.color, label: sr.label, value: tooltipFmt(Number(d[sr.key]) || 0),
                }))}
              />
              {stacked ? (
                <div className="chart-bar flex h-full w-full max-w-[32px] flex-col-reverse overflow-hidden rounded-t-[5px]" style={{ animationDelay: `${i * 45}ms` }}>
                  {series.map((sr) => {
                    const v = Number(d[sr.key]) || 0
                    return (
                      <div
                        key={sr.key}
                        className="w-full cursor-help transition-all group-hover:brightness-105 group-hover:saturate-125"
                        style={{ height: `${(v / max) * 100}%`, background: `linear-gradient(to top, ${sr.color}, color-mix(in oklch, ${sr.color}, white 12%))` }}
                      />
                    )
                  })}
                </div>
              ) : (
                series.map((sr) => {
                  const v = Number(d[sr.key]) || 0
                  return (
                    <div
                      key={sr.key}
                      className="chart-bar w-full max-w-[26px] cursor-help rounded-t-[5px] transition-all group-hover:brightness-105 group-hover:saturate-125"
                      style={barStyle(sr.color, v > 0 ? Math.max((v / max) * 100, 2) : 0, i)}
                    />
                  )
                })
              )}
            </div>
          ))}
        </div>
        {line && (
          <div className="chart-line pointer-events-none absolute inset-0 pl-12">
            <div className="relative h-full">
              <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  points={linePoints}
                  fill="none"
                  stroke={line.color}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              </svg>
              {data.map((d, i) => {
                const v = Math.max(Number(d[line.key]) || 0, 0)
                return (
                  <span
                    key={i}
                    className="absolute h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-background"
                    style={{
                      left: `${((i + 0.5) / data.length) * 100}%`,
                      bottom: `${(v / max) * 100}%`,
                      background: line.color,
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-1.5 pl-12">
        {data.map((d, i) => (
          <div key={i} className="flex-1 truncate text-center text-[10px] font-medium text-muted-foreground" title={d.label}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}

const C = {
  indigoSoft: 'hsl(230 75% 85%)',
  indigo: 'hsl(230 80% 62%)',
  violet: 'hsl(262 83% 58%)',
  electric: 'hsl(199 89% 48%)',
  crimson: 'hsl(0 72% 62%)',
  lavender: 'hsl(255 35% 88%)',
}

function barStyle(color: string, heightPct: number, index: number): CSSProperties {
  return {
    height: `${heightPct}%`,
    background: `linear-gradient(to top, ${color}, color-mix(in oklch, ${color}, white 18%))`,
    animationDelay: `${index * 45}ms`,
  }
}

export function RevenueChart({ data }: { data: MoneyPoint[] }) {
  return (
    <Bars
      data={data}
      series={[
        { key: 'booked', label: 'Booked', color: C.indigoSoft },
        { key: 'collected', label: 'Collected', color: C.indigo },
      ]}
    />
  )
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(i + 2, pts.length - 1)]
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`
  }
  return d
}

export function PLChart({ data }: { data: MoneyPoint[] }) {
  const rows = data.map((d) => ({ ...d, revenue: d.revenue ?? d.collected ?? 0 }))
  const series = [
    { key: 'revenue', label: 'Revenue', color: C.indigo },
    { key: 'expenses', label: 'Expenses', color: C.crimson },
    { key: 'profit', label: 'Profit', color: C.electric },
  ]
  const max = Math.max(...rows.flatMap((d) => [d.revenue ?? 0, d.expenses ?? 0, Math.max(d.profit ?? 0, 0)]), 1)
  const pt = (v: number, i: number) => ({ x: ((i + 0.5) / rows.length) * 100, y: 100 - (Math.max(v, 0) / max) * 100 })
  const revenuePts = rows.map((d, i) => pt(d.revenue ?? 0, i))
  const expensePts = rows.map((d, i) => pt(d.expenses ?? 0, i))
  const profitPts = rows.map((d, i) => pt(Math.max(d.profit ?? 0, 0), i))
  if (!rows.length) return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No data yet</div>
  const area = (pts: { x: number; y: number }[]) =>
    pts.length < 2
      ? `M ${pts[0].x - 4} ${pts[0].y} L ${pts[0].x + 4} ${pts[0].y} L ${pts[0].x + 4} 100 L ${pts[0].x - 4} 100 Z`
      : `${smoothPath(pts)} L ${pts[pts.length - 1].x} 100 L ${pts[0].x} 100 Z`

  return (
    <div className="w-full">
      <Legend series={series} />
      <div className="relative" style={{ height: 220 }}>
        <Ticks max={max} fmt={fmtLakh} />
        <div className="absolute inset-0 pl-12">
          <div className="relative h-full">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="pl-rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={C.indigo} stopOpacity="0.28" />
                  <stop offset="1" stopColor={C.indigo} stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="pl-exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={C.crimson} stopOpacity="0.22" />
                  <stop offset="1" stopColor={C.crimson} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={area(revenuePts)} fill="url(#pl-rev)" className="chart-line" />
              <path d={smoothPath(revenuePts)} fill="none" stroke={C.indigo} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
              <path d={area(expensePts)} fill="url(#pl-exp)" className="chart-line" />
              <path d={smoothPath(expensePts)} fill="none" stroke={C.crimson} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
              <path d={profitPts.length < 2 ? `M ${profitPts[0].x - 4} ${profitPts[0].y} L ${profitPts[0].x + 4} ${profitPts[0].y}` : smoothPath(profitPts)} fill="none" stroke={C.electric} strokeWidth="2.5" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            {rows.map((d, i) => (
              <span
                key={i}
                className="absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-background shadow-sm"
                style={{ left: `${((i + 0.5) / rows.length) * 100}%`, bottom: `${(Math.max(d.profit ?? 0, 0) / max) * 100}%`, background: C.electric }}
              />
            ))}
            <div className="absolute inset-0 flex">
              {rows.map((d, i) => (
                <div key={i} className="group relative h-full flex-1">
                  <GroupTooltip
                    label={d.label}
                    rows={series.map((sr) => ({ color: sr.color, label: sr.label, value: fmtMoney(Number(d[sr.key as 'revenue' | 'expenses' | 'profit']) || 0) }))}
                  />
                  <div className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-border group-hover:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-1.5 pl-12">
        {rows.map((d, i) => (
          <div key={i} className="flex-1 truncate text-center text-[10px] font-medium text-muted-foreground" title={d.label}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export function TrendChart({ data }: { data: MoneyPoint[] }) {
  return (
    <Bars
      data={data}
      stacked
      series={[
        { key: 'collected', label: 'Collected', color: C.indigo },
        { key: 'pending', label: 'Pending', color: C.lavender },
      ]}
    />
  )
}

export function IncentiveTrendChart({ data }: { data: { label: string; deepak: number; akhil: number }[] }) {
  return (
    <Bars
      data={data as unknown as MoneyPoint[]}
      series={[
        { key: 'deepak', label: 'Deepak', color: C.indigo },
        { key: 'akhil', label: 'Akhil', color: C.electric },
      ]}
    />
  )
}

export function CountChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="w-full">
      <div className="relative" style={{ height: 220 }}>
        <Ticks max={max} fmt={(n) => String(n)} />
        <div className="absolute inset-0 flex items-end gap-1.5 pl-12">
          {data.map((d, i) => (
            <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              <GroupTooltip label={d.label} rows={[{ color: C.violet, label: 'Bookings', value: String(d.count) }]} />
              <span className="mb-1 text-[10px] font-medium tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {d.count}
              </span>
              <div
                className="chart-bar w-full max-w-[34px] cursor-help rounded-t-[5px] transition-all group-hover:brightness-105 group-hover:saturate-125"
                style={barStyle(C.violet, d.count > 0 ? Math.max((d.count / max) * 100, 2) : 0, i)}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-1.5 pl-12">
        {data.map((d, i) => (
          <div key={i} className="flex-1 truncate text-center text-[10px] font-medium text-muted-foreground" title={d.label}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DonutChart({ data, size = 190, thickness = 18, centerLabel, centerSubLabel, className }: {
  data: { label: string; value: number; color: string }[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerSubLabel?: string
  className?: string
}) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1
  const radius = (size - thickness) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn('block', className)}>
      <circle cx={c} cy={c} r={radius} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
      {data.map((d, i) => {
        const dash = (d.value / total) * circumference
        const gap = data.length > 1 ? Math.min(4, dash * 0.15) : 0
        const node = (
          <circle
            key={i}
            cx={c} cy={c} r={radius}
            fill="none"
            stroke={d.color}
            strokeWidth={thickness}
            strokeLinecap={data.length > 1 ? 'round' : 'butt'}
            strokeDasharray={`${Math.max(dash - gap, 0.5)} ${circumference - Math.max(dash - gap, 0.5)}`}
            strokeDashoffset={-offset - gap / 2}
            transform={`rotate(-90 ${c} ${c})`}
            className="transition-all hover:brightness-105"
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          >
            <title>{`${d.label}: ${d.value}`}</title>
          </circle>
        )
        offset += dash
        return node
      })}
      {centerLabel && (
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" dy={centerSubLabel ? '-6' : '0'}
          style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', fill: 'var(--foreground)' }}>
          {centerLabel}
        </text>
      )}
      {centerSubLabel && (
        <text x="50%" y="50%" dy="14" dominantBaseline="central" textAnchor="middle"
          style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', fill: 'var(--muted-foreground)' }}>
          {centerSubLabel}
        </text>
      )}
    </svg>
  )
}
