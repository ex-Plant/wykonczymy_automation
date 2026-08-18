---
date: 2026-08-17T14:12:06Z
researcher: Claude
git_commit: 768cc23da5fad881bc7efa9074ffbcb77d5fb1e9
branch: filtry-problemy
repository: wykonczymy
topic: "Renaming the paying party from `client` to `investor` in code (tier C)"
tags: [research, codebase, rename, kosztorys, migration, no-domain-drift, snapshots]
status: complete
last_updated: 2026-08-17
last_updated_by: Claude
---

# Research: renaming the paying party from `client` to `investor` in code

**Date**: 2026-08-17T14:12:06Z
**Researcher**: Claude
**Git Commit**: `768cc23da5fad881bc7efa9074ffbcb77d5fb1e9`
**Branch**: `filtry-problemy`
**Repository**: wykonczymy

## Research Question

The UI half of the „Klient" → „Inwestor" rename shipped in `f4fa21fb`; the code underneath still says
`client`. Before planning tier C: where does `client` actually live, what of it is persisted, which
gates would catch a half-done rename, and what does the prior mechanical rename (EX-548) teach about
sequencing it?

## Summary

The change is bigger than `change.md` recorded and its riskiest surface is not the DB column.

**Three claims in `change.md` are wrong and are corrected below**: the blast radius (123 files /
~880 occurrences, not ~89 / ~500), the "zero persisted `'client'` values" line (three JSONB surfaces
plus two `localStorage` keys persist it), and the assumption that the kosztorys throwaway-data
carve-out covers the snapshot payload (it does not cover the curated global preset library).

The load-bearing finding: **`tsc` is the primary gate and it is blind to every persistence surface
this rename touches**. A renamed key in `kosztorys_snapshots.payload`, `kosztorys_presets.payload` or
`kosztoryses.sheet_column_mapping` produces no type error, no test failure, and no runtime error —
the tolerant parsers drop unknown keys by design, and `num(undefined)` is `0`. The golden master does
not see it either, because it never joins `kosztorys_items`.

Two whole clusters were missing from the original scope: the `client-totals` family (which reaches
past the kosztorys onto the investments listing) and the `RowConditionKindT` union with its persisted
condition ids.

## Detailed Findings

### 1. Blast radius — corrected

| Bucket | Meaning | Size |
|---|---|---|
| A | the paying party (the rename target) | **123 files, ~880 occurrences** |
| B | React `'use client'` / client-side | 221 directives + ~45 identifiers |
| C | CRM lead (`components/tables/leads.tsx`) | 1, Polish prose |
| D | Google / Payload / Vercel SDK clients | ~40 |
| E | genuinely ambiguous | 2 |

Roughly half of bucket A is comments and prose — not rename targets, but they must be read, because
this is exactly where „klient" vs „inwestor" confusion was documented in the first place. **14 files
need `git mv`** (10 source + 4 spec, the spec moves forced by the AGENTS.md full-path-mirroring rule,
which no gate enforces).

`grep -rhoE "[A-Za-z_][A-Za-z0-9_-]*[Cc]lient[A-Za-z0-9_-]*" src e2e` yields **66 distinct
identifiers**. Ones that must **not** be swept: `getReadonlySheetsClient`, `sheets-client`,
`uploadFileClient`, `scanReceiptClient`, `useClientMultiFilter`, `FixedClientLoader`,
`ServerFunctionClient`, `getBoundingClientRect`, `e.clientX`, `client_email` (a Google
service-account wire key), `lineItemClientSchema`.

### 2. The cluster the original scope missed: `client-totals`

`KosztorysClientTotalsT` / `…MapT` / `…RowT`, `kosztorysClientTotals`, `selectKosztorysClientTotals`,
`fetchKosztorysClientTotals`, `clientTotalsFromSubtotals`, `KOSZTORYS_CLIENT_TOTALS_TAGS`, and the
cache key `'kosztorys-client-totals-v1'` (`src/lib/queries/balances.ts:104`) — ~50 sites spanning
`lib/db`, `lib/queries` and `shape-investments`, i.e. **out past the kosztorys onto the investments
listing**. A stale cache key is not a correctness bug (the old entry simply goes cold), but it is a
decision the plan owes.

### 3. The second `'client'` union — persisted, and silently tolerant

Independent of `PriceViewT`: `RowConditionKindT = 'filter' | 'diagnostic' | 'client'`
(`src/lib/kosztorys/row-conditions.ts:11`), with the condition ids `'client-empty'` (`:100`) and
`'no-client-price'` (`:116`). Both persist under `localStorage["kosztorys-filters:<id>"]`, and
`use-engaged-conditions.ts:39-41` **drops unknown ids without a word** — so a rename quietly
disarms whatever filter the owner had switched on. `'no-client-price'` alone has 22 sites, of which
11 are hardcoded strings in `row-conditions.test.ts` and 7 in `problems-menu-model.test.ts`.

**Correction to a claim made earlier in this session**: `PriceViewT`'s `'client'` member *does*
persist — `use-price-view.ts:13` writes it to `localStorage["kosztorys-view:<investmentId>"]` via
`usePersistedEnum`. It is not an in-memory-only union.

### 4. The silent-failure inventory (the core risk)

| Surface | Reference | Why it fails silently |
|---|---|---|
| `kosztoryses.sheet_column_mapping` jsonb | written `lib/actions/sheets.ts:204,231`; key set is `ColumnFieldT`, `sheet-import/columns.ts:41` | the parser drops unknown keys by design (`sheet-column-mapping.ts:22-25`); **no version constant at all** → every owner-saved „Cena j.m." column pointing evaporates |
| `kosztorys_snapshots.payload` jsonb | `serialize-kosztorys.ts:12` | `insertItems` (`insert-rows.ts:124`) writes `undefined` into the price column of every restored row; INSERT succeeds |
| `kosztorys_presets.payload` jsonb | `serialize-preset.ts:14-22` retains `clientPrice` deliberately | same, and this library is **global and hand-curated** |
| `kosztorys_client_view.hidden_columns` jsonb | `client-view-settings-form.tsx:51-57` | unknown keys sanitized away silently (`kosztorys-client-view.test.ts:64-68`) |
| raw-SQL mapper | `lib/db/kosztorys-tree.ts:147` `clientPrice: num(row.client_price)` | `row` is `Record<string, unknown>`; `num(undefined)` → **0** |
| `defaultColumns: [… 'clientPrice']` | `collections/kosztorys-items.ts:20` | untyped `string[]` → admin column silently disappears |
| `ITEM_INSERT_COLUMNS` ↔ VALUES tuple | `insert-rows.ts:31` vs `:124` | correlated **by position only** — reorder while renaming and columns are mis-written with no type error |

### 5. `SNAPSHOT_SCHEMA_VERSION` — the carve-out does not cover presets

`snapshot-format.ts:8-18` mandates a bump on a renamed field; the version is `1`. But
`lessons.md:743-760` rules "bump on the rationale, not the letter" — bump only when a stored payload
would restore into *wrong* rows — and records the asymmetry that makes this decision load-bearing:

- a bump makes `assertReadableSchemaVersion` throw on **every** stored row, and
- the three list queries do **not** assert, so the versions drawer and the „dodaj sekcję z szablonu"
  picker keep offering entries that error the moment you use one.

Crucially the same lesson states the **global, hand-curated `kosztorys_presets` library is not
covered by the kosztorys throwaway-data carve-out**. `change.md:39-40` leaned on that carve-out. A
renamed key here restores rows at price 0 — which is "wrong rows", so the rationale points at a bump,
and the bump then breaks the curated library. **This is the one genuine design decision in the whole
change**; everything else is mechanical.

### 6. Verification gates — what catches what

Gates, in order: pre-commit `lint-staged` (staged files only); pre-push `typecheck` →
`vitest run` → `test:integration` (5435) → `test:parity`; `pnpm lint` full-repo, `pnpm build` and
`pnpm test:e2e` are **manual and ungated**.

**`tsc` catches** the symbol level: `KosztorysItemT.clientPrice`, `ItemPatchT`
(`lib/kosztorys/types.ts:70`), `ITEM_FIELDS` (`v2-rows.ts:12`, guarded by `satisfies readonly (keyof
ItemPatchT)[]`), `ColumnFieldT` + `FIELD_LABELS`, `LABOR_FIELDS` (`resolve-columns.ts:171`), and
every spec fixture typed against them — the ~22 symbol-only spec files fix themselves under a
type-aware rename.

**`tsc` structurally misses** every raw-SQL string (`kosztorys-tree.ts:73`,
`kosztorys-client-totals.ts:42,57,65,67,69,70`, `insert-rows.ts:31`), the Payload field `name:`
(`collections/kosztorys-items.ts:43` — and `generate:types` *regenerates `payload-types.ts` to
conform*, so it can never disagree), the row-condition id string, and the composed undo key
`'item:1:clientPrice'` (`undo-reversal.test.ts:36`).

**The decisive gate is `src/__tests__/lib/kosztorys/insert-schema-drift.test.ts:25,60`** — it reads
the live 5435 `information_schema.columns` for `kosztorys_items` and asserts **set equality** against
`ITEM_INSERT_COLUMNS`. It fails in both directions (migration without code, code without migration).
It works automatically because `scripts/test-integration.sh:20-33` fingerprints
`cat src/migrations/*.ts | git hash-object --stdin` against `dumps/.test-db-schema-stamp` — **adding a
migration file forces `db:import:test` + `payload migrate` against 5435 by itself**. Caveat:
`db:import:test` reimports a prod dump carrying zero kosztorys rows, so `pnpm seed:kosztorys:test` is
owed after, or the golden master's `kosztorysItems: 20` floor fails closed
(`financial-golden-master-db.test.ts:237`).

**`kosztorys-tree-sql-drift.test.ts`** is source-text only (no DB, plain unit leg): it regexes the
SELECT list and the `row.<col>` accesses in the mapper and asserts `accesses \ columns === []`. It
catches a half-renamed SELECT-vs-mapper **in both directions**, but is satisfied when both are
renamed and the migration is missing, and it says nothing about `kosztorys-client-totals.ts` — which
**has no source-level drift guard at all**, and is covered only by `kosztorys-client-totals.test.ts`
at runtime.

**The golden master does not cover this rename.** Its figures come from `sum-transfers.ts`, which
reads only `transactions` + `investments` and never joins `kosztorys_items`; the kosztorys join at
`financial-golden-master-db.test.ts:139-152` feeds only the input hash and never touches
`client_price`. So a `client_price` read silently returning 0 moves no golden-master figure and does
not even invalidate the hash. **`investment-render-parity-db.test.ts` is the gate that does cover
it** — it imports `selectKosztorysClientTotals` directly (`:24`).

**E2E is near-zero risk and near-zero signal.** All `client` hits in `e2e/` are prose in comments;
the only functional selector already reads `getByRole('radio', { name: 'Inwestor' })`
(`kosztorys-reconciliation.spec.ts:120`) because the UI half shipped.

**Not gated at all**: `src/migrations/index.ts` completeness (a migration file added but not imported
is silently never applied), and the 5433 dev DB (there is no `db:migrate:dev` script — it lags until
you run `pnpm exec payload migrate` by hand, and the app 500s on any kosztorys read).

### 7. Migration house style

Hand-write; never `pnpm migrate:create` (phantom drift since ~March 2026). Name
`YYYYMMDD_<N>_<snake_case>.ts` with a **single-digit, zero-based, unpadded** ordinal per date;
`lessons.md:762-774` warns to pad the whole date's batch if it heads past `_9_`, since lexical
filename order *is* run order. Body carries the marker comment `// Hand-written (migrate:create's
snapshot baseline is stale — see AGENTS.md).`, uses `sql` from `@payloadcms/db-vercel-postgres`, and
`down` reverses in inverse order.

**`index.ts` is edited by hand — two edits**: an import named `migration_<filename>` and an entry
`{ up, down, name: '<filename>' }` in the exported array (`src/migrations/index.ts:414-421`).

The one precedent is `20260222_rename_cash_register_to_source_register.ts`, which renames the
**index** alongside the column. `kosztorys_items.client_price` has no index of its own
(`20260708_2_add_kosztorys_sections_items.ts:35`), so the rename is a single statement — and
non-idempotent by necessity, since Postgres has no `RENAME COLUMN IF EXISTS`. The original
`CREATE TABLE` must **not** be edited; migration history is replayed.

### 8. Prior art — EX-548, the same operation

The kosztorys-terminology rename (`context/archive/2026-07-20-kosztorys-terminology/`; its
`plan.md`/`research.md` were distilled away at archive time, recover with
`git show 7511e64d~1:context/changes/kosztorys-terminology/plan.md`) is the template.

**Sequencing it used**: docs first (a whole phase touching zero `src/` — *„kod nie może być
przepisywany do autorytetu, który sam kłamie"*), then name families cheapest-first, the plane seam in
its own commit, signature changes split out as their own commit for a clean revert point, and the
lint guard **dead last** — *"order is renames-first, then enable — never the reverse"*
(`lessons.md:212`). One family per commit, green `tsc` at each. Six rename commits + one docs commit,
129 files.

**Verification it used**: `tsc` as the load-bearing leg (*"a missed call site is a type error by
construction"*), plus behaviour-neutrality corroborated three independent ways — a golden-master diff
showing every numeric byte-identical, per-file numeric-literal multisets, and an
identifier-stripped token stream. E2E was not run and none was owed: no UI string moved. **No new
specs were authored and none were owed** — the slice changes no behaviour, so there is no behaviour
to pin. The same reasoning applies here.

**Its rule about columns**: *columns, never* — anything migration-bearing was pushed out of scope and
recorded as a glossary DB guardrail (`02-glossary.md:229-248`). SQL **aliases** were renamed freely
because an alias is not a column. This change deliberately breaks that rule for exactly one column,
which is why the migration is the part with an expiry date.

**What broke there, and applies here:**

- **The guard certified a clean codebase while a third of the drift survived** (`lessons.md:213`) —
  the stem list, not the rule, was the weak point. Treat a stem list as spec to be reviewed.
- **Case-as-proxy** (`lessons.md:214`, "the third and worst failure") — `RABAT` passed as intended
  and `ROBOCIZNA_TAB` passed for the same reason, which was not intended. *"A proxy that happens to
  exempt the right thing on the examples you tested will exempt the wrong things on the ones you
  didn't."*
- **Every planning artifact was stale**: 11 of 13 glossary rows cited dead lines, one cited a
  nonexistent file, and a row claimed a rename had "landed" while 159 sites remained.
- **Delay compounds mechanically** — drift grew from ≈61 to 84 identifiers while only ~22 names were
  newly minted; ~80% of drift tokens lived in files that did not exist at the prior pass.
- **"Same name, two different things"** — `robocizna` was three concepts, `rabat` four. *"Rename musi
  te trzy/cztery rozdzielić, nie ujednolicić."* Here the analogue is `client` meaning the payer, the
  React plane, and an SDK handle in the same file.

**Why the concept was named `client` in the first place: nothing recorded a decision.** Neither
`kosztorys-client-share` nor `kosztorys-client-view-reuse` contains any naming rationale — it was
simply the English word reached for while building `/k/[token]`. The reversal *is* recorded, in
`f4fa21fb` and in `02-glossary.md:156,164-176`.

### 9. Can `local/no-domain-drift` guard the result?

Mechanically yes — the stem map's keys are opaque regex prefixes and nothing in
`eslint-rules/no-domain-drift.mjs` assumes Polish. `'use client'` is invisible to it (a directive is
not an `Identifier`, not a `TSLiteralType > Literal`, not a `Property > Literal.value`).

**But `FROZEN` cannot express the exemption this needs.** It matches whole identifiers (`:66`) or
whole split-words (`:68`) — and `client` *is* the split-word, so exempting it would exempt everything.
Catching `clientPrice` while passing `e.clientX`, `client_email`, `useClientMultiFilter` and
`getReadonlySheetsClient` requires either a full-identifier allowlist or **narrower stems**:
`clientView`, `clientPrice`, `clientTotals`. The narrow-stem route is the one that matches how the
rule already works.

Blind spots that carry over unchanged: **filenames** (`no-domain-drift.mjs:19-21`, deferred on
purpose — and this change moves 14 of them), and any string that is neither a `TSLiteralType` member
nor an `id`/`key`/`value`/`type` property.

## Code References

- `src/lib/db/kosztorys-tree.ts:73,147` — SELECT list + the silent `num(row.client_price)` mapper
- `src/lib/db/kosztorys-client-totals.ts:42,57,65,67,69,70` — five raw-SQL sites, no drift guard
- `src/lib/kosztorys/insert-rows.ts:31,124` — `ITEM_INSERT_COLUMNS` and its positionally-correlated VALUES tuple
- `src/collections/kosztorys-items.ts:20,43` — untyped `defaultColumns`, the Payload field `name`
- `src/lib/kosztorys/row-conditions.ts:11,100,116` — the second `'client'` union + persisted ids
- `src/components/kosztorys/editor/hooks/use-price-view.ts:13` — `PriceViewT` → `localStorage`
- `src/lib/kosztorys/snapshot-format.ts:8-18` — the version-bump contract
- `src/lib/kosztorys/sheet-import/columns.ts:41`, `src/lib/actions/sheets.ts:204,231` — the unversioned column mapping
- `src/lib/queries/balances.ts:104` — cache key `'kosztorys-client-totals-v1'`
- `src/__tests__/lib/kosztorys/insert-schema-drift.test.ts:25,60` — the decisive gate
- `src/__tests__/lib/db/kosztorys-tree-sql-drift.test.ts:34-79` — source-text SELECT↔mapper guard
- `scripts/test-integration.sh:20-33,45-48` — migration fingerprint + spec discovery
- `src/migrations/20260222_rename_cash_register_to_source_register.ts` — the only column-rename precedent
- `src/migrations/index.ts:414-421` — the hand-edited registration array
- `eslint-rules/no-domain-drift.mjs:25-48,53,59-73` — stems, `FROZEN`, the matching logic
- `.husky/pre-push:8-34,47-69` — the gate order

## Architecture Insights

- **Translate at the boundary and never again** (`lessons.md:217-222`). `client_price` is a column
  name; the first identifier that touches it should have taken the domain name. The inverse of the
  `AS balance` → `{ saldo }` defect recorded there.
- **Tolerant parsers are the enemy of a rename.** Four separate surfaces here drop unknown keys by
  design — a good property for forward-compat, and the exact reason a renamed key fails silently.
  Any surface with a tolerant parser needs either a version constant or an explicit migration step.
- **A positional correlation (`ITEM_INSERT_COLUMNS` ↔ VALUES) is a rename hazard**, not just a
  reorder hazard: it invites touching both lists in one pass with nothing checking the pairing.
- **`tsc`-as-the-gate works only where types reach.** The share of this rename that lives in template
  strings, jsonb keys and `localStorage` is precisely the share that needs a different instrument.

## Historical Context (from prior changes)

- `context/archive/2026-07-20-kosztorys-terminology/` — the EX-548 rename: `change.md` (the three
  owner gates before any rename), `decisions.md` (rulings decayed under ~490 commits; Q4/Q5/Q6
  "OVERTAKEN"), `review-gate.md:10-14,79-93` (the three-way behaviour-neutrality proof and the
  verification matrix).
- `context/archive/2026-07-20-kosztorys-client-share/` and `-client-view-reuse/` — where the name
  `client` entered, with no recorded rationale.
- `context/domain/02-glossary.md:16,156,164-176,229-248` — the file declares itself "the rename spec";
  row `:156` is the current deliberate-drift entry for the paying party, and §3 is the DB-column
  guardrail this change knowingly steps past.
- `context/foundation/lessons.md:186-191,208-222,708-741,743-774` — migration lexical order, the
  guard's three failure modes, the wire-value rule, the carrier-liveness rule, the doc-lifecycle
  rule, and the snapshot-version rationale.

## Open Questions

1. **Does `SNAPSHOT_SCHEMA_VERSION` move?** The rationale says yes (restored rows would be wrong);
   the consequence is that the curated global preset library throws on every entry, and the listing
   queries do not assert, so the pickers keep offering entries that error on use. Options: bump and
   wipe the presets, bump and migrate the payloads in the same migration, or keep the key
   `clientPrice` inside the serialized payload and rename only at the boundary.
2. **How far does the rename reach past the kosztorys?** The `client-totals` cluster lands on the
   investments listing. Rename the whole cluster, or stop at the kosztorys edge and translate at
   `lib/queries`?
3. **What happens to persisted `localStorage` state** — the `'client'` price view and the
   `'client-empty'` / `'no-client-price'` filter ids? Silent drop is the current behaviour; a
   one-line read-side alias is the cheap alternative.
4. **Is the guard enabled at the end, and with which stems?** `clientView` / `clientPrice` /
   `clientTotals` looks right; a bare `client` stem is unusable.
5. **Do the Payload slugs stay?** `change.md` says out of scope, and `dbName` would let them move
   without touching the table — but the slug `kosztorys-client-view` sits inside a change that
   renames its own filenames, so the inconsistency becomes visible.
6. **The clean-tree constraint.** As of 2026-08-17 a second agent holds `use-kosztorys-editor.ts`,
   `row-conditions.ts` and the `sheet-import/*` cluster open — all three are in scope here.
