import { describe, expect, it } from 'vitest'
import {
  SETTLEMENT_MODES,
  settlementModeToGridAxis,
  settlementModeToPanelAxis,
} from '@/lib/kosztorys/settlement-mode'
import { computeDoZaplatyRM } from '@/lib/kosztorys/summary-economics'

// The stored mode is the only source of the money plane, so these two projections are what keep the
// panel and the grid from disagreeing.
describe('settlement mode projections', () => {
  it('projects the panel axis from the stored mode', () => {
    expect(settlementModeToPanelAxis('NET')).toBe('net')
    expect(settlementModeToPanelAxis('GROSS')).toBe('gross')
    expect(settlementModeToPanelAxis('MIXED')).toBe('mixed')
  })

  it('projects MIXED to both money columns in the grid', () => {
    expect(settlementModeToGridAxis('MIXED')).toBe('both')
  })

  it('projects a single-plane mode to that plane in the grid', () => {
    expect(settlementModeToGridAxis('NET')).toBe('net')
    expect(settlementModeToGridAxis('GROSS')).toBe('gross')
  })

  it('never yields a hidden-money axis for any mode', () => {
    for (const mode of SETTLEMENT_MODES) expect(settlementModeToGridAxis(mode)).not.toBe('none')
  })
})

// EX-590: the select used to disable itself at VAT 0% on the premise that the mode goes inert there,
// which stranded an investment in whatever mode it was stored as. These guard the premise — if any
// of them ever holds, the disable becomes arguable again; while they fail, it is simply a bug.
describe('the stored mode still changes the reading at VAT 0%', () => {
  const VAT_ZERO = 0

  it('keeps Mieszane a different panel and grid projection from the single-plane modes', () => {
    // Neither projection takes a VAT rate at all, so a 0% investment cannot flatten them.
    expect(settlementModeToPanelAxis('MIXED')).not.toBe(settlementModeToPanelAxis('NET'))
    expect(settlementModeToGridAxis('MIXED')).not.toBe(settlementModeToGridAxis('NET'))
  })

  it('bills materiały differently under NET than under GROSS', () => {
    // The panel nulls the materiały netto rate at rozliczenie brutto. That rate is a division on the
    // receipt, not a VAT strip, so switching mode moves „Do zapłaty" even with no VAT in play.
    const materials = { grossBase: 1230, netBilled: 0 }
    const underNet = computeDoZaplatyRM(1000, 0, materials, VAT_ZERO, 0.23)
    const underGross = computeDoZaplatyRM(1000, 0, materials, VAT_ZERO, null)

    expect(underNet.net).not.toBe(underGross.net)
    // The brutto column IS flat here — it is the receipt either way, with no VAT to add on top. That
    // is the whole of what VAT 0% neutralises, and it is not enough to freeze the control.
    expect(underNet.gross).toBe(underGross.gross)
  })
})
