import type { RoleT } from '@/lib/auth/roles'
import type { TransferTypeT, VatPlaneT } from '@/lib/constants/transfers'

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
// `findTransfersRaw` fetch; the expense-category `label` is resolved at the page from reference
// data (like worker names on the payout list). `settled` and `type` together pick the row's tab —
// see `partitionWydatkiRows`; the list shows exactly one of the three sets at a time.
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
