export const YMD = /^\d{4}-\d{2}-\d{2}$/
export const HM = /^\d{2}:\d{2}$/

export function istYmd(at: Date) {
  return at.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export function todayYmd() {
  return istYmd(new Date())
}

export function monthOf(date: string) {
  return date.slice(0, 7)
}

export function excelSerialToYmd(serial: number) {
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  return new Date(ms).toISOString().slice(0, 10)
}

export function normalizeDate(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'number' && value > 20000 && value < 80000) return excelSerialToYmd(value)
  const s = String(value).trim()
  if (YMD.test(s)) return s
  if (YMD.test(s.slice(0, 10)) && (s[10] === 'T' || s[10] === ' ')) return s.slice(0, 10)
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return ''
}

export function normalizeNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null) return 0
  const n = Number(String(value).replace(/[₹,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}
