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

export function nowHm() {
  return new Date().toTimeString().slice(0, 5)
}

export const PURPOSE_COLORS: Record<string, string> = {
  'Party': '#7B6EF6',
  'Shoot': '#1D9E75',
  'Pre-wedding': '#D4537E',
  'Kids Birthday': '#F0A500',
  'Other': '#888780',
}

export const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive'> = {
  paid: 'success',
  partial: 'warning',
  pending: 'destructive',
}
