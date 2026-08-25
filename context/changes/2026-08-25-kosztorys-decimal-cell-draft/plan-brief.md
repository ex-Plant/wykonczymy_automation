# One edit contract for every numeric kosztorys cell — Plan Brief

> Full plan: `context/changes/2026-08-25-kosztorys-decimal-cell-draft/plan.md`

## What & Why

Three different edit models live in one grid. One of them holds the typed text as a draft and rolls
a refused value back with a toast; the other two commit every keystroke straight to the row. Both of
those lose data: „Rabat wart." cannot accept a decimal at all (`12,5` is stored as **125**), and the
plain numeric cells clear themselves when a half-typed value is left standing. This change extracts
the good model and moves the other two onto it.

## Starting Point

`useOverrideEdit` (`grid/cells/subcontractor-columns.tsx:117`) already implements the contract, and
its React-free half is already a separate, unit-tested module (`lib/kosztorys/subcontractor-price-edit.ts`).
„Rabat wart." is a controlled input committing per keystroke — it re-renders over the comma the user
just typed, so the next digit concatenates. The plain numeric cells run on `decimalColumn`, added
2026-08-25 to fix comma parsing; that fix works, but dsg's `parseUserInput(value: string)` never sees
the value it replaces, so "reject and keep" is unexpressible and both `empty` and `invalid` collapse
to `null` — into fields typed `number`.

## Desired End State

Every numeric cell in the grid behaves the same: the typed text stays put while the caret is in the
cell, blur decides, and a refused entry restores what was there and says so. `12,5` works everywhere.
No numeric field is ever sent `null`.

## Key Decisions Made

| Decision                    | Choice                                                                      | Why                                                                                                                               | Source |
| --------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Emptied numeric cell        | Commits `0` on blur                                                         | Matches the `number` type and the sheet, where a blank position is zero; ends the `null` POSTs                                    | Plan   |
| Subcontractor cells         | Move onto the shared hook                                                   | Two draft machines side by side would drift on the first fix — that drift is what this change exists to end                       | Plan   |
| Toast policy                | Only when the row actually moved                                            | The rule `priceSettle` already applies: a word is owed when a different number is on screen, not for garbage that changed nothing | Plan   |
| Escape / Delete / clipboard | Escape restores the entry value, Delete writes `0`, copy/paste keeps commas | Escape does nothing useful today; the clipboard behaviour arrived with `decimalColumn` and must survive leaving `keyColumn`       | Plan   |
| Resting display             | Raw comma text, unchanged                                                   | One representation in and out — the split between resting and editing format is what caused the original complaint                | Plan   |
| Perf verification           | Manual pass on the ~1000-item perf seed                                     | The dataset exists for this; the symptom (typing stutter) is invisible to unit tests                                              | Plan   |

## Scope

**In scope:** the generic keystroke/settle machine + three policies; the `useCellDraft` hook;
„Cena j.m." and „Mnożnik" (subcontractor), „Rabat wart.", „Cena j.m." (Inwestor), „Przedmiar", every
per-etap „ilość".

**Out of scope:** `parseDecimalInput` and its spec; the resting display format; adding a price guard
to the client view; the Playwright spec (deferred, see Risks); the global-discount override rules.

## Architecture / Approach

Bottom-up through three strictly dependent layers:

```
lib/kosztorys/cell-edit.ts      pure: cellKeystroke / cellSettle + CellEditPolicyT
        ↑                       policies: numeric field · discount pair · subcontractor price
grid/cells/use-cell-draft.ts    React: draft state, settle on blur, rollback toast, Escape
        ↑
three cell families             subcontractor · rabat · plain numeric columns
```

A policy is the four functions that differ between them (`snapshot`, `restore`, `applyValue`,
`clear`) plus an optional `guard`. Everything else — including the two rules that were learned the
hard way (never clear mid-typing; roll back only when the row moved) — lives once, in the machine.

## Phases at a Glance

| Phase              | What it delivers                                                                    | Key risk                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1. Pure machine    | `cell-edit.ts` + three policies; `subcontractor-price-edit.ts` re-expressed over it | Changing subcontractor behaviour while "only refactoring" — its untouched spec is the guard |
| 2. `useCellDraft`  | The hook, with the subcontractor cells as first consumer                            | No unit test can reach a hook here; regression risk falls on the manual pass                |
| 3. „Rabat wart."   | The `12,5` → `125` bug dies                                                         | The cell writes a field _pair_; the orphan-bug guard must survive                           |
| 4. Numeric columns | The `-`-clears-the-cell hole and the `null` writes die                              | EX-422 remount trap + several hundred live inputs on the perf dataset                       |

**Prerequisites:** none — no schema, no migration, no prod step. Runs on the existing branch
`heic-upload-gap`.
**Estimated effort:** ~1–2 sessions; phases 1–3 are small, phase 4 carries the bulk.

## Open Risks & Assumptions

- **The E2E is owed, not written.** The failure mode is a DOM round trip — a comma swallowed by a
  re-render — which no unit test can observe. Per AGENTS.md this must be authored at the review gate
  or filed as a Linear issue labelled `e2e-backlog`. Do not archive without one.
- **Phase 2 refactors an incident-hardened path.** The subcontractor guard, its standing verdict and
  the tooltip's fixed tree shape are all load-bearing; the extraction must move zero behaviour.
- **Assumption: the draft alone fixes the rabat.** `12,` still commits 12; what changes is that the
  draft keeps `12,` on screen. If that turns out insufficient, the parse rules — not the draft —
  would need revisiting.

## Success Criteria (Summary)

- `12,5` can be typed into every numeric cell of the grid, including „Rabat wart.".
- A half-typed or refused entry never silently replaces a number with a different one.
- Clearing a numeric cell stores `0`; no `null` reaches `updateItemFieldAction`.
