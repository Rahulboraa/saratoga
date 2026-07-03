import { describe, it, expect } from 'vitest'
import { calcDeepak, calcAkhil, monthIncentive } from '../services/incentives.js'

describe('calcDeepak', () => {
  it('is 1% up to 5L', () => {
    expect(calcDeepak(0).total).toBe(0)
    expect(calcDeepak(100_000).total).toBe(1000)
    expect(calcDeepak(500_000).total).toBe(5000)
  })

  it('adds 1.5% for 5L-10L', () => {
    expect(calcDeepak(600_000).total).toBe(5000 + 1500)
    expect(calcDeepak(1_000_000).total).toBe(5000 + 7500)
  })

  it('adds 3% above 10L (legacy example: 12L = 18500)', () => {
    expect(calcDeepak(1_200_000).total).toBe(18_500)
  })
})

describe('calcAkhil', () => {
  it('is 0 at or below 5L profit', () => {
    expect(calcAkhil(0)).toBe(0)
    expect(calcAkhil(500_000)).toBe(0)
    expect(calcAkhil(-200_000)).toBe(0)
  })

  it('is 5% of profit above 5L', () => {
    expect(calcAkhil(700_000)).toBe(10_000)
    expect(calcAkhil(1_500_000)).toBe(50_000)
  })
})

describe('monthIncentive', () => {
  it('is zero before 2026-04', () => {
    const out = monthIncentive('2026-03', 1_200_000, 100_000)
    expect(out.deepak).toBe(0)
    expect(out.akhil).toBe(0)
    expect(out.total).toBe(0)
    expect(out.profit).toBe(1_100_000)
  })

  it('applies from 2026-04', () => {
    const out = monthIncentive('2026-04', 1_200_000, 100_000)
    expect(out.deepak).toBe(18_500)
    expect(out.akhil).toBe(30_000)
    expect(out.total).toBe(48_500)
  })
})
