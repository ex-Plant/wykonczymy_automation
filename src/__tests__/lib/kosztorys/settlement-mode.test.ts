import { describe, expect, it } from 'vitest'
import {
  settlementModeToGridAxis,
  settlementModeToPanelAxis,
  type SettlementModeT,
} from '@/lib/kosztorys/money-axis'

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
