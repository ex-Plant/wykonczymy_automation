import { VAT_PLANES, VAT_PLANE_LABELS, type VatPlaneT } from '@/lib/constants/transfers'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'

// How the investment is settled with the client — a decision about the deal, stored on the
// investment, NOT a per-person reading preference. Every reader projects the same plane from it, so
// the owner and the client can never be looking at different money.
//
// Built on VAT_PLANES because the verdict compares this mode against wpłaty bucketed by `vatPlane`:
// one enum keeps that comparison from drifting into two independent spellings of netto/brutto.
//
// Type-only imports from money-axis on purpose: this module is reached from the Payload collection
// config, and a value import would drag the grid's column-config into `payload generate:types`.
export const SETTLEMENT_MODES = [...VAT_PLANES, 'MIXED'] as const

export type SettlementModeT = VatPlaneT | 'MIXED'

export const SETTLEMENT_MODE_DEFAULT: SettlementModeT = 'NET'

// A Record, not a lookup over an options array: adding a mode to SETTLEMENT_MODES without a label
// becomes a compile error rather than an `undefined` rendered into the UI.
const SETTLEMENT_MODE_LABELS: Record<SettlementModeT, { en: string; pl: string }> = {
  NET: { en: 'Net', pl: VAT_PLANE_LABELS.NET },
  GROSS: { en: 'Gross', pl: VAT_PLANE_LABELS.GROSS },
  MIXED: { en: 'Mixed', pl: 'Mieszane' },
}

export function settlementModeLabel(mode: SettlementModeT): string {
  return SETTLEMENT_MODE_LABELS[mode].pl
}

export const SETTLEMENT_MODE_OPTIONS = SETTLEMENT_MODES.map((value) => ({
  value,
  label: SETTLEMENT_MODE_LABELS[value].pl,
}))

// The Payload admin renders under its own locale, so it needs the bilingual label shape every other
// select on the collection uses.
export const SETTLEMENT_MODE_ADMIN_OPTIONS = SETTLEMENT_MODES.map((value) => ({
  value,
  label: SETTLEMENT_MODE_LABELS[value],
}))

// A Record, not an if-chain, for the same reason as the labels above: a mode added to
// SETTLEMENT_MODES without a projection is a compile error, not a silent fallthrough to netto.
//
// In the grid, „Mieszane" means both money columns: a mixed-settled client is billed on both planes,
// so showing one would hide half the bill. The panel's 'mixed' has no grid counterpart — the grid
// renders columns, not a settlement narrative. The panel has no such projection: the owner ruled
// that both money columns stand in every tryb, client-facing preview included (2026-08-07), so the
// only thing the panel asks of the mode is whether it is „Mieszane".
const GRID_AXIS_BY_MODE: Record<SettlementModeT, MoneyAxisT> = {
  NET: 'net',
  GROSS: 'gross',
  MIXED: 'both',
}

export function settlementModeToGridAxis(mode: SettlementModeT): MoneyAxisT {
  return GRID_AXIS_BY_MODE[mode]
}
