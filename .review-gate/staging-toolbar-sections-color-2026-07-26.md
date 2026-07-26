# Review-gate ledger — staging toolbar + section ops + section colour · 2026-07-26

Scope: everything on `staging` not covered by the previous gate. The batch
`d5b80d37`..`8ef4a3e5` already has its own ledger
(`.review-gate/staging-post-merge-kosztorys-refactors.md`, all boxes closed), so this
gate covers `00a97318..HEAD` **plus the uncommitted section-colour work**:

- `1bd8bd2e` dedupe toolbar panel-toggle buttons (`panel-toggle-button.tsx`)
- `d81fef76` reposition toolbar toggles
- `49ec90ad` move „Widok sekcji" into the right-aligned toolbar cluster
- `44296504` section insert + reorder in the row-actions menu (`swapSectionOrderAction`,
  `insertSectionAction`, `swapSectionBlock`, `applyInsertSectionRow`)
- `961e1f7c` remove the redundant Sekcje side drawer
- uncommitted: section colour end-to-end (migration + `section-colors.ts` palette +
  `SectionColorPicker` + pinned pie fills)

No `plan.md` covers this batch (worked directly on `staging`) → `/10x-impl-review`
dropped from the fan-out. No manual-verification skill in this project → Step 0.5
skipped. Ran: `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.

## Findings

<!-- ONE checkbox per finding — every source folds in here. Most-severe first.
     Format: [box] [severity tag, bug-finding checks only] · disposition · `source` · `file:line` · what — reason -->

_(pending Step 1 triage)_

## Simplify pass

_(pending Step 2)_

## Tests & suite

_(pending Step 3)_
