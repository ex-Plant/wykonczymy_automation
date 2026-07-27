import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { getDb } from '@/lib/db/get-db'
import {
  selectInvestmentKosztorysSettings,
  selectKosztorysItems,
  selectKosztorysSections,
  selectKosztorysStages,
  selectStageProgress,
} from '@/lib/db/kosztorys-tree'
import { DEFAULT_COEFFS, DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { perfStart } from '@/lib/perf'
import type { KosztorysItemT, KosztorysSectionT, KosztorysTreeT } from '@/lib/kosztorys/types'

// The five reads below share one Promise.all, so a lap timer would credit the entire wall-clock to
// whichever settled last and report the other four as ~0ms. Each read times itself instead, which is
// what makes the slowest of the five identifiable rather than just the batch total.
async function timedRead<T>(
  label: string,
  run: () => Promise<T>,
  rowCount: (result: T) => number,
): Promise<T> {
  const elapsed = perfStart()
  const result = await run()
  console.log(`[PERF] query.kosztorysTree.${label} ${elapsed()}ms (${rowCount(result)} rows)`)
  return result
}

// S-01: sections + items of a single investment, ordered by displayOrder → displayOrder.
// S-04: stages (ordered by ordinal) + sparse per-item progress. S-05: per-investment VAT rate.
export async function getKosztorysTree(investmentId: number): Promise<KosztorysTreeT> {
  // DAL guard: the read authorizes itself rather than trusting its caller. requireAuth's session
  // lookup is React-cache()'d, so a page that already guards pays for this only once.
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  return buildKosztorysTree(investmentId)
}

// The tree-building body, split from the guard above so the client-share read paths
// (lib/queries/client-kosztorys.ts) — one of which is deliberately unauthenticated — reach the same
// tree through the same code. Two copies of this mapping would drift, and the client projection
// would then be projecting a different tree from the one the owner edits.
export async function buildKosztorysTree(investmentId: number): Promise<KosztorysTreeT> {
  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const setupMs = elapsed()

  const [sectionRows, items, stages, progress, investment] = await Promise.all([
    timedRead('sections', () => selectKosztorysSections(db, investmentId), (r) => r.length),
    timedRead('items', () => selectKosztorysItems(db, investmentId), (r) => r.length),
    timedRead('stages', () => selectKosztorysStages(db, investmentId), (r) => r.length),
    timedRead('progress', () => selectStageProgress(db, investmentId), (r) => r.length),
    timedRead(
      'investment',
      () => selectInvestmentKosztorysSettings(db, investmentId),
      () => 1,
    ),
  ])
  const queriesMs = elapsed()

  if (!investment) throw new Error(`Investment ${investmentId} not found`)

  // Distinguish an unset coefficient from a legitimate 0 — `|| default` would rewrite a stored 0.
  const globalCoeffs = {
    wTools: investment.wToolsCoeff ?? DEFAULT_COEFFS.wTools,
    ownTools: investment.ownToolsCoeff ?? DEFAULT_COEFFS.ownTools,
  }

  // Bucket items by section in one O(items) pass — a per-section filter would be O(sections × items),
  // quadratic at the 1000+-row bar this editor targets.
  const itemsBySection = new Map<number, KosztorysItemT[]>()
  for (const it of items) {
    const bucket = itemsBySection.get(it.sectionId)
    if (bucket) bucket.push(it)
    else itemsBySection.set(it.sectionId, [it])
  }

  const sections: (KosztorysSectionT & { items: KosztorysItemT[] })[] = sectionRows.map(
    (section) => ({ ...section, items: itemsBySection.get(section.id) ?? [] }),
  )

  // Split from the query time because they answer different questions: a slow `queries` number argues
  // for caching or aggregating in SQL, a slow `map` number argues that materialising the tree in JS is
  // itself the cost — and only one of those is fixed by a cache.
  const mapMs = elapsed()
  console.log(
    `[PERF] buildKosztorysTree ${setupMs + queriesMs + mapMs}ms ` +
      `(setup ${setupMs}ms, queries ${queriesMs}ms, map ${mapMs}ms) ` +
      `[inv ${investmentId}: ${sections.length} sections, ${items.length} items, ` +
      `${stages.length} stages, ${progress.length} progress]`,
  )

  return {
    sections,
    stages,
    progress,
    globalCoeffs,
    vatRate: investment.vatRate ?? DEFAULT_VAT,
    settlementMode: investment.settlementMode,
    materialsNetRate: investment.materialsNetRate ?? null,
    globalDiscount: {
      // Amount-only stored discount — fail closed on a legacy 'percent' row (treat it as none).
      type: investment.globalDiscountType === 'amount' ? 'amount' : null,
      value: investment.globalDiscountValue,
    },
    revision: investment.updatedAt,
  }
}
