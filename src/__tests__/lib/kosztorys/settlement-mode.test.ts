import { describe, expect, it } from 'vitest'
import {
  settlementModeToGridAxis,
  settlementModeToPanelAxis,
  type SettlementModeT,
} from '@/lib/kosztorys/money-axis'
import { buildSettlementPlaneVerdict } from '@/lib/kosztorys/reconciliation'

// The stored mode is the only source of the money plane, so these two projections are what keep the
// panel and the grid from disagreeing. Everything else in the change reads them.
describe('settlement mode projections', () => {
  it('projects the panel axis from the stored mode', () => {
    expect(settlementModeToPanelAxis('NET')).toBe('net')
    expect(settlementModeToPanelAxis('GROSS')).toBe('gross')
    expect(settlementModeToPanelAxis('MIXED')).toBe('mixed')
  })

  // „Mieszane" bills on both planes, so hiding one would hide half the bill — the grid shows both
  // money columns where the panel shows its settlement narrative.
  it('projects MIXED to both money columns in the grid', () => {
    expect(settlementModeToGridAxis('MIXED')).toBe('both')
  })

  it('projects a single-plane mode to that plane in the grid', () => {
    expect(settlementModeToGridAxis('NET')).toBe('net')
    expect(settlementModeToGridAxis('GROSS')).toBe('gross')
  })

  it('never yields a hidden-money axis for any mode', () => {
    const modes: SettlementModeT[] = ['NET', 'GROSS', 'MIXED']
    for (const mode of modes) expect(settlementModeToGridAxis(mode)).not.toBe('none')
  })
})

// A deposit on the other plane records normally and disappears into the totals — this verdict is the
// only thing that says the mode and the wpłata disagree.
describe('buildSettlementPlaneVerdict', () => {
  it('screams when a netto-settled investment took brutto wpłaty', () => {
    const verdict = buildSettlementPlaneVerdict({ mode: 'NET', paidNet: 1000, paidGross: 250 })
    expect(verdict.mismatch).toBe(true)
    expect(verdict.offendingAmount).toBe(250)
  })

  // paidNet already absorbs unmarked deposits (the null→netto ruling), so netto-only is the clean case.
  it('stays clean when a netto-settled investment took only netto wpłaty', () => {
    expect(
      buildSettlementPlaneVerdict({ mode: 'NET', paidNet: 1000, paidGross: 0 }).mismatch,
    ).toBe(false)
  })

  it('screams when a brutto-settled investment took netto wpłaty', () => {
    const verdict = buildSettlementPlaneVerdict({ mode: 'GROSS', paidNet: 400, paidGross: 900 })
    expect(verdict.mismatch).toBe(true)
    expect(verdict.offendingAmount).toBe(400)
  })

  // „Mieszane" is settled on both planes at once, so no wpłata can contradict it.
  it('never screams in MIXED, whatever the wpłaty', () => {
    const verdict = buildSettlementPlaneVerdict({ mode: 'MIXED', paidNet: 500, paidGross: 700 })
    expect(verdict.mismatch).toBe(false)
    expect(verdict.offendingAmount).toBe(0)
  })

  it('stays clean with no wpłaty at all, in every mode', () => {
    const modes: SettlementModeT[] = ['NET', 'GROSS', 'MIXED']
    for (const mode of modes) {
      expect(buildSettlementPlaneVerdict({ mode, paidNet: 0, paidGross: 0 }).mismatch).toBe(false)
    }
  })
})
