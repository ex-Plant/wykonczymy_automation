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

// Materiały valuation switch, driven by the investment's persisted netto rate:
//   null → faceValue: netto = brutto, the raw receipt, no concession.
//   a rate → netto = brutto ÷ (1+rate), the price whose gross-up returns the receipt.
// Division, not `× (1 − rate)`: at 23% a 123 zł receipt is billed 100 zł, and 123 × 0,77 = 94,71 is a
// different (larger) concession than the server's `materialsNetDiscount` computes — the two figures
// would then disagree on screen, which is the defect this whole change exists to close.
export function billedMaterialsPair(gross: number, netRate: number | null): MoneyPairT {
  return netRate == null ? faceValue(gross) : { net: gross / (1 + netRate), gross }
}

// The concession in złotych — brutto receipt minus what the investor is billed. The netto-billed
// bucket is deliberately out of reach: it carries no VAT toward the investor, so cutting it here
// would deduct the same VAT twice. `deriveFinancials` calls THIS for the marża/bilans term, so the
// panel's „Obniżka materiałów" row and the figures it moves are one formula, not two that agree by
// convention. The settlement-mode gate stays server-side — it is about who owes VAT, not arithmetic.
export function materialsNetDiscount(grossBase: number, netRate: number | null): number {
  const { net, gross } = billedMaterialsPair(grossBase, netRate)
  return gross - net
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
export function materialsPair(materials: MaterialsT, netRate: number | null): MoneyPairT {
  const base = billedMaterialsPair(materials.grossBase, netRate)
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
  netRate: number | null,
): SummaryLineT {
  const pair = materialsPair(materials, netRate)
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
  materialsNetRate: number | null = null,
): SummaryT {
  // Folded in BEFORE combinedNet: that sum is the denominator every udział divides by, so a
  // netto bucket added after the shares would leave them summing to less than 100%.
  const materialy = materialsPair(materials, materialsNetRate)
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
  materialsNetRate: number | null = null,
): MoneyPairT {
  const materialy = materialsPair(materials, materialsNetRate)
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
  materialsNetRate: number | null = null,
): MixedSettlementT {
  const materialy = materialsPair(materials, materialsNetRate)
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

export type DepositTallyT = { total: number; count: number }

export type DepositPlaneSumsT = {
  paidNet: number
  paidGross: number
  // Deposits whose plane was actually typed, per plane. Separate from paidNet/paidGross because the
  // null→netto ruling is a *settlement* rule, not evidence: an unmarked deposit is unknown, and
  // reading it as netto turns "nobody has tagged anything here" into a contradiction the plane
  // warning then screams about on every brutto investment.
  taggedNet: DepositTallyT
  taggedGross: DepositTallyT
}

const tally = (
  rows: { amount: number; vatPlane: VatPlaneT | null }[],
  plane: VatPlaneT,
): DepositTallyT =>
  rows.reduce<DepositTallyT>(
    (acc, row) =>
      row.vatPlane === plane ? { total: acc.total + row.amount, count: acc.count + 1 } : acc,
    { total: 0, count: 0 },
  )

// Bucket deposits by VAT plane for the tryb-mieszany reconciliation. A deposit marked GROSS goes to
// the invoiced part; everything else — NET *and* legacy/unmarked null — pays down the gotówka
// (no-VAT) part, the owner's „brak wartości = netto" ruling (flipped 2026-07-22 from the earlier
// null→brutto default). The tagged tallies alongside keep the one place that reads `vatPlane`, so
// the settlement reading and the evidence reading can differ without a second interpretation of null.
export function bucketDepositsByPlane(
  rows: { amount: number; vatPlane: VatPlaneT | null }[],
): DepositPlaneSumsT {
  const taggedGross = tally(rows, 'GROSS')
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  return {
    paidNet: total - taggedGross.total,
    paidGross: taggedGross.total,
    taggedNet: tally(rows, 'NET'),
    taggedGross,
  }
}
