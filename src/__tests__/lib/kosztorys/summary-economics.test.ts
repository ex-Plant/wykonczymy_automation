import { describe, expect, it } from 'vitest'
import {
  bucketDepositsByPlane,
  computeMixedSettlement,
  computeDoZaplatyRM,
  computeSummarySplit,
  faceValue,
  grossPair,
  materialsPair,
  materialyPair,
  moneyPair,
  sumaPracPreRabat,
  summaryLine,
  summaryLineMaterials,
} from '@/lib/kosztorys/summary-economics'
import { clientTotalsFromSubtotals } from '@/lib/kosztorys/settlement'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'
import type { DepositTransactionRowT } from '@/types/reference-data'

// Materiały with nothing billed netto — the pre-netto-type world, so the existing expectations
// keep reading as the brutto-only baseline they were written for.
const justGross = (grossBase: number) => ({ grossBase, netBilled: 0 })

const deposit = (amount: number, vatPlane: DepositTransactionRowT['vatPlane']) => ({
  amount,
  vatPlane,
})

describe('grossPair', () => {
  it('removes VAT to derive netto from a brutto figure (inverse of moneyPair)', () => {
    const p = grossPair(123, 0.23)
    expect(p.net).toBeCloseTo(100)
    expect(p.gross).toBe(123)
  })

  it('vat = 0 degenerates to netto === brutto', () => {
    const p = grossPair(500, 0)
    expect(p.net).toBe(500)
    expect(p.gross).toBe(500)
  })
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

  it('moneyPair and grossPair are inverse directions at the same rate', () => {
    // 100 netto → 123 brutto → back to 100 netto.
    expect(grossPair(moneyPair(100, 0.23).gross, 0.23).net).toBeCloseTo(100)
  })
})

describe('summary-row udział builders', () => {
  it('summaryLine: netto-native row, udział = net / Łącznie', () => {
    const line = summaryLine(250, 1000, 0.23)
    expect(line.net).toBe(250)
    expect(line.gross).toBeCloseTo(307.5) // 250 × 1.23
    expect(line.share).toBeCloseTo(0.25)
  })

  it('zero Łącznie yields share 0 in every builder (no division by zero)', () => {
    expect(summaryLine(250, 0, 0.23).share).toBe(0)
    expect(summaryLineMaterials({ grossBase: 123, netBilled: 0 }, 0, 0.23, true).share).toBe(0)
  })
})

describe('materialyPair (netto pricing switch)', () => {
  it('deriveNet=true removes VAT (netto = brutto ÷ 1+VAT), brutto native', () => {
    const p = materialyPair(123, 0.23, true)
    expect(p.net).toBeCloseTo(100)
    expect(p.gross).toBe(123)
  })

  it('deriveNet=false keeps the raw brutto on both axes (no reduction)', () => {
    const p = materialyPair(123, 0.23, false)
    expect(p.net).toBe(123)
    expect(p.gross).toBe(123)
  })
})

describe('materiały netto pricing off (deriveMaterialsNet=false)', () => {
  it('computeSummarySplit: materiały netto === brutto, so Łącznie netto keeps the full brutto', () => {
    const p = computeSummarySplit(1000, justGross(123), 0.23, false)
    // Materiały netto = Łącznie netto − robocizna netto = 123 (not the VAT-stripped 100).
    expect(p.combined.net - p.laborCosts.net).toBeCloseTo(123)
    expect(p.combined.net).toBeCloseTo(1123)
    // Brutto is unchanged by the switch: robocizna 1230 + materiały 123.
    expect(p.combined.gross).toBeCloseTo(1230 + 123)
  })

  it('computeDoZaplatyRM: materiały enter netto at full brutto; brutto axis unchanged', () => {
    const r = computeDoZaplatyRM(1000, 300, justGross(123), 0.23, false)
    // netto: robocizna 1000 − wpłaty 300 + materiały 123 (raw brutto, not derived 100).
    expect(r.net).toBeCloseTo(823)
    expect(r.gross).toBeCloseTo(1230 - 300 + 123)
  })
})

describe('computeSummarySplit', () => {
  it('materiały enters as BRUTTO — its netto is derived by removing VAT', () => {
    // materiały 123 brutto → 100 netto at 23%.
    const p = computeSummarySplit(1000, justGross(123), 0.23)
    // Materiały netto = Łącznie netto − robocizna netto.
    expect(p.combined.net - p.laborCosts.net).toBeCloseTo(100)
    expect(p.combined.net).toBeCloseTo(1100)
    // Robocizna is netto native (1000 → 1230); materiały is brutto native (123). Łącznie brutto sums
    // each side at its own native amount: 1230 + 123, NOT 1100 × 1.23.
    expect(p.laborCosts.gross).toBeCloseTo(1230)
    expect(p.combined.gross).toBeCloseTo(1230 + 123)
  })

  it('udziały sum to 1 (100%), materiały off the DERIVED netto', () => {
    const p = computeSummarySplit(1000, justGross(123), 0.23)
    expect(p.combined.share).toBe(1)
    expect(p.laborCosts.share).toBeCloseTo(1000 / 1100)
    expect(1 - p.laborCosts.share).toBeCloseTo(100 / 1100)
  })

  it('zero Łącznie yields 0 shares, no division by zero', () => {
    const p = computeSummarySplit(0, justGross(0), 0.23)
    expect(p.laborCosts.share).toBe(0)
    expect(p.combined.share).toBe(0)
    expect(p.combined.net).toBe(0)
  })

  it('vat = 0: materiały netto === brutto, Łącznie brutto === netto', () => {
    const p = computeSummarySplit(0, justGross(500), 0)
    expect(p.laborCosts.share).toBe(0)
    expect(p.combined.share).toBe(1)
    expect(p.combined.net).toBe(500)
    expect(p.combined.gross).toBe(500)
  })
})

describe('computeDoZaplatyRM', () => {
  it('materiały added at derived netto (net) and raw brutto (gross); wpłaty at face value', () => {
    const r = computeDoZaplatyRM(1000, 300, justGross(123), 0.23)
    // netto: robocizna 1000 − wpłaty 300 + materiały 100 (derived).
    expect(r.net).toBeCloseTo(800)
    // brutto: robocizna 1000 → 1230, − wpłaty 300 + materiały 123 (raw brutto).
    expect(r.gross).toBeCloseTo(1230 - 300 + 123)
  })

  it('zero zaliczki: equals Łącznie (robocizna + materiały netto)', () => {
    const r = computeDoZaplatyRM(1000, 0, justGross(123), 0.23)
    expect(r.net).toBeCloseTo(1100)
  })

  it('zaliczki exceeding R + M goes negative (overpaid)', () => {
    const r = computeDoZaplatyRM(1000, 1800, justGross(123), 0.23)
    expect(r.net).toBeCloseTo(1000 - 1800 + 100)
    expect(r.gross).toBeCloseTo(1230 - 1800 + 123)
  })
})

// Rabat is an obniżka OF prace, so it grosses like prace. This guards the Podsumowanie brutto
// waterfall: the display composes Łącznie − Rabat − Wpłaty and it MUST land on Do zapłaty on the
// brutto axis too, not just netto — now with materiały entering as brutto (netto derived).
describe('Podsumowanie brutto waterfall (rabat grosses, materiały brutto)', () => {
  it('Łącznie − Rabat − Wpłaty === Do zapłaty on BOTH axes', () => {
    const laborCostsNetFromKosztorys = 800 // do zapłaty, po rabacie
    const rabatNet = 200
    const materialsGross = 123 // → 100 netto at 23%
    const wplatyNet = 300
    const vat = 0.23

    const sumaPracNet = laborCostsNetFromKosztorys + rabatNet // 1000, pre-rabat
    const { combined } = computeSummarySplit(sumaPracNet, justGross(materialsGross), vat)
    const rabat = moneyPair(rabatNet, vat)
    const wplaty = faceValue(wplatyNet)
    const doZaplaty = computeDoZaplatyRM(
      laborCostsNetFromKosztorys,
      wplatyNet,
      justGross(materialsGross),
      vat,
    )

    expect(combined.net - rabat.net - wplaty.net).toBeCloseTo(doZaplaty.net)
    expect(combined.gross - rabat.gross - wplaty.gross).toBeCloseTo(doZaplaty.gross)
    // Concretely on the brutto axis: Łącznie (1000→1230 + 123) − rabat (200→246) − wpłaty 300.
    expect(doZaplaty.gross).toBeCloseTo(1230 + 123 - 246 - 300)
  })
})

// Two stacked sections: NETTO (Robocizna + Materiały = Łącznie → − wpłaty netto → Do rozliczenia
// netto) then BRUTTO (Do rozliczenia netto + VAT = Reszta brutto → − wpłaty brutto → Do zapłaty
// brutto). Only the still-owed netto is grossed, so netto deposits shield their złoty from VAT.
describe('computeMixedSettlement (tryb mieszany)', () => {
  const vat = 0.23
  const robocizna = 700
  const materialsGross = 369 // netto = 300 after VAT strip (369 / 1.23)

  it('netto section: Łącznie = robocizna + materiały netto, minus wpłaty netto', () => {
    const s = computeMixedSettlement(robocizna, justGross(materialsGross), vat, 400, 0)
    expect(s.robocizna).toBeCloseTo(700)
    expect(s.materialy).toBeCloseTo(300)
    expect(s.combinedNet).toBeCloseTo(1000)
    expect(s.doRozliczeniaNet).toBeCloseTo(600) // 1000 − 400
  })

  it('brutto section: only the still-owed netto is grossed, then wpłaty brutto pay it down', () => {
    const s = computeMixedSettlement(robocizna, justGross(materialsGross), vat, 400, 200)
    expect(s.resztaGross).toBeCloseTo(600 * 1.23) // Do rozliczenia netto + VAT
    expect(s.doZaplatyGross).toBeCloseTo(600 * 1.23 - 200) // − wpłaty brutto
  })

  it('no wpłaty netto: full Łącznie is grossed onto the invoice', () => {
    const s = computeMixedSettlement(robocizna, justGross(materialsGross), vat, 0, 0)
    expect(s.doRozliczeniaNet).toBeCloseTo(1000)
    expect(s.resztaGross).toBeCloseTo(1230)
    expect(s.doZaplatyGross).toBeCloseTo(1230)
  })

  it('over-paying netto past Łącznie: Do rozliczenia netto goes negative (no clamp)', () => {
    const s = computeMixedSettlement(robocizna, justGross(materialsGross), vat, 1500, 0)
    expect(s.doRozliczeniaNet).toBeCloseTo(-500)
    expect(s.resztaGross).toBeCloseTo(-500 * 1.23)
  })

  it('vatRate = 0: no VAT — Reszta brutto equals Do rozliczenia netto', () => {
    const s = computeMixedSettlement(700, justGross(300), 0, 400, 100)
    expect(s.materialy).toBeCloseTo(300) // no VAT to strip
    expect(s.doRozliczeniaNet).toBeCloseTo(600)
    expect(s.resztaGross).toBeCloseTo(600)
    expect(s.doZaplatyGross).toBeCloseTo(500)
  })

  it('materiały reduction overrides the VAT strip for the netto figure', () => {
    const s = computeMixedSettlement(700, justGross(1000), vat, 0, 0, true, 0.1)
    expect(s.materialy).toBeCloseTo(900) // 1000 × (1 − 0.1)
    expect(s.combinedNet).toBeCloseTo(1600)
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
    expect(b).toEqual({ paidNet: 0, paidGross: 0 })
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

  it('B1: at a −8% toggle the netto bucket contributes its full amount, not ×0.92', () => {
    const base = computeSummarySplit(1000, justGross(GROSS_BASE), VAT, true, REDUCTION)
    const withNet = computeSummarySplit(
      1000,
      { grossBase: GROSS_BASE, netBilled: NET_BILLED },
      VAT,
      true,
      REDUCTION,
    )
    expect(withNet.combined.net - base.combined.net).toBeCloseTo(NET_BILLED)
    expect(withNet.combined.net - base.combined.net).not.toBeCloseTo(NET_BILLED * (1 - REDUCTION))
  })

  it('the VAT-strip default cannot reach it either', () => {
    const base = computeSummarySplit(1000, justGross(GROSS_BASE), VAT)
    const withNet = computeSummarySplit(1000, { grossBase: GROSS_BASE, netBilled: NET_BILLED }, VAT)
    expect(withNet.combined.net - base.combined.net).toBeCloseTo(NET_BILLED)
  })

  it('both axes: a netto expense raises Do zapłaty .net AND .gross by exactly its netAmount', () => {
    const base = computeDoZaplatyRM(1000, 300, justGross(GROSS_BASE), VAT, true, REDUCTION)
    const withNet = computeDoZaplatyRM(
      1000,
      300,
      { grossBase: GROSS_BASE, netBilled: NET_BILLED },
      VAT,
      true,
      REDUCTION,
    )
    expect(withNet.net - base.net).toBeCloseTo(NET_BILLED)
    expect(withNet.gross - base.gross).toBeCloseTo(NET_BILLED)
  })

  it('udziały still sum to 1 — the bucket lands in the denominator, not after the shares', () => {
    const p = computeSummarySplit(
      1000,
      { grossBase: GROSS_BASE, netBilled: NET_BILLED },
      VAT,
      true,
      REDUCTION,
    )
    const materialy = summaryLineMaterials(
      { grossBase: GROSS_BASE, netBilled: NET_BILLED },
      p.combined.net,
      VAT,
      true,
      REDUCTION,
    )
    expect(p.laborCosts.share + materialy.share).toBeCloseTo(1)
    expect(p.combined.share).toBe(1)
  })

  it('B5: the aggregate row carries the stored netAmount unrounded — list and summary agree', () => {
    const odd = 1234.56
    const withNet = summaryLineMaterials({ grossBase: 0, netBilled: odd }, 0, VAT, true, REDUCTION)
    expect(withNet.net).toBe(odd)
    expect(withNet.gross).toBe(odd)
  })

  it('tryb mieszany sees it too — the netto section is not a separate composition', () => {
    const base = computeMixedSettlement(700, justGross(369), VAT, 400, 0)
    const withNet = computeMixedSettlement(
      700,
      { grossBase: 369, netBilled: NET_BILLED },
      VAT,
      400,
      0,
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
    const laborCostsNetFromKosztorys = totals.doneNet - totals.globalRabatNet
    expect(laborCostsNetFromKosztorys).toBe(-82_000)

    expect(sumaPracPreRabat(laborCostsNetFromKosztorys, totals.rabatClientNet)).toBe(
      totals.sumaPracNet,
    )
    expect(totals.sumaPracNet).toBe(18_000)
  })

  it('holds for a per-item rabat too, not just a global one', () => {
    const totals = clientTotalsFromSubtotals([subtotal(9_200, 800)], { type: null, value: 0 })
    const laborCostsNetFromKosztorys = totals.doneNet - totals.globalRabatNet

    expect(sumaPracPreRabat(laborCostsNetFromKosztorys, totals.rabatClientNet)).toBe(
      totals.sumaPracNet,
    )
    expect(totals.sumaPracNet).toBe(10_000)
  })

  it('relocating the rabat leaves Łącznie where it was: Robocizna − Rabat + Materiały', () => {
    const laborCostsNetFromKosztorys = 90_000 // already post-rabat
    const rabatAmount = 10_000
    const materials = justGross(12_300)
    const { combined } = computeSummarySplit(laborCostsNetFromKosztorys, materials, 0.23)

    const rows =
      sumaPracPreRabat(laborCostsNetFromKosztorys, rabatAmount) -
      rabatAmount +
      materialsPair(materials, 0.23, true).net

    expect(rows).toBeCloseTo(combined.net)
  })
})
