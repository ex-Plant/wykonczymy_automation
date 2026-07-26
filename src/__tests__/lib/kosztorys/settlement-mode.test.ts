import { describe, expect, it } from 'vitest'
import {
  SETTLEMENT_MODES,
  settlementModeToGridAxis,
  settlementModeToPanelAxis,
} from '@/lib/kosztorys/settlement-mode'

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
