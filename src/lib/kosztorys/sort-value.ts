import {
  rowDiscountForView,
  rowDoneFraction,
  rowPlannedNetForView,
  toGross,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import {
  measureDiscrepancy,
  rowRemainingForView,
  rowTotalQtyDone,
  rowValueForView,
} from '@/lib/kosztorys/settlement-rows'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// The sort key for a grid column. Most columns in kosztorys-v2-columns.tsx are COMPUTED — their
// value is derived at render from calc/settlement, never stored on the row — so a `row[field]` read
// returns undefined for them and the sort silently no-ops (EX-487). Each computed case here composes
// the figure the same way its column renderer does; the arithmetic stays in calc/settlement, this
// only picks which composition, so the two cannot drift on the maths. A real row field falls through
// to the default. `null` (a figure with no denominator, e.g. remaining with no przedmiar) is returned
// verbatim — sortRows sinks nulls to the bottom in both directions.
export function columnSortValue(
  row: KosztorysV2RowT,
  field: string,
  view: PriceViewT,
  stages: KosztorysStageT[],
): string | number | null {
  switch (field) {
    // Editable (client) / subcontractor price column: the value is the view's price, not a stored field.
    case 'price':
      return viewPrice(row, view)
    case 'priceGross':
      return toGross(viewPrice(row, view), row.vatRate)
    case 'plannedNet':
      return rowPlannedNetForView(row, view)
    case 'plannedGross':
      return toGross(rowPlannedNetForView(row, view), row.vatRate)
    case 'net':
      return rowValueForView(row, stages, view)
    case 'gross':
      return toGross(rowValueForView(row, stages, view), row.vatRate)
    case 'discountAmount':
      return rowDiscountForView(row, rowTotalQtyDone(row, stages, view), view)
    case 'discountAmountGross':
      return toGross(rowDiscountForView(row, rowTotalQtyDone(row, stages, view), view), row.vatRate)
    case 'stageQtySum':
      return rowTotalQtyDone(row, stages, view)
    // By value, not by quantity: sorting a rozjazd list is triage, and „which m² gap is biggest" says
    // nothing across rows priced at 30 zł and 3000 zł. `null` on the rows that agree sinks them to the
    // bottom, which is where a work list wants them.
    case 'divergence':
      return measureDiscrepancy(row, stages)?.net ?? null
    case 'donePercent':
      return rowDoneFraction(row, rowTotalQtyDone(row, stages, view))
    case 'remaining':
      return rowRemainingForView(row, stages, view)
    case 'remainingGross':
      return toGross(rowRemainingForView(row, stages, view), row.vatRate)
    default: {
      const value = row[field as keyof KosztorysV2RowT]
      return (typeof value === 'number' ? value : (value ?? '')) as string | number
    }
  }
}

// A column sort survives the column leaving the grid — e.g. sorting by „Pozostało brutto", then
// flipping the money axis to Netto, which drops every brutto column. The sort's own SortHeader (the
// only control that clears it) leaves with the column, yet the sort state lingers: rows stay in an
// order tied to a header that is gone, and row-reorder actions stay disabled with no way to re-enable
// them (EX-486). Reconcile the stored sort against the set of field ids that actually render, so a
// sort whose column is no longer present resolves to "no sort".
export function reconcileSort<SortT extends { field: string }>(
  sort: SortT | null,
  renderedFieldIds: Set<string>,
): SortT | null {
  return sort && renderedFieldIds.has(sort.field) ? sort : null
}
