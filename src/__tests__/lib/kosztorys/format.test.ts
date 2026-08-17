import { describe, expect, it } from 'vitest'
import { formatPercent, formatPercentPrecise } from '@/lib/kosztorys/format'

describe('formatPercent / formatPercentPrecise', () => {
  it('fraction → percent; integer for the grid, one decimal for the headline', () => {
    expect(formatPercent(0.75)).toBe('75%')
    expect(formatPercentPrecise(0.746)).toBe('74,6%') // pl-PL comma
  })

  it('rounds rather than truncates', () => {
    expect(formatPercent(0.756)).toBe('76%')
    expect(formatPercentPrecise(0.7456)).toBe('74,6%')
  })

  it('no denominator (null) → dash, never 0%', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercentPrecise(null)).toBe('—')
  })

  it('zero is a real 0%, not a dash', () => {
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercentPrecise(0)).toBe('0,0%')
  })

  it('overshoot past 100% shows literally', () => {
    expect(formatPercent(1.2)).toBe('120%')
  })
})
