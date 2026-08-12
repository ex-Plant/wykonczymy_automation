import { describe, expect, it } from 'vitest'
import {
  effectiveMaterialsNetRate,
  SETTLEMENT_MODES,
  settlementModeToGridAxis,
} from '@/lib/kosztorys/settlement-mode'
import { computeDoZaplatyRM } from '@/lib/kosztorys/summary-economics'

// The stored mode is the only source of the grid's money plane. The panel has no such projection —
// both columns stand there in every tryb, so it only ever asks whether the mode is MIXED.
describe('settlement mode projections', () => {
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

// Every surface that prices materiały reads the rate through here, so a new one cannot ship the
// GROSS gate from memory — which is exactly how the investments listing ended up without it.
describe('effectiveMaterialsNetRate', () => {
  it('goes inert under GROSS whatever rate is saved', () => {
    expect(effectiveMaterialsNetRate('GROSS', 0.25)).toBeNull()
    expect(effectiveMaterialsNetRate('GROSS', 0)).toBeNull()
    expect(effectiveMaterialsNetRate('GROSS', null)).toBeNull()
  })

  it('hands the saved rate through untouched under NET and MIXED', () => {
    expect(effectiveMaterialsNetRate('NET', 0.25)).toBe(0.25)
    expect(effectiveMaterialsNetRate('MIXED', 0.25)).toBe(0.25)
    expect(effectiveMaterialsNetRate('NET', null)).toBeNull()
    expect(effectiveMaterialsNetRate('MIXED', null)).toBeNull()
  })
})

// EX-590: the select used to disable itself at VAT 0% on the premise that the mode goes inert there,
// which stranded an investment in whatever mode it was stored as. These guard the premise — if any
// of them ever holds, the disable becomes arguable again; while they fail, it is simply a bug.
describe('the stored mode still changes the reading at VAT 0%', () => {
  const VAT_ZERO = 0

  it('keeps Mieszane a different grid projection from the single-plane modes', () => {
    // The projection takes no VAT rate at all, so a 0% investment cannot flatten it.
    expect(settlementModeToGridAxis('MIXED')).not.toBe(settlementModeToGridAxis('NET'))
  })

  it('bills materiały differently under NET than under GROSS', () => {
    // The panel nulls the materiały netto rate at rozliczenie brutto. That rate is a division on the
    // receipt, not a VAT strip, so switching mode moves „Do zapłaty" even with no VAT in play.
    const materials = { grossBase: 1230, netBilled: 0 }
    const underNet = computeDoZaplatyRM(1000, 0, materials, VAT_ZERO, 0.23)
    const underGross = computeDoZaplatyRM(1000, 0, materials, VAT_ZERO, null)

    expect(underNet.net).not.toBe(underGross.net)
    // Both columns move: materiały are billed ONCE and enter both planes at that same figure, so the
    // rate reaches the brutto column too. VAT 0% only removes the VAT on prace — nothing here.
    expect(underNet.gross).not.toBe(underGross.gross)
    expect(underGross.gross - underNet.gross).toBeCloseTo(230)
  })
})
