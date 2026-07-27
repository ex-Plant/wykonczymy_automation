import {
  netForQtyForView,
  rowDiscountForView,
  rowPlannedNetForView,
  toGross,
} from '@/lib/kosztorys/calc'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import {
  rowRemainingForView,
  rowTotalQtyDone,
  stageAxisForView,
  stagesForView,
} from '@/lib/kosztorys/settlement'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

/**
 * Every column's total over a set of rows, keyed by the grid's own column ids — the shape both the
 * „Razem" row and each section's footer render from.
 *
 * One function for both, because they are the same figure at two scopes: the footer is this over one
 * section's rows, „Razem" is this over all of them. Σ of the footers therefore equals „Razem" by
 * construction rather than by two implementations happening to agree.
 *
 * A column absent from the map renders blank. That is the honest outcome for a column whose total is
 * not a sum of its own cells (a share, a ratio) — never a 0, which would claim a reading.
 *
 * `net` is the executed value BEFORE any rabat globalny, matching what the „Razem" row has always
 * shown: the global rabat is a single subtraction the summary panel makes once, not a per-row figure
 * these columns could carry a share of.
 */
export function columnTotalsForRows(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: PriceViewT,
  vatRate: number,
): Map<string, number> {
  const totals = new Map<string, number>()
  const viewStages = stagesForView(stages, view)

  let net = 0
  let plannedNet = 0
  let discount = 0
  let plannedQty = 0
  // „Pozostało": rows with no przedmiar read `null` — no offer to subtract from — and are skipped, so
  // the total sums what the column actually shows rather than a 0 it never claimed.
  let remaining = 0
  for (const row of rows) {
    // One pomiar per row, priced twice: the value and the rabat taken on it must stand on the same
    // quantity, exactly as in sectionSubtotalsForView.
    const qtyDone = rowTotalQtyDone(row, viewStages, view)
    net += netForQtyForView(row, qtyDone, view)
    plannedNet += rowPlannedNetForView(row, view)
    discount += rowDiscountForView(row, qtyDone, view)
    plannedQty += row.plannedQty ?? 0
    const rowRemaining = rowRemainingForView(row, stages, view)
    if (rowRemaining === null) continue
    remaining += rowRemaining
  }

  totals.set('net', net)
  totals.set('gross', toGross(net, vatRate))
  // The przedmiar has no per-rozliczenie reading, so outside the client view there is nothing to sum —
  // and the columns it would total are hidden there anyway.
  if (view === 'client') {
    totals.set('plannedNet', plannedNet)
    totals.set('plannedGross', toGross(plannedNet, vatRate))
  }
  totals.set('remaining', remaining)
  totals.set('remainingGross', toGross(remaining, vatRate))
  totals.set('discountAmount', discount)
  totals.set('discountAmountGross', toGross(discount, vatRate))
  totals.set('plannedQty', plannedQty)

  // Iterated over the view's own stages only: an out-of-view etap has no column here to total, and
  // stageAxisForView deliberately gives it no share of the value either.
  const stageAxis = stageAxisForView(rows, stages, view)
  let stageQtySum = 0
  for (const stage of viewStages) {
    const stageQty = stageAxis.qty.get(stage.id) ?? 0
    stageQtySum += stageQty
    totals.set(stageKey(stage.id), stageQty)
    const stageValueNet = stageAxis.net.get(stage.id) ?? 0
    totals.set(stageValueNetKey(stage.id), stageValueNet)
    totals.set(stageValueGrossKey(stage.id), toGross(stageValueNet, vatRate))
  }
  totals.set('stageQtySum', stageQtySum)
  return totals
}
