# Review-gate ledger — subcontractor-price-guard (EX-609) · 2026-07-27

Scope: the twelve commits that make up the slice — `6386bb39` (p1), `3a78c9f4` (p2), `91fb43a8` (p3),
`e3eb47da` (manual checks), then the refinement run `f6242dc8`, `9b0bc14a`, `c58be89c`, `e4622130`,
`e280f4e9`, `71e19d01`, `fe66f393`, `fa96b7a8`. The branch carries three other slices, so the review
diff is the union of those commits, not `main...HEAD`.

## Findings

- [x] 🔴 CRITICAL · fixed · code-review + impl-review · `subcontractor-columns.tsx` · „Mnożnik"
      committed every parseable keystroke and its blur only cleared the message — a refused „0,9"
      left the row at coefficient **0**, i.e. a 0 zł subcontractor price, silently. It also ate the
      decimal point (the controlled input rewrote „0," back to „0"), so a decimal multiplier was
      effectively untypeable. Both die with the shared `useOverrideEdit` draft machine, which routes
      „Mnożnik" through the same `priceKeystroke`/`priceSettle` pair „Cena" already used.
      test: test-driven-debugging · unit — `subcontractor-price-edit.test.ts` „odrzucony mnożnik nie
      zostawia wiersza na prefiksie „0"" pins entry-state rollback for the coeff mode.
- [x] 🔴 CRITICAL · fixed · code-review · `subcontractor-columns.tsx` · switching „Źródło" carried the
      stored number across unread, and the two modes read that slot differently: a 200 zł kwota stała
      became a multiplier of **200** (a 20 000 zł row the guard never saw — no keystroke went through
      it), and a 0,65 mnożnik became a price of 65 groszy. `modeChange` now re-seeds from the price
      the row already shows, so the switch changes the source, not the price — which is also what
      makes it safe: whatever passed the guard before still passes after.
      test: test-driven-debugging · unit — `modeChange` block, all four directions + the
      clientPrice-0 fallback.
- [x] 🟡 WARNING · fixed · code-review · `subcontractor-price-guard.ts:41` · a negative price passed
      unremarked whenever `clientPrice` was 0 — the zero short-circuit returns before the ceiling, so
      the rows still being priced were exactly the unguarded ones. Added a negative floor ahead of
      the short-circuit.
      test: TDD · unit — `checkSubcontractorPrice — cena ujemna`, incl. the zero-client-price case
      and the zero-is-not-negative boundary.
- [x] 🟡 WARNING · fixed · impl-review · `kosztorys-global-settings.tsx:36,48` · both global-coefficient
      fields capped at `MAX_CLIENT_SHARE` but had no floor, so a negative global coefficient was
      typeable and produced negative subcontractor prices on every auto row at once. `min={0}` added.
      test: no automated test · — the guard's negative rung above covers the resulting row state; the
      input attribute itself is browser-enforced and belongs to the manual/E2E pass.
- [x] 🔵 OBSERVATION · fixed · code-review · `subcontractor-columns.tsx` · Escape had no handler, so
      an in-flight rejected draft could only be resolved by blurring. Escape now rolls the row back to
      the entry snapshot and clears the draft — deliberately WITHOUT calling `blur()`, because the
      stale-closure `onBlur` would then settle the same draft a second time after the rollback.
- [x] 🔵 OBSERVATION · fixed · code-review · `subcontractor-columns.tsx` · a draft outlived its row:
      the grid recycles cell components across rows while virtualizing, so scrolling mid-edit could
      settle one row's text onto another. The draft now carries `rowId` and settle/cancel no-op when
      it doesn't match.
- [x] 🔵 OBSERVATION · fixed · code-review · `subcontractor-columns.tsx` · the tooltip revealed on
      pointer only, so a keyboard user reaching the cell by Tab never saw why their value was refused.
      Added `onFocusCapture`/`onBlurCapture` alongside the pointer handlers.
- [x] fixed · module-cohesion + structure-scatter · `constants.ts` · `OVERRIDE_FIELDS` lived in the
      edit module while three columns and the cell file all needed it — two audits converged on the
      same relocation. Moved to `kosztorys/constants.ts`.
- [x] fixed · code-review · `subcontractor-price-edit.ts` · the cell file had hand-rolled its own
      copy of the module's private `withOverride`. Exported the original, deleted the duplicate.
- [x] fixed · code-review · `subcontractor-columns.tsx` · the price cell rendered a raw float
      (`70.00000000000001`) and a dot separator in a Polish UI. `round2` now trims to two places and
      emits a comma.
- [x] fixed · tailwind-v4-audit + code-review + a11y · `globals.css` · `--color-warning` measured
      1.83:1 on light, below the 3:1 non-text floor. First skipped as the owner's deliberate choice,
      then resolved outright: they dropped the whole warning tier (2026-07-28), so the token, its
      dark-mode twin and `AlertIcon`'s second tone all went as dead code. The contrast question
      disappears with the colour.
- [x] fixed · comment-noise · `subcontractor-price-guard.test.ts:53,86` · two comments were written in
      Polish; AGENTS.md keeps comments English even beside Polish UI strings. Translated. The rest of
      the proposed deletes/trims were re-read against the current files and every one carries
      rationale that survives the STRIP TEST — dropped rather than churned.
- [x] fixed · primitive-reuse · `slice-pie.tsx:47` · rendered a bare `AlertTriangle` (the deprecated
      lucide alias) instead of the app's `AlertIcon`. Adopted.
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

**Archived 2026-07-28.** Every finding box is checked. The 12 manual-check boxes in
`manual-checks.md` were still unticked at the time, which read as a blocker until the owner's
2026-07-28 ruling made manual verification non-blocking for Done.

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
