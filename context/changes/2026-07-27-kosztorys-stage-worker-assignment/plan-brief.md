# Worker↔etap assignment (EX-613) — Plan Brief

> Full plan: `context/changes/2026-07-27-kosztorys-stage-worker-assignment/plan.md`
> Research: `context/changes/2026-07-27-kosztorys-stage-worker-assignment/research.md`
> Decisions: `context/changes/2026-07-27-kosztorys-stage-worker-assignment/change.md`

## What & Why

Nothing in the app links executed work to a person: należne is an investment-level lump, wypłaty are
per worker, and the code says so in a docblock. Assigning one worker per etap turns „ile jestem
winien tej ekipie" into „ile jestem winien tej osobie" — and puts that answer in front of you at the
moment you add a wypłata.

## Starting Point

`plane` (z narzędziami / bez narzędzi) already exists as a nullable per-etap attribute that changes
money, worked through nine layers. The per-worker wypłata sum is already a cached query. The panel's
per-worker table already exists — with exactly one column, Σ wypłat. The feature is one column plus
one grouping key; the surrounding machinery is unusually complete.

## Desired End State

Each etap can name who is to do it (optional, editable). „Podsumowanie podwykonawców" shows należne /
wypłacono / pozostało per person, with a separate residual row for etapy nobody is assigned to. The
wypłata form pre-fills what the chosen worker is owed and warns — without blocking — when the figures
can't be trusted. Reassigning an etap that already holds executed work demands an explicit
confirmation naming the amount and both people.

## Key Decisions Made

| Decision                        | Choice                                                              | Why                                                                                       | Source   |
| ------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| Grain                           | One etap, one worker; nullable                                      | Splitting an etap between people is a different, bigger problem                            | Owner    |
| Editor figure vs dialog figure  | One shared pure derivation, two feeds                               | Two derivations diverge unboundedly and invisibly; one diverges only for the ~500ms save   | Owner    |
| Loud reassignment               | Confirm dialog naming amount + both names. No snapshot, no undo     | Nothing is destroyed; reassigning back is the exact inverse. The red negative is the trail | Owner    |
| Missing worker                  | Never locks quantity entry; no second etap-header badge             | A worker-less etap still has a value — unlike a plane-less one, whose money vanishes       | Owner    |
| Plane-less etap                 | Accepts no worker at all — picker disabled until rozliczenie is set | An assignment there would show a name against a silent `0 zł` należne                     | Owner    |
| Negative „pozostało"            | Red in all three cases, with a qualifier saying which               | The reader needs to tell an overpayment from an unassigned worker                          | Owner    |
| Roster source set & order       | Workers with etapy ∪ workers with wypłaty, sorted by pozostało desc | The list answers „komu jeszcze jestem winien"; that's the sort key                         | Owner    |
| Client share / role visibility  | Unchanged in both cases                                             | The panel isn't role-gated today (only „Marża" is); the share stays as-is                  | Owner    |
| Where the grouping lands        | Inside the existing per-etap settlement loop                        | The editor already runs ~6 O(rows×stages) passes; a separate memo would be a seventh       | Research |
| Assignment lives on the etap    | Not on the transaction                                              | The deposit→etap bridge (EX-536) was built, broke twice, and was torn out                  | Research |

## Scope

**In scope:** nullable `worker_id` on `kosztorys-stages` + hand-written migration; etap-header picker
with „Bez przypisania"; confirm dialog on reassigning a populated etap; per-worker grouping in the
settlement pass; three money columns in the panel; investment-scoped roster + two non-blocking
warnings on the wypłata form.

**Out of scope:** splitting an etap between people; stripping the worker from the client share; any
role gate; auto-snapshot or undo for a worker change; a worker on a transaction; any new required
form field; E2E specs (filed to `e2e-backlog` at the review gate).

## Architecture / Approach

`subcontractorDueByWorker` sits beside `subcontractorDueByPlane` in `settlement.ts` as a pure
`(rows, stages) => …` function, filled from the per-etap total the plane loop already computes. The
editor feeds it live grid state; the wypłata roster feeds it a server-fetched tree through the
existing `treeToRows`. One derivation, two feeds — the alternative is two code paths computing the
same money, which is the failure `lessons.md:19-24` exists to prevent.

## Phases at a Glance

| Phase                       | What it delivers                                               | Key risk                                                                       |
| --------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1. The assignment exists    | Column, migration, header picker, loud reassignment confirm    | Mirroring `plane` too faithfully — widening the quantity lock or the read-only predicate |
| 2. Money per worker         | Per-worker grouping + three panel columns + the residual row   | The `plane === null` skip runs first; grouping before it breaks the invariant   |
| 3. Roster on wypłata form   | Server derivation, on-demand fetch, two loud non-blocking warnings | No pre-submit warning that doesn't block exists in the forms tree — every rule there is binary zod |

**Prerequisites:** local docker Postgres on 5433; the prod migration is applied by a human before the
code ships.
**Estimated effort:** ~3 sessions, one per phase.

## Open Risks & Assumptions

- Phase 3's warnings are loud on purpose (owner: „to są pieniądze") and reuse the existing
  destructive-toned primitives — so the risk is the opposite of a soft tier: a banner that only
  states a sum, with nothing to open, becomes furniture. Each must name a count and link to the rows.
- The parity spec in Phase 3 is what keeps decision #1 honest — if it is skipped, the two surfaces
  will drift silently.
- „Podsumowanie pracowników" is a plain grid, not a sortable DataTable; the new order is hard-coded.
- An etap can be simultaneously plane-unconfirmed and worker-unassigned; only the plane signal shows,
  by decision. If that ever reads as a bug, the decision is where to look.

## Success Criteria (Summary)

- You can see, per person, what they are owed on an investment and what is left to pay them.
- Adding a wypłata never becomes harder — but the figure you need is on screen when you do it.
- Moving an etap between people cannot happen by accident.
