import { describe, it, expect } from 'vitest'
import { calcDeepak, calcDeepakV1, calcDeepakV2, calcAkhil, monthIncentive } from '../services/incentives.js'

describe('calcDeepakV1 (Apr-Jun 2026)', () => {
  it('is 1% up to 5L', () => {
    expect(calcDeepakV1(0).total).toBe(0)
    expect(calcDeepakV1(100_000).total).toBe(1000)
    expect(calcDeepakV1(500_000).total).toBe(5000)
  })

  it('adds 1.5% for 5L-10L', () => {
    expect(calcDeepakV1(600_000).total).toBe(5000 + 1500)
    expect(calcDeepakV1(1_000_000).total).toBe(5000 + 7500)
  })

  it('adds 3% above 10L (legacy example: 12L = 18500)', () => {
    expect(calcDeepakV1(1_200_000).total).toBe(18_500)
  })
})

describe('calcDeepakV2 (from Jul 2026)', () => {
  it('is 1.5% up to 5L (max 7,500)', () => {
    expect(calcDeepakV2(0).total).toBe(0)
    expect(calcDeepakV2(-100_000).total).toBe(0)
    expect(calcDeepakV2(100_000).total).toBe(1_500)
    expect(calcDeepakV2(500_000).total).toBe(7_500)
  })

  it('adds 2% for 5L-10L (max 17,500)', () => {
    expect(calcDeepakV2(600_000).total).toBe(7_500 + 2_000)
    expect(calcDeepakV2(1_000_000).total).toBe(17_500)
  })

  it('adds 3% for 10L-15L (max 32,500)', () => {
    expect(calcDeepakV2(1_200_000).total).toBe(17_500 + 6_000)
    expect(calcDeepakV2(1_500_000).total).toBe(32_500)
  })

  it('switches to a flat 5% of total sales above 15L', () => {
    expect(calcDeepakV2(1_700_000).total).toBe(85_000)
    expect(calcDeepakV2(1_700_000).slabs).toHaveLength(1)
    expect(calcDeepakV2(2_000_000).total).toBe(100_000)
  })
})

describe('calcDeepak', () => {
  it('uses the old slabs before Jul 2026', () => {
    expect(calcDeepak(1_200_000, '2026-06').total).toBe(18_500)
  })

  it('uses the new slabs from Jul 2026 onwards', () => {
    expect(calcDeepak(1_200_000, '2026-07').total).toBe(23_500)
    expect(calcDeepak(1_200_000).total).toBe(23_500)
  })
})

describe('calcAkhil', () => {
  it('is 1.5% on the first 7.5L of booked sales', () => {
    expect(calcAkhil(0)).toBe(0)
    expect(calcAkhil(-200_000)).toBe(0)
    expect(calcAkhil(500_000)).toBe(7_500)
    expect(calcAkhil(750_000)).toBe(11_250)
  })

  it('adds 2% for 7.5L-15L (sheet examples)', () => {
    expect(calcAkhil(760_000)).toBe(11_450) // May
    expect(calcAkhil(860_000)).toBe(13_450) // June
    expect(calcAkhil(1_160_000)).toBe(19_450) // April
    expect(calcAkhil(1_500_000)).toBe(26_250)
  })

  it('adds 3% above 15L', () => {
    expect(calcAkhil(2_000_000)).toBe(11_250 + 15_000 + 15_000)
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

  it('applies from 2026-04 (akhil on booked sales)', () => {
    const out = monthIncentive('2026-04', 1_200_000, 100_000)
    expect(out.deepak).toBe(18_500)
    expect(out.akhil).toBe(20_250) // 11,250 + 450000*2%
    expect(out.total).toBe(38_750)
  })

  it('picks up deepak revised slabs from 2026-07', () => {
    const out = monthIncentive('2026-07', 1_200_000, 100_000)
    expect(out.deepak).toBe(23_500)
    expect(out.akhil).toBe(20_250)
    expect(out.total).toBe(43_750)
  })
})
