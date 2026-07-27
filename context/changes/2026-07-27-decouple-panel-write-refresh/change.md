---
change_id: decouple-panel-write-refresh
title: Investment page data-fetching architecture — the summary panel made it unusably slow
status: in-progress
created: 2026-07-27
updated: 2026-07-27
archived_at: null
branch: ex-597-decouple-panel-write-refresh
worktree: null
---

## Notes

**EX-597** — https://linear.app/ex-plant/issue/EX-597

This file is the **current account** of the change. `research.md` is the chronological spike log
(S1–S8 + a closing synthesis); several of its sections record what was believed at the time and were
later overturned. Where the two disagree, this file and the synthesis are current.

The history of what we got wrong is not deleted — it's compressed into "Superseded beliefs" at the
bottom, with pointers to the section of `research.md` that holds the full record. Three of those were
wrong in the same way, and that pattern is the most transferable thing this change produced.

---

## The problem, as stated

Owner, opening the change: **"In its current state the stat panel is basically unusable."**

The acceptance bar was never "measurably faster" — it was that the app **feels as fast as it did
originally, when the investment page was transfers only**. That framing ruled out treating this as a
micro-optimisation pass: the panel had added a whole second data plane (the kosztorys tree) on top of
a page that already had one (transfers + reference data), and nothing was consolidated when it landed.

Two problems were kept deliberately separate:

1. **The write path** — every persisted control triggered a full-route `router.refresh()`. This is
   what made the panel feel _broken_.
2. **The read path** — the page's fetch fan-out was heavy on every render, refresh or not. This is
   what made the page feel _slow_, and it was paid on first load too.

Both were in scope. As it turned out, only one of them was real — see "What actually mattered".

---

## Outcome

**Owner verdict: "the feeling is drastically improved."** The acceptance bar is met.

**What actually mattered was the client.** The change the owner felt — pending state plus optimistic
values on the settings block — has **no measurable effect on elapsed time**. Perceived and elapsed
latency came apart completely, and every instrument used in this spike measured only the second one.

Ranked by real effect:

| #   | commit(s)             | what                                                      | effect                                                 |
| --- | --------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| 1   | `b4b8a48e` `6ef19850` | pending flag + optimistic VAT/rabat on the settings block | **the one the owner felt** — no effect on elapsed time |
| 2   | `d15ba6ab`            | `deferRefresh` on per-cell autosave                       | 324 766 B → **127 B** per debounced write              |
| 3   | `dd148c15`            | `router.refresh()` deleted                                | render count halved                                    |
| 4   | `73480ff1`            | `fetchReferenceData` deduped per request                  | 3× → 1× per render                                     |
| 5   | `a1bf7234` `72ff0ea1` | media read cached whole under a `media` tag               | removes a serial hop behind the transfers query        |
| —   | `9f14cbeb` `ca5ae1af` | tree read → raw SQL → one `json_agg` query                | **no measurable effect**; kept for code shape only     |

**Caveat found at the review gate, after the table above was written.** `deferRefresh` (#2) was
being partly handed back a few lines from where it was won. `use-kosztorys-editor.ts` ends its
grid-change path with `setTimeout(() => router.refresh(), 700)` — and that timer was **never
cleared**, so the comment beside it ("after the save quiets down") was false: a run of edited cells
queued one full-route refresh _each_. Pre-existing, moved there by `08310f68`, and invisible to every
instrument this spike used, because all of them measured a single write. Fixed at the gate by holding
the handle in a ref and restarting it, mirroring the `flushTimer` directly above.

The lesson generalises past this line: **a per-write saving is only real if nothing downstream
re-adds per-write work.** The measurement that proved `deferRefresh` (324 766 B → 127 B) was taken on
the action's own payload, so it could not have seen a second refresh path 80 lines away.

The settings relocation (`a6050f2c` — earlier `research.md` sections cite this as `37349c77`, which
was rewritten and is no longer on the branch) is its own category: moving „Opcje
rozliczenia" off the investment page into the kosztorys editor behind `?ustawienia=1` **retired** the
decoupling problem on this route rather than solving it.

---

## The optimistic rule this change discovered

Shipped state of the four „Opcje rozliczenia" controls:

| control               | pending | optimistic | why                                                         |
| --------------------- | ------- | ---------- | ----------------------------------------------------------- |
| VAT                   | ✅      | ✅         | value is denormalized onto `rows` — client-owned, patchable |
| rabat globalny        | ✅      | ✅         | same                                                        |
| sposób rozliczenia    | ✅      | ❌         | lives only on `tree` — server-owned, mount-frozen (EX-441)  |
| stawka netto wydatków | ✅      | ❌         | same                                                        |

The rule is mechanical, not a judgement call: **a setting is optimistic exactly when its value is
denormalized onto `rows`.** Settings that live only on `tree` have nothing local to move, because
`tree` is frozen at mount. Anyone adding a fifth control can read the answer straight off that rule
rather than re-deriving it.

Naming trap recorded in `research.md` → S7 shipped: `optimisticSettingSave` is the _pending_ helper,
not the optimistic one — the name predates the split and misleads on first read.

---

## Findings from the research pass (2026-07-27)

Full write-up in `research.md` → `# Synthesis`. The four that matter:

### 1. The branch is wider than the ticket

Four strands ride `ex-597-decouple-panel-write-refresh`, and only the first is EX-597:

| strand                                  | commits                                                                      | relation                                         |
| --------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| perf / data-fetching                    | `dd148c15` `73480ff1` `a1bf7234` `72ff0ea1` `d15ba6ab` `9f14cbeb` `ca5ae1af` | the ticket                                       |
| settings relocation + panel restructure | `983b8086` `d02df88a` `64d887b9` `2b78a2b9` `7a9e8123` `a6050f2c`            | enabler — retired the problem                    |
| nav crumb                               | `6676c7f6` `ad1f5661` `09c5a101` `94e881a4`                                  | adjacent; `getInvestmentName` is a perf decision |
| settlement-view display                 | `e7bc98dd` `0d54ad16`                                                        | **unrelated** — a domain/display change          |

Only the first strand is tagged `EX-597`. Anyone reviewing this branch as "the perf change" is
reading two other features at the same time. Relevant to how it gets reviewed and archived.

### 2. Four caching strategies now coexist, and they are not interchangeable

| read                 | strategy                             | why this one                                                                                                                                                              |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetchReferenceData` | `cache(unstable_cache(...))`         | two axes — `unstable_cache` spans requests and dies on tag invalidation; `cache()` collapses the 3 calls **within one render** (page + transfers table + root-layout nav) |
| `fetchAllMedia`      | `unstable_cache`, whole table        | inverted from per-id: the filtered read was a serial hop behind the transfers query on every render; the full sweep runs only after a media write                         |
| `getInvestmentName`  | `unstable_cache`, name only          | crumb renders on every `/inwestycje/[id]/**` nav; shares `getInvestment`'s tags so one invalidation covers both                                                           |
| `buildKosztorysTree` | **uncached**, one raw-SQL round trip | still uncached — and per S8 that turned out not to matter                                                                                                                 |

### 3. The sharpest latent trap: `cache()` is safe only circumstantially

`fetchReferenceData`'s own comment concedes it: _"safe here only because nothing reads reference data
before a mutation in the same request, so the first call is always post-write."_

Verified — all ~20 call sites are pages, the root layout, or read-only query modules; no server action
reads reference data after mutating in the same request. **Nothing enforces that.** A future action
that writes an investment and then calls `fetchReferenceData()` in the same request gets the pre-write
value, silently. Undocumented outside `research.md` and unguarded by any test.

### 4. Two claims corrected against the code rather than their own comments

- **Media invalidation is genuinely wired**, not merely assumed. `src/collections/media.ts` registers
  `makeRevalidateAfterChange('media')` and `makeRevalidateAfterDelete('media', 'transfers')`, and
  `src/hooks/revalidate-collection.ts:22` calls `revalidateTag(CACHE_TAGS[slug], 'default')`. Correct
  by construction; still never exercised by a live upload or delete.
- **The `fetchAllMedia` size headroom is ~10×, not ~2×.** The comment cited "988 rows / 808kB", which
  is the _table_ read, not the cached payload. The four projected columns measure **95 kB across 988
  rows** on the dev DB — a few hundred kB as JSON, against the Vercel Data Cache's ~2 MB per-entry
  ceiling. Not a risk today. Revisit around ~10 000 media rows, where the entry would silently stop
  being cached and every render would pay the full sweep. (Comment corrected at the review gate — the
  wrong number was the one the headroom conclusion rested on.)

---

## Tests added (2026-07-27) — no behaviour changed

Hand-written SQL introduced a class of silent failure the ORM did not have, so it owes guards. Three
specs, 13 tests, **each verified by mutation** (break the code, confirm the right test fails):

| spec                                                    | layer         | guards                                                                                                                                                         |
| ------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/__tests__/lib/db/kosztorys-tree-sql-drift.test.ts` | source, no DB | a mapper reading a column the SELECT stopped providing — `num(undefined)` is **0**, so a price silently becomes zero                                           |
| `src/__tests__/lib/db/kosztorys-tree.db.test.ts`        | DB @5435      | empty-investment `coalesce` (`json_agg` over zero rows is NULL), section ordering, progress scoped through its item, `revision` ISO format, missing investment |
| `src/__tests__/lib/cache/revalidate.test.ts`            | unit          | `deferRefresh` skipping _invalidation_ rather than only the re-render                                                                                          |

The drift guard deliberately covers only what the type system cannot see: `tsc` already fails when a
field is added to `KosztorysItemT` and left unmapped, but nothing ties a mapper's `row.X` reads back to
the SELECT that must provide it.

Mutation record:

```
drop client_price from items SELECT   → items drift test fails, other 4 pass
drop coalesce on sections             → empty-investment test fails
JOIN kosztorys_items ON true          → progress-isolation test fails
drop ORDER BY in json_agg             → ordering test fails
deferRefresh branch → continue        → 2 revalidate tests fail
```

Suite after: **1761 passed / 62 skipped**, `tsc --noEmit` clean repo-wide.

---

## Open

- **No end-to-end guard on the write path.** `deferRefresh` means a broken write is invisible in the
  session that made it — the grid keeps rendering the typed value from its own `rows` state whether or
  not anything reached Postgres. Browser-level by nature; **filed as EX-604** (`e2e-backlog`) at the
  review gate. Declining to _author_ the E2E doesn't discharge the obligation — filing does.
- **Two behaviour findings deliberately left for the owner**, both filed at the review gate:
  **EX-605** — picking „Kwotowy" persists nothing, so the control promises a suppression the engine
  isn't performing until an amount is typed; the fix activates the rabat the instant the mode is
  picked, which moves figures. **EX-606** (High) — the intended 0% mass-clear wipes every per-item
  rabat and is not on the undo stack. Both are recorded as known-unfixed manual checks.
- The `cache()` mutation-ordering constraint (finding 3) is unenforced and undocumented outside these
  two files.
- `buildKosztorysTree` is still uncached. Per S8 this is no longer believed to matter, and should not
  be picked up again without a fresh measurement that separates warm from cold.
- ~~**Non-blocking settings**~~ — raised and **declined** by the owner: _"the write is fast enough,
  this is fine."_ The blocking window isn't felt, so it doesn't earn local state for the two
  non-optimistic controls plus an ordering guard. Rationale in `research.md` → "Non-blocking settings".
- `/10x-plan` was never run for this change; it proceeded as a spike throughout.

---

## Superseded beliefs

Kept as the record of what was believed and why it was wrong. Full text of each in `research.md`.

| belief                                                                                                             | verdict                                                                                                                                                                                                                                                              | where      |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `sumAllRegisterBalances` is 1015 ms — two full `GROUP BY` scans, a "28× cache cliff"                               | **Wrong.** `EXPLAIN ANALYZE` puts it at **2.4 ms** over 3 044 rows, both legs index-scanned. The 1015 ms was Neon connection setup on a cold request, billed to whichever query touched the DB first. No query-level fix exists.                                     | S2         |
| The tree read's 5 ORM queries are the shape problem — round-trip count is the cost                                 | **Wrong.** The five reads were already fully parallel: one warm sample shows `buildKosztorysTree 45ms` with reads at 20/21/21/21/44 ms — **total equals the slowest read, not their sum.** Collapsing them into one query could never win, and measured, it doesn't. | S8         |
| The 83–119 ms `investment` (1-row) read proves pool contention                                                     | **Wrong.** Cold-start connection setup. Warm it is 21 ms. This retires the theory that motivated `ca5ae1af`.                                                                                                                                                         | S8         |
| "Pending state, **not** optimistic values"                                                                         | **Half right.** Both shipped — see "The optimistic rule" above.                                                                                                                                                                                                      | S7 shipped |
| "The uncached `getKosztorysTree` is the remaining server-side lever, and a bigger one than anything on the client" | **Disproven.** Attacked in two commits, neither moved the clock. The client was the whole story.                                                                                                                                                                     | S8         |

### The pattern behind three of the five

Every one of those wrong beliefs was built on a small sample against Neon, whose latency is
**bimodal — ~20–60 ms warm, ~160–200 ms cold**. A handful of cold reads is dominated by connection
setup and looks _exactly_ like structural cost. A theory was built on two samples, twice.

The method lesson, stated once so it survives the archive: **separate warm from cold before believing
a per-request number, and prefer one request that exposes the mechanism to a dozen that produce a
median.** The 45 ms sample that settled the whole tree question did so because it showed the five
reads overlapping — not because it was faster than the others.
