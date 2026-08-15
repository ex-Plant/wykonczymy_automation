import { describe, expect, it } from 'vitest'
import {
  breakdownRowPair,
  bucketDepositsByPlane,
  computeMixedSettlement,
  combinedPair,
  computeAmountDue,
  faceValue,
  materialsNetDiscount,
  materialsPair,
  billedCategoryCosts,
  billedMaterials,
  billedMaterialsPair,
  moneyPair,
  sumaPracPreRabat,
} from '@/lib/kosztorys/summary-economics'
import { clientTotalsFromSubtotals } from '@/lib/kosztorys/settlement-client-totals'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'
import type { DepositTransactionRowT } from '@/types/transfers'

// Materiały with nothing billed netto — the pre-netto-type world, so the existing expectations
// keep reading as the brutto-only baseline they were written for.
const justGross = (grossBase: number) => ({ grossBase, netBilled: 0 })

const deposit = (amount: number, vatPlane: DepositTransactionRowT['vatPlane']) => ({
  amount,
  vatPlane,
})

describe('moneyPair / faceValue (VAT direction primitives)', () => {
  it('moneyPair grosses a netto-native figure UP (robocizna / prace)', () => {
    const p = moneyPair(100, 0.23)
    expect(p.net).toBe(100)
    expect(p.gross).toBeCloseTo(123)
  })

  it('faceValue is a no-VAT figure: brutto === netto (wpłaty / korekta)', () => {
    const p = faceValue(300)
    expect(p.net).toBe(300)
    expect(p.gross).toBe(300)
  })

  it('moneyPair and billedMaterialsPair are inverse directions at the same rate', () => {
    // 100 netto → 123 brutto → back to 100 netto.
    expect(billedMaterialsPair(moneyPair(100, 0.23).gross, 0.23).net).toBeCloseTo(100)
  })
})

describe('billedMaterialsPair (netto pricing switch)', () => {
  // 123 brutto at a 23% rate is billed 100 netto — the price whose gross-up returns the receipt.
  // `123 × (1 − 0,23) = 94,71` is a different, larger concession than the server computes, so this
  // pins the division against a re-derivation of the old subtraction.
  it('a rate divides brutto down to the netto price, brutto native', () => {
    const p = billedMaterialsPair(123, 0.23)
    expect(p.net).toBeCloseTo(100)
    expect(p.net).not.toBeCloseTo(123 * (1 - 0.23))
    expect(p.gross).toBe(123)
  })

  it('no rate keeps the raw brutto on both axes — where every investment starts', () => {
    const p = billedMaterialsPair(123, null)
    expect(p.net).toBe(123)
    expect(p.gross).toBe(123)
  })
})

// ONE rate spans the bridge in both directions — the row's recorded plane decides which way it
// crosses, never a second rate. A table whose header names one rate must not compute half its rows
// with another.
describe('breakdownRowPair (one „Wydatki inwestycyjne" row on both planes)', () => {
  it('a brutto row keeps its receipt and divides down to netto', () => {
    const p = breakdownRowPair({ net: 123, origin: 'gross' }, 0.23)
    expect(p.gross).toBe(123)
    expect(p.net).toBeCloseTo(100)
  })

  it('a netto row keeps its billed amount and multiplies back up — the SAME rate', () => {
    const p = breakdownRowPair({ net: 100, origin: 'netBilled' }, 0.23)
    expect(p.net).toBe(100)
    expect(p.gross).toBeCloseTo(123)
  })

  it('the two directions invert each other: brutto → netto → brutto returns the receipt', () => {
    const { net } = breakdownRowPair({ net: 123, origin: 'gross' }, 0.23)
    expect(breakdownRowPair({ net, origin: 'netBilled' }, 0.23).gross).toBeCloseTo(123)
  })

  it('no rate = no bridge, in either direction', () => {
    expect(breakdownRowPair({ net: 100, origin: 'netBilled' }, null)).toEqual({
      net: 100,
      gross: 100,
    })
    expect(breakdownRowPair({ net: 123, origin: 'gross' }, null)).toEqual({ net: 123, gross: 123 })
  })

  // „Korekta (bez kategorii)" arrives negative. The bug this replaced flipped or flattened such a
  // row, so pin both the sign and the ratio: a credit must cross the bridge exactly like a charge.
  it('a negative row keeps its sign and its ratio', () => {
    const gross = breakdownRowPair({ net: -123, origin: 'gross' }, 0.23)
    expect(gross.gross).toBe(-123)
    expect(gross.net).toBeCloseTo(-100)

    const netBilled = breakdownRowPair({ net: -100, origin: 'netBilled' }, 0.23)
    expect(netBilled.net).toBe(-100)
    expect(netBilled.gross).toBeCloseTo(-123)
  })
})

// The default state of every investment today: no materiały rate saved. It is the branch's own
// most-travelled path and the one the „frozen bucket" suite never exercises — every case there
// passes a non-null rate.
describe('materialsPair without a saved materiały rate', () => {
  it('leaves both buckets whole on both axes — with no rate there is nothing to cross', () => {
    const pair = materialsPair({ grossBase: 12_300, netBilled: 1000 }, null)
    expect(pair.net).toBeCloseTo(13_300)
    expect(pair.gross).toBeCloseTo(13_300)
  })

  // The regression this branch exists to close: VAT once stood in for the missing rate here and
  // nowhere else, so the aggregate sat above the rows it sums and above the bilans.
  it('agrees with breakdownRowPair on the netto-billed bucket', () => {
    const viaMaterials = materialsPair({ grossBase: 0, netBilled: 1000 }, null)
    const viaRow = breakdownRowPair({ net: 1000, origin: 'netBilled' }, null)
    expect(viaMaterials.gross).toBe(viaRow.gross)
    expect(viaMaterials.gross).toBe(1000)
  })
})

// The settlement steps carry one money column, so materiały must reduce to ONE figure: the plane the
// investor is actually billed on.
describe('billedMaterials', () => {
  it('a saved rate bills the netto price, not the receipt', () => {
    expect(billedMaterials({ grossBase: 123, netBilled: 0 }, 0.23)).toBeCloseTo(100)
  })

  it('no rate bills the raw receipt, netto and brutto being the same figure anyway', () => {
    const pair = materialsPair({ grossBase: 123, netBilled: 10 }, null)
    expect(pair.net).toBe(pair.gross)
    expect(billedMaterials({ grossBase: 123, netBilled: 10 }, null)).toBe(133)
  })
})

describe('billedCategoryCosts', () => {
  it('divides only the brutto part of a category that mixes both planes', () => {
    const billed = billedCategoryCosts(
      [{ categoryId: 1, total: 1250 }],
      [{ categoryId: 1, total: 100 }],
      0.25,
    )
    expect(billed).toEqual([{ categoryId: 1, total: 1020 }]) // 1150 ÷ 1,25 + 100
  })

  it('treats a category with no netto part as pure brutto receipts', () => {
    expect(billedCategoryCosts([{ categoryId: 2, total: 123 }], [], 0.23)).toEqual([
      { categoryId: 2, total: expect.closeTo(100, 10) },
    ])
  })

  it('bills the raw receipts when no rate is saved', () => {
    const categories = [
      { categoryId: 1, total: 1250 },
      { categoryId: 2, total: 500 },
    ]
    expect(billedCategoryCosts(categories, [{ categoryId: 1, total: 100 }], null)).toEqual(
      categories,
    )
  })

  it('sums to the same figure as the aggregate over the two buckets', () => {
    const categories = [
      { categoryId: 1, total: 1250 },
      { categoryId: 2, total: 500 },
    ]
    const net = [{ categoryId: 1, total: 100 }]
    const columnSum = billedCategoryCosts(categories, net, 0.25).reduce((s, c) => s + c.total, 0)
    expect(columnSum).toBeCloseTo(billedMaterials({ grossBase: 1650, netBilled: 100 }, 0.25), 10)
  })
})

describe('materialsNetDiscount', () => {
  it('is what billing netto gives away — 23 zł on a 123 zł receipt at 23%', () => {
    expect(materialsNetDiscount(123, 0.23)).toBeCloseTo(23)
  })

  it('is 0 without a rate', () => {
    expect(materialsNetDiscount(123, null)).toBe(0)
  })
})

describe('materiały netto pricing off (no saved rate)', () => {
  it('combinedPair: materiały netto === brutto, so Łącznie carries the full receipt on both axes', () => {
    const combined = combinedPair(1000, billedMaterials(justGross(123), null), 0.23)
    expect(combined.net).toBeCloseTo(1123)
    expect(combined.gross).toBeCloseTo(1230 + 123)
  })

  it('computeAmountDue: materiały enter netto at full brutto; brutto axis unchanged', () => {
    const r = computeAmountDue(1000, 300, justGross(123), 0.23, null)
    // netto: robocizna 1000 − wpłaty 300 + materiały 123 (raw brutto, not derived 100).
    expect(r.net).toBeCloseTo(823)
    expect(r.gross).toBeCloseTo(1230 - 300 + 123)
  })
})

// „Łącznie" = prace on their two planes + materiały as ONE billed figure. Materiały enters both
// axes at the same złoty because the panel prints it as a single merged cell — a total the reader
// cannot re-add from the cell above it is the defect this pins.
describe('combinedPair („Łącznie")', () => {
  it('prace gross, materiały enter both axes at the billed figure', () => {
    // materiały 123 brutto → billed 100 netto at a 23% rate.
    const combined = combinedPair(1000, billedMaterials(justGross(123), 0.23), 0.23)
    expect(combined.net).toBeCloseTo(1100)
    // 1230 + 100 — the SAME 100 the netto axis added, not the raw 123 receipt.
    expect(combined.gross).toBeCloseTo(1330)
  })

  it('the two axes differ by exactly the VAT on prace, never on materiały', () => {
    const combined = combinedPair(1000, 100, 0.23)
    expect(combined.gross - combined.net).toBeCloseTo(230)
  })

  it('vat = 0: both axes read the same figure', () => {
    expect(combinedPair(0, 500, 0)).toEqual({ net: 500, gross: 500 })
  })
})

describe('computeAmountDue', () => {
  it('materiały added at derived netto (net) and raw brutto (gross); wpłaty at face value', () => {
    const r = computeAmountDue(1000, 300, justGross(123), 0.23, 0.23)
    // netto: robocizna 1000 − wpłaty 300 + materiały 100 (billed).
    expect(r.net).toBeCloseTo(800)
    // brutto: robocizna 1000 → 1230, − wpłaty 300 + the same billed 100.
    expect(r.gross).toBeCloseTo(1230 - 300 + 100)
  })

  it('zero zaliczki: equals Łącznie (robocizna + materiały netto)', () => {
    const r = computeAmountDue(1000, 0, justGross(123), 0.23, 0.23)
    expect(r.net).toBeCloseTo(1100)
  })

  it('zaliczki exceeding R + M goes negative (overpaid)', () => {
    const r = computeAmountDue(1000, 1800, justGross(123), 0.23, 0.23)
    expect(r.net).toBeCloseTo(1000 - 1800 + 100)
    expect(r.gross).toBeCloseTo(1230 - 1800 + 100)
  })
})

// A strata is a cost the company swallowed, so the client stops owing exactly the złoty entered —
// the same złoty on both axes. That is what separates it from a rabat, which is a concession ON the
// price and therefore grosses: 1000 zł of rabat wipes 1230 zł of brutto debt, 1000 zł of strata
// wipes 1000 zł. Grossing it here would hand the client 230 zł nobody ever charged.
describe('strata enters the settlement at face value', () => {
  it('computeAmountDue: one loss lowers netto and brutto by the SAME złoty', () => {
    const base = computeAmountDue(1000, 300, justGross(123), 0.23, 0.23)
    const withLoss = computeAmountDue(1000, 300, justGross(123), 0.23, 0.23, 400)
    expect(base.net - withLoss.net).toBeCloseTo(400)
    expect(base.gross - withLoss.gross).toBeCloseTo(400)
  })

  it('computeMixedSettlement: a loss mirrors a wpłata netto on both sections', () => {
    const vat = 0.23
    const base = computeMixedSettlement(700, justGross(369), vat, 400, 200, vat)
    const withLoss = computeMixedSettlement(700, justGross(369), vat, 400, 200, vat, 150)
    expect(base.outstandingNet - withLoss.outstandingNet).toBeCloseTo(150)
    expect(base.remainderGross - withLoss.remainderGross).toBeCloseTo(150)
    // Both closing figures inherit the shift from the two terms above — no second deduction.
    expect(base.amountDueGross - withLoss.amountDueGross).toBeCloseTo(150)
    expect(base.amountDueNet - withLoss.amountDueNet).toBeCloseTo(150)
  })

  it('computeMixedSettlement: a loss lands exactly where an equal wpłata netto would', () => {
    const vat = 0.23
    const asDeposit = computeMixedSettlement(700, justGross(369), vat, 550, 200, vat)
    const asLoss = computeMixedSettlement(700, justGross(369), vat, 400, 200, vat, 150)
    expect(asLoss.outstandingNet).toBeCloseTo(asDeposit.outstandingNet)
    expect(asLoss.remainderGross).toBeCloseTo(asDeposit.remainderGross)
  })
})

// Rabat is an obniżka OF prace, so it grosses like prace. This guards the Podsumowanie brutto
// waterfall: the display composes Łącznie − Rabat − Wpłaty and it MUST land on Do zapłaty on the
// brutto axis too, not just netto — now with materiały entering as brutto (netto derived).
describe('Podsumowanie brutto waterfall (rabat grosses, materiały brutto)', () => {
  it('Łącznie − Rabat − Wpłaty === Do zapłaty on BOTH axes', () => {
    const laborCostsNet = 800 // do zapłaty, po rabacie
    const rabatNet = 200
    const materialsGross = 123 // → 100 netto at 23%
    const depositsTotal = 300
    const vat = 0.23

    const sumaPracNet = laborCostsNet + rabatNet // 1000, pre-rabat
    const combined = combinedPair(sumaPracNet, billedMaterials(justGross(materialsGross), vat), vat)
    const rabat = moneyPair(rabatNet, vat)
    const wplaty = faceValue(depositsTotal)
    const amountDue = computeAmountDue(
      laborCostsNet,
      depositsTotal,
      justGross(materialsGross),
      vat,
      vat,
    )

    expect(combined.net - rabat.net - wplaty.net).toBeCloseTo(amountDue.net)
    expect(combined.gross - rabat.gross - wplaty.gross).toBeCloseTo(amountDue.gross)
    // Concretely on the brutto axis: Łącznie (1000→1230 + 100) − rabat (200→246) − wpłaty 300.
    expect(amountDue.gross).toBeCloseTo(1230 + 100 - 246 - 300)
  })
})

// Two stacked sections: NETTO (Robocizna + Materiały = Łącznie → − wpłaty netto → Do rozliczenia
// netto) then BRUTTO (Do rozliczenia netto + VAT = Reszta brutto → − wpłaty brutto → Do zapłaty
// brutto). Only the still-owed netto is grossed, so netto deposits shield their złoty from VAT.
describe('computeMixedSettlement (tryb mieszany)', () => {
  const vat = 0.23
  const laborCostsNet = 700
  const materialsGross = 369 // netto = 300 after VAT strip (369 / 1.23)

  it('netto section: Łącznie = robocizna + materiały netto, minus wpłaty netto', () => {
    const s = computeMixedSettlement(laborCostsNet, justGross(materialsGross), vat, 400, 0, vat)
    expect(s.laborCostsNet).toBeCloseTo(700)
    expect(s.materialsBilled).toBeCloseTo(300)
    expect(s.combinedNet).toBeCloseTo(1000)
    expect(s.outstandingNet).toBeCloseTo(600) // 1000 − 400
  })

  // VAT rides the prace and nothing else, so the brutto section starts from „Łącznie" brutto — where
  // materiały already sits at face value — and the wpłaty come off it. Grossing the still-owed netto
  // instead swept materiały into the VAT: „Pozostało brutto" then quoted the same debt 69 zł above the
  // „Łącznie" brutto printed directly over it, on one screen. Every case here uses a materiały rate
  // DIFFERENT from the VAT rate, because at rate === vatRate the two formulas agree and the bug hides.
  it('brutto section: Łącznie brutto less the wpłaty netto, then wpłaty brutto pay it down', () => {
    const s = computeMixedSettlement(laborCostsNet, justGross(materialsGross), vat, 400, 200, vat)
    // Prace 700 × 1,23 = 861, materiały 300 at face → Łącznie brutto 1161; − 400 wpłaty netto.
    expect(s.remainderGross).toBeCloseTo(761)
    expect(s.amountDueGross).toBeCloseTo(561)
  })

  it('never grosses materiały: Reszta brutto reconciles with combinedPair', () => {
    const s = computeMixedSettlement(laborCostsNet, justGross(materialsGross), vat, 400, 0, vat)
    const combined = combinedPair(laborCostsNet, s.materialsBilled, vat)
    expect(s.remainderGross).toBeCloseTo(combined.gross - 400)
    // The old arithmetic — grossing Łącznie netto whole — is what this rules out.
    expect(s.remainderGross).not.toBeCloseTo(s.outstandingNet * (1 + vat))
  })

  it('no wpłaty netto: Reszta brutto IS Łącznie brutto', () => {
    const s = computeMixedSettlement(laborCostsNet, justGross(materialsGross), vat, 0, 0, vat)
    expect(s.outstandingNet).toBeCloseTo(1000)
    expect(s.remainderGross).toBeCloseTo(1161)
    expect(s.amountDueGross).toBeCloseTo(1161)
  })

  it('over-paying netto past Łącznie: both closing figures go negative (no clamp)', () => {
    const s = computeMixedSettlement(laborCostsNet, justGross(materialsGross), vat, 1500, 0, vat)
    expect(s.outstandingNet).toBeCloseTo(-500)
    expect(s.remainderGross).toBeCloseTo(1161 - 1500)
  })

  // The bug this guards: „Do zapłaty netto" divided the whole outstanding brutto by the VAT rate,
  // which de-grossed the wpłaty brutto along with it and credited the client less than they paid. A
  // wpłata is cash — VAT belongs to the prace alone (owner, 2026-08-07).
  it('credits wpłaty brutto at face value — a wpłata carries no VAT to strip', () => {
    const s = computeMixedSettlement(laborCostsNet, justGross(materialsGross), vat, 400, 200, vat)
    // Pozostało netto 600 − the wpłata as paid, 200. NOT 600 − 200 ÷ 1,23.
    expect(s.amountDueNet).toBeCloseTo(400)
    expect(s.amountDueNet).not.toBeCloseTo(600 - 200 / (1 + vat))
  })

  it('an extra złoty wpłacony brutto lowers the netto closing figure by exactly that złoty', () => {
    const base = computeMixedSettlement(
      laborCostsNet,
      justGross(materialsGross),
      vat,
      400,
      200,
      vat,
    )
    const more = computeMixedSettlement(
      laborCostsNet,
      justGross(materialsGross),
      vat,
      400,
      300,
      vat,
    )
    expect(base.amountDueNet - more.amountDueNet).toBeCloseTo(100)
  })

  it('vatRate = 0: no VAT — Reszta brutto equals Do rozliczenia netto', () => {
    const s = computeMixedSettlement(700, justGross(300), 0, 400, 100, 0)
    expect(s.materialsBilled).toBeCloseTo(300) // no VAT to strip
    expect(s.outstandingNet).toBeCloseTo(600)
    expect(s.remainderGross).toBeCloseTo(600)
    expect(s.amountDueGross).toBeCloseTo(500)
  })

  // The rate is a division on the receipt, the VAT a multiplication on the prace — two different
  // planes. Reading materiały off the VAT rate here is the shape of the bug that hid behind fixtures
  // where the two rates happened to match.
  it('grosses the prace at the VAT rate while materiały stays at its own billed figure', () => {
    const s = computeMixedSettlement(700, justGross(1100), vat, 0, 0, 0.1)
    expect(s.materialsBilled).toBeCloseTo(1000)
    expect(s.remainderGross).toBeCloseTo(700 * 1.23 + 1000)
  })

  it('the netto figure follows the investment rate, not the VAT rate', () => {
    const s = computeMixedSettlement(700, justGross(1100), vat, 0, 0, 0.1)
    expect(s.materialsBilled).toBeCloseTo(1000) // 1100 ÷ 1,1
    expect(s.combinedNet).toBeCloseTo(1700)
  })
})

// The netto/gross split of wpłaty that feeds the mixed-settlement gotówka target. The load-bearing
// rule is the owner's „brak wartości = netto": GROSS is the invoiced part, everything else (NET + null) is netto.
describe('bucketDepositsByPlane', () => {
  it('NET deposits bucket to paidNet, GROSS to paidGross', () => {
    const b = bucketDepositsByPlane([deposit(100, 'NET'), deposit(250, 'GROSS')])
    expect(b.paidNet).toBe(100)
    expect(b.paidGross).toBe(250)
  })

  it('a null (unmarked) deposit counts as NETTO, not brutto', () => {
    const b = bucketDepositsByPlane([deposit(100, 'GROSS'), deposit(400, null)])
    expect(b.paidNet).toBe(400)
    expect(b.paidGross).toBe(100)
  })

  it('all three states together: NET + null → paidNet, GROSS → paidGross', () => {
    const b = bucketDepositsByPlane([deposit(100, 'NET'), deposit(200, 'GROSS'), deposit(50, null)])
    expect(b.paidNet).toBe(150)
    expect(b.paidGross).toBe(200)
    // The two buckets always sum to the total wpłaty.
    expect(b.paidNet + b.paidGross).toBe(350)
  })

  it('empty list yields zeroed buckets', () => {
    const b = bucketDepositsByPlane([])
    expect(b).toEqual({
      paidNet: 0,
      paidGross: 0,
      total: 0,
      taggedNet: { total: 0, count: 0 },
      taggedGross: { total: 0, count: 0 },
    })
  })

  // The tagged tallies count ONLY what was actually typed — an unmarked deposit lands in paidNet by
  // the settlement ruling but must leave taggedNet at zero, or the plane warning reads "untagged" as
  // "contradicts the mode".
  it('tagged tallies exclude unmarked deposits', () => {
    const b = bucketDepositsByPlane([
      deposit(100, 'NET'),
      deposit(400, null),
      deposit(200, 'GROSS'),
    ])
    expect(b.paidNet).toBe(500)
    expect(b.taggedNet).toEqual({ total: 100, count: 1 })
    expect(b.taggedGross).toEqual({ total: 200, count: 1 })
  })
})

// GUARDS B1 / B5 — the netto expense type. The whole reason the two buckets are separate props is
// that the global „wszystko netto" toggle may reach ONE of them. These pin the seam by differencing
// against an identical composition with nothing billed netto, so they read the netto bucket's
// contribution directly rather than a hand-computed total.
describe('the netto-billed bucket is frozen against the materiały toggle', () => {
  const VAT = 0.23
  const REDUCTION = 0.08
  const NET_BILLED = 1000
  const GROSS_BASE = 123

  const lacznie = (materials: { grossBase: number; netBilled: number }, rate: number | null) =>
    combinedPair(1000, billedMaterials(materials, rate), VAT)

  it('B1: at a −8% toggle the netto bucket contributes its full amount, not ×0.92', () => {
    const base = lacznie(justGross(GROSS_BASE), REDUCTION)
    const withNet = lacznie({ grossBase: GROSS_BASE, netBilled: NET_BILLED }, REDUCTION)
    expect(withNet.net - base.net).toBeCloseTo(NET_BILLED)
    expect(withNet.net - base.net).not.toBeCloseTo(NET_BILLED / (1 + REDUCTION))
  })

  it('the VAT-strip default cannot reach it either', () => {
    const base = lacznie(justGross(GROSS_BASE), VAT)
    const withNet = lacznie({ grossBase: GROSS_BASE, netBilled: NET_BILLED }, VAT)
    expect(withNet.net - base.net).toBeCloseTo(NET_BILLED)
  })

  // „Pozostało do zapłaty" bills materiały once, so a netto expense moves BOTH axes by the same
  // netAmount — the grossed-up twin belongs to the Wydatki breakdown, which reads the two planes
  // separately, not to the settlement.
  it('a netto expense raises Pozostało do zapłaty by its netAmount on both axes', () => {
    const base = computeAmountDue(1000, 300, justGross(GROSS_BASE), VAT, REDUCTION)
    const withNet = computeAmountDue(
      1000,
      300,
      { grossBase: GROSS_BASE, netBilled: NET_BILLED },
      VAT,
      REDUCTION,
    )
    expect(withNet.net - base.net).toBeCloseTo(NET_BILLED)
    expect(withNet.gross - base.gross).toBeCloseTo(NET_BILLED)
  })

  it('B5: the aggregate carries the stored netAmount unrounded — list and summary agree', () => {
    const odd = 1234.56
    const pair = materialsPair({ grossBase: 0, netBilled: odd }, REDUCTION)
    expect(pair.net).toBe(odd)
    // Its brutto is the netto crossed to the other plane, never the stored figure repeated.
    expect(pair.gross).toBeCloseTo(odd * (1 + REDUCTION))
  })

  it('tryb mieszany sees it too — the netto section is not a separate composition', () => {
    const base = computeMixedSettlement(700, justGross(369), VAT, 400, 0, VAT)
    const withNet = computeMixedSettlement(
      700,
      { grossBase: 369, netBilled: NET_BILLED },
      VAT,
      400,
      0,
      VAT,
    )
    expect(withNet.combinedNet - base.combinedNet).toBeCloseTo(NET_BILLED)
  })
})

// A section subtotal reduced to the two fields the totals formula reads, so the fixture states the
// scenario instead of restating `sectionSubtotalsForView`'s whole output shape.
const subtotal = (net: number, discount: number): SectionSubtotalT => ({
  sectionId: 1,
  sectionName: 'Sekcja',
  sectionColor: null,
  net,
  plannedNet: net,
  discount,
  share: 1,
  completionRatio: null,
  itemCount: 1,
})

describe('sumaPracPreRabat — one „Robocizna", one number', () => {
  it('matches the suma prac the investment page reconciles against', () => {
    // Inwestycja 31: 18 000 zł wykonane, rabat na cały kosztorys 100 000 zł. The panel used to show
    // „Robocizna −82 000 zł" while „z kosztorysu" showed 18 000 zł — same label, two figures.
    const totals = clientTotalsFromSubtotals([subtotal(18_000, 0)], {
      type: 'amount',
      value: 100_000,
    })
    const laborCostsNet = totals.doneNet - totals.globalRabatNet
    expect(laborCostsNet).toBe(-82_000)

    expect(sumaPracPreRabat(laborCostsNet, totals.rabatClientNet)).toBe(totals.sumaPracNet)
    expect(totals.sumaPracNet).toBe(18_000)
  })

  it('holds for a per-item rabat too, not just a global one', () => {
    const totals = clientTotalsFromSubtotals([subtotal(9_200, 800)], { type: null, value: 0 })
    const laborCostsNet = totals.doneNet - totals.globalRabatNet

    expect(sumaPracPreRabat(laborCostsNet, totals.rabatClientNet)).toBe(totals.sumaPracNet)
    expect(totals.sumaPracNet).toBe(10_000)
  })

  it('relocating the rabat leaves Łącznie where it was: Robocizna − Rabat + Materiały', () => {
    const laborCostsNet = 90_000 // already post-rabat
    const rabatAmount = 10_000
    const materials = justGross(12_300)
    const combined = combinedPair(laborCostsNet, billedMaterials(materials, 0.23), 0.23)

    const rows =
      sumaPracPreRabat(laborCostsNet, rabatAmount) - rabatAmount + billedMaterials(materials, 0.23)

    expect(rows).toBeCloseTo(combined.net)
  })
})

// The reference defect, on the v2 settlement plane (investment 62): materiały the owner covered with
// a strata of the same amount, no robocizna and no wpłaty — the client owes nothing on either axis.
describe('investment 62 — an expense fully covered by a strata', () => {
  it('closes the settlement at zero on both planes', () => {
    const amountDue = computeAmountDue(0, 0, justGross(362.84), 0.23, null, 362.84)

    expect(amountDue.net).toBeCloseTo(0)
    expect(amountDue.gross).toBeCloseTo(0)
  })
})
