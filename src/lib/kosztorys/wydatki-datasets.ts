import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import type { MaterialTransactionRowT } from '@/types/transfers'

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

// The two expense sets first, in the order their „Razem" figures add to the breakdown's total; the
// set that never bills the investor comes last. A `Record` rather than a tuple so a new dataset
// cannot compile until it has been given a place in the strip.
const DATASET_RANK: Record<WydatkiDatasetT, number> = { gross: 0, net: 1, settled: 2 }

const DATASET_ORDER = (Object.keys(DATASET_RANK) as WydatkiDatasetT[]).sort(
  (a, b) => DATASET_RANK[a] - DATASET_RANK[b],
)

// An empty set gets no tab at all — an investment with no netto and no settled materials is the
// common case, and a tab that shows „brak danych" is just a dead end.
export function availableWydatkiDatasets(partition: WydatkiPartitionT): WydatkiDatasetT[] {
  return DATASET_ORDER.filter((set) => partition[set].length > 0)
}

// Σ over the two expense sets is `totalMaterialCosts`, which is what makes the split checkable
// against the breakdown above the list.
export function sumBilled(rows: MaterialTransactionRowT[]): number {
  return rows.reduce((acc, row) => acc + row.billed, 0)
}

// A row served from a stale cache has no type yet; link to the unfiltered list rather than to a
// filter that would exclude the row it points at.
export function wydatkiRowHref(investmentId: number, row: MaterialTransactionRowT): string {
  return investmentTransfersHref(investmentId, {
    types: row.type ? [row.type] : undefined,
    id: row.id,
  })
}
