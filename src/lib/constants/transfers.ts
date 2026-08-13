// Sorted alphabetically by Polish label
export const TRANSFER_TYPES = [
  'CANCELLATION', // Anulowanie
  'OTHER_DEPOSIT', // Inna wpłata
  'OTHER', // Inny wydatek
  'CORRECTION', // Korekta
  'LABOR_COST', // Koszty robocizny
  'RABAT', // Rabat
  'LOSS', // Strata
  'REGISTER_TRANSFER', // Transfer między kasami
  'INVESTOR_DEPOSIT', // Wpłata od inwestora
  'INVESTMENT_EXPENSE', // Wydatek inwestycyjny
  'INVESTMENT_EXPENSE_NET', // Wydatek inwestycyjny netto
  'PAYOUT', // Wypłata
  'COMPANY_FUNDING', // Zasilenie z konta firmowego
] as const
export type TransferTypeT = (typeof TRANSFER_TYPES)[number]

/**
 * What a transfer type DOES — one row per type, one column per decision.
 *
 * The axis used to run the other way: a dozen membership arrays each answering "which
 * types belong to me", so adding a type meant visiting each one and remembering to
 * consider it. A miss was a silently wrong number, never a build error. `satisfies
 * Record<TransferTypeT, …>` inverts that — a new type cannot compile until every column
 * below has an answer.
 *
 * Deliberately narrow: only decisions where getting it wrong moves money or misroutes a
 * sheet row. Per-field form rules (which fields show, which are required, which are
 * auto-cleared) are five independent axes per field, not one membership question, and
 * stay as their own predicates below.
 */
type TransferSpecT = {
  label: string
  color: string
  /** Adds to a register instead of subtracting, and counts as investor income. */
  deposit: boolean
  /** Owns a row on the kosztorys „Wydatki inwestycyjne" tab. */
  expensesSheetTab: boolean
  /** Owns a row on the „transfery (tylko do odczytu)" tab. */
  transfersSheetTab: boolean
  /**
   * The „wliczone w robociznę" flag means something for this type.
   *
   * It was equal to `expensesSheetTab` for all twelve pre-netto types — which is exactly
   * why the two were once a single predicate. INVESTMENT_EXPENSE_NET ended that: it owns
   * an expenses-tab row but is NOT settleable, because collapsing them leaks netto into
   * totalSettled → marża.
   */
  settleable: boolean
  /**
   * Which investment figure this type feeds. `'none'` means it feeds none — an explicit
   * answer, so a type that falls into no bucket is a stated decision rather than a
   * `deriveFinancials` that simply forgot to mention it.
   *
   * `'materials'` splits further on the `settled` flag: unsettled → totalMaterialCosts,
   * settled → totalSettled. That split lives in deriveFinancials, not here, because it
   * is a per-ROW fact, not a per-type one.
   *
   * `'materialsNet'` is a bucket of its own, NOT a flavour of `'materials'`: its rows are
   * already netto, so the global kosztorys „wszystko netto" toggle must never reach them.
   * Keeping it out of the number the toggle multiplies makes the double cut structurally
   * impossible, instead of an `if` someone has to remember.
   */
  financialBucket:
    | 'materials'
    | 'materialsNet'
    | 'income'
    | 'laborCosts'
    | 'payouts'
    | 'discount'
    | 'loss'
    | 'none'
  /**
   * Which stored column bills the investor. Every type but the netto expense bills at
   * `amount`; INVESTMENT_EXPENSE_NET leaves the register at `amount` (brutto) and bills
   * at `netAmount`. Separate from `financialBucket` — that says WHICH figure a type
   * feeds, this says WHICH number it feeds it with.
   */
  billedAmount: 'amount' | 'netAmount'
  /** Whether a source register is required, or meaningless (a P&L figure, no cash moves). */
  sourceRegister: 'required' | 'never'
}

export type FinancialBucketT = TransferSpecT['financialBucket']

export const TRANSFER_TYPE_SPECS = {
  CANCELLATION: {
    label: 'Anulowanie',
    color: 'muted-foreground',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: false,
    settleable: false,
    financialBucket: 'none',
    billedAmount: 'amount',
    // A cancellation moves no cash of its own — it annotates the row it reverses, whose
    // register already carries the reversal. A register set here would reach the `ELSE
    // -amount` arm in sum-transfers and silently drain that register.
    sourceRegister: 'never',
  },
  OTHER_DEPOSIT: {
    label: 'Inna wpłata',
    color: 'chart-green',
    deposit: true,
    expensesSheetTab: false,
    transfersSheetTab: false,
    settleable: false,
    financialBucket: 'income',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  OTHER: {
    label: 'Inny wydatek',
    color: 'chart-red',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: false,
    settleable: false,
    financialBucket: 'none',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  CORRECTION: {
    label: 'Korekta',
    color: 'chart-orange',
    deposit: false,
    expensesSheetTab: true,
    transfersSheetTab: false,
    settleable: true,
    financialBucket: 'materials',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  LABOR_COST: {
    label: 'Koszty robocizny',
    color: 'chart-orange',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: true,
    settleable: false,
    financialBucket: 'laborCosts',
    billedAmount: 'amount',
    sourceRegister: 'never',
  },
  RABAT: {
    label: 'Rabat',
    color: 'chart-green',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: true,
    settleable: false,
    financialBucket: 'discount',
    billedAmount: 'amount',
    sourceRegister: 'never',
  },
  LOSS: {
    label: 'Strata',
    color: 'chart-purple',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: true,
    settleable: false,
    financialBucket: 'loss',
    billedAmount: 'amount',
    sourceRegister: 'never',
  },
  REGISTER_TRANSFER: {
    label: 'Transfer między kasami',
    color: 'chart-turquoise',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: false,
    settleable: false,
    financialBucket: 'none',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  INVESTOR_DEPOSIT: {
    label: 'Wpłata od inwestora',
    color: 'chart-green',
    deposit: true,
    expensesSheetTab: false,
    transfersSheetTab: true,
    settleable: false,
    financialBucket: 'income',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  INVESTMENT_EXPENSE: {
    label: 'Wydatek inwestycyjny',
    color: 'chart-red',
    deposit: false,
    expensesSheetTab: true,
    transfersSheetTab: false,
    settleable: true,
    financialBucket: 'materials',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  INVESTMENT_EXPENSE_NET: {
    label: 'Wydatek inwestycyjny netto',
    color: 'chart-blue',
    deposit: false,
    // Shares routing, category and sheet-sync with the brutto expense — only the money
    // differs.
    expensesSheetTab: true,
    transfersSheetTab: false,
    // The one column that separates it from INVESTMENT_EXPENSE: „wliczone w robociznę"
    // would route its amount into totalSettled, which marża reads — and the netto figure
    // must never reach marża.
    settleable: false,
    financialBucket: 'materialsNet',
    billedAmount: 'netAmount',
    sourceRegister: 'required',
  },
  PAYOUT: {
    label: 'Wypłata',
    color: 'chart-red',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: true,
    settleable: false,
    financialBucket: 'payouts',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  COMPANY_FUNDING: {
    label: 'Zasilenie z konta firmowego',
    color: 'chart-green',
    deposit: true,
    expensesSheetTab: false,
    transfersSheetTab: false,
    settleable: false,
    financialBucket: 'income',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
} satisfies Record<TransferTypeT, TransferSpecT>

const mapSpecs = <V>(pick: (spec: TransferSpecT) => V): Record<TransferTypeT, V> =>
  Object.fromEntries(TRANSFER_TYPES.map((t) => [t, pick(TRANSFER_TYPE_SPECS[t])])) as Record<
    TransferTypeT,
    V
  >

export const TRANSFER_TYPE_LABELS: Record<TransferTypeT, string> = mapSpecs((s) => s.label)

export const TRANSFER_TYPE_COLORS: Record<TransferTypeT, string> = mapSpecs((s) => s.color)

export const EXPENSE_CATEGORY_LABEL = 'Typ wydatku inwestycyjnego'

// Single source for the settled INVESTMENT_EXPENSE (material priced into robocizna):
// label + chart color, shared by the transfers table and the investment stats panel so they never drift.
// `color` is a chart token (resolved via var(--color-<token>)); chart-pink keeps it distinct from korekta (orange).
export const SETTLED_TYPE = {
  label: 'Materiały wliczone w robociznę',
  color: 'chart-pink',
} as const

// Bound to the table's `deposit` column by the consistency test. Kept as an explicit
// array because it is spread into SQL IN-lists at module load.
export const DEPOSIT_TYPES: TransferTypeT[] = [
  'INVESTOR_DEPOSIT',
  'COMPANY_FUNDING',
  'OTHER_DEPOSIT',
]

// Deposit types visible in the deposit dialog (sorted by Polish label). „Inna wpłata" is the type
// for cash entering a register without an investment — EX-536 took the investment away from it, not
// the type, and EX-557 restores it. The netto/brutto plane still applies to INVESTOR_DEPOSIT only.
export const DEPOSIT_UI_TYPES: TransferTypeT[] = [
  'OTHER_DEPOSIT',
  'INVESTOR_DEPOSIT',
  'COMPANY_FUNDING',
]

// Transfer types visible in the transaction transfer dialog (sorted by Polish label).
// „Koszty robocizny" and „Rabat" are gone (EX-555): both figures are now read off the kosztorys, so
// booking either by hand would double-count against it. Neither type is retired — existing rows still
// render, filter, edit, cancel and travel to the sheet, and both keep their places in every other list
// in this file. This array is the „offerable in the dialog" list, nothing more.
export const TRANSACTION_TRANSFER_TYPES: TransferTypeT[] = [
  'OTHER', // Inny wydatek
  'CORRECTION', // Korekta
  'LOSS', // Strata
  'INVESTMENT_EXPENSE', // Wydatek inwestycyjny
  'INVESTMENT_EXPENSE_NET', // Wydatek inwestycyjny netto
  'PAYOUT', // Wypłata
]

// Investment-linked types mirrored on the sheet's 'transfery (tylko do odczytu)'
// tab. Stays a literal because it exports SheetTransferTabTypeT — deriving it with a
// .filter() destroys the literal union. Membership is bound to the table's
// `transfersSheetTab` column by the consistency test.
// (Order is NOT the summary-block column order — that is TRANSFERS_SUMMARY_TYPES.
// This array is only ever used in `{ in: [...] }` wheres and .includes(), so it is
// order-free.)
export const SHEET_TRANSFER_TAB_TYPES = [
  'INVESTOR_DEPOSIT',
  'LABOR_COST',
  'RABAT',
  'PAYOUT',
  'LOSS',
] as const satisfies readonly TransferTypeT[]
export type SheetTransferTabTypeT = (typeof SHEET_TRANSFER_TAB_TYPES)[number]

// Types that own a row on the kosztorys "Wydatki inwestycyjne" tab. Stays a literal
// because sync-sheet.ts spreads it at module load inside the Payload config graph, which
// needs an eager value. Membership is bound to the table's `expensesSheetTab` column by
// the consistency test.
export const EXPENSES_TAB_TYPES = [
  'INVESTMENT_EXPENSE',
  'INVESTMENT_EXPENSE_NET',
  'CORRECTION',
] as const satisfies readonly TransferTypeT[]

// Placeholder label for the retired Korekta summary column. Corrections now live
// on the expenses tab, but the column stays so sheet formulas keyed to a fixed
// position don't shift; the label signals where corrections went. It's ALSO the
// SUMIF criterion, so it must match no real `typ` value (it never will) → totals 0.
export const CORRECTION_MOVED_LABEL = 'Korekta → wydatki inwest.'

// Per-type SUMIF summary columns on the transfers tab — a FIXED layout, decoupled
// from data routing (SHEET_TRANSFER_TAB_TYPES). CORRECTION keeps its original 5th
// slot even though corrections now route to the expenses tab (its SUMIF totals 0
// here): the summary block is rebuilt verbatim by setupTab on a reset/relink, and
// dropping the column would shift LOSS left and break sheet formulas keyed to a
// fixed column position. Order = column order on the tab.
export const TRANSFERS_SUMMARY_TYPES = [
  'INVESTOR_DEPOSIT',
  'LABOR_COST',
  'RABAT',
  'PAYOUT',
  'CORRECTION',
  'LOSS',
] as const satisfies readonly TransferTypeT[]

export const PAYMENT_METHODS = [
  'CASH',
  'TRANSFER',
  // 'BLIK',
  // 'CARD',
] as const
export type PaymentMethodT = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodT, string> = {
  CASH: 'Gotówka',
  TRANSFER: 'Przelew',
  // BLIK: 'BLIK',
  // CARD: 'Karta',
}

// EX-536 netto/brutto wpłata bucket. The create form now always sends NET or GROSS (NET preselected),
// but NULL stays a valid stored state for wpłaty booked before that. Downstream (deposits
// reconciliation) an unmarked deposit is treated as netto — the owner's „brak wartości = netto"
// ruling (flipped 2026-07-23 from the earlier null→brutto default; only GROSS goes to the invoiced
// part, NET and null pay gotówka).
export const VAT_PLANES = ['NET', 'GROSS'] as const
export type VatPlaneT = (typeof VAT_PLANES)[number]

export const VAT_PLANE_LABELS: Record<VatPlaneT, string> = {
  NET: 'Netto',
  GROSS: 'Brutto',
}

// ── Predicates ──────────────────────────────────────────────────────────
//
// Every value here must stay eager. sync-sheet.ts spreads these arrays at module load
// inside the Payload config graph; a lazy value would yield [] there and every transfer
// would silently stop syncing to the sheet. (A barrel re-export, not the split, is what
// once made this file cycle — so a second home buys nothing.)

export const isTransferType = (type: string): type is TransferTypeT =>
  (TRANSFER_TYPES as readonly string[]).includes(type)

const specOf = (type: unknown): TransferSpecT | undefined =>
  typeof type === 'string' && isTransferType(type) ? TRANSFER_TYPE_SPECS[type] : undefined

export const isDepositType = (type: string) => specOf(type)?.deposit === true

export const isExpensesTabType = (type: unknown): boolean => specOf(type)?.expensesSheetTab === true

export const canBeSettled = (type: unknown): boolean => specOf(type)?.settleable === true

export const isSheetTransferTabType = (type: unknown): type is SheetTransferTabTypeT =>
  specOf(type)?.transfersSheetTab === true

export const needsSourceRegister = (type: string) => specOf(type)?.sourceRegister === 'required'

// An unknown type contributes to nothing rather than throwing — a row whose type predates
// the union must not take the whole investment panel down with it.
export const financialBucketOf = (type: unknown): FinancialBucketT =>
  specOf(type)?.financialBucket ?? 'none'

// An unknown type answers `amount` — the column every row has — so a stale type can never sum a
// NULL column into a silent zero.
export const billedAmountOf = (type: unknown): 'amount' | 'netAmount' =>
  specOf(type)?.billedAmount ?? 'amount'

// Does this type bill at the netto column? Every consumer that reads a billed figure, renders
// the netto beside the brutto, or gates the netto input asks exactly this — as a named predicate
// so `'netAmount'` stays a spec-table detail instead of a literal spread across three layers.
export const billsNetAmount = (type: unknown): boolean => billedAmountOf(type) === 'netAmount'

/**
 * The figure this row bills the investor — the one number every billing surface must read, so the
 * app's totals, the „Wydatki inwestycyjne" list and the owner's sheet can't disagree about what a
 * netto row costs the client.
 *
 * A netto row missing its netAmount bills 0 rather than falling back to brutto: the write path
 * guarantees the column (hooks/transfers/validate.ts), and a silent brutto fallback would be the
 * exact over-billing this type exists to prevent.
 */
export const billedAmountFor = (
  type: unknown,
  amount: number,
  netAmount: number | null | undefined,
): number => (billsNetAmount(type) ? (netAmount ?? 0) : amount)

// Field-rule predicates. NOT folded into the table: a field is governed by up to five
// independent axes (shown / required / auto-cleared / optional / exempt), and `investment`
// alone uses three of them over two different type sets. One boolean column per predicate
// would be wrong by construction.

// COMPANY_FUNDING and OTHER_DEPOSIT left this set in EX-557: both are company-level cash, never
// client-level, so an investment on them would silently move that investment's bilans. Membership
// here is what the edit dialog, the Payload admin and the validate hook's auto-clear all read.
const INVESTMENT_TYPES: TransferTypeT[] = [
  'INVESTMENT_EXPENSE',
  'INVESTMENT_EXPENSE_NET',
  'LABOR_COST',
  'INVESTOR_DEPOSIT',
  'RABAT',
  'LOSS',
  'CORRECTION',
  'PAYOUT',
]

// Subset of INVESTMENT_TYPES where the investment is mandatory (not just shown).
const REQUIRES_INVESTMENT_TYPES: TransferTypeT[] = [
  'INVESTOR_DEPOSIT',
  'INVESTMENT_EXPENSE',
  'INVESTMENT_EXPENSE_NET',
  'LABOR_COST',
  'RABAT',
  // Mandatory since EX-675, when a strata started lowering the investor's bilans: an unlinked one
  // would be a concession credited to nobody.
  'LOSS',
]

export const showsInvestment = (type: string) =>
  isTransferType(type) && (INVESTMENT_TYPES as readonly string[]).includes(type)

export const requiresInvestment = (type: string) =>
  isTransferType(type) && (REQUIRES_INVESTMENT_TYPES as readonly string[]).includes(type)

export const needsTargetRegister = (type: string) =>
  isTransferType(type) && type === 'REGISTER_TRANSFER'

export const needsWorker = (type: string) => isTransferType(type) && type === 'PAYOUT'

export const needsOtherCategory = (type: string) => isTransferType(type) && type === 'OTHER'

// Brutto and netto investment expense differ only in which amount bills the investor —
// every form-field rule below treats them as one type.
const isInvestmentExpense = (type: string) =>
  type === 'INVESTMENT_EXPENSE' || type === 'INVESTMENT_EXPENSE_NET'

export const showsOtherCategory = (type: string) =>
  isTransferType(type) && (type === 'OTHER' || isInvestmentExpense(type) || type === 'PAYOUT')

export const needsExpenseCategory = (type: string, hasInvestment?: boolean) =>
  isTransferType(type) && (isInvestmentExpense(type) || (type === 'CORRECTION' && !!hasInvestment))

export const isLaborCost = (type: string) => isTransferType(type) && type === 'LABOR_COST'

export const isCancellationType = (type: string) => isTransferType(type) && type === 'CANCELLATION'
