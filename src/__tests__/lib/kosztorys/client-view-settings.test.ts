import { describe, it, expect } from 'vitest'
import {
  sameClientViewSettings,
  sanitizeClientViewSettings,
} from '@/lib/kosztorys/client-view-settings'

// „Dalej" in the share dialog writes only when this says the draft differs. A false negative here
// materialises a per-investment row on a step the owner only looked at, and that row overrides the
// firm-wide default forever after.
describe('sameClientViewSettings', () => {
  it('treats the hidden columns as a set, not a list', () => {
    expect(
      sameClientViewSettings(
        { hiddenColumns: ['unit', 'price'], hideEmptyRows: true },
        { hiddenColumns: ['price', 'unit'], hideEmptyRows: true },
      ),
    ).toBe(true)
  })

  it('separates a changed tick from an unchanged one', () => {
    const base = { hiddenColumns: ['unit'], hideEmptyRows: true }

    expect(sameClientViewSettings(base, { ...base, hideEmptyRows: false })).toBe(false)
    expect(sameClientViewSettings(base, { hiddenColumns: [], hideEmptyRows: true })).toBe(false)
    expect(sameClientViewSettings(base, { hiddenColumns: ['price'], hideEmptyRows: true })).toBe(
      false,
    )
  })

  it('answers on the sanitized shape, so a key outside the allowlist is not a change', () => {
    const stored = sanitizeClientViewSettings({ hiddenColumns: ['unit', 'note'] })

    expect(sameClientViewSettings(stored, { hiddenColumns: ['unit'], hideEmptyRows: true })).toBe(
      true,
    )
  })
})
