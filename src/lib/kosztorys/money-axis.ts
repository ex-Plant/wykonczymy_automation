import { AXIS_EXEMPT_COLUMNS, COLUMN_MONEY_AXIS } from '@/lib/kosztorys/column-config'

// The grid's second reading axis: the owner reads netto when settling with a subcontractor and brutto
// when invoicing the client, and never both in one sitting. It composes with the column picker rather
// than replacing it — visible(col) = pickerAllows(col) AND axisAllows(col) — so the two answer
// different questions and can't contradict.

export type MoneyAxisT = 'net' | 'gross' | 'both' | 'none'

export const MONEY_AXIS_DEFAULT: MoneyAxisT = 'both'

// How the investment is settled with the client — a decision about the deal, stored on the
// investment, NOT a per-person reading preference. Every reader projects the same plane from it, so
// the owner and the client can never be looking at different money.
export const SETTLEMENT_MODES = ['NET', 'GROSS', 'MIXED'] as const

export type SettlementModeT = (typeof SETTLEMENT_MODES)[number]

export const SETTLEMENT_MODE_OPTIONS = [
  { value: 'NET', label: 'Netto' },
  { value: 'GROSS', label: 'Brutto' },
  { value: 'MIXED', label: 'Mieszane' },
] as const satisfies readonly { value: SettlementModeT; label: string }[]

export const SETTLEMENT_MODE_DEFAULT: SettlementModeT = 'NET'

// The totals panel's axis. Extends MoneyAxisT with a panel-only 'mixed': 'both' keeps its original
// meaning (netto + brutto columns side by side), 'mixed' is the „Mieszane" settlement view
// (netto figures + the gotówka block).
export type PanelAxisT = MoneyAxisT | 'mixed'

export function settlementModeToPanelAxis(mode: SettlementModeT): PanelAxisT {
  if (mode === 'GROSS') return 'gross'
  if (mode === 'MIXED') return 'mixed'
  return 'net'
}

// In the grid, „Mieszane" means both money columns: a mixed-settled client is billed on both planes,
// so showing one would hide half the bill. The panel's 'mixed' has no grid counterpart — the grid
// renders columns, not a settlement narrative.
export function settlementModeToGridAxis(mode: SettlementModeT): MoneyAxisT {
  if (mode === 'GROSS') return 'gross'
  if (mode === 'MIXED') return 'both'
  return 'net'
}

// Netto/brutto visibility flags for a footer/readout at this axis. Shared so every summary block
// derives them one way.
export function axisShows(axis: MoneyAxisT): { net: boolean; gross: boolean } {
  return {
    net: axis === 'net' || axis === 'both',
    gross: axis === 'gross' || axis === 'both',
  }
}

export function axisAllows(toggleKey: string, axis: MoneyAxisT): boolean {
  if (AXIS_EXEMPT_COLUMNS.has(toggleKey) || axis === 'both') return true

  const columnAxis = COLUMN_MONEY_AXIS[toggleKey]
  if (columnAxis === undefined) return true
  if (axis === 'none') return false
  return columnAxis === axis
}
