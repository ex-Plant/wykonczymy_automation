import { sectionColorForIndex } from '@/lib/kosztorys/section-colors'
import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
} from '@/lib/kosztorys/types'
import { fold, HEADER_BLOCK_ROWS, isFooterLabel } from './columns'
import { round6 } from '@/lib/utils/round'
import type { ResolvedLaborColumnsT } from './resolve-columns'

// The marker the owner types into Przedmiar + Pomiar on a row that is not a praca. A section header
// and a footer row are BOTH marked this way — the section name is the only thing separating them.
export const NON_ITEM_MARKER = 'x'

// The praca's own fields. The four subcontractor-override fields are missing on purpose: they come
// from the „zakres pracy" tabs, so the parser has no honest value for them and refuses to invent
// one — a placeholder `null` would read as „inherit the global coefficient", which is a cost the
// sheet never has.
export type ParsedItemT = Omit<
  KosztorysItemT,
  'wToolsOverrideType' | 'wToolsOverrideValue' | 'ownToolsOverrideType' | 'ownToolsOverrideValue'
>

export type ParsedLaborTabT = {
  sections: KosztorysSectionT[]
  items: ParsedItemT[]
  stages: KosztorysStageT[]
  progress: StageProgressT[]
  // 0-based index of the first footer row, so `footer-totals` reads the summary block without
  // re-deriving where the prace stop. -1 when the sheet has no footer.
  footerStart: number
  // Rows carrying a description above the first section header. They belong to no section, so they
  // cannot be imported — the count exists so the preview says so instead of losing them in silence.
  skippedBeforeFirstSection: number
  // 1-based sheet row per parsed praca, kept beside the items rather than on them: the items are
  // spread straight into inserts, and a stray field would ride along into the database.
  sheetRowByItemId: Map<number, number>
}

const text = (cell: unknown): string =>
  typeof cell === 'string' ? cell.trim() : cell == null ? '' : String(cell).trim()

const number = (cell: unknown): number => (typeof cell === 'number' ? cell : Number(cell) || 0)

// Where the summary block begins, found by walking up from the bottom rather than down from the top.
// Downwards, the footer is indistinguishable from a blank spacer row mid-sheet — both are marked and
// unnamed — and stopping at the first one truncates the import at that spacer, silently. Upwards
// there is no ambiguity: the footer is simply everything below the last praca, and a praca is an
// unmarked row with a description that isn't one of the summary labels.
function findFooterStart(grid: unknown[][], columns: ResolvedLaborColumnsT['columns']): number {
  for (let rowIndex = grid.length - 1; rowIndex >= HEADER_BLOCK_ROWS; rowIndex--) {
    const row = grid[rowIndex] ?? []
    if (fold(row[columns.plannedQty]) === NON_ITEM_MARKER) continue
    const description = text(row[columns.description])
    if (description && !isFooterLabel(fold(description))) {
      return rowIndex + 1 < grid.length ? rowIndex + 1 : -1
    }
  }
  return -1
}

// „Pomiar z natury" only means something when the owner TYPED it. On the blank offer sheet the
// column is `=SUM(D:M)` in every row, so importing its value would store Σ etapów and later compare
// it against Σ etapów — a reconciliation that can never fire. `number()` is deliberately not used:
// its `|| 0` would turn an empty cell into a measurement of zero, flagging every row nobody has
// measured yet.
function readMeasuredQty(
  row: unknown[],
  formulaRow: unknown[],
  column: number | undefined,
): number | null {
  if (column === undefined) return null
  if (typeof formulaRow[column] === 'string' && formulaRow[column].startsWith('=')) return null
  const cell = row[column]
  if (cell == null) return null
  if (typeof cell === 'string' && cell.trim() === '') return null
  const value = typeof cell === 'number' ? cell : Number(cell)
  return Number.isFinite(value) ? value : null
}

export function parseLaborTab(
  grid: unknown[][],
  resolved: ResolvedLaborColumnsT,
  // Required rather than defaulted: a caller that forgets it would silently import no measurement
  // at all, and the whole reconciliation would go quiet without a single failing test.
  formulas: unknown[][],
): ParsedLaborTabT {
  const { columns, stages: stageColumns } = resolved
  const sections: KosztorysSectionT[] = []
  const items: ParsedItemT[] = []
  const progress: StageProgressT[] = []
  const sheetRowByItemId = new Map<number, number>()

  const sectionIdByName = new Map<string, number>()
  let currentSectionId: number | undefined
  let nextSectionId = 1
  let nextItemId = 1
  let skippedBeforeFirstSection = 0

  const footerStart = findFooterStart(grid, columns)
  const lastRow = footerStart < 0 ? grid.length : footerStart

  for (let rowIndex = HEADER_BLOCK_ROWS; rowIndex < lastRow; rowIndex++) {
    const row = grid[rowIndex] ?? []
    const description = text(row[columns.description])

    if (fold(row[columns.plannedQty]) === NON_ITEM_MARKER) {
      const name = text(row[columns.section]) || description
      // A marked row is a section header — unless it has no name at all (a spacer), or its name is
      // one of the summary labels the owner sometimes types into the opis column mid-sheet. Either
      // would otherwise become a section, and every praca below it would be filed under it.
      if (!name || isFooterLabel(fold(name))) continue

      let sectionId = sectionIdByName.get(name)
      if (sectionId === undefined) {
        sectionId = nextSectionId++
        sectionIdByName.set(name, sectionId)
        sections.push({
          id: sectionId,
          name,
          displayOrder: sections.length,
          color: sectionColorForIndex(sections.length),
        })
      }
      currentSectionId = sectionId
      continue
    }

    if (!description) continue
    if (currentSectionId === undefined) {
      skippedBeforeFirstSection++
      continue
    }

    const discountFraction = columns.discount === undefined ? 0 : number(row[columns.discount])
    // The sheet stores rabat as a fraction (0,09); the app stores a percentage. A value of 1 or more
    // is a whole percent typed into the fraction column — 9 meaning 9%, not a 900% discount that
    // would price the praca deeply negative. A missing rabat is „no discount", not 0%: the two
    // render differently in the editor.
    const discountPercent =
      discountFraction >= 1 ? round6(discountFraction) : round6(discountFraction * 100)
    const itemId = nextItemId++
    sheetRowByItemId.set(itemId, rowIndex + 1)
    items.push({
      id: itemId,
      sectionId: currentSectionId,
      displayOrder: items.length,
      description,
      unit: text(row[columns.unit]) || null,
      plannedQty: number(row[columns.plannedQty]),
      discountType: discountFraction > 0 ? 'percent' : null,
      discountValue: discountFraction > 0 ? discountPercent : 0,
      clientPrice: number(row[columns.clientPrice]),
      sheetMeasuredQty: readMeasuredQty(row, formulas[rowIndex] ?? [], columns.measuredQty),
      note: null,
    })

    for (let stage = 0; stage < stageColumns.count; stage++) {
      const qtyDone = number(row[stageColumns.firstColumn + stage])
      if (qtyDone !== 0) progress.push({ itemId, stageId: stage + 1, qtyDone })
    }
  }

  // Every resolved etap column becomes an etap, including the trailing ones nobody has started —
  // deriving the count from the data would silently shrink the kosztorys. Label, plane and worker
  // stay empty: the sheet's row-3 stage names are crew scribbles, not the app's etap labels, and
  // plane/worker (EX-613) exist only in the app.
  const stages: KosztorysStageT[] = Array.from({ length: stageColumns.count }, (_, index) => ({
    id: index + 1,
    ordinal: index + 1,
    label: null,
    plane: null,
    workerId: null,
  }))

  return {
    sections,
    items,
    stages,
    progress,
    footerStart,
    skippedBeforeFirstSection,
    sheetRowByItemId,
  }
}
