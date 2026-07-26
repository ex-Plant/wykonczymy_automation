import { toGross } from '@/lib/kosztorys/calc'
import type { VatPlaneT } from '@/lib/constants/transfers'

export type MoneyPairT = { net: number; gross: number }

// A net figure paired with its brutto at the investment's VAT rate — the shape behind a PRACE row's
// netto/brutto columns. VAT is a prace-only concept: use this only for robocizna / prace figures.
export function moneyPair(net: number, vatRate: number): MoneyPairT {
  return { net, gross: toGross(net, vatRate) }
}

// A no-VAT figure: brutto === netto. For everything off the prace plane — korekta, wpłaty
// (context/reference/kosztorys-editor-domain-notes.md, „VAT dotyczy wyłącznie prac"). Without this,
// grossing an expense would invent VAT that never existed on the ledger.
export function faceValue(net: number): MoneyPairT {
  return { net, gross: net }
}

// A gross-native figure — materiały, recorded as brutto transactions (VAT already inside). The
// counterpart to `moneyPair`: there netto is native and brutto is grossed up; here brutto is native
// and netto is derived by REMOVING VAT (`net = gross / (1+vat)`), the inverse direction. `vat = 0`
// degenerates to `net === gross`.
export function grossPair(gross: number, vatRate: number): MoneyPairT {
  return { net: gross / (1 + vatRate), gross }
}

// Materiały valuation switch. Recorded brutto either way; `deriveNet` decides the netto axis:
//   false → faceValue: netto = brutto, the raw expense amount, no reduction.
//   true, `reduction` given → netto = brutto × (1 − reduction), the owner-set brutto discount
//     (client-side experiment: the reduction % is a panel control, default = VAT rate).
//   true, no `reduction` → grossPair: netto = brutto ÷ (1+VAT), the VAT-stripped netto.
// Brutto is `gross` in every branch, so this only moves the netto figures.
export function materialyPair(
  gross: number,
  vatRate: number,
  deriveNet: boolean,
  reduction?: number,
): MoneyPairT {
  if (!deriveNet) return faceValue(gross)
  if (reduction != null) return { net: gross * (1 - reduction), gross }
  return grossPair(gross, vatRate)
}

/** The two materiały buckets, always passed together. An object rather than two positional
 *  numbers on purpose: the whole point of the split is that a caller can never feed the
 *  toggle a figure that already carries its own netto, and a positional pair invites exactly
 *  that mistake. `grossBase` is toggle-driven; `netBilled` is frozen at face value. */
export type MaterialsT = { grossBase: number; netBilled: number }

/** Materiały as one pair: the brutto base valued through the toggle, plus the netto-billed
 *  bucket added at FACE VALUE on both axes. The netto figure is what the investor is billed
 *  and carries no VAT toward him, so cutting it again — on either axis — would deduct the
 *  same VAT twice. */
export function materialsPair(
  materials: MaterialsT,
  vatRate: number,
  deriveNet: boolean,
  reduction?: number,
): MoneyPairT {
  const base = materialyPair(materials.grossBase, vatRate, deriveNet, reduction)
  return { net: base.net + materials.netBilled, gross: base.gross + materials.netBilled }
}

export type SummaryLineT = MoneyPairT & {
  // Fraction of Łącznie netto (0..1); 0 when Łącznie is 0. Null-safe by construction.
  share: number
}

// A PRACE net figure as a summary row: its netto/brutto pair (VAT-grossed) plus its udział as a
// fraction of Łącznie. The one home for the udział-base math.
export function summaryLine(net: number, combinedNet: number, vatRate: number): SummaryLineT {
  return { ...moneyPair(net, vatRate), share: combinedNet > 0 ? net / combinedNet : 0 }
}

// The „Materiały" aggregate row: both buckets valued by `materialsPair`, with its udział off the
// resulting netto.
export function summaryLineMaterials(
  materials: MaterialsT,
  combinedNet: number,
  vatRate: number,
  deriveNet: boolean,
  reduction?: number,
): SummaryLineT {
  const pair = materialsPair(materials, vatRate, deriveNet, reduction)
  return { ...pair, share: combinedNet > 0 ? pair.net / combinedNet : 0 }
}

export type SummaryT = {
  laborCosts: SummaryLineT
  combined: SummaryLineT
}

// The Podsumowanie split (sheet Podsumowanie r06–08): Robocizna (kosztorys wartość netto) plus
// Materiały = Łącznie, each carrying its udział % of Łącznie. Materiały enters only via the
// Łącznie denominator here — the per-category materiały rows are built by the caller, which shares
// `combined.net` as their udział base. Robocizna reacts to unsaved editor edits; materiały is a
// server prop, passed as BRUTTO (its netto is derived by removing VAT).
export function computeSummarySplit(
  laborCostsNetFromKosztorys: number,
  materials: MaterialsT,
  vatRate: number,
  deriveMaterialsNet = true,
  materialsReduction?: number,
): SummaryT {
  // Folded in BEFORE combinedNet: that sum is the denominator every udział divides by, so a
  // netto bucket added after the shares would leave them summing to less than 100%.
  const materialy = materialsPair(materials, vatRate, deriveMaterialsNet, materialsReduction)
  const combinedNet = laborCostsNetFromKosztorys + materialy.net
  const laborCosts = summaryLine(laborCostsNetFromKosztorys, combinedNet, vatRate)
  // Łącznie = robocizna (netto native, grossed up) + materiały (brutto native, netto derived). Each
  // side carries VAT in its own direction; combining the two native planes keeps both correct.
  const combined: SummaryLineT = {
    net: combinedNet,
    gross: laborCosts.gross + materialy.gross,
    share: combinedNet > 0 ? 1 : 0,
  }
  return { laborCosts, combined }
}

// „Robocizna" is shown PRE-rabat, with the rabat as its own deduction row below it — the same figure
// the investment page's „z kosztorysu" block labels Robocizna, so one label never means two numbers.
// Łącznie is unaffected: `laborCostsNetFromKosztorys` is already post-rabat, so the row pair adds
// back and deducts the same amount.
export function sumaPracPreRabat(laborCostsNetFromKosztorys: number, rabatAmount: number): number {
  return laborCostsNetFromKosztorys + rabatAmount
}

// „Aktualnie do zapłaty R + M" (sheet footer r456–464): the headline still-owed figure —
// robocizna do zapłaty plus materiały, less the investor's wpłaty (Σ INVESTOR_DEPOSIT on the
// investment). Can go negative when wpłaty exceed R + M — a real overpaid state, not clamped here.
export function computeDoZaplatyRM(
  laborCostsNetFromKosztorys: number,
  wplatyNet: number,
  materials: MaterialsT,
  vatRate: number,
  deriveMaterialsNet = true,
  materialsReduction?: number,
): MoneyPairT {
  const materialy = materialsPair(materials, vatRate, deriveMaterialsNet, materialsReduction)
  // Robocizna is netto native (grossed up); materiały is brutto native (netto derived by removing
  // VAT); wpłaty carry no VAT (face value). Each figure enters each axis at its own native amount.
  const net = laborCostsNetFromKosztorys - wplatyNet + materialy.net
  const gross = toGross(laborCostsNetFromKosztorys, vatRate) - wplatyNet + materialy.gross
  return { net, gross }
}

export type MixedSettlementT = {
  // Netto section: robocizna + materiały = Łącznie, then wpłaty netto → Do rozliczenia netto.
  robocizna: number
  materialy: number
  combinedNet: number
  paidNet: number
  // combinedNet − paidNet: the still-owed netto that goes onto the invoice.
  doRozliczeniaNet: number
  // Brutto section: the still-owed netto grossed up, then wpłaty brutto → Do zapłaty brutto.
  resztaGross: number
  paidGross: number
  // resztaGross − paidGross: what the client still owes on the invoice.
  doZaplatyGross: number
}

// Tryb mieszany: the client settles part in cash (no invoice → no VAT) and the rest on an invoice
// WITH VAT. Two stacked sections the reader reconstructs top-down:
//   NETTO:  Robocizna + Materiały = Łącznie netto → − wpłaty netto → Do rozliczenia netto
//   BRUTTO: Do rozliczenia netto + VAT = Reszta brutto → − wpłaty brutto → Do zapłaty brutto
// Only the STILL-OWED netto is grossed (the cash-paid part never touches the invoice), so netto
// deposits shield their złoty from VAT while brutto deposits pay down the invoiced part directly.
// Robocizna netto is already post-rabat (Suma prac po rabacie), so the rabat's effect flows through
// both sections without a second deduction — the panel shows it as an informational line only.
export function computeMixedSettlement(
  laborCostsNetFromKosztorys: number,
  materials: MaterialsT,
  vatRate: number,
  paidNet: number,
  paidGross: number,
  deriveMaterialsNet = true,
  materialsReduction?: number,
): MixedSettlementT {
  const materialy = materialsPair(materials, vatRate, deriveMaterialsNet, materialsReduction)
  const combinedNet = laborCostsNetFromKosztorys + materialy.net
  const doRozliczeniaNet = combinedNet - paidNet
  const resztaGross = toGross(doRozliczeniaNet, vatRate)
  return {
    robocizna: laborCostsNetFromKosztorys,
    materialy: materialy.net,
    combinedNet,
    paidNet,
    doRozliczeniaNet,
    resztaGross,
    paidGross,
    doZaplatyGross: resztaGross - paidGross,
  }
}

export type DepositPlaneSumsT = { paidNet: number; paidGross: number }

// Bucket deposits by VAT plane for the tryb-mieszany reconciliation. A deposit marked GROSS goes to
// the invoiced part; everything else — NET *and* legacy/unmarked null — pays down the gotówka
// (no-VAT) part, the owner's „brak wartości = netto" ruling (flipped 2026-07-22 from the earlier
// null→brutto default).
export function bucketDepositsByPlane(
  rows: { amount: number; vatPlane: VatPlaneT | null }[],
): DepositPlaneSumsT {
  const paidGross = rows.reduce(
    (sum, row) => (row.vatPlane === 'GROSS' ? sum + row.amount : sum),
    0,
  )
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  return { paidNet: total - paidGross, paidGross }
}
