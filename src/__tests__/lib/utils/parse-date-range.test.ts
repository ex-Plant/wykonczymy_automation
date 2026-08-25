import { describe, it, expect } from 'vitest'
import { parseDateRange } from '@/lib/utils/parse-date-range'

describe('parseDateRange', () => {
  it('keeps both bounds when both are given', () => {
    expect(parseDateRange({ from: '2024-01-01', to: '2024-01-31' })).toEqual({
      from: '2024-01-01',
      to: '2024-01-31',
    })
  })

  // A one-sided window is a legitimate filter — „od 1 stycznia" must not collapse
  // into no filter at all.
  it('leaves the far end open when only one bound is given', () => {
    expect(parseDateRange({ from: '2024-01-01' })).toEqual({ from: '2024-01-01', to: undefined })
    expect(parseDateRange({ to: '2024-01-31' })).toEqual({ from: undefined, to: '2024-01-31' })
  })

  it('is an empty window when neither is present', () => {
    expect(parseDateRange({})).toEqual({ from: undefined, to: undefined })
  })

  it('drops a bound that arrived repeated', () => {
    expect(parseDateRange({ from: ['2024-01-01'], to: '2024-01-31' })).toEqual({
      from: undefined,
      to: '2024-01-31',
    })
  })

  it('treats an empty string as no bound', () => {
    expect(parseDateRange({ from: '', to: '2024-01-31' })).toEqual({
      from: undefined,
      to: '2024-01-31',
    })
  })

  // Comparison downstream is lexical, so a bound that isn't an ISO day never errors — it just
  // matches nothing, and every total silently reads zero as if the window were honestly empty.
  it('drops a bound that is not an ISO day', () => {
    expect(parseDateRange({ from: 'abc', to: '2024-01-31' })).toEqual({
      from: undefined,
      to: '2024-01-31',
    })
    expect(parseDateRange({ from: '2024-1-1' })).toEqual({ from: undefined, to: undefined })
    expect(parseDateRange({ to: '2024-01-31T00:00:00.000Z' })).toEqual({
      from: undefined,
      to: undefined,
    })
  })
})
