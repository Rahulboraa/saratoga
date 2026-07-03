import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'

function toDate(ymd: string): Date | undefined {
  if (!ymd) return undefined
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function DatePicker({ value, onChange, placeholder = 'Pick a date', clearable = false, className }: {
  value: string
  onChange: (ymd: string) => void
  placeholder?: string
  clearable?: boolean
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('w-full justify-start px-3 font-normal', !value && 'text-muted-foreground', className)}
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {value ? fmtDate(value) : placeholder}
          {clearable && value && (
            <span
              role="button"
              tabIndex={0}
              className="ml-auto rounded-sm p-0.5 hover:bg-accent"
              onClick={(e) => { e.stopPropagation(); onChange('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange('') } }}
            >
              <X className="size-3.5 text-muted-foreground" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={toDate(value)}
          defaultMonth={toDate(value)}
          onSelect={(d) => d && onChange(toYmd(d))}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

function timeLabel(hm: string) {
  const [h, m] = hm.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

export function TimeSelect({ value, onChange, allowEmpty = false, className }: {
  value: string
  onChange: (hm: string) => void
  allowEmpty?: boolean
  className?: string
}) {
  const options = value && !TIME_OPTIONS.includes(value) ? [value, ...TIME_OPTIONS] : TIME_OPTIONS
  return (
    <Select value={value || (allowEmpty ? 'none' : value)} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {allowEmpty && <SelectItem value="none">—</SelectItem>}
        {options.map((t) => <SelectItem key={t} value={t}>{timeLabel(t)}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export interface DateRange {
  from: string
  to: string
}

export function DateRangePicker({ value, onChange, placeholder = 'All dates', className }: {
  value: DateRange | null
  onChange: (range: DateRange | null) => void
  placeholder?: string
  className?: string
}) {
  const label = value
    ? value.from === value.to || !value.to
      ? fmtDate(value.from)
      : `${fmtDate(value.from)} – ${fmtDate(value.to)}`
    : placeholder

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('justify-start px-3 font-normal', !value && 'text-muted-foreground', className)}
        >
          <CalendarIcon className="size-5 text-muted-foreground" />
          {label}
          {value && (
            <span
              role="button"
              tabIndex={0}
              className="ml-auto rounded-sm p-0.5 hover:bg-accent"
              onClick={(e) => { e.stopPropagation(); onChange(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(null) } }}
            >
              <X className="size-3.5 text-muted-foreground" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={value ? { from: toDate(value.from), to: value.to ? toDate(value.to) : undefined } : undefined}
          defaultMonth={value ? toDate(value.from) : undefined}
          onSelect={(r) => {
            if (!r?.from) return onChange(null)
            onChange({ from: toYmd(r.from), to: r.to ? toYmd(r.to) : toYmd(r.from) })
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
