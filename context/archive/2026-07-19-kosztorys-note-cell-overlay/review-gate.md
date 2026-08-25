# Review-gate ledger — EX-538 (kosztorys long-text cell overlay) · 2026-08-10

Scope: working-tree diff — `src/components/ui/datasheet-grid/long-text-cell.tsx` (new),
`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx` (modified), plus the change docs.

Step 0.5 (browser verification) ran in the prior session: two bugs found and fixed (grid painting over
the overlay at `z-20`; a click on the overhanging part of the overlay ending the edit). Both are
recorded as Key Discoveries in `plan.md` and covered by the deferred E2E (EX-657).

Fan-out was scaled to the diff (2 files): `/10x-impl-review` + `/code-review high` in parallel, the
tailwind / comment-noise / file-organization checks done inline, then `/simplify` +
`primitive-reuse-scan`.

## Findings

_Twelve `fixed` findings trimmed at archive (2026-08-10) — the fixes are the code now. Recoverable
from `git log --follow` on this file._

- [x] 🔵 · skipped · `impl-review` + `code-review` · `long-text-cell.tsx` · **Shift+Enter newlines
      corrupt the plain-text clipboard.** dsg builds `text/plain` as unquoted TSV, so a cell holding a
      newline copied _out of the app_ splits into two rows in Sheets/Excel; in-app paste survives via
      dsg's `text/html` payload. Not fixed: newlines are the feature, and every fix (escaping on copy,
      stripping on commit) is a behaviour change the owner should choose. Recorded as a known
      limitation in the manual checks and in EX-657.
      test: no automated test · pinned as an assertion in EX-657 so nobody "fixes" it by stripping newlines.
- [x] skipped · `simplify` · `src/lib/utils/enter-escape-keydown.ts` · its `stopPropagation` does not
      stop dsg's co-located `document` listener (this diff proves only `stopImmediatePropagation`
      does), so `EditableCellInput` carries the same latent leak. Behaviour-changing, in a third file
      outside this slice, harmless today (the keys it swallows dsg handles benignly). Recorded on
      EX-657 as a gate follow-up.
- [x] dismissed · `simplify`/`reuse-scan` · `long-text-cell.tsx` · three reuse candidates checked and
      rejected with reasons: `enter-escape-keydown.ts` (would break Shift+Enter, no Tab branch, wrong
      swallow), `use-inline-rename.ts` (controlled + blur-commit vs uncontrolled + per-keystroke), and
      the `disabled` early return (the convention every custom cell here follows).
- [x] dropped · `simplify` · `long-text-cell.tsx:130` · `overflow-auto` is redundant (the UA already
      gives a textarea `overflow: auto`) — one class in a documented string, not worth the churn.
- [x] dropped · `simplify` · `long-text-cell.tsx` · merging the Escape and Tab branches to share three
      lines would re-nest a key check and fuse two load-bearing comments. Net loss.

## Simplify pass

Ran `/simplify` + `primitive-reuse-scan` — 3 applied, 4 dismissed, 2 dropped, 1 skipped, 0 open; every
finding folded into `## Findings` above (tagged `simplify` / `reuse-scan`).
Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.9oC3bePS4l.md`

## Tests & suite

No new automated tests: the slice's risk is overlay stacking, focus and key handling, none of which a
unit or integration spec can reach honestly. E2E deferred to **EX-657** (`e2e-backlog`, project
Wykonczymy), extended at this gate with the four regressions found here plus the clipboard limitation.

- `pnpm typecheck` — pass (0 errors)
- `pnpm lint` — pass (0 errors, 80 pre-existing warnings in `src/migrations/*`)
- `pnpm exec vitest run` — pass (119 files / 1928 tests, 86 skipped)
- `pnpm build` / `pnpm test:e2e` — not run (user's call at the gate; nothing in this slice touches
  either plane)
