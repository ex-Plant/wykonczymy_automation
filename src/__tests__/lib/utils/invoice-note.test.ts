import { describe, expect, it } from 'vitest'
import { firstNoteLine } from '@/lib/utils/invoice-note'

describe('firstNoteLine', () => {
  it('returns null for a missing note', () => {
    expect(firstNoteLine(null)).toBeNull()
    expect(firstNoteLine(undefined)).toBeNull()
  })

  it('returns null for an empty or whitespace-only note', () => {
    expect(firstNoteLine('')).toBeNull()
    expect(firstNoteLine('   ')).toBeNull()
    expect(firstNoteLine('\n\n  \n')).toBeNull()
  })

  it('returns the whole note when it has no line break', () => {
    expect(firstNoteLine('FV 12/03/2026')).toBe('FV 12/03/2026')
  })

  it('returns only the first line of a multi-line note', () => {
    const note = 'FV 12/03/2026\nPłyta OSB 12mm — 240,00\nWkręty 4x50 — 38,50'
    expect(firstNoteLine(note)).toBe('FV 12/03/2026')
  })

  it('skips leading blank lines', () => {
    expect(firstNoteLine('\n\nFV 12/03/2026\nPłyta OSB')).toBe('FV 12/03/2026')
  })

  it('trims surrounding whitespace and a trailing newline', () => {
    expect(firstNoteLine('  FV 12/03/2026  \n')).toBe('FV 12/03/2026')
  })
})
