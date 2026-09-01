import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ImportGridsT } from '../../lib/kosztorys/sheet-import/read-sheet'
import type { SheetFailureReasonT } from '../../lib/kosztorys/sheet-import/classify-sheet-failure'

// Poza repo (zrzuty niosą ceny 57 budów) i poza /tmp, które bywa sprzątane w trakcie akcji —
// a cały sens przebiegu A jest taki, żeby zassać raz.
export const DUMP_DIR =
  process.env.LEGACY_SHEET_DUMP_DIR ?? join(homedir(), '.local/share/wykonczymy-legacy-sheets')

export const dumpPath = (googleSheetId: string) => join(DUMP_DIR, `${googleSheetId}.json`)

export type SheetDumpT = {
  sheetId: number
  googleSheetId: string
  sheetName: string
  // Ręczne przypisanie kolumn z bazy, jeśli ktoś je dla tego arkusza ustawił. Wędruje razem ze
  // zrzutem, żeby faza 3 nie musiała wracać do bazy po arkusz, który już leży na dysku.
  columnMapping: Record<string, number> | null
  investmentId: number | null
  investmentName: string | null
  investmentCreatedAt: string | null
  grids: ImportGridsT | null
  // `message` obok `reason`, bo `classifySheetFailure` zna tylko 403/404/brak zakładki — cała
  // reszta, limit zapytań i timeout włącznie, wychodzi jako 'unknown' i bez treści błędu nie da się
  // odróżnić arkusza zepsutego od arkusza, który trzeba po prostu pobrać jeszcze raz.
  failure: { reason: SheetFailureReasonT; message: string } | null
}
