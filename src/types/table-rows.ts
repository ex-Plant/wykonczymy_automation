import type { CashRegisterTypeT, InvestmentStatusT } from '@/types/reference-data'
import type { SheetStatusT } from '@/lib/constants/sheets'
import type { RoleT } from '@/lib/auth/roles'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'

/** The shapes a listing query hands to the table that renders it — a contract between the two
 *  layers, not a property of either. They live here rather than in the table component because the
 *  producers sit BELOW the components: `lib/queries/**` and the plain-node parity audit both build
 *  these rows, and importing a `.tsx` module to learn the shape is what forced that audit to
 *  re-derive formulas instead of calling the real builder. */
export type InvestmentRowT = {
  id: number
  name: string
  status: InvestmentStatusT
  /** Materiały + robocizna. The sum is old, but EX-555 (`f72c68a1`) swapped the robocizna under it
   *  for the kosztorys one without renaming the column, so it has been a v2 reading — silently —
   *  since then. Its transactions twin below is the reading it used to be. */
  totalCosts: number
  totalCostsFromTransactions: number
  totalMaterialCosts: number
  totalIncome: number
  /** Kosztorys plane, pre-rabat. Its twin below is pre-rabat too, so the two subtract cleanly.
   *  `totalLaborCosts` keeps the bare name because the parity fixture is keyed by it; the suffix on
   *  the twin is what warns that a second plane exists. */
  totalLaborCosts: number
  totalLaborCostsFromTransactions: number
  totalPayouts: number
  totalInvestmentExpense: number
  totalSettled: number
  balance: number
  balanceGross: number
  /** The same bilans on the transactions plane. Both are shown while investments are still being
   *  moved off the sheets: for one that has no kosztorys in the app yet, this is the only reading
   *  that carries its robocizna at all. */
  balanceFromTransactions: number
  /** The v1 formula on the transactions plane — the figure the investment page's v1 shows. It reads
   *  the raw transfers on purpose: fed the kosztorys robocizna it was neither reading, and matched
   *  no other surface in the app. */
  margin: number
  /** The EX-649 reading, beside `margin` rather than instead of it. Absent where an etap holds
   *  executed work with no rozliczenie — the figure is unknowable, not zero. `undefined` and not
   *  `null` because TanStack's `sortUndefined` is the only thing that keeps those rows out of the
   *  numeric comparator, which would read them as 0. */
  marginV2?: number
  address: string
  phone: string
  email: string
  contactPerson: string
  review: string
  notes: string
  hasSheet: boolean
  // No column renders these — the whole row is handed to EditInvestmentDialog, whose form needs
  // them. `vatRate` is the exception that also prices `balanceGross`.
  materialsNetRate: number | null
  settlementMode: SettlementModeT
  vatRate: number
}

export type CashRegisterRowT = {
  id: number
  name: string
  ownerName: string
  balance: number
  type: CashRegisterTypeT
  active: boolean
}

// A kosztorys is a real Google Sheet registered in the app — either linked to an
// investment or standing alone. This is a distinct entity from an investment
// that simply has no kosztorys yet (see InvestmentWithoutSheetRowT), which is why
// the two now render as separate tables instead of one status-discriminated list.
export type KosztorysRowT = {
  id: string
  status: SheetStatusT
  name: string
  sheetId: number
  sheetName: string
  googleSheetId: string
  investmentId?: number
  investmentName?: string
}

// An investment with no kosztorys yet — the target for "Dodaj kosztorys".
export type InvestmentWithoutSheetRowT = {
  id: string
  investmentId: number
  name: string
}

export type UserRowT = {
  id: number
  name: string
  role: RoleT
  email: string
  active: boolean
  defaultCashRegisterName?: string
  balance: number
}
