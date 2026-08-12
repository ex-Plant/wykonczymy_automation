'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import {
  buildImportPlan,
  type ImportPlanT,
  type ImportReportT,
} from '@/lib/kosztorys/sheet-import/build-import-plan'
import { MissingRobociznaTabError, readImportGrids } from '@/lib/kosztorys/sheet-import/read-sheet'
import { getReadonlySheetsClient } from '@/lib/google/readonly-sheets-client'
import type { ActionResultT } from '@/types/action'

// Every tag the tree touches. Settings are copied rather than changed, but `restoreKosztorys`
// rewrites the investment row regardless, so `investments` goes with them — same list
// `restoreSnapshotAction` bumps.
const IMPORT_TAGS = [
  'kosztorysSections',
  'kosztorysItems',
  'kosztorysStages',
  'stageProgress',
  'investments',
] as const

export type ImportPreviewT = { report: ImportReportT; problems: string[] }

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

// `protectedAction` admits every management role, MANAGER included. Import replaces the whole
// kosztorys behind one confirm, so it is narrowed to the two roles that own the numbers.
const ADMIN_ONLY = 'Tylko właściciel lub administrator może wczytać kosztorys z arkusza.'

export async function previewKosztorysImport(
  investmentId: number,
): Promise<ActionResultT<ImportPreviewT>> {
  return protectedAction<ImportPreviewT>('previewKosztorysImport', async ({ payload, user }) => {
    if (!isAdminOrOwnerRole(user.role)) return { success: false, error: ADMIN_ONLY }

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

// Takes no plan from the client: it re-reads the sheet and rebuilds, so a forged preview payload
// cannot decide what gets written. Then, in ONE transaction, a forced pre-import snapshot (captured
// on the transaction handle and BEFORE the wipe — outside it, a rollback would leave the snapshot
// behind; after the wipe it would snapshot nothing) and the replacement itself. Any throw rolls both
// back and the live kosztorys is untouched.
export async function applyKosztorysImport(
  investmentId: number,
): Promise<ActionResultT<ApplyImportResultT>> {
  return protectedAction<ApplyImportResultT>(
    'applyKosztorysImport',
    async ({ payload, user }) => {
      if (!isAdminOrOwnerRole(user.role)) return { success: false, error: ADMIN_ONLY }

      const spreadsheetId = await getInvestmentSheetId(payload, investmentId)
      if (!spreadsheetId) return { success: false, error: MISSING_SHEET }

      let plan: ImportPlanT
      try {
        plan = await derivePlan(investmentId, spreadsheetId)
      } catch (error) {
        return { success: false, error: sheetFailureMessage(error) }
      }
      if (!plan.ok) return { success: false, error: plan.problems.join(' ') }

      const restored = await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          await captureAutoSnapshot(txDb, investmentId, user.id)
          return restoreKosztorys(payload, req, investmentId, plan.tree)
        },
        { skipRevalidation: true },
      )

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
    [...IMPORT_TAGS],
  )
}
