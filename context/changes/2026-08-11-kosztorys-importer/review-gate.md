# Review-gate ledger — 2026-08-11-kosztorys-importer · 2026-08-11

Slice S-15 `kosztorys-importer` (EX-417). Scope: 7 modified + 23 new files under `src/`.
Step 0.5 (verification pass) skipped — no `verify-manual-checks` skill installed in this workspace.

Fan-out: `/10x-impl-review` · `/code-review` · `tailwind-v4-audit` · `feature-first-structure` ·
`module-cohesion-audit` · `structure-scatter-audit` (diff-scoped) · `comment-noise-audit` (flag-only).

## Findings

- [x] 🔴 CRITICAL · fixed · code-review · `src/lib/kosztorys/sheet-import/build-import-plan.ts:120` ·
      zero resolvable cennik tabs produced no warning and wrote a flat `0 zł` subcontractor override onto
      every praca behind an enabled confirm button — a number that reads as deliberate in the editor and
      silently destroys the margin. Now `{ ok: false }` with a Polish problem naming the cennik.
      test: test-driven-debugging · unit — `'refuses the import outright when no cennik could be read'` +
      `'says which tab it skipped when that tab is the only cennik'`, both proven red against pre-fix code.
- [x] 🔴 CRITICAL · fixed · code-review · `src/__tests__/fixtures/kosztorys-sheet/header-blocks.ts:303-305,315-317` ·
      real client crew names (`PAWEL AES`, `EKIPA MYKOLA`) committed as fixtures, violating "fabricate all
      PII in fixtures, even pre-commit"; `no-pii.test.ts` had no person-name pattern so it passed. Names
      fabricated (`BRYGADA JEDEN` / `EKIPA DWA`), keeping the all-caps shape the parser must survive.
      test: TDD · unit — `no-pii.test.ts` gained an ALL-CAPS person/crew-name pattern with an explicit
      allowlist for the stand-ins, so the guard stays blind to which words are real.
- [x] 🔴 CRITICAL · fixed · impl-review · `src/lib/kosztorys/sheet-import/parse-robocizna.ts:44` ·
      the forward footer scan `break`s at the first marked-and-unnamed row, which is also what a blank
      spacer row mid-sheet looks like — the import truncated there, silently dropping every praca below.
      Replaced with a backward scan from the bottom, where the footer has no ambiguity.
      test: test-driven-debugging · unit — `'keeps reading past a blank spacer row that looks exactly like
    the footer'`, red pre-fix.
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/kosztorys/sheet-import/parse-robocizna.ts:80` ·
      a summary label typed into the opis column mid-sheet became a section, and every praca below it was
      filed under it. Footer labels are now recognised via the shared `isFooterLabel`.
      test: test-driven-debugging · unit — `'does not make a section out of a footer label typed into the
    opis column'`, red pre-fix.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/sheet-import/parse-robocizna.ts:108` ·
      rabat is a fraction in the sheet (`0,09`) but the owner sometimes types the whole percent (`9`);
      unclamped, that priced the praca at a 900% discount, i.e. deeply negative. Values ≥ 1 are now read
      as the percent they are.
      test: test-driven-debugging · unit — `'reads a rabat typed as a whole percent as that percent, not
    as a 900% discount'`, red pre-fix.
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/kosztorys/sheet-import/parse-robocizna.ts:98` ·
      rows carrying a description above the first section header were dropped without a trace. They still
      cannot be imported (no section), but they are now counted and surfaced as a preview warning.
      test: test-driven-debugging · unit — `'counts the rows above the first section instead of dropping
    them in silence'`, red pre-fix.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/actions/kosztorys-import.ts:96` ·
      the apply path had no try/catch around `derivePlan`, so a Google read failure at confirm time
      escaped the action as an unhandled rejection instead of a Polish error toast. Both paths now share
      `sheetFailureMessage`.
      test: no automated test — the seam is the Google client itself; the preview path's equivalent is
      already covered and apply now routes through the same helper.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/sheet-import/footer-totals.ts:30` ·
      each footer row was compared only against the app figure its own key names, but the owner's labels
      do not reliably say which of the two a row holds (on a sheet with nothing executed both carry the
      same number). Every row is now checked against both and reported via `matchedAgainst`.
      test: TDD · unit — `'matches a footer row against the other figure when that is the one it agrees
    with'`.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/sheet-import/footer-totals.ts:52` ·
      the summary figure was read from the „Wartość netto" column only, so a footer the owner merged
      across columns read as absent. A row with exactly one number now yields that number.
      test: TDD · unit — `'finds the summary figure when the owner merged it out of the Wartość netto
    column'`.
- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/editor/dialogs/sheet-import-gate.ts:24` ·
      a footer row that could not be found at all counted as a mismatch, so a sheet with no summary block
      showed a fabricated disagreement. A `null` sheetValue is now excluded.
      test: TDD · unit — `'does not call a footer row it never found a disagreement'`.
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/sheet-import/resolve-rates.ts:70` ·
      when the coherence guard dropped a candidate the decision was reported as `auto` with no rejected
      side, hiding exactly the pair the owner needs to see. The dropped candidate now rides along.
      test: no automated test — covered incidentally by the existing `resolve-rates` decision specs; the
      field is display-only.
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/sheet-import/build-import-plan.ts:96` ·
      `rateDecisions` listed every `missing` praca one by one, so an unreadable cennik buried the handful
      of real disagreements under 400 identical lines. `missing` is now a counted warning and the kind
      union is narrowed to the three reachable kinds.
      test: TDD · unit — the pre-existing flat-zero spec now asserts the warning text instead.
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/sheet-import/build-import-plan.ts:60` ·
      the columns report omitted the section and description columns, which are the two located by
      fragile offset — precisely what the owner must be able to eyeball. Both are now reported.
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/sheet-import/build-import-plan.ts:72` ·
      the rate-tab column report hardcoded the header string `'cena j.m.'` instead of showing the header
      cell it actually resolved, so a wrongly-resolved column looked right in the preview.
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/actions/kosztorys-import.ts:56` ·
      Google's own English, unactionable errors („The caller does not have permission") were surfaced
      verbatim in a Polish toast. One Polish message plus a `TODO(EX-449) SENTRY-REQUIRED` log line;
      only the missing-`kosztorys_robocizny`-tab case keeps its own actionable wording.
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/kosztorys/editor/dialogs/sheet-import-dialog.tsx` ·
      list keys derived from content collided on duplicate warnings/columns. All are index-based now.
- [x] fixed · feature-first-structure · `src/lib/kosztorys/sheet-import/sheets-client.ts` ·
      a generic read-only Sheets client sat inside the feature folder; moved to
      `src/lib/google/readonly-sheets-client.ts` with both importers updated.
- [x] fixed · module-cohesion-audit · `src/lib/kosztorys/sheet-import/columns.ts:88` ·
      the footer-label vocabulary lived beside the comparison while the parser needed it too. `FOOTER_ROWS` + `isFooterLabel` moved to `columns.ts`; `footer-totals.ts` re-exports the key type.
- [x] fixed · simplify · `src/lib/kosztorys/sheet-import/build-import-plan.ts:1` ·
      local `LETTERS` / `columnName()` reinvented `columnLetter` from `@/lib/google/sheet-configs`; also a
      duplicate `ROBOCIZNA_TAB` import merged.
- [x] fixed · simplify · `src/lib/kosztorys/sheet-import/parse-robocizna.ts:4` ·
      `round6` was defined twice; it is now exported once from `derive-override.ts`.
- [x] fixed · simplify · `src/__tests__/fixtures/kosztorys-sheet/grid.ts` ·
      `col()` / `row()` were duplicated across `header-blocks.ts` and `rows.ts`; extracted to `grid.ts`.
- [x] fixed · simplify · `src/lib/actions/kosztorys-import.ts` ·
      dead `spreadsheetId` field on `ImportPreviewT`, an unused `payload` parameter on `derivePlan`, a
      spurious `await` on a synchronous call, and a dead `import type { Payload }`.
- [x] fixed · tailwind-v4-audit · `src/components/kosztorys/editor/dialogs/sheet-import-dialog.tsx` ·
      raw `text-red-600` replaced with the `text-destructive` token, and the dialog's own
      `max-h-[85vh] overflow-y-auto` dropped — `DialogContent` already ships `max-h-[90vh]`.
- [x] fixed · impl-review · `src/components/kosztorys/editor/dialogs/sheet-import-dialog.tsx` ·
      the dialog's section order did not match the plan (Rozpoznane kolumny must lead, since every later
      section is only trustworthy if the columns resolved right); reordered. The „Zostaną zachowane" block
      also gained the section-rename hint the plan specifies.
- [x] fixed · impl-review · `src/components/kosztorys/editor/dialogs/sheet-import-dialog.tsx` ·
      the footer hand-rolled its buttons instead of using `DialogActions`, so Cancel stayed live during
      the write. Now on the shared pending contract.
- [x] fixed · impl-review · `context/changes/2026-08-11-kosztorys-importer/plan.md` ·
      Phase 5 success criteria named a nonexistent `sheet-import-dialog.test.tsx`; this repo has no
      DOM/React render stack, so the spec is `sheet-import-gate.test.ts`.
- [x] fixed · impl-review · `context/changes/2026-08-11-kosztorys-importer/change.md:4` ·
      doc drift — `status: planned` with every Progress box 1.1–5.3 ticked; now `implemented`.
      Roadmap S-15 deliberately stays `ready`: this project tracks code-complete-awaiting-review with the
      Linear `in review` label (applied to EX-417), not with a roadmap status.
- [x] filed · impl-review · `e2e/` · the browser-level path (menu gating → preview → confirm → re-seed →
      snapshot restore) has no automated proof; the unit layer covers everything below the plan builder.
      Deferred rather than authored because the seam needs a stubbed Sheets client in the Playwright
      harness, which is its own piece of work — filed **EX-671** (`e2e-backlog`).
      test: e2e — the risk and the injection seam are written into the issue.
- [x] fixed · impl-review · `context/foundation/manual-checks.md` ·
      the change had no manual-check section; added one covering role gating, the columns report, the
      footer-total proof, re-seed without reload, the pre-apply snapshot, and the no-cennik refusal.
- [x] dismissed · code-review · `src/lib/kosztorys/sheet-import/build-import-plan.ts` ·
      claimed `groupBy` reinvents an existing repo primitive — verified false, the repo has no such helper.
- [x] dismissed · code-review · `src/lib/kosztorys/sheet-import/derive-override.ts` ·
      claimed `round6` reinvents an existing repo primitive — verified false; it is now deduped
      _within_ the slice, which is the real (and applied) finding.
- [x] dropped · code-review · `src/__tests__/fixtures/kosztorys-sheet/*` ·
      street-name nicknames (Białostocka / Altowa / Przedpole) flagged as PII. They are the project's
      established vocabulary across `plan.md`, `AGENTS.md` and existing specs, not client identifiers.
- [x] dropped · comment-noise-audit · slice-wide ·
      the flag-only pass returned no restatement/vanished-state comments to delete; the two it trimmed
      were rewritten in place during the correctness fixes above.

## Simplify pass

Ran the simplification + `primitive-reuse-scan` pass inline (the fan-out's structural findings were
applied in the same sitting rather than deferred) — 5 applied, 0 proposed, 2 dismissed; each finding is
folded into `## Findings` above, tagged `simplify`. No separate report file: the ledger is the report.

The two dismissals are worth keeping visible, because both were confident-sounding "you reinvented a
repo primitive" claims that did not survive checking: the repo has no `groupBy` helper, and `round6`
exists only inside this slice. The real duplication in both cases was slice-internal, and that is what
was fixed.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 errors, 82 warnings, all pre-existing `db` unused-arg warnings in `src/migrations/*`.
- `pnpm exec vitest run` over the slice's trees — **80 passed / 8 files**. 9 of those are the regression
  guards authored at this gate; each of the 4 parser guards was proven **red** against the pre-fix file
  (temporarily reverted, run, restored) so the guard and the fix are both real, and the 11 pre-existing
  parser specs stayed green throughout — the footer rewrite is not a happy-path behaviour change.
- `pnpm test:e2e` — not run; the slice's browser coverage is deferred to **EX-671**.
- `pnpm build` — **cannot run in this worktree**: `node_modules` is a symlink into the main checkout and
  Turbopack refuses it (`Symlink node_modules is invalid, it points out of the filesystem root`).
  Pre-existing worktree constraint, unrelated to this diff.

## Archive gate

**Blocked — do not archive.** Every finding box is checked, but the manual checks in
`context/foundation/manual-checks.md` § `kosztorys-importer (EX-417)` have not been run: nobody has yet
watched the grid re-seed after an apply, or confirmed the pre-apply snapshot restores. EX-417 carries the
`in review` label and stays `In Progress` until those pass.
