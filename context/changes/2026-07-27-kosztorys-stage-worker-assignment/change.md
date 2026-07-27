---
change_id: kosztorys-stage-worker-assignment
title: Assign one worker per etap so należne is attributed per person
status: preparing
created: 2026-07-27
updated: 2026-07-27
archived_at: null
branch: null
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
  pozostało will look like an overpayment.
- **Worker with no etapy: Należne `0`, Pozostało negative**, flagged „brak przypisanych
  etapów" so it is distinguishable from a genuine overpayment (the panel already colours a
  negative pozostało red for the overpaid case).
- Workers missing from `users` are added by hand first — not a code concern.

Open questions after research (full detail in `research.md`):

1. **Live vs saved.** The editor's należne is computed client-side over unsaved grid edits; the
   wypłata roster would read the DB. Must the two agree (one shared pure function, parity
   asserted), or is the divergence accepted and labelled?
2. **The loud reassignment.** Reassigning an etap that already holds quantities silently moves
   already-earned money. Owner: "it has to be loud as fuck." Mechanism: confirm dialog gated on
   a populated-etap predicate, ± an auto-snapshot, ± the first undo entry for a stage-metadata
   change (a plane change has none today).
3. **Client disclosure.** The client share ships the tree unstripped — strip the worker, or
   extend the accepted leak?
4. **Two residuals in one UI.** An etap can be both plane-unconfirmed and worker-unassigned.
   Two badges, one combined signal, or plane dominant?
5. **The three-state negative pozostało** — genuinely overpaid / paid against no assigned work /
   nothing assigned yet. Which get their own treatment, which share one?
6. **Roster inclusion & ordering** — union of „has etapy" and „has wypłaty"; where a worker with
   należne but no wypłaty sorts.
7. **MANAGER visibility.** Per-worker należne is cost/margin-class data (S-10, open question P10).
   Roster OWNER-only?

Rough slicing: (1) assignment exists — column, migration, header picker; (2) money per worker
— one grouping key in the existing per-plane settlement pass + panel columns; (3) roster on
the wypłata form.
