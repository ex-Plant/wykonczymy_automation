---
change_id: decouple-panel-write-refresh
title: Investment page data-fetching architecture — the summary panel made it unusably slow
status: preparing
created: 2026-07-27
updated: 2026-07-27
archived_at: null
branch: ex-597-decouple-panel-write-refresh
worktree: null
---

## Notes

**EX-597** — https://linear.app/ex-plant/issue/EX-597

Research complete → `research.md` (2026-07-27). It answers Q2/Q3/Q5 and corrects two things below:
`src/lib/db` uses `sql` from `@payloadcms/db-vercel-postgres` + `getDb()`, not `@vercel/postgres`
directly; and the baseline **was not captured** — the attempt authenticated against the wrong DB and
was silently served the login page. Q1 and Q4 stay open, with a corrected capture protocol in
`research.md`. **EX-540** already owns the tree fetch and must be reconciled with this change.

### Measurement environment settled (2026-07-27) — see `research.md` follow-up section

We measure the **deployed app against real data**, not local dev. Key facts:

- **There is no live production deployment** — the last 12 deploys are all `preview`, and
  `wykonczymy.vercel.app` 404s on every route. The live app is the `staging` branch preview.
- **Staging HTTP is behind Vercel SSO**, with no bypass secret configured. A `curl` returns a
  convincing `200 / 1.26s / 484 KB` that is the **Vercel login page**, not the app.
- **`vercel logs --branch <b> -q "PERF" --expand --json` is the channel** and needs no SSO bypass:
  it returns the app's own per-request `[PERF]` telemetry. Owner browses, agent reads. Log _bodies_
  have short retention (metadata outlives them), so measurement must be a live session.
- **Scope widened to three surfaces** at the owner's direction: `/inwestycje/[id]`,
  `/inwestycje/[id]/kosztorys_v2`, and `/` (the manager dashboard). The first two share one uncached
  `getKosztorysTree` sized for the editor; the investment page reduces the whole tree to two scalars.
  The editor page additionally runs an uninstrumented **nine-way `Promise.all`**.
- **Spike protocol (owner):** push with `--no-verify`, no typecheck/test gating — speed of iteration
  over correctness gates while measuring. Document every finding immediately.

### ~~In scope — `sumAllRegisterBalances` is 1015 ms on the dashboard~~ — SUPERSEDED 2026-07-27

**The section below is wrong and is kept only as the record of what we believed.** `EXPLAIN ANALYZE`
puts this query at **2.4 ms** over 3 044 rows, both legs index-scanned. The 1015 ms is Neon
connection setup on a cold request, billed to whichever query touches the DB first. There is no
query-level fix. See `research.md` → "S2 investigation".

First real measurement off the deployed app: `sumAllRegisterBalances` costs **1015 ms** for 29
registers on `/`, with `fetchRegisterBalances` a 1 ms cache wrapper around it and
`fetchManagerDashboardData` totalling 1195 ms. Two full `GROUP BY` scans of the whole `transactions`
table (`src/lib/db/sum-transfers.ts:71-112`); **cost scales with transaction history, not with the 29
registers returned**.

I initially filed this as out of scope — wrong, and the owner corrected it. The acceptance bar for
this change is _"the app feels as fast as it did originally"_, and `/` is the first page loaded in
every session. A one-second query there is the same problem as the panel, not a neighbouring one.
It also sits on `/kasa/[id]`.

It is `unstable_cache`d under the `transfers` tag, so 1015 ms is a **cache miss** — but every
transfer create/delete invalidates that tag, so on an active day misses are the normal case, not the
exception. Details and candidate fixes in `research.md`.

### Goal and severity (owner, 2026-07-27)

**In its current state the stat panel is basically unusable.** The target is not "measurably
faster" — it is that the app **feels as fast as it did originally, when the investment page was
transfers only**. That is the acceptance bar for this change: the panel must not be perceptible as
a cost on a page that used to be quick.

That framing matters because it rules out treating this as a micro-optimisation pass. The panel
added a whole second data plane (the kosztorys tree) on top of a page that already had one
(transfers + reference data), and nothing was consolidated when it landed. The scope here is the
page's **data-fetching architecture**, not just the refresh bug that surfaced it.

### Two problems, deliberately kept separate

1. **The write path** — every persisted control triggers a full-route refresh (below). This is what
   makes the panel feel _broken_.
2. **The read path** — the page's fetch fan-out is heavy on every render, refresh or not. This is
   what makes the page feel _slow_, and it is paid on first load too, not just on writes.

Fixing (1) alone would stop the freeze but leave the page slower than the transfers-only baseline
the owner is measuring against. Both are in scope.

---

## Problem 1 — the write path

Decouple updating data from refetching everything: a write that provably cannot affect the
transactions table must not cause it to refetch, re-render, or re-stream.

Every persisted control in the v2 summary panel calls `router.refresh()`, which re-executes and
re-streams **every** Server Component on the route regardless of cache tags. The tagging is already
correct — both `updateInvestmentSettlementModeAction` and `updateInvestmentMaterialsNetRateAction`
invalidate only `['investments']`, and `findTransfersRaw` is tagged `transfers`, so the transactions
DB query is already skipped. `router.refresh()` throws that fine-grained scoping away.

Measured (investment 6, local dev, warm cache) — the DB is not the bottleneck at today's data size:

| Measurement                                 | Value      |
| ------------------------------------------- | ---------- |
| All 5 `getKosztorysTree` queries (43 items) | 33 ms      |
| TTFB                                        | 30–81 ms   |
| Total RSC response                          | 262–817 ms |
| RSC payload                                 | 198 KB     |

### Leading hypothesis: the `router.refresh()` is redundant — we refresh twice

`updateTag` is Next 16's read-your-own-writes variant: unlike `revalidateTag` (stale-while-
revalidate), it signals **client** cache invalidation. `addRevalidationHeader` in
`packages/next/src/server/app-render/action-handler.ts` sets `x-action-revalidated:
ActionDidRevalidateStaticAndDynamic` whenever a profile-less tag (i.e. `updateTag`) was called —
"Only count tags without a profile (updateTag) as requiring client cache invalidation."

Our actions already call `updateTag` via `revalidateCollections` (`run-action.ts:54` →
`revalidate.ts:15`), so the action response **already** tells the router to re-render the route.
`investment-summary-panel-client.tsx` then awaits that action and calls `router.refresh()` anyway —
a second full route render per click, sequential with the first. If confirmed, the fix is deleting
the `router.refresh()` call, not restructuring state ownership.

Not yet verified. The earlier Playwright probe counted only **POST** requests and saw 1 per click;
`router.refresh()` may issue a separate RSC GET that the counter missed. First research task is to
count _all_ requests (GET + POST) and total bytes per toggle — 2 round-trips confirms this, 1
refutes it and sends us back to the consumer-ownership refactor below.

Why a refresh is otherwise hard to avoid: `materialsNetRate` reaches four consumers, three of them
page-level siblings of the panel (`calculateMargin` → Marża strip, `materialsNetDiscount` → tile,
`buildFinancialFields` → transfers header/CSV). No client component owns the value, so nothing
narrower than a route refresh moves all four. If the double-refresh hypothesis is refuted, the fix
is giving these four a shared client-side owner fed by the action's return value.

---

## Problem 2 — the read path / data-fetching architecture

The owner's instinct on the tree fetch is right: **`buildKosztorysTree` runs 5 separate Payload ORM
queries and reduces the whole result set in JS** (`src/lib/queries/kosztorys.ts:40`).

| #   | Collection               | limit   |
| --- | ------------------------ | ------- |
| 1   | `kosztorys-sections`     | 1 000   |
| 2   | `kosztorys-items`        | 5 000   |
| 3   | `kosztorys-stages`       | 1 000   |
| 4   | `stage-progress`         | 100 000 |
| 5   | `investments` (findByID) | —       |

They run in `Promise.all`, so wall-clock is the slowest one, not the sum — which is why this
measures 33 ms today. **33 ms is not the finding; the shape is.** Specific smells:

- **`limit: 100000` on `stage-progress` is fetch-everything-and-join-in-JS.** At the 1000+ item
  target (recorded in memory as a real scale for a kosztorys) with ~10 stages, that is ~10 000 rows
  pulled into Node to be reduced into a handful of summary figures. The aggregation belongs in SQL —
  `SUM(...) GROUP BY` returns tens of rows instead of ten thousand.
- **No field projection.** `depth: 0` correctly avoids joins, but there is no `select`, so every
  column of every row is read, serialized by Payload, and discarded. The panel needs aggregates.
- **Payload ORM, not raw SQL.** AGENTS.md states financial calculations use raw SQL via
  `@vercel/postgres` in `src/lib/db` precisely for this reason; the tree fetch sits outside that
  rule while feeding financial figures.
- **Not cached.** `getKosztorysTree` has no `unstable_cache`, unlike every neighbour in
  `reference-data.ts`. So it re-queries on every render of the route, including every refresh.
- **Whole-tree read for aggregate output.** The panel renders summary figures; it materialises the
  entire kosztorys to get them. Any per-item detail it does need is a much smaller subset than "all
  items, all stages, all progress".

### The page-level fan-out compounds it

`/inwestycje/[id]` triggers, per render:

| Source                         | Fetch                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `page.tsx:53`                  | `fetchReferenceData` + `fetchFilteredByType` + `fetchCategoryBreakdowns`              |
| `InvestmentSummaryPanel`       | `getKosztorysTree` (the 5 above, uncached)                                            |
| `transfer-table-server.tsx:22` | `findTransfersRaw` + `fetchReferenceData` **again** + `fetchFilteredByType` **again** |
| root layout → `navigation.tsx` | `fetchReferenceData` a **third** time                                                 |

- **`fetchReferenceData` runs 3× per request.** There is no React `cache()` anywhere in
  `src/lib/queries` or `src/lib/db`, so nothing dedupes it. `navigation.tsx:23` additionally spreads
  the result into a new object (`{ ...base, currentUserId, currentUserRole }`), breaking reference
  identity even where dedup could otherwise apply.
- **`fetchReferenceData` is a global blob.** It loads _all_ investments, registers, users and
  categories on every page. A detail page that needs one investment reads 96 and then does
  `refData.investments.find(...)` in JS (`page.tsx:60`). Same fetch-everything-filter-in-JS pattern
  as the tree, one level up.
- **`fetchFilteredByType` runs twice** (page + transfer table) with the same `where`.
- **Two `'use client'` boundaries receive the full `reference-data.ts` shape** rather than the
  fields they read: `transfer-table-server.tsx:62` and `navigation.tsx:25` → `top-nav.tsx`. The
  latter is in the root layout, so it re-serializes on every navigation app-wide — this is not an
  investment-page-only tax.

Net: a page that used to be "transfers + a bit of reference data" now performs ~9 fetch operations
across two data planes, three of them redundant, one of them unbounded — and serializes ~200 KB.

---

## Research questions (before any fix is planned)

1. How many round-trips does one toggle actually make (GET + POST, all requests, total bytes)?
   Settles the double-refresh hypothesis.
2. Does `updateTag`'s automatic client invalidation fully replace `router.refresh()` for our four
   consumers, or does something read through a path it doesn't reach?
3. Can the panel's figures be computed by SQL aggregation in `src/lib/db` instead of materialising
   the tree? What does the panel genuinely need per-item vs. in aggregate?
4. What does the page cost _without_ the panel (v1 / `?stats=v1`) vs. with it — that is the
   transfers-only baseline the owner is measuring against, and it is available today via the
   existing version toggle.
5. Is `cacheComponents` / `'use cache'` viable here, or still blocked by the Vercel bug noted in
   AGENTS.md? Relevant to whether render output can be reused at all.

## Baseline — hard precondition

No fix ships without before/after on the same scenario. Capture **before touching code**, then
re-capture after each step so each step's gain is attributable:

- All requests per toggle (count + method + bytes), not just POSTs.
- RSC payload size in bytes.
- Per-request invocation counts of `fetchReferenceData` / `findTransfersRaw` / `getKosztorysTree` —
  the `[PERF]` log lines already exist in `reference-data.ts` and `transfer-table-server.tsx`.
- Click-to-visual-flip wall clock (Playwright).
- TTFB and total response time.
- **Page load, v1 vs v2** (`?stats=v1`) — the transfers-only reference point for "as fast as it
  originally was".

## Owed regardless of approach

- `useOptimistic` / `useTransition` on the control — it is inert for the whole round-trip today,
  which is what makes it read as broken rather than merely slow.
- Playwright spec in `e2e/` asserting the control reflects its new value without a full page
  refresh.

## Where the spike landed (2026-07-27)

Shipped on `ex-597-decouple-panel-write-refresh`; per-step evidence in `research.md`:

- `router.refresh()` deleted — render count halved (S1)
- `fetchReferenceData` deduped per request, 3× → 1× (S3)
- Settings moved out of the investment page into the kosztorys editor, reached by a
  `?ustawienia=1` link — this **retired** the decoupling problem on this route rather than
  solving it (`37349c77`, `94e881a4`)
- Media lookup cached whole under a new `media` tag + collection-hook invalidation, read via raw
  SQL (`a1bf7234`, `72ff0ea1`)

**Two findings that reframe the ticket** and belong in any follow-up:

1. `sumAllRegisterBalances` is **not** a query problem — the "28× cache cliff" was the cold/warm
   boundary. No index or materialized view would move it (S2).
2. **Server work is no longer the bottleneck on this page.** Median server render is ~250 ms; the
   remaining perceived 1–2 s is client-side re-render of the transfers table (200–620 ms every
   click) plus intermittent ~900 ms cold starts. The optimistic/pending UI listed below is now the
   only remaining lever on how this _feels_ — and the "we'd just be hiding slow queries" objection
   no longer holds, because no slow query remains (S3).

Still open: the whole-tree-for-two-scalars read (~120–175 ms warm, fix shape unsettled), its
unmeasured worst case, and the two items under "Owed regardless of approach" above.
