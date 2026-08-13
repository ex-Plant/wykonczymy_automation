import type { SheetMeasuredQtyRowT } from '@/lib/db/kosztorys-sheet-measured-qty'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type { KosztorysItemT } from '@/lib/kosztorys/types'
import { keyItems } from './item-key'
import { parseRobocizna } from './parse-robocizna'
import type { ImportGridsT } from './read-sheet'
import { resolveRobocizna } from './resolve-columns'

export type MeasuredQtyRefreshT = {
  rows: SheetMeasuredQtyRowT[]
  // Pozycje the app holds that the sheet no longer names — left alone, since the sheet has said
  // nothing about them rather than said zero.
  unmatched: number
}

export type MeasuredQtyRefreshResultT =
  | { ok: true; refresh: MeasuredQtyRefreshT }
  | { ok: false; problems: string[] }

/**
 * Pair the sheet's pozycje with the stored ones and hand back what „Zaciągnij pomiary z arkusza"
 * should write.
 *
 * A matched pozycja whose sheet Pomiar is a formula or an empty cell yields `null`, not a skip: the
 * sheet stopped claiming a hand-typed measurement, and a stale reference figure surviving that would
 * make „Rozjazd" answer with a number nobody stands behind any more.
 */
export function buildMeasuredQtyRefresh(
  grids: ImportGridsT,
  currentTree: SnapshotPayloadT,
): MeasuredQtyRefreshResultT {
  const resolved = resolveRobocizna(grids.robocizna)
  if (!resolved.ok) return { ok: false, problems: resolved.problems }

  const parsed = parseRobocizna(grids.robocizna, resolved, grids.robociznaFormulas)

  const sheetSectionName = new Map(parsed.sections.map((section) => [section.id, section.name]))
  const appSectionName = new Map(currentTree.sections.map((section) => [section.id, section.name]))

  const sheetByKey = keyItems(
    parsed.items as unknown as KosztorysItemT[],
    (item) => sheetSectionName.get(item.sectionId) ?? '',
  )
  const appByKey = keyItems(currentTree.items, (item) => appSectionName.get(item.sectionId) ?? '')

  const rows: SheetMeasuredQtyRowT[] = []
  let unmatched = 0
  for (const [key, item] of appByKey) {
    const fromSheet = sheetByKey.get(key)
    if (!fromSheet) {
      unmatched++
      continue
    }
    rows.push({ id: item.id, qty: fromSheet.sheetMeasuredQty })
  }
  return { ok: true, refresh: { rows, unmatched } }
}
