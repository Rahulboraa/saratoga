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
    <div className="mb-3 flex flex-wrap justify-end gap-x-4 gap-y-1">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="h-2 w-2 rounded-[3px]" style={{ background: s.color }} />
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
          <div className="flex-1 border-t border-dashed border-border/60" />
        </div>
      ))}
    </div>
  )
}

function GroupTooltip({ label, rows }: { label: string; rows: { color: string; label: string; value: string }[] }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/60 bg-card px-3 py-2 text-[11px] text-card-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
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
                <div className="flex h-full w-full max-w-[40px] flex-col-reverse overflow-hidden rounded-t-md">
                  {series.map((sr) => {
                    const v = Number(d[sr.key]) || 0
                    return (
                      <div
                        key={sr.key}
                        className="w-full origin-bottom cursor-help transition-all group-hover:opacity-80"
                        style={{ height: `${(v / max) * 100}%`, background: sr.color }}
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
                      className="w-full max-w-[26px] origin-bottom cursor-help rounded-t-md transition-all group-hover:scale-x-105 group-hover:opacity-80"
                      style={{ height: v > 0 ? `${Math.max((v / max) * 100, 2)}%` : '0%', background: sr.color }}
                    />
                  )
                })
              )}
            </div>
          ))}
        </div>
        {line && (
          <div className="pointer-events-none absolute inset-0 pl-12">
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
  bookedLight: 'hsl(217 91% 82%)',
  blue: 'hsl(221.2 83.2% 53.3%)',
  coral: 'hsl(6 78% 71%)',
  green: 'hsl(142 65% 40%)',
  purple: 'hsl(270 75% 60%)',
  pendingPink: 'hsl(0 72% 87%)',
}

export function RevenueChart({ data }: { data: MoneyPoint[] }) {
  return (
    <Bars
      data={data}
      series={[
        { key: 'booked', label: 'Booked', color: C.bookedLight },
        { key: 'collected', label: 'Collected', color: C.blue },
      ]}
    />
  )
}

export function PLChart({ data }: { data: MoneyPoint[] }) {
  const rows = data.map((d) => ({ ...d, revenue: d.revenue ?? d.collected ?? 0 }))
  return (
    <Bars
      data={rows}
      series={[
        { key: 'revenue', label: 'Revenue', color: C.blue },
        { key: 'expenses', label: 'Expenses', color: C.coral },
      ]}
      line={{ key: 'profit', label: 'Profit', color: C.green }}
    />
  )
}

export function TrendChart({ data }: { data: MoneyPoint[] }) {
  return (
    <Bars
      data={data}
      stacked
      series={[
        { key: 'collected', label: 'Collected', color: C.blue },
        { key: 'pending', label: 'Pending', color: C.pendingPink },
      ]}
    />
  )
}

export function IncentiveTrendChart({ data }: { data: { label: string; deepak: number; akhil: number }[] }) {
  return (
    <Bars
      data={data as unknown as MoneyPoint[]}
      series={[
        { key: 'deepak', label: 'Deepak', color: C.blue },
        { key: 'akhil', label: 'Akhil', color: C.green },
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
              <span className="mb-1 text-[10px] font-medium tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {d.count}
              </span>
              <div
                className="w-full max-w-[40px] origin-bottom cursor-help rounded-t-md transition-all group-hover:scale-x-105 group-hover:opacity-80"
                style={{ height: d.count > 0 ? `${Math.max((d.count / max) * 100, 2)}%` : '0%', background: C.purple }}
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
        const node = (
          <circle
            key={i}
            cx={c} cy={c} r={radius}
            fill="none"
            stroke={d.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${c} ${c})`}
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
