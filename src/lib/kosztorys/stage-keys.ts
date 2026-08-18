import type { StageKeyT } from '@/lib/kosztorys/types'

// The stage-column key namespace: the string prefixes each stage axis lives under, and the builders
// that turn a stage id into a concrete column key. One home so the prefix, its group, and its key
// builder are decided together — every row/column/settlement module keys stage cells through these.

// Each stage axis hides under ONE picker entry rather than one per `stage_<id>`: a row per stage is
// noise, and it keeps stage ids out of the visibility map — Postgres can reissue a deleted stage's
// id, and a new stage inheriting the dead one's hidden state would be a ghost. Three groups, so the
// qty axis and both value axes hide independently.
export const STAGES_COLUMN_GROUP = 'stages'
export const STAGE_VALUE_NET_COLUMN_GROUP = 'stageValueNet'
export const STAGE_VALUE_GROSS_COLUMN_GROUP = 'stageValueGross'

// The qty axis's prefix — the one axis whose key IS a row field. diffRow (v2-rows.ts) classifies
// every key on the row by it, so it decides what gets saved as stage progress; the two value
// namespaces below are defined against it and must never collide with or prefix it.
export const STAGE_QTY_PREFIX = 'stage_'

// The editable stage-qty field key for a stage id (the row's `stage_<id>`).
export function stageKey(stageId: number): StageKeyT {
  return `${STAGE_QTY_PREFIX}${stageId}`
}

// Column ids for the per-stage value columns. Deliberately NOT under STAGE_QTY_PREFIX: that prefix
// means "an editable qty field on the row", so a value column wearing it would reach diffRow, which
// would parse `Number('ValueNet_7')` → NaN into a save against a nonexistent stage.
export function stageValueNetKey(stageId: number): string {
  return `${STAGE_VALUE_NET_COLUMN_GROUP}_${stageId}`
}

export function stageValueGrossKey(stageId: number): string {
  return `${STAGE_VALUE_GROSS_COLUMN_GROUP}_${stageId}`
}

// The inverses of the two value builders, for code that receives a column id and has to recover the
// etap it belongs to (sort-value.ts). Only the value namespaces need one: `stage_<id>` is a real row
// field, so its consumers read the key rather than parse it.
//
// A key from the WRONG namespace must resolve to null, not to a number — `Number('Gross_7')` is NaN
// but `Number('')` is 0, so a bare Number() on a mis-routed key would silently name etap 0.
function stageIdFromKey(key: string, group: string): number | null {
  const prefix = `${group}_`
  if (!key.startsWith(prefix)) return null
  const rest = key.slice(prefix.length)
  return /^\d+$/.test(rest) ? Number(rest) : null
}

export function stageIdFromValueNetKey(key: string): number | null {
  return stageIdFromKey(key, STAGE_VALUE_NET_COLUMN_GROUP)
}

export function stageIdFromValueGrossKey(key: string): number | null {
  return stageIdFromKey(key, STAGE_VALUE_GROSS_COLUMN_GROUP)
}
