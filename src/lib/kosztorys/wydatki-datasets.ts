import type { MaterialTransactionRowT } from '@/types/reference-data'

export type WydatkiDatasetT = 'gross' | 'net' | 'settled'

export type WydatkiPartitionT = Record<WydatkiDatasetT, MaterialTransactionRowT[]>

// Korekty ride with the brutto expenses: the Sheet files them there (CORRECTION_MOVED_LABEL) and
// they count into `totalMaterialCosts`, so the brutto tab's Σ is the breakdown's brutto figure only
// with them included.
//
// The netto test comes BEFORE `settled` to mirror `materialsNetBilled`, which ignores `settled`
// (see the bucketing matrix): the netto type is `settleable: false`, so a settled netto row cannot
// be written — but were one forged, the model still bills it, and routing it to the settled tab
// would hide it from the two totals that must add up to `totalMaterialCosts`.
export function partitionWydatkiRows(rows: MaterialTransactionRowT[]): WydatkiPartitionT {
  const partition: WydatkiPartitionT = { gross: [], net: [], settled: [] }

  for (const row of rows) {
    if (row.type === 'INVESTMENT_EXPENSE_NET') partition.net.push(row)
    else if (row.settled) partition.settled.push(row)
    else partition.gross.push(row)
  }

  return partition
}

// What the investor is charged for this set — the figure a tab's „Razem" shows. Σ over the two
// expense sets is `totalMaterialCosts`, which is what makes the split checkable against the
// breakdown above the list.
export function sumBilled(rows: MaterialTransactionRowT[]): number {
  return rows.reduce((acc, row) => acc + row.billed, 0)
}
