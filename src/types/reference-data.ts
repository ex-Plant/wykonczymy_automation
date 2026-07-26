import type { RoleT } from '@/lib/auth/roles'
import type { TransferTypeT, VatPlaneT } from '@/lib/constants/transfers'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'

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
  // Both feed the per-row Marża on the investments list: the concession is gated on the settlement
  // mode, so a reader that has one without the other cannot compute it. null rate = no concession.
  materialsNetRate: number | null
  settlementMode: SettlementModeT
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
// PayoutTransactionRowT. `vatPlane` is null for wpłaty booked before the plane became a required
// choice in the form — the reconciliation reads those as netto.
export type DepositTransactionRowT = {
  id: number
  date: string
  amount: number
  vatPlane: VatPlaneT | null
}

// One materiały (Wydatki inwestycyjne) transaction for the Podsumowanie's wydatki list — an
// INVESTMENT_EXPENSE / INVESTMENT_EXPENSE_NET / CORRECTION row. Sourced from the existing
// `findTransfersRaw` fetch; the expense-category `label` is resolved in the shared fetcher, not at
// either page, so the owner view and the client share view label a row identically. `settled` and
// `type` together pick the row's tab — see `partitionWydatkiRows`; the list shows exactly one of the
// three sets at a time. The invoice triple feeds the list's bulk-ZIP download and its per-row
// preview, and is null when no invoice is attached. `invoiceNote` is the transfer's free-text note —
// written by the AI scan in a known shape, but just as often typed by hand (see `lib/utils/invoice-note`).
export type MaterialTransactionRowT = {
  id: number
  date: string
  // Brutto — what left the kasa. `billed` is what the investor is charged for this row; the two
  // differ only on the netto type (see `sumBilled` for what the tab totals must reconcile with).
  amount: number
  billed: number
  label: string
  description: string | null
  settled: boolean
  // Optional because the client share read is `unstable_cache`d: a warm entry written before this
  // field existed serves rows without it until KOSZTORYS_TAGS invalidates. Every consumer has to
  // handle that, and `undefined` here is what stops a cleanup pass deleting the guards as dead.
  type: TransferTypeT | undefined
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
