---
change_id: kosztorys-stage-worker-assignment
title: Assign one worker per etap so należne is attributed per person
status: implementing
created: 2026-07-27
updated: 2026-07-28
archived_at: null
branch: staging
worktree: null
---

## Notes

Linear: **EX-613**

Assign a worker to an etap so we know who is owed what on an investment. Today the code
states the gap outright (`src/lib/kosztorys/subcontractor-summary.ts`): należne is
investment-level, wypłaty are per worker, and nothing links executed work to a person.

Decided with the owner (2026-07-27):

- **One etap, one worker.** Nullable relationship on `kosztorys-stages`, sibling to `plane`.
  Splitting an etap between people is explicitly out of scope for now.
- **Meaning: „kto ma zrobić"** — a planned assignment, editable, chooseable at etap creation
  (optional, never forced, unlike `plane`).
- **Należne counts executed work only** (pomiar, never przedmiar).
- **Unassigned etapy** get their own residual row and are never distributed across assigned
  workers. Unlike a null `plane`, a null worker must NOT lock quantity entry.
- **The wypłata roster pre-fills, never gates.** Adding a payment must stay possible with no
  assignment — two warnings, neither blocking: (a) investment has unassigned etapy, so the
  roster's pozostało figures read short; (b) the selected worker has no etapy here, so their
  pozostało will look like an overpayment. **Non-blocking does NOT mean quiet** (owner, 2026-07-28:
  „ten wykrzyknik ma krzyczeć, to są pieniądze") — both reuse the existing destructive-toned
  primitives at full volume; no softer advisory tier is invented.
- **Worker with no etapy: Należne `0`, Pozostało negative**, flagged „brak przypisanych
  etapów" so it is distinguishable from a genuine overpayment (the panel already colours a
  negative pozostało red for the overpaid case).
- Workers missing from `users` are added by hand first — not a code concern.

Open questions — **all resolved with the owner 2026-07-28** (research detail in `research.md`):

1. **Live vs saved → one shared derivation, divergence bounded by the save.** The editor's figure
   and the wypłata roster's figure must come from the **same pure function**, fed by live grid
   state on one side and DB-assembled rows/stages on the other. Then the only possible
   disagreement is the ~500 ms debounce window, which is accepted. Two independent derivations
   are explicitly rejected: that divergence would be unbounded and invisible.
2. **The loud reassignment → confirm dialog, nothing more.** An `AlertDialog` naming the etap, the
   amount of executed work, and both workers. **No auto-snapshot, no undo entry** — nothing is
   destroyed and reassigning back is the inverse. The visible aftermath is the signal: the losing
   worker's pozostało goes negative and reads red.
3. **Client disclosure → no change.** The share keeps shipping the tree as it does today.
4. **Two residuals → rozliczenie (plane) dominant.** An etap with no plane earns nobody anything,
   so "no worker" on it is a claim about zero. Only the plane warning renders. **A missing worker
   never locks quantity entry** (unlike a missing plane). **Corollary the owner added: a plane-less
   etap accepts no worker at all** — the picker is disabled until a plane is chosen, because an
   assignment made there would show a name against a silent `0 zł`.
5. **Negative pozostało → always red, with a description of which case it is.** All three meanings
   (genuinely overpaid / etapy reassigned away / never had etapy here) read red; the copy beside
   the figure distinguishes them.
6. **Roster → union of „has etapy" and „has wypłaty", sorted by pozostało desc**, no-worker bucket
   pinned last. Note: „Podsumowanie pracowników" is a plain grid with a hard-coded order (kwota
   desc today) — the sortable DataTable is the wypłaty list below it, a different table.
7. **MANAGER visibility → no change.** The „Podwykonawcy" panel is **not** role-gated today (only
   „Marża" is, via `financials`), and it stays that way. MANAGER sees the per-worker figures.

Rough slicing: (1) assignment exists — column, migration, header picker; (2) money per worker
— one grouping key in the existing per-plane settlement pass + panel columns; (3) roster on
the wypłata form.
