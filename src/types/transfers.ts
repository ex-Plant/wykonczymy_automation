import type { TransferTypeT, PaymentMethodT, VatPlaneT } from '@/lib/constants/transfers'

/**
 * A transfer row as rendered in the transfers table. Cross-cutting: produced by the
 * server query (`lib/queries/transfer-mapping.ts`) and consumed across the UI
 * (tables, forms, dialogs), the export pipeline, and actions — so it lives here
 * rather than in any single module.
 */
// One page of an invoice, already resolved to something openable. A media row whose `url` is null is
// dropped upstream rather than carried as a hole — every consumer (preview, ZIP) needs the URL,
// so a page without one is not a page.
export type InvoiceFileT = {
  // The media id, so a single page can be detached. Absent on a locally picked file that hasn't
  // been uploaded yet — there is nothing to detach from.
  id?: number
  url: string
  filename: string | null
  mimeType: string | null
}

export type TransferRowT = {
  id: number
  description: string
  amount: number
  // What the investor is billed, when that differs from the brutto that left the kasa (the netto
  // expense type). null on every type that bills at `amount`.
  netAmount: number | null
  type: TransferTypeT
  paymentMethod: PaymentMethodT
  date: string
  sourceRegisterId: number | null
  sourceRegisterName: string
  targetRegisterId: number | null
  targetRegisterName: string
  investmentId: number | null
  investmentName: string
  expenseCategoryId: number | null
  expenseCategoryName: string
  otherCategoryName: string
  otherCategoryId: number | null
  workerName: string
  workerId: number | null
  createdByName: string
  createdById: number | null
  createdAt: string
  // Every page of the invoice, in the order they were attached. Empty when nothing is attached.
  invoices: InvoiceFileT[]
  invoiceNote: string | null
  cancelled: boolean
  settled: boolean
  // Netto/Brutto plane the amount is stated on; null when unspecified.
  vatPlane: VatPlaneT | null
  // For a CANCELLATION row: the type of the original transfer it reverses (display-only). null otherwise.
  originalType: TransferTypeT | null
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
// `type` together pick the row's tab — see `partitionExpenseRows`; the list shows exactly one of the
// three sets at a time. `invoices` feeds the list's bulk-ZIP download and its per-row
// preview, and is empty when no invoice is attached. `invoiceNote` is the transfer's free-text note —
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
  invoices: InvoiceFileT[]
  invoiceNote: string | null
}
