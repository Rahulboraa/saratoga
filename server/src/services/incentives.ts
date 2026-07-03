export const INCENTIVE_START = '2026-04'

const L5 = 500_000
const L10 = 1_000_000

export function calcDeepak(sales: number) {
  const slab1 = Math.min(sales, L5) * 0.01
  const slab2 = Math.min(Math.max(sales - L5, 0), L5) * 0.015
  const slab3 = Math.max(sales - L10, 0) * 0.03
  return {
    slabs: [
      { label: 'First ₹5L @ 1%', amount: Math.round(slab1) },
      { label: 'Next ₹5L @ 1.5%', amount: Math.round(slab2) },
      { label: 'Above ₹10L @ 3%', amount: Math.round(slab3) },
    ],
    total: Math.round(slab1 + slab2 + slab3),
  }
}

export function calcAkhil(profit: number) {
  return Math.round(Math.max(profit - L5, 0) * 0.05)
}

export function monthIncentive(month: string, sales: number, expenses: number) {
  const profit = sales - expenses
  if (month < INCENTIVE_START) return { month, sales, expenses, profit, deepak: 0, akhil: 0, total: 0 }
  const deepak = calcDeepak(sales).total
  const akhil = calcAkhil(profit)
  return { month, sales, expenses, profit, deepak, akhil, total: deepak + akhil }
}
