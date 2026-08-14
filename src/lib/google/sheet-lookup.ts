import type { Payload } from 'payload'
import {
  parseSheetColumnMapping,
  type SheetColumnMappingT,
} from '@/lib/kosztorys/sheet-import/columns'

// What every action that needs the sheet says when the investment has none. One sentence, one home —
// a second wording would read as a second cause.
export const MISSING_SHEET = 'Inwestycja nie ma kosztorysu.'

export type InvestmentSheetT = {
  id: number
  googleSheetId: string
  columnMapping: SheetColumnMappingT
}

// The import path needs two fields off the same row, so it reads the row rather than the id.
export async function getInvestmentSheet(
  payload: Payload,
  investmentId: number,
): Promise<InvestmentSheetT | undefined> {
  const found = await payload.find({
    collection: 'kosztoryses',
    where: { investment: { equals: investmentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const sheet = found.docs[0]
  if (!sheet?.googleSheetId) return undefined
  return {
    id: sheet.id,
    googleSheetId: sheet.googleSheetId,
    columnMapping: parseSheetColumnMapping(sheet.sheetColumnMapping),
  }
}

// Resolve an investment's linked Google Sheet id, or undefined if it has none.
// The sheet id lives on the `kosztoryses` collection (one row per sheet, optional
// FK back to an investment), so we look up by relation rather than reading a
// field on investments — see migration 20260528_move_sheet_id_to_kosztoryses.
//
// This lives in a non-`'use server'` file so callers in any context (server
// actions, page server components, hooks) can import it as a plain function
// without the call going through the RSC server-action serialization boundary.
export async function getInvestmentSheetId(
  payload: Payload,
  investmentId: number,
): Promise<string | undefined> {
  return (await getInvestmentSheet(payload, investmentId))?.googleSheetId
}
