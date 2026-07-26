import { sectionColorFill } from '@/lib/kosztorys/section-colors'
import type { SectionSubtotalClientT } from '@/lib/kosztorys/types'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'

// `id` is a stable React key — section names / materiały labels are free-typed and can collide,
// so keying a Cell/legend row on `name` risks duplicate keys (mis-reconcile on the base toggle).
export type PieSliceT = { id: string; name: string; value: number; fill: string }

// Positional palette — order preserved from the old conic pie's SLICE_COLORS. recharts fills a slice
// with the raw CSS var; Tailwind never scans these, so no bg-chart-* utility is needed.
export const CHART_FILLS = [
  'var(--color-chart-blue)',
  'var(--color-chart-orange)',
  'var(--color-chart-green)',
  'var(--color-chart-purple)',
  'var(--color-chart-turquoise)',
  'var(--color-chart-pink)',
  'var(--color-chart-yellow)',
  'var(--color-chart-red)',
  'var(--color-chart-teal)',
] as const

// A slice before painting. `fill` present = the caller pinned this one (a section with a chosen
// colour); absent = paint it from the positional palette.
type RawSliceT = Omit<PieSliceT, 'fill'> & { fill?: string }

// Drop zero-value slices, then color the unpinned survivors by position — the shared tail of every pie
// builder. Coloring after the filter keeps the palette contiguous (no gaps where a zero was).
//
// Pinned slices are honoured as-is and their colours are REMOVED from the pool the unpinned ones
// draw from: without that, a section pinned to blue plus an unpinned one that lands on blue by
// position would render two identical wedges — the exact ambiguity the pie exists to avoid. If the
// pins exhaust the palette the pool falls back to the full list (a repeat beats no fill at all).
function paintSlices(raw: RawSliceT[]): PieSliceT[] {
  const kept = raw.filter((slice) => slice.value !== 0)
  const pinned = new Set(kept.map((slice) => slice.fill).filter((fill) => fill != null))
  const free = CHART_FILLS.filter((fill) => !pinned.has(fill))
  const pool = free.length > 0 ? free : CHART_FILLS
  let next = 0
  return kept.map((slice) => ({
    ...slice,
    fill: slice.fill ?? pool[next++ % pool.length],
  }))
}

export type SectionPieBaseT = 'przedmiar' | 'wykonane'

// The section pie only needs each section's two money figures; it takes the client-priced,
// view-invariant subtotals so a structure chart never moves with the widok cen. Picking off the
// client variant is what makes „przedmiar" a usable base here — outside that view the figure is
// withheld, and the pie would have nothing to slice.
export type SectionSliceInputT = Pick<
  SectionSubtotalClientT,
  'sectionId' | 'sectionName' | 'sectionColor' | 'plannedNet' | 'net'
>

export function sectionPieSlices(
  subtotals: readonly SectionSliceInputT[],
  base: SectionPieBaseT,
): PieSliceT[] {
  return paintSlices(
    subtotals.map((section) => ({
      id: `section-${section.sectionId}`,
      name: section.sectionName,
      value: base === 'przedmiar' ? section.plannedNet : section.net,
      fill: sectionColorFill(section.sectionColor),
    })),
  )
}

// Two-slice cost split — robocizna vs materiały as single totals, no per-category breakdown. Used by
// the „Struktura kosztów" pie, which reasons in netto totals rather than the per-expense rozpiska.
export function costTotalsPieSlices(robocizna: number, materialy: number): PieSliceT[] {
  return paintSlices([
    { id: 'robocizna', name: 'Robocizna', value: robocizna },
    { id: 'materialy', name: 'Materiały', value: materialy },
  ])
}

// Per-category „Wydatki inwestycyjne" share — one slice per non-zero expense category. `row.net` is
// the brutto sum; the reduction is uniform, so brutto and netto proportions are identical.
export function expensePieSlices(rows: readonly MaterialyBreakdownRowT[]): PieSliceT[] {
  return paintSlices(
    rows.map((row) => ({
      id: row.id !== null ? `expense-${row.id}` : 'korekta',
      name: row.label,
      value: row.net,
    })),
  )
}

// Wpłaty split by VAT plane — netto vs brutto deposits. Shown only in tryb mieszany, where the plane
// distinction exists; the netto slice absorbs the unmarked deposits (they default to netto).
export function depositPlanePieSlices(paidNet: number, paidGross: number): PieSliceT[] {
  return paintSlices([
    { id: 'netto', name: 'Wpłaty netto', value: paidNet },
    { id: 'brutto', name: 'Wpłaty brutto', value: paidGross },
  ])
}
