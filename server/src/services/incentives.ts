export const INCENTIVE_START = '2026-04'
// Deepak's slabs were revised with effect from July 2026.
export const DEEPAK_V2_START = '2026-07'

const L5 = 500_000
const L7_5 = 750_000
const L10 = 1_000_000
const L15 = 1_500_000

type Incentive = { slabs: { label: string; amount: number }[]; total: number }

function build(slabs: { label: string; amount: number }[]): Incentive {
  return { slabs, total: slabs.reduce((sum, s) => sum + s.amount, 0) }
}

// Apr–Jun 2026: first 5L @ 1%, 5L–10L @ 1.5%, above 10L @ 3%
export function calcDeepakV1(sales: number): Incentive {
  const s = Math.max(sales, 0)
  return build([
    { label: 'First ₹5L @ 1%', amount: Math.round(Math.min(s, L5) * 0.01) },
    { label: 'Next ₹5L @ 1.5%', amount: Math.round(Math.min(Math.max(s - L5, 0), L5) * 0.015) },
    { label: 'Above ₹10L @ 3%', amount: Math.round(Math.max(s - L10, 0) * 0.03) },
  ])
}

// From Jul 2026: first 5L @ 1.5%, 5L–10L @ 2%, 10L–15L @ 3% (max 32,500);
// once sales cross 15L the slabs are dropped for a flat 5% of total sales.
export function calcDeepakV2(sales: number): Incentive {
  const s = Math.max(sales, 0)
  if (s > L15) return build([{ label: 'Flat 5% of sales (above ₹15L)', amount: Math.round(s * 0.05) }])
  return build([
    { label: 'First ₹5L @ 1.5%', amount: Math.round(Math.min(s, L5) * 0.015) },
    { label: '₹5L–10L @ 2%', amount: Math.round(Math.min(Math.max(s - L5, 0), L5) * 0.02) },
    { label: '₹10L–15L @ 3%', amount: Math.round(Math.min(Math.max(s - L10, 0), L5) * 0.03) },
  ])
}

export function calcDeepak(sales: number, month?: string): Incentive {
  return month && month < DEEPAK_V2_START ? calcDeepakV1(sales) : calcDeepakV2(sales)
}

// Slab on booked sales: first 7.5L @ 1.5%, 7.5L–15L @ 2%, above 15L @ 3%
export function calcAkhil(sales: number) {
  const slab1 = Math.min(Math.max(sales, 0), L7_5) * 0.015
  const slab2 = Math.min(Math.max(sales - L7_5, 0), L15 - L7_5) * 0.02
  const slab3 = Math.max(sales - L15, 0) * 0.03
  return Math.round(slab1 + slab2 + slab3)
}

export function monthIncentive(month: string, sales: number, expenses: number) {
  const profit = sales - expenses
  if (month < INCENTIVE_START) return { month, sales, expenses, profit, deepak: 0, akhil: 0, total: 0 }
  const deepak = calcDeepak(sales, month).total
  const akhil = calcAkhil(sales)
  return { month, sales, expenses, profit, deepak, akhil, total: deepak + akhil }
}
