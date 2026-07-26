import { AXIS_EXEMPT_COLUMNS, COLUMN_MONEY_AXIS } from '@/lib/kosztorys/column-config'

// The grid's second reading axis: the owner reads netto when settling with a subcontractor and brutto
// when invoicing the client, and never both in one sitting. It composes with the column picker rather
// than replacing it — visible(col) = pickerAllows(col) AND axisAllows(col) — so the two answer
// different questions and can't contradict.

export type MoneyAxisT = 'net' | 'gross' | 'both' | 'none'

export const MONEY_AXIS_DEFAULT: MoneyAxisT = 'both'

// The client view offers one plane at a time, so its two-value subset is a type of its own — the
// persisted axis is shared with the owner's Kwoty control and can arrive as 'both'/'none', which the
// client's toggle has no item for (an unmatched value would leave the group with nothing active).
export type ClientMoneyAxisT = Extract<MoneyAxisT, 'net' | 'gross'>

export function toClientAxis(axis: MoneyAxisT): ClientMoneyAxisT {
  return axis === 'gross' ? 'gross' : 'net'
}

// The Podsumowanie panel's own default. It opens on netto; „Mieszane" ('both') is now the
// Mieszane settlement view, not a both-columns readout, so it must not be the panel's opening state.
export const SUMMARY_AXIS_DEFAULT: MoneyAxisT = 'net'

// How the investment is settled with the client — a decision about the deal, stored on the
// investment, NOT a per-person reading preference. Every reader projects the same plane from it, so
// the owner and the client can never be looking at different money.
export type SettlementModeT = 'NET' | 'GROSS' | 'MIXED'

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
