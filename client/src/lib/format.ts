const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function fmtMoney(n: number | undefined | null) {
  return inr.format(n ?? 0)
}

export function fmtLakh(n: number) {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)}k`
  return `₹${n}`
}

export function fmtDate(ymd: string | undefined) {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }).replace(' ', "'")
}

export function todayYmd() {
  return new Date().toLocaleDateString('en-CA')
}

export function currentMonth() {
  return todayYmd().slice(0, 7)
}

export function chartWindow<T extends { month: string }>(rows: T[], back = 8, fwd = 4): T[] {
  const [y, m] = currentMonth().split('-').map(Number)
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const from = shift(-back)
  const to = shift(fwd)
  const win = rows.filter((r) => r.month >= from && r.month <= to)
  return win.length ? win : rows.slice(-(back + fwd + 1))
}

export function nowHm() {
  return new Date().toTimeString().slice(0, 5)
}

export const PURPOSE_COLORS: Record<string, string> = {
  'Birthday/Anniversary': '#F0A500',
  'Corporate Party': '#7B6EF6',
  'Kitty / Private Party': '#E0609A',
  'Wedding/Pre-wedding': '#D4537E',
  'Shoot': '#1D9E75',
  'Stays': '#2F8FD6',
  'Other': '#888780',
  // Anything left over from the old lists still gets a colour rather than nothing.
  'Party': '#7B6EF6',
  'Pre-wedding': '#D4537E',
  'Kids Birthday': '#F0A500',
}

export const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive'> = {
  paid: 'success',
  partial: 'warning',
  pending: 'destructive',
}
