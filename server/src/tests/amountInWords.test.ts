import { describe, it, expect } from 'vitest'
import { amountInWords } from '../../../client/src/lib/amountInWords.js'

describe('writing a rupee figure out', () => {
  it('handles the small cases', () => {
    expect(amountInWords(0)).toBe('Rupees Zero Only')
    expect(amountInWords(1)).toBe('Rupees One Only')
    expect(amountInWords(15)).toBe('Rupees Fifteen Only')
    expect(amountInWords(42)).toBe('Rupees Forty Two Only')
    expect(amountInWords(100)).toBe('Rupees One Hundred Only')
    expect(amountInWords(118)).toBe('Rupees One Hundred Eighteen Only')
  })

  it('groups in lakh and crore, not millions', () => {
    expect(amountInWords(50_000)).toBe('Rupees Fifty Thousand Only')
    expect(amountInWords(1_00_000)).toBe('Rupees One Lakh Only')
    expect(amountInWords(2_50_000)).toBe('Rupees Two Lakh Fifty Thousand Only')
    expect(amountInWords(1_00_00_000)).toBe('Rupees One Crore Only')
    expect(amountInWords(1_23_45_678)).toBe('Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only')
  })

  it('skips the groups that are empty', () => {
    // Ten lakh and five hundred: no lakh-thousands, no tens of thousands.
    expect(amountInWords(10_00_500)).toBe('Rupees Ten Lakh Five Hundred Only')
  })

  it('rounds to the rupee, since paise never reach these bills', () => {
    expect(amountInWords(59_000.4)).toBe('Rupees Fifty Nine Thousand Only')
    expect(amountInWords(59_000.6)).toBe('Rupees Fifty Nine Thousand One Only')
  })

  it('says so when the figure is negative', () => {
    expect(amountInWords(-5000)).toBe('Minus Rupees Five Thousand Only')
  })
})
