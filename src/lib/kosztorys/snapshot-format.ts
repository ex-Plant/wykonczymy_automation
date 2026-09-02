import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
} from '@/lib/kosztorys/types'

// Bump only on a non-additive payload change (a renamed/dropped field). An ADDITIVE field usually
// needs no bump, but not because "the mapper defaults anything missing" — it defaults exactly what
// insertKosztorysTree lists: the numeric NOT NULL DEFAULT columns and display_order. A new column
// that is NOT NULL *without* a default (`kosztorys_sections.name`, `kosztorys_stages.ordinal` are
// the two today) has no meaningful fallback, so adding one IS a breaking change for every stored
// payload, additive or not. See restore-kosztorys.ts for the tolerant deserialization contract.
//
// A field DROPPED without ever having been read is exempt: the restore mapper picks keys it knows,
// so the stale key in an old payload is inert and the snapshot still restores whole (precedent:
// 20260724_1).
//
// A BUMP IS NOT DONE UNTIL THE EXISTING ROWS ARE DEALT WITH. Three exits, pick one:
//   - don't bump — additive, or a key the mapper never reads (five column drops have taken this
//     exit with no failure);
//   - migrate the stored payloads — presets: a hand-curated library, deleting it destroys real work;
//   - delete the stored rows — snapshots: ambient history, cheap to re-accumulate.
// Forbidden: bump and leave. Bumping is asymmetric — the list queries (snapshots.ts, presets.ts)
// don't assert, so every stranded version and preset keeps being offered in the UI and throws the
// Polish error below only once clicked. Honouring the rule buys the invariant that EVERY row in
// kosztorys_snapshots is readable by the current code, which is in turn why listSnapshots carries no
// schema_version filter: an unreadable row is not history to be filtered out of a list, it is a row
// that should not exist.
export const SNAPSHOT_SCHEMA_VERSION = 1 as const

// Gate a stored payload at read time. Because the version bumps ONLY on a non-additive change, any
// mismatch (an old row written before that change, or a future row from newer code) means the
// tolerant mapper would seed wrong/missing columns — so reject loudly instead of silently applying.
// Never bumped yet, so this rejects nothing today; it's the guard that arms on the first bump.
export function assertReadableSchemaVersion(version: number, kind: 'preset' | 'snapshot'): void {
  if (version === SNAPSHOT_SCHEMA_VERSION) return
  const label = kind === 'preset' ? 'szablonu' : 'wersji'
  throw new Error(
    `Nie można wczytać ${label}: zapisano w formacie ${version}, aplikacja obsługuje ${SNAPSHOT_SCHEMA_VERSION}.`,
  )
}

// The investment editor-settings that shape computed prices — captured so a restore is faithful
// (restore rewrites them). Kept off the tree because they live on `investments`. The global discount
// is deliberately NOT captured: restoring a version must not reset the live amount discount.
export type SnapshotSettingsT = {
  wToolsCoeff: number
  ownToolsCoeff: number
  vatRate: number
}

// One serialized kosztorys, flat (no nested items) so restore can rebuild the FK graph by remapping
// ids. Column-parity with the four tree tables + the three investment fields. `id`/`sectionId`/
// `itemId`/`stageId` are the OLD ids — restore mints new ones and remaps children.
export type SnapshotPayloadT = {
  schemaVersion: number
  sections: KosztorysSectionT[]
  items: KosztorysItemT[]
  stages: KosztorysStageT[]
  progress: StageProgressT[]
  settings: SnapshotSettingsT
}
