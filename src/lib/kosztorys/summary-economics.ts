import { toGross } from '@/lib/kosztorys/calc'
import { costForCategory } from '@/lib/db/map-category-costs'
import type { VatPlaneT } from '@/lib/constants/transfers'
import type { CategoryCostT } from '@/types/investment-financials'

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

// One „Wydatki inwestycyjne" row on both planes. A rate is a bridge BETWEEN planes and ONE rate
// spans it in both directions — a brutto row divides down, a netto row multiplies back up. Which
// direction a row crosses is decided by the plane it was recorded on, never by a second rate.
export function breakdownRowPair(
  row: { net: number; origin: 'gross' | 'netBilled' },
  rate: number | null,
): MoneyPairT {
  if (row.origin !== 'netBilled') return billedMaterialsPair(row.net, rate)
  return rate == null ? faceValue(row.net) : { net: row.net, gross: toGross(row.net, rate) }
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
 *  that mistake. `grossBase` is toggle-driven; `netBilled` is frozen on the netto axis only —
 *  it still crosses to brutto through the rate. */
export type MaterialsT = { grossBase: number; netBilled: number }

/** Materiały as one pair: the brutto base valued through the toggle, plus the netto-billed
 *  bucket — which enters the netto axis at face value (it IS the netto the investor is billed,
 *  so cutting it again would deduct the same VAT twice) and crosses to the brutto axis through
 *  the SAME rate that brought the base down.
 *
 *  The materiały rate is the ONLY thing that crosses the netto bucket — with no rate saved there is
 *  no crossing at all and the bucket is billed at face value on both axes (owner, 2026-08-07). VAT
 *  is deliberately not a fallback here: it would gross a bucket the investor settles netto, putting
 *  the aggregate 160 zł above the per-category rows and above the bilans, which both bill face value.
 *  Built from `breakdownRowPair` so the aggregate is the same arithmetic as the rows it sums. */
export function materialsPair(materials: MaterialsT, netRate: number | null): MoneyPairT {
  const base = billedMaterialsPair(materials.grossBase, netRate)
  const netBilled = breakdownRowPair({ net: materials.netBilled, origin: 'netBilled' }, netRate)
  return { net: base.net + netBilled.net, gross: base.gross + netBilled.gross }
}

/** What the investor owes for materiały as ONE figure — for the settlement steps, whose table has a
 *  single money column. The rule is the plane they are actually billed on: the netto price where a
 *  materiały rate is saved, the raw receipt where none is (owner, 2026-08-07). Both cases are `.net`
 *  because without a rate nothing crosses and the two axes already carry the same receipt — a branch
 *  here would only pretend they differ. */
export function billedMaterials(materials: MaterialsT, netRate: number | null): number {
  return materialsPair(materials, netRate).net
}

/** The same billed figure as `billedMaterials`, per expense category — for a surface that shows the
 *  split rather than the aggregate. `netCategoryCosts` is a SUBSET of `categoryCosts`, so a
 *  category's brutto base is its total minus its netto part; feeding the raw total as `grossBase`
 *  would divide the netto part a second time. Built on `billedMaterials` so Σ of these columns is
 *  the same arithmetic as the total they must add up to. */
export function billedCategoryCosts(
  categoryCosts: CategoryCostT[],
  netCategoryCosts: CategoryCostT[],
  netRate: number | null,
): CategoryCostT[] {
  return categoryCosts.map(({ categoryId, total }) => {
    const netBilled = costForCategory(netCategoryCosts, categoryId)
    return {
      categoryId,
      total: billedMaterials({ grossBase: total - netBilled, netBilled }, netRate),
    }
  })
}

/** The investor balance carried onto the brutto plane. Negative means the client owes, so the VAT —
 *  another charge on them — DEDUCTS. It rides the prace alone, and on the prace net of the rabat: a
 *  discounted złoty was never billed, so it never carried VAT. The rabat is already inside `balance`
 *  (`calculateBalance` adds it back), which is why it has to come off the VAT base separately here. */
export function grossBalance(
  balance: number,
  vatRate: number,
  totalLaborCosts: number,
  totalRabat: number,
): number {
  return balance - vatRate * (totalLaborCosts - totalRabat)
}

/** „Łącznie" — the prace on their own two planes, plus materiały. Materiały enters BOTH axes at the
 *  same billed figure, because it IS one figure: the panel renders it as a single merged cell across
 *  both money columns, so shifting the two axes by different złoty would print a total the reader
 *  cannot reproduce from the cell above it. `laborCostsNet` is already post-rabat, which
 *  is what lets the Rabat row sit above this and still reconcile. */
export function combinedPair(
  laborCostsNet: number,
  materialsBilled: number,
  vatRate: number,
): MoneyPairT {
  const prace = moneyPair(laborCostsNet, vatRate)
  return { net: prace.net + materialsBilled, gross: prace.gross + materialsBilled }
}

// „Robocizna" is shown PRE-rabat, with the rabat as its own deduction row below it — the same figure
// the investment page's „z kosztorysu" block labels Robocizna, so one label never means two numbers.
// Łącznie is unaffected: `laborCostsNet` is already post-rabat, so the row pair adds
// back and deducts the same amount.
export function sumaPracPreRabat(laborCostsNet: number, rabatAmount: number): number {
  return laborCostsNet + rabatAmount
}

// „Pozostało do zapłaty" (sheet footer r456–464): the headline still-owed figure — Łącznie less the
// investor's wpłaty (Σ INVESTOR_DEPOSIT). Wpłaty carry no VAT, so like materiały they come off both
// axes at the same złoty — which is what lets the panel render them as one merged cell and still have
// the reader arrive at both columns below. Can go negative when wpłaty exceed Łącznie: a real
// overpaid state, not clamped here.
export function computeDoZaplatyRM(
  laborCostsNet: number,
  depositsTotal: number,
  materials: MaterialsT,
  vatRate: number,
  materialsNetRate: number | null,
): MoneyPairT {
  const combined = combinedPair(
    laborCostsNet,
    billedMaterials(materials, materialsNetRate),
    vatRate,
  )
  return { net: combined.net - depositsTotal, gross: combined.gross - depositsTotal }
}

export type MixedSettlementT = {
  // Netto section: robocizna + materiały = Łącznie, then wpłaty netto → Do rozliczenia netto.
  robocizna: number
  materialy: number
  combinedNet: number
  paidNet: number
  // combinedNet − paidNet: the still-owed netto that goes onto the invoice.
  doRozliczeniaNet: number
  // Brutto section: Łącznie brutto less the wpłaty netto, then wpłaty brutto → Do zapłaty brutto.
  resztaGross: number
  paidGross: number
  // resztaGross − paidGross: what the client still owes on the invoice.
  doZaplatyGross: number
  // What closes the settlement if the client pays the rest off-invoice (gotówka) instead of brutto:
  // the still-owed netto less every wpłata already made. Not a term of either column — an alternative
  // reading of the same debt.
  doZaplatyNet: number
}

// Tryb mieszany: the client settles part in cash (no invoice → no VAT) and the rest on an invoice
// WITH VAT. Two stacked sections the reader reconstructs top-down:
//   NETTO:  Robocizna + Materiały = Łącznie netto → − wpłaty netto → Do rozliczenia netto
//   BRUTTO: Łącznie brutto → − wpłaty netto → Reszta brutto → − wpłaty brutto → Do zapłaty brutto
// VAT is added to the prace and to nothing else, so the brutto section starts from „Łącznie" brutto
// rather than grossing the still-owed netto — the wpłaty come off at face value on both planes.
// Robocizna netto is already post-rabat (Suma prac po rabacie), so the rabat's effect flows through
// both sections without a second deduction — the panel shows it as an informational line only.
export function computeMixedSettlement(
  laborCostsNet: number,
  materials: MaterialsT,
  vatRate: number,
  paidNet: number,
  paidGross: number,
  materialsNetRate: number | null,
): MixedSettlementT {
  const materialsBilled = billedMaterials(materials, materialsNetRate)
  const combined = combinedPair(laborCostsNet, materialsBilled, vatRate)
  const doRozliczeniaNet = combined.net - paidNet
  // VAT rides the prace alone, so the gross-up runs on „Łącznie" — where materiały already sits at
  // face value on both axes — and the wpłaty come off after it. Grossing `doRozliczeniaNet` instead
  // put materiały × VAT into this figure, so „Pozostało brutto" and the „Łącznie" brutto printed
  // directly above it quoted the same debt at two amounts on one screen.
  const resztaGross = combined.gross - paidNet
  const doZaplatyGross = resztaGross - paidGross
  return {
    robocizna: laborCostsNet,
    materialy: materialsBilled,
    combinedNet: combined.net,
    paidNet,
    doRozliczeniaNet,
    resztaGross,
    paidGross,
    doZaplatyGross,
    // Wpłaty brutto enter at FACE VALUE, not de-grossed. A wpłata is cash, and VAT belongs to the
    // prace alone (context/reference/kosztorys-editor-domain-notes.md, „VAT dotyczy wyłącznie prac") —
    // dividing it by the VAT rate credited the client less than they actually paid (owner, 2026-08-07).
    doZaplatyNet: doRozliczeniaNet - paidGross,
  }
}

export type DepositTallyT = { total: number; count: number }

export type DepositPlaneSumsT = {
  paidNet: number
  paidGross: number
  // Σ of the very rows the two buckets partition, returned from the one place that already reduces
  // them — so „Wpłaty" and the wpłaty list it sits above cannot be summed by two different rules.
  total: number
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
    total,
    taggedNet: tally(rows, 'NET'),
    taggedGross,
  }
}
