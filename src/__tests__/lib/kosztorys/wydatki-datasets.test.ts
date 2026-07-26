import { describe, it, expect } from 'vitest'
import {
  availableWydatkiDatasets,
  partitionWydatkiRows,
  wydatkiRowHref,
} from '@/lib/kosztorys/wydatki-datasets'
import type { MaterialTransactionRowT } from '@/types/reference-data'

// The tab split in isolation. The one assertion that couples it to `deriveFinancials` — Σ over the
// two expense tabs === totalMaterialCosts — stays in derive-financials-bucketing.test.ts, where the
// bucketing matrix it reconciles against lives.

const ROW_BASE = { date: '2026-07-26', label: 'Materiały', description: null } as const

const rows: MaterialTransactionRowT[] = [
  { ...ROW_BASE, id: 1, type: 'INVESTMENT_EXPENSE', amount: 100, billed: 100, settled: false },
  { ...ROW_BASE, id: 2, type: 'CORRECTION', amount: -25, billed: -25, settled: false },
  {
    ...ROW_BASE,
    id: 3,
    type: 'INVESTMENT_EXPENSE_NET',
    amount: 1230,
    billed: 1000,
    settled: false,
  },
  { ...ROW_BASE, id: 4, type: 'INVESTMENT_EXPENSE', amount: 40, billed: 40, settled: true },
]

describe('partitionWydatkiRows', () => {
  it('assigns every row to exactly one tab', () => {
    const { gross, net, settled } = partitionWydatkiRows(rows)
    expect([...gross, ...net, ...settled].map((row) => row.id).sort()).toEqual([1, 2, 3, 4])
  })

  // The client share read is `unstable_cache`d, so a warm entry written before `type` existed
  // serves rows without it until KOSZTORYS_TAGS invalidates. Such a row belongs with the brutto
  // expenses — the set that reconciles at `amount` — not silently dropped from every tab.
  it('files a row with no type under the brutto expenses', () => {
    const stale: MaterialTransactionRowT = {
      ...ROW_BASE,
      id: 6,
      type: undefined,
      amount: 100,
      billed: 100,
      settled: false,
    }
    const { gross, net, settled } = partitionWydatkiRows([stale])

    expect(gross).toHaveLength(1)
    expect(net).toHaveLength(0)
    expect(settled).toHaveLength(0)
  })

  it('keeps a forged settled netto row in the netto tab, where the model still bills it', () => {
    const forged: MaterialTransactionRowT = {
      ...ROW_BASE,
      id: 5,
      type: 'INVESTMENT_EXPENSE_NET',
      amount: 1230,
      billed: 1000,
      settled: true,
    }
    const { net, settled } = partitionWydatkiRows([forged])

    expect(net).toHaveLength(1)
    expect(settled).toHaveLength(0)
  })
})

describe('availableWydatkiDatasets', () => {
  // The tab strip is built from this list, so an empty set must not reach it: the common investment
  // has neither netto nor settled rows, and a tab that opens onto „brak danych" is a dead end.
  it('offers a tab only for a non-empty set, in reading order', () => {
    expect(availableWydatkiDatasets(partitionWydatkiRows(rows))).toEqual([
      'gross',
      'net',
      'settled',
    ])
    expect(availableWydatkiDatasets(partitionWydatkiRows([rows[0]!, rows[3]!]))).toEqual([
      'gross',
      'settled',
    ])
    expect(availableWydatkiDatasets(partitionWydatkiRows([rows[2]!]))).toEqual(['net'])
    expect(availableWydatkiDatasets(partitionWydatkiRows([]))).toEqual([])
  })
})

describe('wydatkiRowHref', () => {
  // Regression: the href hardcoded `type=INVESTMENT_EXPENSE`, so clicking a netto row or a korekta
  // landed on a list that filtered out the very row clicked (`buildTransferFilters` → where.type).
  it('links each row to a list filtered by its own type', () => {
    const href = (row: MaterialTransactionRowT) => wydatkiRowHref(42, row)

    expect(href(rows[0]!)).toBe('/inwestycje/42?type=INVESTMENT_EXPENSE&id=1')
    expect(href(rows[1]!)).toBe('/inwestycje/42?type=CORRECTION&id=2')
    expect(href(rows[2]!)).toBe('/inwestycje/42?type=INVESTMENT_EXPENSE_NET&id=3')
  })

  it('omits the type filter for a stale-cache row rather than guessing one', () => {
    const stale: MaterialTransactionRowT = {
      ...ROW_BASE,
      id: 9,
      type: undefined,
      amount: 100,
      billed: 100,
      settled: false,
    }
    expect(wydatkiRowHref(42, stale)).toBe('/inwestycje/42?id=9')
  })
})
