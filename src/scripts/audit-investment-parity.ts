// READ-ONLY parity check for the investment financial figures.
//
// SCOPE SINCE EX-555: this audits the two TRANSACTION-PLANE aggregations against each other. It is
// not a check on what the listing renders, because since the read-switch an investment with a
// kosztorys draws its robocizna and rabat from there — so bilans, bilans brutto and marża on screen
// are DELIBERATELY not the figures below. Both sides here are fed transaction financials, so a
// kosztorys-plane investment cannot show up as an outlier; it is reported separately instead, as a
// reminder that its three switched figures are outside this net.
//
// WHY THIS EXISTS: the seven per-investment figures (bilans netto/brutto, marża,
// materiały, wydatki inwestycyjne, wypłaty, settled) are computed by TWO
// independent code paths that must always agree:
//   - listing path — sumAllInvestmentFinancials(): one batched aggregate over ALL
//     investments, used by the list view (fast, single query).
//   - detail path  — sumFilteredByType + sumCategoryByTypeSettled ->
//     deriveCategoryBreakdowns -> deriveFinancials(): per-investment, used by the
//     detail page.
// Because they're separate implementations, a change to the aggregation logic can
// silently make them drift apart. This script computes both for every investment,
// diffs them, and reports any mismatch — your regression net when touching
// src/lib/db/sum-transfers.ts or the calculate-* helpers.
//
// WORKFLOW: snapshot before a refactor, snapshot after, compare the two dumps:
//   node --env-file=.env --import tsx src/scripts/audit-investment-parity.ts before
//   node --env-file=.env --import tsx src/scripts/audit-investment-parity.ts after
// Writes dumps/parity-<label>.{json,csv} and prints outliers to stdout. A non-empty
// "Outliers" list means the two paths disagree — investigate before shipping.
//
// Avoids the next/cache-wrapped query wrappers (they throw outside Next): it calls the
// raw db aggregation functions directly and lists investments via payload.find.
import { mkdirSync, writeFileSync } from 'node:fs'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  sumAllInvestmentFinancials,
  sumFilteredByType,
  sumCategoryByTypeSettled,
  deriveCategoryBreakdowns,
  deriveFinancials,
} from '@/lib/db/sum-transfers'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import { getDb } from '@/lib/db/get-db'
import { calculateBalance } from '@/lib/db/calculate-balance'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { effectiveMaterialsNetRate, SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'
import { billedMaterials, grossBalance } from '@/lib/kosztorys/summary-economics'
import { DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { shapeInvestments } from '@/lib/queries/shape-investments'
import type { InvestmentRefT } from '@/types/reference-data'

type FiguresT = {
  bilans: number
  bilansBrutto: number
  marza: number
  materialy: number
  wydatkiInwestycyjne: number
  wyplaty: number
  settled: number
}

// The DETAIL side, assembled from the financials the panel reads — deliberately NOT the listing's
// formula. The two sides once shared one `figuresOf`, which made `wydatkiInwestycyjne` diff to zero
// by construction and let the plane defect ship unnoticed.
function detailFigures(f: InvestmentFinancialsT, inv: InvestmentRefT): FiguresT {
  const netRate = effectiveMaterialsNetRate(inv.settlementMode, inv.materialsNetRate)
  const bilans = calculateBalance(f)
  return {
    bilans,
    // The one figure with no second implementation to compare against, so this side calls the same
    // helper the row builder does. It still detects an ASSEMBLY drift (did the row get fed the right
    // financials?) — it cannot police the formula, and is not claimed to.
    bilansBrutto: grossBalance(bilans, inv.vatRate, f.totalLaborCosts, f.totalRabat),
    marza: calculateMargin(f),
    materialy: f.totalMaterialCosts,
    wydatkiInwestycyjne: billedMaterials(
      { grossBase: f.materialsGrossBase, netBilled: f.materialsNetBilled },
      netRate,
    ),
    wyplaty: f.totalPayouts,
    settled: f.totalSettled,
  }
}

// The LISTING side through the REAL row assembly — `shapeInvestments` is what the page renders, so
// a figure that only the row builder gets wrong still shows up here (lessons.md:19). The kosztorys
// totals argument is left empty on purpose: this side must stay on the same plane as `detailFigures`
// or every kosztorys-bearing investment diffs by design (see SCOPE at the top).
function listingFigures(f: InvestmentFinancialsT, inv: InvestmentRefT): FiguresT {
  const [row] = shapeInvestments([inv], { [String(inv.id)]: f })
  return {
    bilans: row.balance,
    bilansBrutto: row.balanceGross,
    marza: row.margin,
    materialy: row.totalMaterialCosts,
    wydatkiInwestycyjne: row.totalInvestmentExpense,
    wyplaty: row.totalPayouts,
    settled: row.totalSettled,
  }
}

// Compare at 2 dp — the two paths sum in different orders, so raw floats differ by
// sub-grosz noise that isn't a real mismatch.
const round2 = (n: number) => Math.round(n * 100) / 100
const FIGURE_KEYS: (keyof FiguresT)[] = [
  'bilans',
  'bilansBrutto',
  'marza',
  'materialy',
  'wydatkiInwestycyjne',
  'wyplaty',
  'settled',
]

async function main() {
  const label = process.argv[2] ?? 'snapshot'
  const payload = await getPayload({ config })

  // Every investment, no access filtering — this is an offline audit, not a user request.
  const invResult = await payload.find({
    collection: 'investments',
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  // The concession columns travel with each investment: the listing aggregate reads them from SQL,
  // so the detail path must be handed the same two or every investment with a rate set reports a
  // false mismatch on bilans and marża.
  const investments: InvestmentRefT[] = invResult.docs.map((d) => ({
    id: Number(d.id),
    name: String(d.name),
    status: d.status ?? 'active',
    active: d.status === 'active',
    address: d.address ?? '',
    phone: d.phone ?? '',
    email: d.email ?? '',
    contactPerson: d.contactPerson ?? '',
    notes: d.notes ?? '',
    review: d.review ?? '',
    hasSheet: false,
    materialsNetRate: d.materialsNetRate ?? null,
    settlementMode: d.settlementMode ?? SETTLEMENT_MODE_DEFAULT,
    vatRate: d.vatRate ?? DEFAULT_VAT,
  }))

  const listingMap = await sumAllInvestmentFinancials(payload)

  // Plane membership, read straight rather than through `selectKosztorysClientTotals`: that module is
  // `server-only` and this script runs under tsx. Presence of items is the whole switch condition, so
  // a count is the same answer the aggregate would give.
  const db = await getDb(payload)
  const planeRows = await db.execute(
    sql`SELECT DISTINCT investment_id FROM kosztorys_items WHERE investment_id IS NOT NULL`,
  )
  const kosztorysPlane = new Set(planeRows.rows.map((row) => Number(row.investment_id)))

  const rows = []
  for (const inv of investments) {
    const where = { investment: { equals: inv.id } }
    const [byType, catRows] = await Promise.all([
      sumFilteredByType(payload, where),
      sumCategoryByTypeSettled(payload, where),
    ])
    const breakdowns = deriveCategoryBreakdowns(catRows)
    const detailFin = deriveFinancials(
      byType,
      breakdowns.categoryCosts,
      breakdowns.settledCategoryCosts,
      inv.materialsNetRate,
      inv.settlementMode,
      breakdowns.netCategoryCosts,
    )
    const listingFin = listingMap.get(inv.id)

    const detail = detailFigures(detailFin, inv)
    // An investment with no transfers is absent from the listing aggregate; treat it
    // as all-zero so it still diffs against the detail path instead of crashing.
    const listing = listingFin
      ? listingFigures(listingFin, inv)
      : (Object.fromEntries(FIGURE_KEYS.map((k) => [k, 0])) as FiguresT)

    const diffs = FIGURE_KEYS.filter((k) => round2(listing[k]) !== round2(detail[k]))
    rows.push({
      id: inv.id,
      name: inv.name,
      listing,
      detail,
      match: diffs.length === 0,
      diffs,
      onKosztorysPlane: kosztorysPlane.has(inv.id),
    })
  }

  // `dumps/` is gitignored, so it is absent in a fresh clone or worktree — the audit is read-only
  // and must not die on its own output dir.
  mkdirSync('dumps', { recursive: true })
  writeFileSync(`dumps/parity-${label}.json`, JSON.stringify(rows, null, 2))

  const header = [
    'id',
    'name',
    ...FIGURE_KEYS.flatMap((k) => [`${k}_listing`, `${k}_detail`]),
    'match',
  ].join(',')
  const csvLines = rows.map((r) =>
    [
      r.id,
      `"${r.name.replace(/"/g, '""')}"`,
      ...FIGURE_KEYS.flatMap((k) => [round2(r.listing[k]), round2(r.detail[k])]),
      r.match ? 'TAK' : 'NIE',
    ].join(','),
  )
  writeFileSync(`dumps/parity-${label}.csv`, [header, ...csvLines].join('\n'))

  const onPlane = rows.filter((r) => r.onKosztorysPlane)
  if (onPlane.length > 0) {
    console.log(
      `\n${onPlane.length} investments read robocizna + rabat from the kosztorys — their bilans, ` +
        `bilans brutto and marża on screen are NOT the figures audited here:`,
    )
    for (const r of onPlane) console.log(`  #${r.id} ${r.name}`)
  }

  const outliers = rows.filter((r) => !r.match)
  console.log(`\n${rows.length} investments. Outliers: ${outliers.length}`)
  for (const o of outliers) {
    console.log(`  #${o.id} ${o.name} — differs on: ${o.diffs.join(', ')}`)
    for (const k of o.diffs) {
      console.log(`      ${k}: listing=${round2(o.listing[k])} detail=${round2(o.detail[k])}`)
    }
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
