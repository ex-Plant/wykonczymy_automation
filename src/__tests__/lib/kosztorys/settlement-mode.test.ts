import { describe, expect, it } from 'vitest'
import {
  effectiveMaterialsNetRate,
  SETTLEMENT_MODES,
  settlementModeToMoneyAxis,
} from '@/lib/kosztorys/settlement-mode'
import { isOffPlaneDeposit } from '@/lib/kosztorys/deposit-planes'
import { computeAmountDue } from '@/lib/kosztorys/summary-economics'

const NO_DEPOSITS = { net: 0, gross: 0 }

// The tryb decides which money column EXISTS — exactly one, never two. „Mieszane" settles on netto
// like tryb netto: what is mixed there are the WPŁATY, not the bill.
describe('settlement mode projections', () => {
  it('settles Mieszane on netto, the plane its wpłaty share', () => {
    expect(settlementModeToMoneyAxis('MIXED')).toBe('net')
  })

  it('projects a single-plane mode to that plane', () => {
    expect(settlementModeToMoneyAxis('NET')).toBe('net')
    expect(settlementModeToMoneyAxis('GROSS')).toBe('gross')
  })

  it('gives every tryb exactly one money column — never both, never none', () => {
    for (const mode of SETTLEMENT_MODES) {
      expect(['net', 'gross']).toContain(settlementModeToMoneyAxis(mode))
    }
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

  it('bills materiały differently under NET than under GROSS', () => {
    // The panel nulls the materiały netto rate at rozliczenie brutto. That rate is a division on the
    // receipt, not a VAT strip, so switching mode moves „Do zapłaty" even with no VAT in play.
    const materials = { grossBase: 1230, netBilled: 0 }
    const underNet = computeAmountDue(1000, NO_DEPOSITS, materials, VAT_ZERO, 0.23)
    const underGross = computeAmountDue(1000, NO_DEPOSITS, materials, VAT_ZERO, null)

    expect(underNet.net).not.toBe(underGross.net)
    // Both columns move: materiały are billed ONCE and enter both planes at that same figure, so the
    // rate reaches the brutto column too. VAT 0% only removes the VAT on prace — nothing here.
    expect(underNet.gross).not.toBe(underGross.gross)
    expect(underGross.gross - underNet.gross).toBeCloseTo(230)
  })

  it('keeps Mieszane a different reading from tryb netto — this is why the third mode exists', () => {
    // Mieszane and netto settle on the same column, so what separates them is not arithmetic but
    // whether a przelew is an anomaly. Take this away and the three warnings have nothing to
    // propose: „ustaw rozliczenie mieszane" is the remedy each of them names.
    const przelew = { vatPlane: 'GROSS' as const }

    expect(isOffPlaneDeposit(przelew, 'NET')).toBe(true)
    expect(isOffPlaneDeposit(przelew, 'MIXED')).toBe(false)
  })
})
