import { DEFAULT_ITEM_DESCRIPTION, DEFAULT_UNIT } from '@/lib/kosztorys/constants'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// Revert a row field to its pre-edit value (revert-on-error autosave), but ONLY
// if nothing newer was typed since the failed save (current === attempted) —
// otherwise we would trample the user's fresher edit.
export function revertField(
  rows: KosztorysV2RowT[],
  id: number,
  field: keyof KosztorysV2RowT,
  prevValue: unknown,
  attempted: unknown,
): KosztorysV2RowT[] {
  return rows.map((r) => {
    if (r.id !== id || r[field] !== attempted) return r
    return { ...r, [field]: prevValue } as KosztorysV2RowT
  })
}

export type BlankRowInputT = {
  id: number
  displayOrder: number
  sectionId: number
  sectionName: string
  sectionColor: SectionColorKeyT | null
  vatRate: number
  globalDiscountActive: boolean
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
  stages: KosztorysStageT[]
}

// Blank item row = createBlankItem's server defaults + denormalized section fields
// + stage_*=0. Built optimistically from the known id/displayOrder returned by the action.
export function buildBlankRow(input: BlankRowInputT): KosztorysV2RowT {
  const stageFields: Record<string, number> = {}
  for (const st of input.stages) stageFields[stageKey(st.id)] = 0
  return {
    id: input.id,
    sectionId: input.sectionId,
    displayOrder: input.displayOrder,
    description: DEFAULT_ITEM_DESCRIPTION,
    unit: DEFAULT_UNIT,
    plannedQty: 0,
    sheetMeasuredQty: null,
    discountType: null,
    discountValue: 0,
    clientPrice: 0,
    wToolsOverrideType: null,
    wToolsOverrideValue: 0,
    ownToolsOverrideType: null,
    ownToolsOverrideValue: 0,
    hiddenInExport: false,
    note: null,
    sectionName: input.sectionName,
    sectionColor: input.sectionColor,
    vatRate: input.vatRate,
    globalDiscountActive: input.globalDiscountActive,
    globalWToolsCoeff: input.globalWToolsCoeff,
    globalOwnToolsCoeff: input.globalOwnToolsCoeff,
    ...stageFields,
  } as KosztorysV2RowT
}

// Lands after the LAST row of its own section, not at the end of the array: the grid groups rows into
// section bands by walking them in order, so a row parked past a later section would open a second
// band for a section that already has one — one id, two rows, duplicate keys in dsg's virtualizer.
// A section with no rows yet (a fresh section's first item) has nothing to follow, so it appends.
export function applyAddItem(rows: KosztorysV2RowT[], row: KosztorysV2RowT): KosztorysV2RowT[] {
  let at = rows.length
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].sectionId === row.sectionId) at = i + 1
  }
  return [...rows.slice(0, at), row, ...rows.slice(at)]
}

export function applyRemoveItem(rows: KosztorysV2RowT[], itemId: number): KosztorysV2RowT[] {
  return rows.filter((r) => r.id !== itemId)
}

// Put a removed row back after a failed delete. `afterId` is the id the row followed at removal time
// (null = it was first). Resolved against the CURRENT array, not a stale index, so a concurrent
// add/remove/reorder during the delete's await can't misplace it: land right after `afterId` if it's
// still present, at the front if the row was first, else append.
export function applyRestoreItem(
  rows: KosztorysV2RowT[],
  row: KosztorysV2RowT,
  afterId: number | null,
): KosztorysV2RowT[] {
  if (afterId === null) return [row, ...rows]
  const anchor = rows.findIndex((r) => r.id === afterId)
  const at = anchor < 0 ? rows.length : anchor + 1
  return [...rows.slice(0, at), row, ...rows.slice(at)]
}

// display_order the inserted row takes: "above" claims the anchor's slot, "below" the next one.
// Mirrors insertItemAction's server-side insert point.
export function insertDisplayOrder(anchor: KosztorysV2RowT, dir: 'above' | 'below'): number {
  return dir === 'above' ? anchor.displayOrder : anchor.displayOrder + 1
}

// Splice a blank row into the display sequence at the anchor (±1) and bump the local display_order
// of same-section rows at/after the insert point — the client mirror of insertItemAction's
// section-tail shift, so a later ▲▼/insert stays consistent with the server without a refresh.
// Array position (not display_order) drives the unsorted grid render, so the row lands at the
// anchor's array index; the display_order bump only keeps the persisted-order mirror correct.
// `newRow.displayOrder` MUST be the insert point (from insertDisplayOrder) before calling.
export function applyInsertItem(
  rows: KosztorysV2RowT[],
  anchorId: number,
  newRow: KosztorysV2RowT,
  dir: 'above' | 'below',
): KosztorysV2RowT[] {
  const anchorIdx = rows.findIndex((r) => r.id === anchorId)
  if (anchorIdx < 0) return rows
  const at = newRow.displayOrder
  const bumped = rows.map((r) =>
    r.sectionId === newRow.sectionId && r.displayOrder >= at
      ? { ...r, displayOrder: r.displayOrder + 1 }
      : r,
  )
  const insertIdx = dir === 'above' ? anchorIdx : anchorIdx + 1
  return [...bumped.slice(0, insertIdx), newRow, ...bumped.slice(insertIdx)]
}

// Move an item one place within ITS section (▲/▼). Operates on the display sequence
// of items in the same section (their order in `rows`), NOT on block contiguity —
// this way a section whose rows are not adjacent still moves the pair the user sees.
// Returns the same reference on a no-op (block edge / unknown id) — a signal to the editor
// that there is nothing to save.
export function swapItemInSection(
  rows: KosztorysV2RowT[],
  itemId: number,
  dir: 'up' | 'down',
): KosztorysV2RowT[] {
  const target = rows.find((r) => r.id === itemId)
  if (!target) return rows
  // Indices in `rows` of items in the same section, in array order (= display order).
  const sameSection = rows
    .map((r, i) => ({ id: r.id, i }))
    .filter((_, idx) => rows[idx].sectionId === target.sectionId)
  const pos = sameSection.findIndex((x) => x.id === itemId)
  const targetPos = dir === 'up' ? pos - 1 : pos + 1
  if (targetPos < 0 || targetPos >= sameSection.length) return rows // block edge → no-op
  const a = sameSection[pos].i
  const b = sameSection[targetPos].i
  const next = [...rows]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

// Rows grouped by section, in the order the sections first appear. A Map keeps insertion order, so
// its keys ARE the section display sequence — both section movers below read the order off this one
// pass rather than a second stored sequence.
export function groupBySection(rows: KosztorysV2RowT[]): Map<number, KosztorysV2RowT[]> {
  const blocks = new Map<number, KosztorysV2RowT[]>()
  for (const r of rows) {
    const block = blocks.get(r.sectionId)
    if (block) block.push(r)
    else blocks.set(r.sectionId, [r])
  }
  return blocks
}

// Both section movers work by editing the section SEQUENCE and re-concatenating the blocks, never by
// splicing array indices: a section's rows are not guaranteed adjacent, and the regroup pulls a stray
// row back into its block, where an index splice would land past the wrong one.
function regroup(blocks: Map<number, KosztorysV2RowT[]>, seq: number[]): KosztorysV2RowT[] {
  return seq.flatMap((id) => blocks.get(id) ?? [])
}

// Splice the first row of a newly inserted section into the display sequence, just before or just
// after the anchor section's block.
export function applyInsertSectionRow(
  rows: KosztorysV2RowT[],
  anchorSectionId: number,
  row: KosztorysV2RowT,
  dir: 'above' | 'below',
): KosztorysV2RowT[] {
  const blocks = groupBySection(rows)
  const seq = [...blocks.keys()]
  const pos = seq.indexOf(anchorSectionId)
  if (pos < 0) return [...rows, row]
  seq.splice(dir === 'above' ? pos : pos + 1, 0, row.sectionId)
  blocks.set(row.sectionId, [row])
  return regroup(blocks, seq)
}

export function neighborSectionId(
  rows: KosztorysV2RowT[],
  sectionId: number,
  dir: 'up' | 'down',
): number | undefined {
  const seq = [...groupBySection(rows).keys()]
  const pos = seq.indexOf(sectionId)
  if (pos < 0) return undefined
  return seq[dir === 'up' ? pos - 1 : pos + 1]
}

// Move a whole section one place (▲/▼). Same reference on a no-op (edge / unknown id).
export function swapSectionBlock(
  rows: KosztorysV2RowT[],
  sectionId: number,
  dir: 'up' | 'down',
): KosztorysV2RowT[] {
  const blocks = groupBySection(rows)
  const seq = [...blocks.keys()]
  const pos = seq.indexOf(sectionId)
  const targetPos = dir === 'up' ? pos - 1 : pos + 1
  if (pos < 0 || targetPos < 0 || targetPos >= seq.length) return rows
  ;[seq[pos], seq[targetPos]] = [seq[targetPos], seq[pos]]
  return regroup(blocks, seq)
}

// Neighbor of an item within ITS section in the ▲/▼ direction (same sequence as swapItemInSection).
// `undefined` at the block edge — a no-op signal. Used to swap the display_order of two rows.
export function sectionNeighbor(
  rows: KosztorysV2RowT[],
  itemId: number,
  dir: 'up' | 'down',
): KosztorysV2RowT | undefined {
  const target = rows.find((r) => r.id === itemId)
  if (!target) return undefined
  const sameSection = rows.filter((r) => r.sectionId === target.sectionId)
  const pos = sameSection.findIndex((r) => r.id === itemId)
  const neighborPos = dir === 'up' ? pos - 1 : pos + 1
  return sameSection[neighborPos]
}
