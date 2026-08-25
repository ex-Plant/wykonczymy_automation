---
change_id: investor-rename-code
title: Rename the paying party from `client` to `investor` in code
status: archived
created: 2026-08-17
updated: 2026-08-25
archived_at: 2026-08-25
branch: null
worktree: null
---

## Outcome — canceled 2026-08-25, never planned

Dropped, not deferred. The benefit sits on the `tsc`-visible half (types, props, components, filenames,
cache tags), which never expires; the deadline sits on the persisted half (the `client_price` column +
five silent-drop payload surfaces), which is worth nothing and carries all the risk. `research.md` was
distilled away — its durable half is `lessons.md` („A rename splits into two halves with opposite
economics"), which keeps the blind-spot inventory and the gate map; the naming ruling is
`context/domain/02-glossary.md` §2. Nothing else from the 318-line research survives the cancellation.

## Notes

Linear: **EX-704**. Prior art: EX-548 (the kosztorys terminology rename).

Tier C of the „Klient" → „Inwestor" rename. The UI half shipped 2026-08-17 (`f4fa21fb`): every
label, the view axis, the share dialog and the route `/podglad-inwestora` now say „Inwestor", while
the code underneath still says `client`. The glossary records the split as deliberate
(`context/domain/02-glossary.md`, commit `768cc23d`) — this change closes it.

**In scope**

- TS symbols: `ClientView*` → `InvestorView*`, the `clientView` prop, `PriceViewT`'s `'client'`
  member → `'investor'`, and the `kosztorys-client-view-*` / `client-view-settings` filenames.
- Payload field `clientPrice` → `investorPrice` on `kosztorys-items`, with a hand-written migration
  renaming the column `client_price` → `investor_price` (Payload scalar fields take no `dbName`, so
  the field rename IS a column rename). Touches the raw SQL in `lib/db/kosztorys-tree.ts`,
  `lib/db/kosztorys-client-totals.ts`, `lib/kosztorys/insert-rows.ts`.

**Out of scope (decided, not forgotten)**

- The Payload collection slug `kosztorys-client-view` and global slug
  `kosztorys-client-view-defaults`. Both are invisible to the owner, and `dbName` (collections
  `types.d.ts:418`, globals `:161`) would let the slug move without touching the table — but the
  rename buys nothing and costs a drift-verification round.
- `components/tables/leads.tsx`, where „klient" means a CRM lead — a prospect, not a payer.

**Measured blast radius** — see `research.md`; the pre-research figures below were wrong on three
counts and are kept only to mark what changed.

- ```89 files, ~500 occurrences~~ → **123 files, ~880 occurrences** in the paying-party bucket, plus
  **14 files to `git mv`**. Two clusters were missing from the count: `client-totals` (which reaches
  past the kosztorys onto the investments listing) and the `RowConditionKindT` union.
  ```
- ~~Zero persisted `'client'` values~~ → **five persistence surfaces**: three JSONB
  (`kosztorys_snapshots.payload`, `kosztorys_presets.payload`, `kosztoryses.sheet_column_mapping`)
  and two `localStorage` keys (`kosztorys-view:<id>`, `kosztorys-filters:<id>`). Every one has a
  tolerant parser that drops unknown keys **silently**.
- ~~The throwaway-data carve-out covers the migration~~ → it does **not** cover the global,
  hand-curated `kosztorys_presets` library (`lessons.md:743-760`). Whether
  `SNAPSHOT_SCHEMA_VERSION` moves is the one real design decision in this change.
- 1 DB column, one hand-written migration. `insert-schema-drift.test.ts` is the gate that fails in
  both directions; adding the migration file re-migrates the 5435 test DB automatically.

**Naming trap to hold the line on:** the target prefix is `investor*`, never `investment*` —
`investmentId` already denotes the project, a different thing one word away.

**Sequencing constraint:** a mechanical ~500-site rename conflicts with anything in flight. Start it
only against a clean working tree; on 2026-08-17 a second agent held `use-kosztorys-editor.ts`,
`row-conditions.ts` and the `sheet-import/*` cluster open.
