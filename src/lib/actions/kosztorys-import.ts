'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { setSheetMeasuredQty } from '@/lib/db/kosztorys-sheet-measured-qty'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import {
  buildImportPlan,
  type ImportPlanT,
  type ImportReportT,
} from '@/lib/kosztorys/sheet-import/build-import-plan'
import { buildMeasuredQtyRefresh } from '@/lib/kosztorys/sheet-import/build-measured-qty-refresh'
import {
  buildSheetComparison,
  type SheetComparisonT,
} from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import { MissingRobociznaTabError, readImportGrids } from '@/lib/kosztorys/sheet-import/read-sheet'
import { getReadonlySheetsClient } from '@/lib/google/readonly-sheets-client'
import type { ActionResultT } from '@/types/action'

const PRE_IMPORT_LABEL = 'Przed importem z arkusza Google'

export type ImportPreviewT = { report: ImportReportT; problems: string[] }

export type RefreshMeasuredQtyResultT = {
  updated: number
  cleared: number
  unmatched: number
}

export type ApplyImportResultT = {
  sections: number
  items: number
  stages: number
  droppedWorkerAssignments: number
}

// Reading the sheet and merging it with the current tree — the single derivation both actions run,
// so the preview can never describe an import different from the one apply performs.
async function derivePlan(investmentId: number, spreadsheetId: string): Promise<ImportPlanT> {
  const grids = await readImportGrids(getReadonlySheetsClient(), spreadsheetId)
  return buildImportPlan(grids, await serializeKosztorys(investmentId))
}

const MISSING_SHEET = 'Inwestycja nie ma kosztorysu.'
const SHEET_UNREADABLE = 'Nie udało się odczytać arkusza Google. Spróbuj ponownie za chwilę.'

// Google's own errors are English, unactionable („The caller does not have permission") and would
// land in a Polish toast. Only the one failure the owner can actually fix — no `kosztorys_robocizny`
// tab — keeps its own wording; everything else becomes one message and a log line.
function sheetFailureMessage(error: unknown): string {
  if (error instanceof MissingRobociznaTabError) return error.message
  // TODO(EX-449) SENTRY-REQUIRED: capture the underlying Google error, not just the console line.
  console.error('[kosztorys-import] sheet read failed', error)
  return SHEET_UNREADABLE
}

export async function previewKosztorysImport(
  investmentId: number,
): Promise<ActionResultT<ImportPreviewT>> {
  return protectedAction<ImportPreviewT>('previewKosztorysImport', async ({ payload }) => {
    const spreadsheetId = await getInvestmentSheetId(payload, investmentId)
    if (!spreadsheetId) return { success: false, error: MISSING_SHEET }

    try {
      const plan = await derivePlan(investmentId, spreadsheetId)
      // The tree stays on the server: the browser has no use for it, and shipping it would invite a
      // round-trip that apply would have to distrust anyway.
      return plan.ok
        ? { success: true, data: { report: plan.report, problems: [] } }
        : { success: true, data: { report: emptyReport(), problems: plan.problems } }
    } catch (error) {
      return { success: false, error: sheetFailureMessage(error) }
    }
  })
}

// A failed resolution still renders a dialog, so the preview needs a report shape to render nothing
// with — the problems list is what the owner reads and the confirm button is what it disables.
function emptyReport(): ImportReportT {
  return {
    columns: [],
    counts: { sections: 0, items: 0, stages: 0 },
    rateDecisions: [],
    retained: [],
    totals: [],
    warnings: [],
  }
}

/**
 * „Porównaj z arkuszem" — a live read that writes nothing, so it carries no revalidation tags and is
 * never cached: every open asks the sheet what it says right now.
 *
 * Lives here rather than in `lib/queries` (where an on-demand client read normally belongs) because
 * it shares `getInvestmentSheetId`, `readImportGrids` and `sheetFailureMessage` with the import pair
 * above — splitting them would duplicate the failure-message translation and give the two
 * sheet-reading dialogs two different error shapes.
 */
export async function compareWithSheet(
  investmentId: number,
): Promise<ActionResultT<SheetComparisonT>> {
  return protectedAction<SheetComparisonT>('compareWithSheet', async ({ payload }) => {
    const spreadsheetId = await getInvestmentSheetId(payload, investmentId)
    if (!spreadsheetId) return { success: false, error: MISSING_SHEET }

    try {
      const grids = await readImportGrids(getReadonlySheetsClient(), spreadsheetId)
      const built = buildSheetComparison(grids, await serializeKosztorys(investmentId))
      return built.ok
        ? { success: true, data: built.comparison }
        : { success: false, error: built.problems.join(' ') }
    } catch (error) {
      return { success: false, error: sheetFailureMessage(error) }
    }
  })
}

/**
 * „Zaciągnij pomiary z arkusza" — refresh the stored reference quantity on every matched pozycja
 * without the wipe-and-reinsert an import performs. Takes only the investment id, for the same reason
 * `applyKosztorysImport` does: the browser has already been shown the comparison, but what gets
 * written is re-derived here.
 */
export async function refreshSheetMeasuredQty(
  investmentId: number,
): Promise<ActionResultT<RefreshMeasuredQtyResultT>> {
  return protectedAction<RefreshMeasuredQtyResultT>(
    'refreshSheetMeasuredQty',
    async ({ payload }) => {
      const spreadsheetId = await getInvestmentSheetId(payload, investmentId)
      if (!spreadsheetId) return { success: false, error: MISSING_SHEET }

      let built: ReturnType<typeof buildMeasuredQtyRefresh>
      try {
        const grids = await readImportGrids(getReadonlySheetsClient(), spreadsheetId)
        built = buildMeasuredQtyRefresh(grids, await serializeKosztorys(investmentId))
      } catch (error) {
        return { success: false, error: sheetFailureMessage(error) }
      }
      if (!built.ok) return { success: false, error: built.problems.join(' ') }

      const { rows, unmatched } = built.refresh
      await setSheetMeasuredQty(await getDb(payload), rows)

      return {
        success: true,
        data: {
          updated: rows.filter((row) => row.qty !== null).length,
          cleared: rows.filter((row) => row.qty === null).length,
          unmatched,
        },
      }
    },
    [...KOSZTORYS_TREE_TAGS],
  )
}

// Takes no plan from the client: it re-reads the sheet and rebuilds, so a forged preview payload
// cannot decide what gets written.
export async function applyKosztorysImport(
  investmentId: number,
): Promise<ActionResultT<ApplyImportResultT>> {
  return protectedAction<ApplyImportResultT>(
    'applyKosztorysImport',
    async ({ payload, user }) => {
      const spreadsheetId = await getInvestmentSheetId(payload, investmentId)
      if (!spreadsheetId) return { success: false, error: MISSING_SHEET }

      let plan: ImportPlanT
      try {
        plan = await derivePlan(investmentId, spreadsheetId)
      } catch (error) {
        return { success: false, error: sheetFailureMessage(error) }
      }
      if (!plan.ok) return { success: false, error: plan.problems.join(' ') }

      const restored = await replaceTreeWithSnapshot(payload, {
        investmentId,
        label: PRE_IMPORT_LABEL,
        takenBy: user.id,
        tree: plan.tree,
      })

      return {
        success: true,
        data: {
          sections: plan.tree.sections.length,
          items: plan.tree.items.length,
          stages: plan.tree.stages.length,
          droppedWorkerAssignments: restored.droppedWorkerAssignments,
        },
      }
    },
    [...KOSZTORYS_TREE_TAGS],
  )
}
