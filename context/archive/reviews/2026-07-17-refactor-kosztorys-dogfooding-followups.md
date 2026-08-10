# Review-gate ledger — refactor/kosztorys-dogfooding-followups (PR #25) · 2026-07-17

Base: origin/staging...HEAD · 63 files · EX-512→EX-517 refactors + EX-477/508/509 fixes
Checks run: code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit,
structure-scatter-audit, comment-noise-audit (`/10x-impl-review` dropped — no single `plan.md`
unifies the branch).

Disposition policy this gate: **fix-first, no new Linear issues** (owner directive) — every real
finding is fixed in code or dropped-if-cosmetic. Nothing deferred to the backlog.

**Trimmed at archive (2026-08-10).** The 14 `fixed` findings were removed: each one's durable record
is its commit, and a ledger line describing a change is strictly worse evidence than the change.
What survives is the negative space git cannot hold — what a reviewer looked at and chose **not** to
act on, and why. Moved here from the `.review-gate/` fallback path, which had no lifecycle of its own.

Final tally before the trim: **14 fixed, 3 dismissed, 2 skipped, 0 open.**

## Findings

- [x] 🔵 OBSERVATION · skipped(cosmetic) · code-review · `kosztorys-row-actions-menu.tsx` · confirm copy „Usunąć pozycję?" doesn't disclose the last-item→section cascade. Copy-only, no data-loss discrepancy — dropped as cosmetic per owner directive.
- [x] 🔵 OBSERVATION · dismissed · code-review · `use-persisted-enum.ts` · shared module-level listener Set — benign (`useSyncExternalStore` bails on unchanged snapshot; one extra `getItem` per unrelated write). Documented in the header comment.
- [x] dismissed · structure-scatter · (branch-wide) · no scatter introduced; the branch CONSOLIDATED the two flat-root kosztorys specs into `src/__tests__/lib/kosztorys/`.
- [x] skipped · tailwind · `ui/select.tsx:59` `min-w-[8rem]`, `ui/textarea.tsx:10` `min-h-[68px]`, `ui/calendar.tsx:79,85` `text-[0.8rem]` · pre-existing shadcn defaults, out of this refactor's scope.
- [x] dismissed · tailwind · `checkbox.tsx` `rounded-[4px]`, `select.tsx` `z-[10001]`, `editor-body.tsx` `calc(100dvh)` · legit runtime/one-off arbitrary values, keep. EX-514 `ring-3` confirmed complete.

## Simplify pass

Ran `/simplify` — 2 applied, 0 proposed, 0 dismissed; both folded into `## Findings` (trimmed above as
`fixed`). Reuse/efficiency angles came back clean.

## Tests & suite

- typecheck: PASS (`tsc --noEmit` clean)
- unit (kosztorys + utils): PASS — 141 passed / 11 skipped (DB-dependent), then 50 passed on the two
  touched specs after the `/simplify` edits.
- lint / e2e / build: not run in this gate (working-tree refactor; full suite runs at PR merge).
