import type { RoleT } from '@/lib/auth/roles'
import type { VatPlaneT } from '@/lib/constants/transfers'

export type ReferenceItemT = {
  id: number
  name: string
  type?: string
  active?: boolean
  ownerId?: number
  defaultCashRegisterId?: number
}

export type CashRegisterTypeT = 'MAIN' | 'AUXILIARY' | 'VIRTUAL' | 'WORKER'

export type InvestmentStatusT = 'active' | 'completed' | 'planowana'

export type CashRegisterRefT = Omit<ReferenceItemT, 'type'> & {
  type: CashRegisterTypeT
}

export type InvestmentRefT = ReferenceItemT & {
  status: InvestmentStatusT
  address: string
  phone: string
  email: string
  contactPerson: string
  notes: string
  review: string
  hasSheet: boolean
}

export type WorkerRefT = Omit<ReferenceItemT, 'type'> & {
  role: RoleT
  email: string
}

// Raw PAYOUT-per-worker aggregate for one investment. `workerId` is null for the „Bez przypisanego
// pracownika" bucket — a real cash payout with no worker attached, which must still count toward Σ
// zaliczek. Names are NOT joined here (query stays tagged on transfers alone); the page enriches.
export type PayoutByWorkerT = {
  workerId: number | null
  total: number
}

// The page-enriched PAYOUT-per-worker row: `PayoutByWorkerT` plus the worker's name resolved from
// reference data (null worker → „Bez przypisanego pracownika"). This is what the editor prop chain
// carries down to the subcontractor summary block.
export type SubcontractorPayoutRowT = PayoutByWorkerT & {
  name: string
}

// One realized PAYOUT transaction, for the subcontractor block's sortable wypłaty list. Worker name
// resolves at render from the SubcontractorPayoutRowT set.
export type PayoutTransactionRowT = {
  workerId: number | null
  date: string
  amount: number
  description: string | null
}

// One INVESTOR_DEPOSIT transaction for the client Podsumowanie's wpłaty list — mirrors
// PayoutTransactionRowT. `vatPlane` is null for the „nie określono" default state.
export type DepositTransactionRowT = {
  id: number
  date: string
  amount: number
  vatPlane: VatPlaneT | null
}

// One materiały (Wydatki inwestycyjne) transaction for the Podsumowanie's wydatki list — an
// INVESTMENT_EXPENSE / CORRECTION row. Sourced from the existing `findTransfersRaw` fetch; the
// expense-category `label` is resolved in the shared fetcher, not at either page, so the owner view
// and the client share view label a row identically. `settled` splits „Wydatki inwestycyjne" (false —
// Σ === materialsGross) from „Materiały wliczone w robociznę" (true) behind the list toggle; both
// sets show in every view. The invoice triple feeds the list's bulk-ZIP download and its per-row
// preview, and is null when no invoice is attached. `invoiceNote` is the AI scan's extracted FV data
// — line 1 the numer faktury, the pozycje below it — null on any row that never went through a scan.
export type MaterialTransactionRowT = {
  id: number
  date: string
  amount: number
  label: string
  description: string | null
  settled: boolean
  invoiceUrl: string | null
  invoiceFilename: string | null
  invoiceMimeType: string | null
  invoiceNote: string | null
}

export type OtherCategoryRefT = {
  id: number
  name: string
}

export type ExpenseCategoryRefT = {
  id: number
  name: string
}

export type ReferenceDataBaseT = {
  cashRegisters: CashRegisterRefT[]
  investments: InvestmentRefT[]
  workers: WorkerRefT[]
  otherCategories: OtherCategoryRefT[]
  expenseCategories: ExpenseCategoryRefT[]
}

export type ReferenceDataT = ReferenceDataBaseT & {
  currentUserId: number
  currentUserRole: RoleT
}
