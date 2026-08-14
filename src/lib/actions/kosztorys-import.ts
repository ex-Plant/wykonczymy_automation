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
import {
  classifySheetFailure,
  readImportGrids,
  ROBOCIZNA_TAB,
  type SheetFailureReasonT,
} from '@/lib/kosztorys/sheet-import/read-sheet'
import { getReadonlySheetsClient } from '@/lib/google/readonly-sheets-client'
import { serviceAccountEmail } from '@/lib/google/sheet-access'
import type { ActionResultT } from '@/types/action'

const PRE_IMPORT_LABEL = 'Przed importem z arkusza Google'

// A read that never happened, carried as DATA rather than as a red toast — the dialog needs
// somewhere to render the address a sheet has to be shared with, and a copy button beside it.
export type SheetFailureT = {
  reason: SheetFailureReasonT
  // Filled only for `forbidden`. Everywhere else the address is not the answer, and showing it would
  // send the owner off sharing a sheet that is already shared.
  serviceAccountEmail: string | null
}

export type ImportPreviewT = {
  report: ImportReportT
  problems: string[]
  failure: SheetFailureT | null
}

export type RefreshMeasuredQtyResultT = {
  updated: number
  cleared: number
  unmatched: number
}

// Both halves are null exactly when `failure` is set: the comparison describes a read that did not
// happen, and the refresh is deliberately skipped — writing a figure off an unreadable sheet would
// be worse than leaving the stored one alone.
export type SheetCompareResultT = {
  comparison: SheetComparisonT | null
  refresh: RefreshMeasuredQtyResultT | null
  failure: SheetFailureT | null
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

const FAILURE_MESSAGES: Record<SheetFailureReasonT, string> = {
  forbidden: 'Arkusz Google nie jest udostępniony kontu usługi tej aplikacji.',
  'not-found': 'Arkusz Google o tym identyfikatorze nie istnieje albo został usunięty.',
  'missing-tab': `Arkusz Google nie ma zakładki „${ROBOCIZNA_TAB}".`,
  unknown: 'Nie udało się odczytać arkusza Google. Spróbuj ponownie za chwilę.',
}

// Google's own errors are English, unactionable („The caller does not have permission") and would
// land in a Polish toast — so the reason is translated here. Only a genuine outage is logged: a
// sheet nobody shared is not a fault worth reporting, it is a thing the owner has to do.
function toSheetFailure(error: unknown): SheetFailureT {
  const reason = classifySheetFailure(error)
  if (reason === 'unknown') {
    // TODO(EX-449) SENTRY-REQUIRED: capture the underlying Google error, not just the console line.
    console.error('[kosztorys-import] sheet read failed', error)
  }
  return { reason, serviceAccountEmail: reason === 'forbidden' ? serviceAccountEmail() : null }
}

// „Pobierz i zastąp" has nothing to render — it refuses the write and says why in one sentence.
function sheetFailureMessage(error: unknown): string {
  return FAILURE_MESSAGES[toSheetFailure(error).reason]
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
        ? { success: true, data: { report: plan.report, problems: [], failure: null } }
        : { success: true, data: { report: emptyReport(), problems: plan.problems, failure: null } }
    } catch (error) {
      return {
        success: true,
        data: { report: emptyReport(), problems: [], failure: toSheetFailure(error) },
      }
    }
  })
}

// A failed resolution still renders a dialog, so the preview needs a report shape to render nothing
// with — the problems list is what the owner reads and the confirm button is what it disables.
function emptyReport(): ImportReportT {
  return {
    missingColumns: [],
    candidates: [],
    counts: { sections: 0, items: 0, stages: 0 },
    rateDecisions: [],
    retained: [],
    totals: [],
    warnings: [],
  }
}

/**
 * „Porównaj z arkuszem" — a live read that also refreshes the stored reference quantity, in one pass.
 *
 * The refresh is not a decision: the stored figure is a copy of the sheet's Pomiar, so once the sheet
 * has been read live, „keep the stale copy" is not an answer anybody would pick (owner, 2026-08-14).
 * Folding it in here also keeps it to ONE sheet read — two actions each calling `readImportGrids`
 * would have doubled the Google round-trip for a single open.
 *
 * Lives here rather than in `lib/queries` (where an on-demand client read normally belongs) because
 * it shares `getInvestmentSheetId`, `readImportGrids` and `sheetFailureMessage` with the import pair
 * above — splitting them would duplicate the failure-message translation and give the two
 * sheet-reading dialogs two different error shapes.
 */
export async function compareWithSheet(
  investmentId: number,
): Promise<ActionResultT<SheetCompareResultT>> {
  return protectedAction<SheetCompareResultT>(
    'compareWithSheet',
    async ({ payload }) => {
      const spreadsheetId = await getInvestmentSheetId(payload, investmentId)
      if (!spreadsheetId) return { success: false, error: MISSING_SHEET }

      let grids: Awaited<ReturnType<typeof readImportGrids>>
      // Outside the try on purpose: this one reads the database, and the catch below translates
      // every failure into „nie udało się odczytać arkusza Google", which would blame the wrong
      // system and hand the owner retry advice that cannot help.
      const treeBeforeWrite = await serializeKosztorys(investmentId)
      try {
        grids = await readImportGrids(getReadonlySheetsClient(), spreadsheetId)
      } catch (error) {
        return {
          success: true,
          data: { comparison: null, refresh: null, failure: toSheetFailure(error) },
        }
      }

      const refreshed = buildMeasuredQtyRefresh(grids, treeBeforeWrite)
      if (!refreshed.ok) return { success: false, error: refreshed.problems.join(' ') }
      const { rows, unmatched } = refreshed.refresh
      const written = await setSheetMeasuredQty(await getDb(payload), investmentId, rows)

      // Re-read rather than reuse the pre-write tree, so the comparison describes the state the
      // write left behind. It happens to be identical today — no figure reported here derives from
      // the stored reference quantity — but that is an invariant of the current report, not of the
      // action, and the day a figure starts reading it this would go quietly stale.
      const tree = written > 0 ? await serializeKosztorys(investmentId) : treeBeforeWrite
      const built = buildSheetComparison(grids, tree, spreadsheetId)
      if (!built.ok) return { success: false, error: built.problems.join(' ') }

      return {
        success: true,
        data: {
          comparison: built.comparison,
          refresh: {
            updated: rows.filter((row) => row.qty !== null).length,
            cleared: rows.filter((row) => row.qty === null).length,
            unmatched,
          },
          failure: null,
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
