import {
  effectiveCoeff,
  rowDiscountForView,
  rowDoneFraction,
  rowPlannedNetForView,
  stageValueForView,
  toGross,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { OVERRIDE_FIELDS } from '@/lib/kosztorys/constants'
import {
  measureDiscrepancy,
  rowRemainingForView,
  rowTotalQtyDone,
  rowValueForView,
} from '@/lib/kosztorys/settlement-rows'
import {
  stageIdFromValueGrossKey,
  stageIdFromValueNetKey,
  stageKey,
} from '@/lib/kosztorys/stage-keys'
import type {
  KosztorysStageT,
  KosztorysV2RowT,
  SubcontractorOverrideTypeT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'

// The wartość of one etap, as its cell computes it. The denominator is Σ etapów of the whole VIEW,
// never a narrowed list (kosztorys-v2-columns.tsx) — `rowTotalQtyDone` applies that filter itself, so
// this is handed the full `stages` array and must stay that way. An id no longer among the etapy has
// no value to show: null, which sortRows sinks.
function stageValueNetSortValue(
  row: KosztorysV2RowT,
  stageId: number,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number | null {
  if (!stages.some((st) => st.id === stageId)) return null
  return stageValueForView(
    row,
    row[stageKey(stageId)] ?? 0,
    rowTotalQtyDone(row, stages, view),
    view,
  )
}

// The multiplier „Mnożnik" actually SHOWS, which is not one field: own under 'coeff', the inherited
// investment/section default under auto, and nothing at all under 'amount' (the cell renders „—").
// Reading `effectiveCoeff` unconditionally would sort every hand-set row by the default it overrode.
function viewCoeffSortValue(row: KosztorysV2RowT, view: ToolPlaneT): number | null {
  const mode = overrideMode(row, view)
  if (mode === 'amount') return null
  if (mode === 'coeff') return (row[OVERRIDE_FIELDS[view].value] as number | null) ?? null
  return effectiveCoeff(row, view)
}

// OVERRIDE_FIELDS keys by `keyof ViewPricingT`, so the indexed read widens to every field's type.
function overrideMode(row: KosztorysV2RowT, view: ToolPlaneT): SubcontractorOverrideTypeT | null {
  return row[OVERRIDE_FIELDS[view].type] as SubcontractorOverrideTypeT | null
}

// „Źródło ceny wykonawcy" ascending runs inherited → hand-overridden, which is the only question
// asked of that column. Alphabetical would split the two override modes around „auto".
const PRICE_MODE_RANK = { auto: 0, coeff: 1, amount: 2 } as const

// The sort key for a grid column. Most columns in kosztorys-v2-columns.tsx are COMPUTED — their
// value is derived at render from calc/settlement, never stored on the row — so a `row[field]` read
// returns undefined for them and the sort silently no-ops (EX-487). Each computed case here composes
// the figure the same way its column renderer does; the arithmetic stays in calc/settlement, this
// only picks which composition, so the two cannot drift on the maths. A real row field falls through
// to the default. `null` — a figure with no denominator (remaining with no przedmiar), a key whose
// etap is gone, or simply an empty cell — is returned verbatim, and sortRows sinks it to the bottom
// in both directions.
export function columnSortValue(
  row: KosztorysV2RowT,
  field: string,
  view: PriceViewT,
  stages: KosztorysStageT[],
): string | number | null {
  // Ahead of the switch: the two per-etap value namespaces carry a stage id inside the key, so no
  // exact-match case can name them. The qty axis needs nothing here — `stage_<id>` IS a row field
  // (v2-rows.ts seeds every one of them as a number), so it resolves through the default below.
  const valueNetStageId = stageIdFromValueNetKey(field)
  if (valueNetStageId !== null) return stageValueNetSortValue(row, valueNetStageId, stages, view)
  const valueGrossStageId = stageIdFromValueGrossKey(field)
  if (valueGrossStageId !== null) {
    const net = stageValueNetSortValue(row, valueGrossStageId, stages, view)
    return net === null ? null : toGross(net, row.vatRate)
  }

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
    // The two subcontractor columns are the other shape no exact-match case could reach: their ids
    // are not row fields — the fields are per-plane (OVERRIDE_FIELDS), which is why flipping their
    // old `sortable: false` alone would have sorted every row by `undefined`. Neither column is
    // assembled in the client view, and `effectiveCoeff` has no client plane to read.
    case 'priceCoeff':
      return view === 'client' ? null : viewCoeffSortValue(row, view)
    case 'priceMode':
      return view === 'client' ? null : PRICE_MODE_RANK[overrideMode(row, view) ?? 'auto']
    default: {
      const value = row[field as keyof KosztorysV2RowT]
      if (typeof value === 'number') return value
      // An empty cell is an absence, not a key. `?? ''` used to answer here, and it did two jobs at
      // once: it sorted every commentless pozycja to the TOP of „Komentarz" (asc), and — because a
      // cleared numeric cell writes null through the grid's `Column<number|null>` — it put a string
      // next to numbers, which drops sortRows into localeCompare for the WHOLE column, ordering
      // „Przedmiar" as text („10" before „9"). null instead: sortRows sinks it under both
      // directions, matching the „—" these cells render.
      return value == null || value === '' ? null : String(value)
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
