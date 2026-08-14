# Review-gate ledger — 2026-08-11-kosztorys-importer · 2026-08-11

Slice S-15 `kosztorys-importer` (EX-417). Scope: 7 modified + 23 new files under `src/`.
Step 0.5 (verification pass) skipped — no `verify-manual-checks` skill installed in this workspace.

Fan-out: `/10x-impl-review` · `/code-review` · `tailwind-v4-audit` · `feature-first-structure` ·
`module-cohesion-audit` · `structure-scatter-audit` (diff-scoped) · `comment-noise-audit` (flag-only).

**Przycięte przy archiwizacji (2026-08-14).** Znaleziska `fixed` zostały usunięte z listy poniżej:
ich trwałym zapisem jest commit, który je naprawił, plus regression guard przy każdym z nich. Zostaje
to, czego git nie niesie — decyzje o *nierobieniu*: `dismissed`, `dropped`, `filed`. Bilans sprzed
przycięcia: **26 fixed, 2 dismissed, 3 dropped, 1 filed · 0 open.**

Trzy z przyciętych zostawiam w jednej linii, bo niosą coś poza samą poprawką:

- 🔴 CRITICAL — arkusz bez czytelnego cennika przepuszczał import, który wpisywał **płaskie 0 zł**
  stawki podwykonawcy na każdą pracę. W edytorze taka liczba wygląda na decyzję, nie na awarię, więc
  cicho kasowała marżę. Teraz import **odmawia** — brak cennika to nie jest stan, z którego da się
  wyprodukować kosztorys.
- 🔴 CRITICAL — migawka „przed importem" była brana jako `kind: 'auto'`, czyli **import nie był
  odwracalny w aplikacji**: w „Wersjach" renderowała się jako bezimienne „Auto" + znacznik czasu wśród
  autozapisów, i podlegała limitowi `AUTO_KEEP = 50` oraz 7-dniowemu GC. Nazwana migawka manualna to
  jedyna forma, w której cofnięcie złego importu faktycznie istnieje.
- Zawężenie do OWNER/ADMIN **zostało cofnięte decyzją właściciela**: każda inna mutacja kosztorysu —
  włącznie z `restoreSnapshotAction`, który podmienia całe drzewo tak samo — siedzi na
  `MANAGEMENT_ROLES`, a nic w `src/components/kosztorys/` nie bramkuje po roli. Zawężenie niczego więc
  nie chroniło, a ukrywało funkcję przed rolą, która prowadzi budowy na co dzień.

## Findings

- [x] filed · impl-review · `e2e/` · the browser-level path (menu gating → preview → confirm → re-seed →
      snapshot restore) has no automated proof; the unit layer covers everything below the plan builder.
      Deferred rather than authored because the seam needs a stubbed Sheets client in the Playwright
      harness, which is its own piece of work — filed **EX-671** (`e2e-backlog`).
      test: e2e — the risk and the injection seam are written into the issue.
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
- [x] dropped · post-gate · `src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx` ·
      the plan wanted the menu item **disabled with a reason** on an investment with no linked sheet; what
      shipped shows it enabled and refuses inside the dialog with „Inwestycja nie ma kosztorysu.". Closing
      the gap needs a fresh `getInvestmentSheetId` round-trip on every kosztorys page load plus the exact
      prop chain just deleted — not worth it for one extra click to the same Polish sentence.
      `manual-checks.md` now describes the shipped behaviour.

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

Zarchiwizowane 2026-08-14 z **niezaznaczonymi** checkami manualnymi w `context/foundation/manual-checks.md`
§ `kosztorys-importer (EX-417)` — od 2026-07-28 checki manualne i E2E **nie blokują** archiwizacji.
EX-417 zostaje `In Progress` z tagiem `[in review]`, dopóki ktoś ich nie przejdzie; to one, nie folder
zmiany, są otwartym zobowiązaniem.
