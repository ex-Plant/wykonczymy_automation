import type { CashRegisterTypeT, InvestmentStatusT } from '@/types/reference-data'
import type { SheetStatusT } from '@/lib/constants/sheets'
import type { RoleT } from '@/lib/auth/roles'
import type { CategoryCostT } from '@/types/investment-financials'
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
  totalCosts: number
  totalMaterialCosts: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  totalInvestmentExpense: number
  totalSettled: number
  /** Priced on the plane the client is billed on, not the raw receipts — so these columns and
   *  `totalInvestmentExpense` stand on the same plane and add up. */
  categoryCosts: CategoryCostT[]
  balance: number
  balanceGross: number
  margin: number
  /** The EX-649 reading, beside `margin` rather than instead of it. `null` where an etap holds
   *  executed work with no rozliczenie — the figure is unknowable, not zero. */
  marginV2: number | null
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
