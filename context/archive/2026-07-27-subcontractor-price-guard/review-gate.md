# Review-gate ledger — subcontractor-price-guard (EX-609) · 2026-07-27

Scope: the twelve commits that make up the slice — `6386bb39` (p1), `3a78c9f4` (p2), `91fb43a8` (p3),
`e3eb47da` (manual checks), then the refinement run `f6242dc8`, `9b0bc14a`, `c58be89c`, `e4622130`,
`e280f4e9`, `71e19d01`, `fe66f393`, `fa96b7a8`. The branch carries three other slices, so the review
diff is the union of those commits, not `main...HEAD`.

## Findings

- [x] dismissed · primitive-reuse · `recon-mismatch-badge.tsx`, `plane-unconfirmed-badge.tsx` · look
      like the same duplication but aren't: each icon is the badge's ONLY content and carries the
      `aria-label` that names it — one of them asserted on by an E2E. `AlertIcon` is `aria-hidden` by
      design (its call sites pair it with text), so adopting it there would delete the accessible name.
- [x] filed EX-614 · gate Step 3 · the settle path (focus, virtualization recycling, Enter, Escape,
      caret survival) is browser-level and units can't reach it — owed as an E2E, filed to the
      `e2e-backlog`.
      test: test-driven-debugging · e2e — risks carried into the issue with the fix.

## Simplify pass

Ran the mutating cleanup pass (`/simplify` + `primitive-reuse-scan`) serially after the fan-out —
3 applied, 0 proposed, 2 dismissed; each folded into `## Findings` above. No separate report file:
the fan-out's structural findings (`OVERRIDE_FIELDS` relocation, the duplicated `withOverride`) had
already been triaged as fix-now and landed there, so the pass added only the `AlertIcon` adoption and
the two comment translations.

Held off every file dirty from a parallel session — `warning-banner.tsx`,
`kosztorys-totals-panel.tsx`, `settlement-plane-warning.tsx`, `use-kosztorys-editor.ts`,
`kosztorys-editor-body.tsx`, `ordinal-gutter-column.tsx`.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 errors, 85 warnings, all pre-existing (unused `db` args in migrations).
- `pnpm exec vitest run` — 1827 passed, 62 skipped (DB-backed specs), 0 failed. Re-run clean after
  the warning-tier removal.
  New this gate: 9 cases in `subcontractor-price-edit.test.ts` (coeff-mode keystrokes, the coeff
  rollback, all of `modeChange`) and, in `subcontractor-price-guard.test.ts`, the negative rung, the
  pre-rabat ceiling, and plane isolation.
- `pnpm test:e2e` — not run; the slice's browser-level coverage is filed as EX-614 rather than
  authored here.
- `pnpm build` — not run (no build-surface change beyond what typecheck covers).

## Outcome

**In review, not archived.** Every finding box is checked, but the second archive blocker stands:
all 12 manual-check boxes in `manual-checks.md` are still unticked, and manual verification is a
hard blocker for Done.

Both open decisions were settled by the owner (2026-07-28):

1. **The 80% ceiling measures against the list price, before any rabat.** The guard already did this
   (`clientPrice` is the pre-rabat unit price; `applyDiscount` works on the row's gross value), but
   nothing pinned it — now guarded by `checkSubcontractorPrice — sufit liczy się od ceny przed
rabatem` and the rationale sits on `maxSubcontractorPrice`.
2. **The amber warning tier is removed, not restyled.** The contrast question was first answered
   "the yellow stays"; an hour of looking at it answered the real one — the tier was annoying, and
   annoying because it was firing correctly on rows that were fine. A flat price above the global
   multiplier is an ordinary thing to type, so amber marked ordinary rows and the colour stopped
   carrying information.

   What went with it: `checkSubcontractorPrice` now returns `string | null` rather than
   `{ severity, message }`; the coefficient comparison, `--color-warning` (both themes),
   `AlertIcon`'s `tone` prop and the cell's `TONE`/`ALERT_TONE` maps are all deleted as dead code.
   The warning cases in the guard spec were deleted outright, not replaced. A "these prices are now
   silent" case was written first and then dropped as redundant: the ceiling case already asserts
   `amount(80) → null`, and 80 sits above the coefficient price, so any tier re-introduced below the
   ceiling fails there. A comment on that case says so, since the coverage isn't obvious.

   Kept deliberately: the half-grosz `TOLERANCE`, which the ceiling comparison needs on its own
   (a price retyped off the screen at exactly the ceiling must not be refused on a float remainder),
   and the `AlertIcon` glyph on refusals — a red number alone is invisible to a colour-blind reader.
