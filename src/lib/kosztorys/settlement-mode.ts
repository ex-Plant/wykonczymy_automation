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
// The tryb decides which money column EXISTS — one per tryb, never two. „Mieszane" settles on netto
// like tryb netto (owner, 2026-08-20, reversing the two-column reading from earlier that day): what
// is mixed there are the WPŁATY, not the bill — a wpłata przelewem is legitimate there and comes off
// the netto column at the netto its faktura names, where tryb netto flags it as off-plane. One projection for the grid and the
// Podsumowanie alike, client-facing preview included: the tryb is a fact about the deal, so the
// client is the reader it is hidden for first (reverses the 2026-08-07 ruling that both columns stand
// in every tryb, and EX-631's „podgląd nie zna trybu rozliczenia").
const MONEY_AXIS_BY_MODE: Record<SettlementModeT, MoneyAxisT> = {
  NET: 'net',
  GROSS: 'gross',
  MIXED: 'net',
}

export function settlementModeToMoneyAxis(mode: SettlementModeT): MoneyAxisT {
  return MONEY_AXIS_BY_MODE[mode]
}

// A brutto-settled client has VAT added on top of the bill, so there is nothing to strip off and the
// saved rate goes inert. The rate itself is kept rather than cleared: switching back to netto
// restores the old figures with nothing to re-enter. One home for the rule, because every surface
// that prices materiały has to apply it and one that forgets prices a whole listing wrong.
export function effectiveMaterialsNetRate(
  mode: SettlementModeT,
  rate: number | null,
): number | null {
  return mode === 'GROSS' ? null : rate
}
