---
topic: Reading a kosztorys out of the owner's Google Sheet and writing it into the editor
researcher: Claude (Opus 5)
date: 2026-08-11
change_id: kosztorys-importer
status: complete
---

# Research: kosztorys sheet import

## Research question

What already exists in this repo that an on-demand sheet→app kosztorys import can stand on, and
where does it genuinely have to build something new? Concretely: (1) how do we get a tree into the
DB safely, (2) how do we do preview→confirm without the two diverging, (3) can the existing Google
Sheets layer read these sheets, and (4) what does the existing seeder prove and what does it get
wrong?

## Summary

**Three of the four layers already exist and can be reused as-is.** The write path
(`restoreSnapshotAction`) is precisely the operation import needs, down to the pre-write snapshot
and the cache-tag list. The preview/apply discipline exists in `sheets-sync.ts` with the anti-forgery
rule already written down. The tree read (`serializeKosztorys`) returns exactly the shape the merge
needs, settings included.

**Only the reading layer is new, and it cannot reuse `resolveHeaders`.** That function is
structurally incompatible with a kosztorys header — it demands every field on one row and throws on
any duplicate match, while these sheets carry a three-row header block with deliberate duplicates.

**The existing seeder is a correctness blueprint with two real defects**: hardcoded column offsets
valid only for one investment, and a positional row-index join between tabs. Its `deriveOverride`
is the one piece that transfers verbatim.

**One thing to watch:** the pre-write snapshot reads through the cached query layer, not the
transaction handle. That is pre-existing behaviour in restore, not something import introduces, but
import inherits it.

## Detailed findings

### 1. The write path — `restoreSnapshotAction` is the operation

`src/lib/actions/kosztorys-snapshots.ts:77-85` is the whole thing:

```ts
const restored = await withPayloadTransaction(
  payload,
  async (req) => {
    const txDb = await getDb(payload, req)
    await captureAutoSnapshot(txDb, snapshot.investmentId, user.id)
    return restoreKosztorys(payload, req, snapshot.investmentId, snapshot.payload)
  },
  { skipRevalidation: true },
)
```

Everything import needs is already decided here and should be copied, not re-reasoned:

- **The snapshot is taken inside the transaction, before the wipe.** Outside it, a rollback leaves
  an orphan snapshot; after the wipe, it snapshots nothing.
- **`skipRevalidation: true`** suppresses per-row collection hooks. The comment at `:58-60` gives the
  reason: ~1000 rows would each fire `revalidateTag`.
- **The tag list is `['kosztorysSections', 'kosztorysItems', 'kosztorysStages', 'stageProgress',
'investments']`** (`:91`). `investments` is on the list because settings live there — import passes
  settings through unchanged, but `restoreKosztorys` still writes them, so the tag stays correct.

`restoreKosztorys` (`src/lib/kosztorys/restore-kosztorys.ts:12`) is wipe → `insertKosztorysTree` →
settings rewrite, with **the caller owning the transaction** (`:9-11`). Two traps for import:

- **It always rewrites `wToolsCoeff` / `ownToolsCoeff` / `vatRate` from `snapshot.settings`**
  (`:33-35`). Since import must not touch those, it has to pass the investment's _current_ settings.
  Passing defaults would silently reset VAT on every import.
- **Global discount is deliberately not restored** (`:36`) — which happens to match import's scope
  exactly.

`insertKosztorysTree` (`src/lib/kosztorys/insert-kosztorys-tree.ts:58`) does one bulk
`INSERT … RETURNING` per level; the comment at `:51-53` records that row-by-row `payload.create` took
~12.6s for ~1000 rows and this path is well under a second. It also **skips a child whose parent is
absent** (`:71,111`) rather than orphaning — a backstop, not a licence for the merge to emit an
inconsistent tree. And `liveWorkerIds` (`:30`) drops a dangling assignee rather than failing the
whole restore (EX-641); import never sets `workerId`, so this is inert here.

### 2. Preview vs apply — the pattern and its security rule

`src/lib/actions/sheets-sync.ts` runs `previewMaterialSync` (`:155`) and `applyMaterialSync` (`:238`)
over a shared `buildSyncPlan`, so the two can't disagree about what would happen. The rule at `:234`
is stated outright: apply _"Re-derives what to append SERVER-SIDE — never trusts a client-supplied
row set."_

Import inverts the direction but inherits both the shape and the rule. It also inherits the
missing-link error string (`:159`), so the two features speak the same Polish to the user.

### 3. The Google layer — reusable for auth, not for header resolution

- `createServiceAccountJWT(scopes)` (`src/lib/google/auth.ts:9`) takes scopes as a parameter, so the
  import reader can ask for `spreadsheets.readonly` while `sheets.ts:43` and `sheet-access.ts:34`
  keep the read-write scope. Nothing here writes; the narrower scope should be used.
- `getInvestmentSheetId` (`src/lib/google/sheet-lookup.ts:11`) resolves the link. Note the sheet id
  lives on `kosztoryses`, not on `investments` (migration `20260528_move_sheet_id_to_kosztoryses`),
  and the file is deliberately **not** `'use server'` so any context can import it as a plain
  function (`:7-10`).
- **`resolveHeaders` (`src/lib/google/sheets.ts:52`) cannot be reused.** Two blocking properties:
  it accepts a row only when it contains _all_ mapped fields (`:66`), and it **throws on any field
  matching more than one column** (`:70-77`, added by review T2.7 precisely so a leftmost-wins guess
  can't write to the wrong column). A kosztorys header is three rows — the stage marker „wykonano"
  sits on row 2 while the field labels sit on row 3 — and Ryżowa 66/127 genuinely carries two
  „Cena jednostkowa" columns. Both properties are _right_ for the tabs this app writes; both are
  fatal for the tabs the owner hand-maintains.

  The reusable parts are `normalize`, `columnLetter` and `MAX_HEADER_SCAN_ROWS` from
  `sheet-configs.ts`, plus the `fieldMatchers` shape — the vocabulary, not the algorithm. And the
  failure style transfers: a named, actionable, Polish message rather than a guess.

- `MissingTabError` (`sheets.ts:89`) shows how an absent tab is distinguished from a real API error —
  import needs exactly that, because a missing `zakres pracy` tab must degrade (fall back to the
  other tab) while a missing `kosztorys_robocizny` must stop.

### 4. The tree read — `serializeKosztorys` fits the merge with no adaptation

`src/lib/kosztorys/serialize-kosztorys.ts:8` returns a `SnapshotPayloadT` with flat `items[]`,
`stages`, `progress` and `settings` lifted from `tree.globalCoeffs` / `tree.vatRate`. That single
call gives the merge both things it needs: the current tree to match against, and the settings to
pass through unchanged. No new read path.

### 5. The existing seeder — what it proves, what it gets wrong

`src/scripts/seed-investment-from-sheet.ts` is a working end-to-end proof against Białostocka and
still typechecks against the current `SnapshotPayloadT`. What transfers:

- **`deriveOverride` (`:79-88`) verbatim**, comment included. Its ruling is not obvious and is easy
  to get wrong on a re-implementation: a blank rate means an explicit flat **0**, _not_ "inherit the
  default coefficient" — the sheet has no inherit concept, and a `null` override would invent a
  section/global-coeff cost the sheet never has.
- **Section-header detection** (`:125-131`): a header row marks the Przedmiar or Pomiar column with
  „x" and carries the name in the section column.
- **Rabat handling** (`:153`): the sheet stores a fraction (0,09), the app stores a percentage —
  `discountType: 'percent'`, value ×100.
- **Section colors** by position via `sectionColorForIndex` (`src/lib/kosztorys/section-colors.ts:232`).

Its defects, both of which the import must not inherit:

- **Hardcoded column offsets** (`:52-68`) against a fixed `A4:T450` range. Valid for one investment.
  The 45-sheet scan showed „Przedmiar" in six different columns and the first stage column at C, D
  or E.
- **A positional join between tabs**: `const rate = rateRows[i]` (`:150`). Rates are attributed by
  row index across two different tabs. The moment the tabs diverge by a single row, every rate below
  that point is silently attached to the wrong praca. Import must match by description.
- **One rates tab only** (`RATES_TAB` defaults to `'zakres pracy bez narzędzi'`, `:42`). A praca
  present only in the other tab imports at 0 zł — verified: 3 such rows on Białostocka, including
  prace projektowe at 3500 zł.
- **Trailing empty stages trimmed** (`maxEtap`, `:73` / `:168`): stage count is derived from the
  highest etap carrying data. An etap that is planned but not yet started disappears. Import should
  take the stage count from the resolved stage columns instead.

### 6. Inherited caveat: the pre-write snapshot reads through the cached query layer

`captureAutoSnapshot` (`src/lib/kosztorys/capture-auto-snapshot.ts:9`) calls
`serializeKosztorys` → `getKosztorysTree` (`src/lib/queries/kosztorys.ts:14`) — the query layer, on
its own connection, **not** the `txDb` handle it is passed (the handle is used only for the insert).
So the snapshot captures what the query layer currently returns rather than a transaction-consistent
read of the row about to be wiped.

This is pre-existing in restore, not introduced by import, and in practice the editor's tags are
fresh at the moment a user clicks. Recording it because import inherits it and because a stale
pre-import snapshot would be the one failure that undoes the whole safety argument. Not worth fixing
inside this change; worth knowing if a restore ever comes back subtly wrong.

Second-order: `captureAutoSnapshot` also applies `pruneAutoCount` (`:16`), so the pre-import snapshot
is an `auto` one subject to the count cap. A user who imports and then edits for a long time can age
it out. If that turns out to matter, the fix is to capture the pre-import snapshot as `manual` with a
label — a one-line change, deliberately not taken now.

### 7. Sheet-side facts (from the 45-sheet scan, 2026-08-11)

- „Przedmiar" occupies six different columns across sheets (I, J, K, L, M, N).
- Stage counts run 3–10; first stage column is C, D or E.
- **Stage headers get renamed to crew names** — „parkieciarze", „Michal Kulas", „kamil", „Andriej" —
  so stage columns must be found by row 2 == „wykonano". This holds on all 45.
- Synonyms that must be in the dictionary: `j.m.` / `j.m` / `jm` / `Jednostka` / `jednostka miary`;
  `Cena j.m.` / `Cena jednostkowa` / `Cena jm.`; `rabat` matched as a prefix (Marszałkowska writes
  „rabat 8%").
- 43/45 resolve. **Dąbrowskiego 86** had its „Przedmiar" header overwritten with „Przesyłam wstępny
  kosztorys."; **Ryżowa 66/127** has duplicate „Cena jednostkowa" and „Wartość netto" columns and no
  rabat column at all. Neither is guessable — both need one cell fixed by the owner.
- Identity by description alone matched **324/324** items on Białostocka.
- Rate resolution with per-praca tab selection: 312 agreeing / 3 single-tab / 8 auto-resolved / 1
  real conflict (r125 akrylowanie).
- **A scoring heuristic without a sanity guard picks impossible values**: on r104 („gruntowanie")
  it chose 3 zł with tools against 5,10 zł without — cheaper _with_ tools. The guard (bez-narzędzi
  ≤ z-narzędziami) is load-bearing, not decoration.
- Sheet row 1 is „Imię i nazwisko oraz adres inwestycji" — real client PII, never read, never
  fixtured.

### 8. Footer totals — the quality gate

Per AGENTS.md, the footer keeps `wartość netto` and `R netto - suma prac wykonannych` as separate
named rows, and the sheet's own arithmetic is `S = Przedmiar × cena − rabat` (the offer) versus
`T = Pomiar × cena − rabat` (executed, where Pomiar is itself `=SUM(D:M)`).

`src/lib/kosztorys/calc.ts` already computes both sides: `rowPlannedNetForView` (`:113`) for the
offered figure and `netForQtyForView` (`:96`) for a quantity-driven one. The comparison must use
these, not a fresh implementation — a reimplementation that happens to agree with itself proves
nothing about the app.

Footer rows must be located **by label**; their row number varies per sheet. AGENTS.md also warns
that some formulas in the filled test sheet are broken, which is why a mismatch is a warning rather
than a block.

## Code references

- `src/lib/actions/kosztorys-snapshots.ts:61-93` — the write path to mirror (transaction, snapshot, tags)
- `src/lib/kosztorys/restore-kosztorys.ts:12,33-36` — wipe/insert/settings; the settings-rewrite trap
- `src/lib/kosztorys/insert-kosztorys-tree.ts:58,71,111` — bulk insert; dangling-parent tolerance
- `src/lib/kosztorys/capture-auto-snapshot.ts:9,16` — non-transactional read; auto-count prune
- `src/lib/kosztorys/serialize-kosztorys.ts:8` — the current tree + settings in one call
- `src/lib/actions/sheets-sync.ts:155,234,238` — preview/apply and the never-trust-the-client rule
- `src/lib/google/sheets.ts:52,66,70-77,89` — why `resolveHeaders` can't be reused; MissingTabError
- `src/lib/google/auth.ts:9` — scoped JWT, so readonly is available
- `src/lib/google/sheet-lookup.ts:11` — investment → sheet id, importable anywhere
- `src/scripts/seed-investment-from-sheet.ts:52-68,79,125-131,150,153,168` — blueprint and its defects
- `src/lib/kosztorys/calc.ts:96,113` — the totals used for the footer comparison
- `src/lib/kosztorys/section-colors.ts:232` — positional section colour
- `src/lib/actions/run-action.ts:43` — `protectedAction` admits MANAGER; OWNER/ADMIN needs an explicit check

## Architecture insights

- **The repo already separates "build the plan" from "apply the plan"** in the one other
  sheet-touching feature. That separation is what makes the anti-forgery rule cheap to honour: apply
  calls the same builder rather than deserializing a client payload.
- **Snapshot/restore is the app's general-purpose bulk-write primitive**, not a versioning-only
  feature. `applyPreset` already reuses `insertKosztorysTree` on the same terms. A third caller
  (import) is the pattern working as intended, not a stretch.
- **Fail-loud on ambiguous headers is an established house rule**, introduced by review rather than
  by accident (`sheets.ts:70-77`). Import's "stop and name the column" behaviour is consistency, not
  a new policy.
- **Every hard problem here is a pure function of grids.** Column resolution, parsing, rate
  resolution and the merge all take data and return data. That is what makes the test-first plan
  cheap — no DB, no network, and real sheet fragments as fixtures.

## Open questions

- **Which footer label maps to which app total.** Both named rows sit in column T in the canonical
  sheet, so the mapping (executed vs offered) must be confirmed against the sheet's formulas during
  Phase 3 rather than assumed from the label text.
- **Whether the pre-import snapshot should be `manual`-kind** so the auto count cap can't age it out.
  Left as-is for now; noted in §6.
- **Whether any of the 45 sheets diverges on the section-header rule** („x" in Przedmiar/Pomiar).
  Verified on Białostocka only; the bulk scan (deferred — no owner access yet) is what would settle
  it. A sheet that marks headers differently would import a flat tree with one section, which the
  preview's section count makes obvious rather than silent.
