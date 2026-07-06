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
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
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
  showValues?: boolean
  fmt?: (n: number) => string
  tooltipFmt?: (n: number) => string
}

function Bars({ data, series, height = 220, stacked = false, showValues = false, fmt = fmtLakh, tooltipFmt = fmtMoney }: BarsProps) {
  const groupTotal = (d: MoneyPoint) =>
    stacked
      ? series.reduce((s, sr) => s + (Number(d[sr.key]) || 0), 0)
      : Math.max(...series.map((sr) => Number(d[sr.key]) || 0))
  const max = Math.max(...data.map(groupTotal), 1)
  const dense = data.length > 8
  const labels = showValues && !dense
  const groupLabel = showValues && dense
  const yMax = showValues ? max * 1.18 : max

  return (
    <div className="w-full">
      <Legend series={series} />
      <div className="relative" style={{ height }}>
        <Ticks max={yMax} fmt={fmt} />
        <div className="absolute inset-0 flex items-end gap-2 pl-12 pr-1 sm:gap-3">
          {data.map((d, i) => (
            <div key={i} className="group relative flex h-full flex-1 items-end justify-center gap-2.5">
              {groupLabel && groupTotal(d) > 0 && (
                <span
                  className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums text-foreground/75"
                  style={{ bottom: `calc(${(groupTotal(d) / yMax) * 100}% + 3px)` }}
                >
                  {fmt(groupTotal(d))}
                </span>
              )}
              <GroupTooltip
                label={d.label}
                rows={series.map((sr) => ({
                  color: sr.color, label: sr.label, value: tooltipFmt(Number(d[sr.key]) || 0),
                }))}
              />
              {stacked ? (
                <div className="relative flex h-full w-full max-w-[32px] items-end justify-center">
                  {labels && groupTotal(d) > 0 && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums text-foreground/75"
                      style={{ bottom: `calc(${(groupTotal(d) / yMax) * 100}% + 3px)` }}
                    >
                      {fmt(groupTotal(d))}
                    </span>
                  )}
                  <div className="chart-bar flex h-full w-full flex-col-reverse overflow-hidden rounded-[7px] rounded-b-[3px]" style={{ animationDelay: `${i * 45}ms` }}>
                    {series.map((sr) => {
                      const v = Number(d[sr.key]) || 0
                      return (
                        <div
                          key={sr.key}
                          className="w-full cursor-help transition-all group-hover:brightness-105 group-hover:saturate-125"
                          style={{ height: `${(v / yMax) * 100}%`, background: `linear-gradient(to top, ${sr.color}, color-mix(in oklch, ${sr.color}, white 12%))` }}
                        />
                      )
                    })}
                  </div>
                </div>
              ) : (
                series.map((sr, si) => {
                  const v = Number(d[sr.key]) || 0
                  const pct = v > 0 ? Math.max((v / yMax) * 100, 2) : 0
                  const prev = si > 0 ? Math.max(((Number(d[series[si - 1].key]) || 0) / yMax) * 100, 2) : -100
                  const lift = si > 0 && v > 0 && Math.abs(pct - prev) < 7 ? 16 : 3
                  return (
                    <div key={sr.key} className="relative flex h-full w-full max-w-[24px] items-end justify-center">
                      {labels && v > 0 && (
                        <span
                          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums text-foreground/75"
                          style={{ bottom: `calc(${pct}% + ${lift}px)` }}
                        >
                          {fmt(v)}
                        </span>
                      )}
                      <div
                        className="chart-bar w-full cursor-help rounded-[6px] rounded-b-[2px] transition-all group-hover:brightness-105 group-hover:saturate-125"
                        style={barStyle(sr.color, pct, i)}
                      />
                    </div>
                  )
                })
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-2 pl-12 pr-1 sm:gap-3">
        {data.map((d, i) => (
          <div key={i} className={cn('flex-1 truncate text-center font-medium text-muted-foreground', dense ? 'text-[10.5px]' : 'text-[10px]')} title={d.label}>
            {dense ? d.label.split("'")[0] : d.label}
          </div>
        ))}
      </div>
    </div>
  )
}

const C = {
  blue: 'hsl(217 91% 60%)',
  blueSoft: 'hsl(215 70% 88%)',
  violet: 'hsl(248 85% 66%)',
  teal: 'hsl(173 66% 42%)',
  green: 'hsl(152 60% 44%)',
  orange: 'hsl(25 95% 53%)',
  red: 'hsl(0 79% 63%)',
  track: 'var(--muted)',
}

function barStyle(color: string, heightPct: number, index: number): CSSProperties {
  return {
    height: `${heightPct}%`,
    background: `linear-gradient(to top, ${color}, color-mix(in oklch, ${color}, white 24%))`,
    animationDelay: `${index * 45}ms`,
  }
}

export function RevenueChart({ data }: { data: MoneyPoint[] }) {
  return (
    <Bars
      data={data}
      showValues
      series={[
        { key: 'booked', label: 'Booked', color: C.blueSoft },
        { key: 'collected', label: 'Collected', color: C.blue },
      ]}
    />
  )
}

export function PLChart({ data }: { data: MoneyPoint[] }) {
  const rows = data.map((d) => ({ ...d, revenue: d.revenue ?? d.collected ?? 0 }))
  const dense = rows.length > 8
  if (!rows.length) return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No data yet</div>
  return (
    <div className="w-full">
      <Bars
        data={rows}
        showValues
        series={[
          { key: 'revenue', label: 'Revenue', color: C.blue },
          { key: 'expenses', label: 'Expenses', color: C.orange },
        ]}
      />
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-dashed border-border/60 pt-2">
        <span className="w-[42px] shrink-0 text-right text-[10px] font-medium text-muted-foreground">Profit</span>
        <div className="flex flex-1 gap-2 pr-1 sm:gap-3">
          {rows.map((d, i) => {
            const p = d.profit ?? 0
            return (
              <div
                key={i}
                className={cn('flex-1 whitespace-nowrap text-center font-semibold tabular-nums', dense ? 'text-[10px]' : 'text-[11px]', p >= 0 ? 'text-emerald-600' : 'text-red-600')}
                title={fmtMoney(p)}
              >
                {p < 0 ? '-' : ''}{fmtLakh(Math.abs(p))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function TrendChart({ data }: { data: MoneyPoint[] }) {
  return (
    <Bars
      data={data}
      stacked
      showValues
      series={[
        { key: 'collected', label: 'Collected', color: C.blue },
        { key: 'pending', label: 'Pending', color: C.track },
      ]}
    />
  )
}

export function IncentiveTrendChart({ data }: { data: { label: string; deepak: number; akhil: number }[] }) {
  return (
    <Bars
      data={data as unknown as MoneyPoint[]}
      showValues
      series={[
        { key: 'deepak', label: 'Deepak', color: C.blue },
        { key: 'akhil', label: 'Akhil', color: C.teal },
      ]}
    />
  )
}

export function CountChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  const current = data.length - 1
  return (
    <div className="w-full">
      <div className="relative" style={{ height: 220 }}>
        <Ticks max={max} fmt={(n) => String(n)} />
        <div className="absolute inset-0 flex items-end gap-2 pl-12 pr-1 sm:gap-3">
          {data.map((d, i) => (
            <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              <GroupTooltip label={d.label} rows={[{ color: i === current ? C.violet : C.track, label: 'Bookings', value: String(d.count) }]} />
              <span className={cn('mb-1 text-[10px] font-semibold tabular-nums', i === current ? 'text-foreground' : 'text-foreground/60')}>
                {d.count}
              </span>
              <div
                className="chart-bar w-full max-w-[30px] cursor-help rounded-[7px] rounded-b-[3px] transition-all group-hover:brightness-[1.03]"
                style={{
                  height: `${d.count > 0 ? Math.max((d.count / max) * 100, 2) : 0}%`,
                  animationDelay: `${i * 45}ms`,
                  background: i === current
                    ? `repeating-linear-gradient(135deg, ${C.violet} 0 5px, color-mix(in oklch, ${C.violet}, white 22%) 5px 9px)`
                    : `linear-gradient(to top, ${C.track}, color-mix(in oklch, ${C.track}, white 30%))`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-2 pl-12 pr-1 sm:gap-3">
        {data.map((d, i) => (
          <div key={i} className={cn('flex-1 truncate text-center font-medium text-muted-foreground', data.length > 8 ? 'text-[10.5px]' : 'text-[10px]')} title={d.label}>
            {data.length > 8 ? d.label.split("'")[0] : d.label}
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
