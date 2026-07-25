import { describe, it, expect } from 'vitest'
import {
  TRANSFER_TYPES,
  TRANSFER_TYPE_SPECS,
  DEPOSIT_TYPES,
  DEPOSIT_UI_TYPES,
  TRANSACTION_TRANSFER_TYPES,
  EXPENSES_TAB_TYPES,
  SHEET_TRANSFER_TAB_TYPES,
  TRANSFERS_SUMMARY_TYPES,
  type TransferTypeT,
} from '@/lib/constants/transfers'

// The spec table makes a MISSING decision a compile error. It cannot make a WRONG one —
// nor can it stop a retained literal array from drifting away from the column it mirrors.
// That is this file's job, and it is a deliberate trade (see plan.md, decision 1): the
// arrays that stay literal do so because deriving them would destroy a literal union,
// break an eager module-load read, or silently rewrite a live client spreadsheet.

const typesWhere = (predicate: (spec: (typeof TRANSFER_TYPE_SPECS)[TransferTypeT]) => boolean) =>
  TRANSFER_TYPES.filter((type) => predicate(TRANSFER_TYPE_SPECS[type]))

const sorted = (types: readonly string[]) => [...types].sort()

describe('spec table — structural integrity', () => {
  it('has exactly one row per transfer type, and no extras', () => {
    expect(sorted(Object.keys(TRANSFER_TYPE_SPECS))).toEqual(sorted(TRANSFER_TYPES))
  })

  it('every row answers every column', () => {
    const columns = [
      'label',
      'color',
      'deposit',
      'expensesSheetTab',
      'transfersSheetTab',
      'settleable',
      'sourceRegister',
    ]
    for (const type of TRANSFER_TYPES) {
      expect(sorted(Object.keys(TRANSFER_TYPE_SPECS[type])), type).toEqual(sorted(columns))
    }
  })

  it('sourceRegister is one of the two allowed states', () => {
    for (const type of TRANSFER_TYPES) {
      expect(['required', 'never'], type).toContain(TRANSFER_TYPE_SPECS[type].sourceRegister)
    }
  })
})

describe('literal arrays agree with the table', () => {
  it('DEPOSIT_TYPES === deposit column', () => {
    expect(sorted(DEPOSIT_TYPES)).toEqual(sorted(typesWhere((s) => s.deposit)))
  })

  it('EXPENSES_TAB_TYPES === expensesSheetTab column', () => {
    expect(sorted(EXPENSES_TAB_TYPES)).toEqual(sorted(typesWhere((s) => s.expensesSheetTab)))
  })

  it('SHEET_TRANSFER_TAB_TYPES === transfersSheetTab column', () => {
    expect(sorted(SHEET_TRANSFER_TAB_TYPES)).toEqual(
      sorted(typesWhere((s) => s.transfersSheetTab)),
    )
  })

  it('DEPOSIT_UI_TYPES is a subset of the deposit column', () => {
    // A strict subset by design — „Inna wpłata" was dropped from the dialog (EX-536)
    // while remaining a deposit everywhere else.
    for (const type of DEPOSIT_UI_TYPES) {
      expect(TRANSFER_TYPE_SPECS[type].deposit, type).toBe(true)
    }
  })

  it('TRANSACTION_TRANSFER_TYPES contains no deposit type', () => {
    for (const type of TRANSACTION_TRANSFER_TYPES) {
      expect(TRANSFER_TYPE_SPECS[type].deposit, type).toBe(false)
    }
  })

  it('TRANSFERS_SUMMARY_TYPES is decoupled from routing — CORRECTION is the proof', () => {
    // The summary block is a FIXED sheet column layout (I–N), rebuilt verbatim by
    // setupTab on a reset/relink. CORRECTION keeps its 5th slot with a SUMIF that totals
    // 0, because dropping the column would shift LOSS left and break formulas keyed to a
    // fixed position. So this array must NOT equal the transfersSheetTab column.
    expect(TRANSFERS_SUMMARY_TYPES).toContain('CORRECTION')
    expect(TRANSFER_TYPE_SPECS.CORRECTION.transfersSheetTab).toBe(false)
  })
})

describe('sheet-sync inputs are eager at module load', () => {
  // sync-sheet.ts spreads these two arrays into SHEET_SYNCED_TYPES at module load, inside
  // the Payload config graph. If either ever became a lazy or derived value that evaluates
  // to [] there, the spread would silently produce an empty list and EVERY transfer would
  // stop syncing to the sheet — with no error anywhere.
  it.each([
    ['EXPENSES_TAB_TYPES', EXPENSES_TAB_TYPES],
    ['SHEET_TRANSFER_TAB_TYPES', SHEET_TRANSFER_TAB_TYPES],
  ])('%s is non-empty on import', (_name, array) => {
    expect(array.length).toBeGreaterThan(0)
  })
})

describe('settleable vs expensesSheetTab — the split the table exists for', () => {
  it('agree today for all twelve types', () => {
    for (const type of TRANSFER_TYPES) {
      expect(TRANSFER_TYPE_SPECS[type].settleable, type).toBe(
        TRANSFER_TYPE_SPECS[type].expensesSheetTab,
      )
    }
  })

  it('a settleable type always owns an expenses-tab row', () => {
    // This direction IS a rule, not a coincidence: the settled flag means "material
    // priced into robocizna", which only makes sense for a material expense. The reverse
    // is what INVESTMENT_EXPENSE_NET will break.
    for (const type of typesWhere((s) => s.settleable)) {
      expect(TRANSFER_TYPE_SPECS[type].expensesSheetTab, type).toBe(true)
    }
  })
})
