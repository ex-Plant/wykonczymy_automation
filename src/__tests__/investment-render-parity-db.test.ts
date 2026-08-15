import { describe, it, expect, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import {
  sumAllInvestmentFinancials,
  sumFilteredByType,
  sumCategoryByTypeSettled,
  deriveFinancials,
  deriveCategoryBreakdowns,
} from '@/lib/db/sum-transfers'
import { getDb } from '@/lib/db/get-db'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { buildFinancialFields } from '@/lib/db/map-category-costs'
import { computeSummary } from '@/components/ui/toggle-stat-buttons'
import { round2 } from '@/__tests__/helpers/money'
import {
  SETTLEMENT_MODE_DEFAULT,
  effectiveMaterialsNetRate,
  type SettlementModeT,
} from '@/lib/kosztorys/settlement-mode'
import { billedMaterials } from '@/lib/kosztorys/summary-economics'
import { grossBalance } from '@/lib/db/gross-balance'
import { DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { shapeInvestments } from '@/lib/queries/shape-investments'
import { selectKosztorysClientTotals } from '@/lib/db/kosztorys-client-totals'
import { financialsOnReading, readingFromKosztorys } from '@/lib/kosztorys/summary-reading'
import type { KosztorysClientTotalsMapT } from '@/lib/queries/balances'
import type { InvestmentRefT, InvestmentStatusT } from '@/types/reference-data'

// REAL-PATH parity: assemble each figure exactly the way each PAGE assembles it, over
// the real DB, for every investment — then assert listing == detail.
//   listing (queries/shape-investments.ts): the REAL row builder the list view renders
//   detail  (page + financial-stats): sum of visible buildFinancialFields(...) / calculateMargin
//     with settled re-summed from buildSettledFields — exactly as financial-stats.tsx does.
//
// Both sides read robocizna and rabat from the KOSZTORYS, because that is the plane the listing is
// on. The v1 cards render the transactions plane by design — comparing the listing against those
// would assert that two deliberately different readings agree, which is not what this guards. What
// it guards is `shapeInvestments` drifting from the detail formulas (lessons.md:19).
//
// Gated like test:parity: skips with no DB env (portable), FAILS if env is set but DB
// is unreachable. Run via `pnpm test:parity`.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('listing vs detail RENDERED parity — real assembly paths (DB)', () => {
  let payload: Payload | null = null
  // Rate and mode ride along because the LISTING side gets them (sum-transfers looks them up per
  // investment). Deriving the detail side without them compares two different formulas the moment
  // any investment has a rate saved.
  let investments: InvestmentRefT[] = []
  let expenseCategories: { id: number; name: string }[] = []
  let setupError: unknown = null

  beforeAll(async () => {
    try {
      const { getPayload } = await import('payload')
      const config = (await import('@payload-config')).default
      payload = await getPayload({ config })
      const inv = await payload.find({
        collection: 'investments',
        limit: 0,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
      investments = inv.docs.map((d) => ({
        id: Number(d.id),
        name: String(d.name),
        status: (d.status as InvestmentStatusT) ?? 'active',
        active: d.status === 'active',
        address: String(d.address ?? ''),
        phone: String(d.phone ?? ''),
        email: String(d.email ?? ''),
        contactPerson: String(d.contactPerson ?? ''),
        notes: String(d.notes ?? ''),
        review: String(d.review ?? ''),
        hasSheet: false,
        materialsNetRate: d.materialsNetRate ?? null,
        settlementMode: (d.settlementMode as SettlementModeT) ?? SETTLEMENT_MODE_DEFAULT,
        vatRate: d.vatRate ?? DEFAULT_VAT,
      }))
      const db = await getDb(payload)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cats: any = await db.execute('SELECT id, name FROM expense_categories ORDER BY name')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expenseCategories = cats.rows.map((r: any) => ({ id: Number(r.id), name: String(r.name) }))
    } catch (e) {
      setupError = e
    }
  })

  it('every figure shown on the listing equals the one shown on the detail page', async () => {
    if (setupError || !payload) {
      throw new Error(
        `real-path parity could not reach the DB — env is set, so this is a failure, not a skip. ` +
          `Cause: ${String(setupError)}`,
      )
    }

    const listingMap = await sumAllInvestmentFinancials(payload)
    const kosztorysTotals: KosztorysClientTotalsMapT = {}
    for (const row of await selectKosztorysClientTotals(await getDb(payload))) {
      const { investmentId, ...totals } = row
      kosztorysTotals[String(investmentId)] = totals
    }

    const mismatches: string[] = []
    for (const inv of investments) {
      const where = { investment: { equals: inv.id } }
      const [byType, catRows] = await Promise.all([
        sumFilteredByType(payload, where),
        sumCategoryByTypeSettled(payload, where),
      ])
      const breakdowns = deriveCategoryBreakdowns(catRows)
      const detailFin = financialsOnReading(
        deriveFinancials(
          byType,
          breakdowns.categoryCosts,
          breakdowns.settledCategoryCosts,
          inv.materialsNetRate,
          inv.settlementMode,
          breakdowns.netCategoryCosts,
        ),
        readingFromKosztorys(kosztorysTotals[String(inv.id)]),
      )

      // LISTING assembly — the REAL row builder, not a re-derivation of its formulas. A figure the
      // listing gets wrong ONLY inside `shapeInvestments` is exactly what slipped past this spec
      // before (lessons.md:19).
      // Always through the row builder, even with no transfers at all: the listing renders such an
      // investment too, and its kosztorys robocizna has to show up there like anywhere else.
      const listingFin = listingMap.get(inv.id)
      const [listingRow] = shapeInvestments(
        [inv],
        listingFin ? { [String(inv.id)]: listingFin } : {},
        kosztorysTotals,
      )

      // DETAIL assembly (mirrors inwestycje/[id]/page.tsx + financial-stats.tsx)
      const fields = buildFinancialFields(detailFin, expenseCategories)
      // The formula ToggleStatButtons renders, over every card (nothing hidden) — FinancialStats
      // partitions `fields` into rows without dropping any, so rows.flat() is `fields`.
      const detailBilans = computeSummary(fields, new Set())
      const netRate = effectiveMaterialsNetRate(inv.settlementMode, inv.materialsNetRate)

      const compare: [string, number, number][] = [
        ['bilans', listingRow?.balance ?? 0, detailBilans],
        ['marża', listingRow?.margin ?? 0, calculateMargin(detailFin)],
        [
          // The plane the defect lived on — bilans and marża both looked healthy while this drifted.
          'wydatki inwestycyjne',
          listingRow?.totalInvestmentExpense ?? 0,
          billedMaterials(
            { grossBase: detailFin.materialsGrossBase, netBilled: detailFin.materialsNetBilled },
            netRate,
          ),
        ],
        [
          'bilans brutto',
          listingRow?.balanceGross ?? 0,
          grossBalance(
            detailBilans,
            inv.vatRate,
            detailFin.totalLaborCosts,
            detailFin.totalDiscount,
          ),
        ],
        ['wliczone w robociznę', listingRow?.totalSettled ?? 0, detailFin.totalSettled],
      ]
      for (const [label, listing, detail] of compare) {
        if (round2(listing) !== round2(detail)) {
          mismatches.push(
            `#${inv.id} ${inv.name} · ${label}: listing=${round2(listing)} detail=${round2(detail)}`,
          )
        }
      }
    }

    expect(mismatches).toEqual([])
    expect(investments.length).toBeGreaterThan(0)
  })
})
