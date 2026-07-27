---
change_id: kosztorys-stage-worker-assignment
title: Assign one worker per etap so należne is attributed per person
status: new
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

Open question for research/plan: reassigning an etap that **already holds quantities**
silently moves already-earned money from one person to another. Owner: "it has to be loud as
fuck." Decide the mechanism during research/plan (confirm dialog is the existing precedent —
see the populated-etap delete confirm).

Rough slicing: (1) assignment exists — column, migration, header picker; (2) money per worker
— one grouping key in the existing per-plane settlement pass + panel columns; (3) roster on
the wypłata form.
