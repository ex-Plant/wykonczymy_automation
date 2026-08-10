# Review-gate ledger — consolidated branch `46183ca3..HEAD` · 2026-08-10

Unit of work: the consolidated temporary branch, 16 commits / 44 files, spanning
EX-534, EX-635, EX-641, EX-643, EX-645, EX-646, EX-647, EX-648. Reviewed in an isolated
worktree (`.claude/worktrees/slice-review-consolidated`, branch `review/consolidated-gate`)
so the main worktree stays free.

No single `change.md` covers the range, so this ledger takes the `.review-gate/` fallback
path rather than a change folder.

Step 0.5 (browser verification pass) skipped — no `verify-manual-checks` skill installed.
Fan-out: all seven checks applied, none dropped.

## Findings

- [x] 🟡 WARNING · fixed · `code-review`+`impl-review` · `src/components/forms/expense-form/use-receipt-generation.ts:64-124` · `.finally()` re-throws, so on a rejecting scan `setFailedIds` / `setIsGenerating(false)` / `setGenerationProgress(null)` were all skipped — `isGenerating` stuck true forever, the form wedged (scan button, per-row remove and add-row stayed disabled) with no pill and no error toast, and the rejection escaped unawaited as an unhandled rejection. Both bug-finding checks found this independently; confirmed by direct read + `map-with-concurrency.ts:3-4` ("a rejecting `fn` rejects the whole call"). The `9c1b223f` fix stopped one step short, and its comment asserted only the pill half. **Fix:** the whole loop moved into `try/catch/finally`; the `catch` logs + toasts so an escaped error stays a visible failure.
      test: test-driven-debugging · e2e — filed EX-655. No DOM/hook harness in the repo (no `jsdom`, no `@testing-library/react`), so `isGenerating` is unreachable from a Vitest spec; the behaviour is browser-level anyway.
- [x] 🟡 WARNING · fixed · `code-review` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` `saveSetting` (key at `:127`) · all four „Opcje rozliczenia" writes shared one module-level `SETTINGS_PENDING_KEY`, so changing VAT then tryb before the first landed made the first `finally` clear the pill while the second write was still on the wire — verbatim the case `pending-store.ts:9-11` cites as the reason the store is keyed rather than boolean. `impl-review` filed the same thing as an OBSERVATION calling it a plan limitation; `code-review`'s read wins — the plan being wrong is not a reason to ship the bug. **Fix:** `` `${SETTINGS_PENDING_KEY}:${label}` ``, and `label` is already unique per setting.
      test: TDD · e2e — filed EX-656. The store-level guarantee is already covered by `pending-store.test.ts`; what's unasserted is the editor passing distinct keys, which needs the editor rendered.
- [x] 🔵 OBSERVATION · fixed · `code-review`+`impl-review` · `src/lib/kosztorys/insert-kosztorys-tree.ts:32-43` · `liveWorkerIds` took no row lock, so a user hard-deleted between the SELECT and the stage INSERT still met the FK and aborted the whole restore — the EX-641 symptom, narrowed but not closed. **Fix:** `FOR SHARE` on the SELECT; the id set is bounded by etap count.
      test: no automated test · — reproducing needs two interleaved transactions against a live FK; the harness cost dwarfs the one-clause fix, and the existing DB spec already covers the deleted-worker path
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:55-61` · the warning said „pracownik został usunięty" (singular) while `droppedWorkerAssignments` counts _etapy_ (`insert-kosztorys-tree.ts:17-19`) — factually wrong when three etapy span two deleted people. **Fix:** the cause clause is now number-free („nie odtworzono przypisań do usuniętych pracowników"), so it holds for any headcount.
      test: no automated test · — user-facing copy, cheaper to read than to assert
- [x] fixed · `code-review`+`comment-noise`+`impl-review` · `src/components/forms/form-fields/cash-register-field.tsx` + `entity-combobox-field.tsx` · the same `(state as { values: Record<string,string> }).values[name]` double-cast through `unknown`, duplicated verbatim along with its two-line comment. **Fix:** extracted to `forms/hooks/use-field-value.ts`, which carries the cast and the flat-key caveat once.
- [x] fixed · `structure-scatter` · `src/components/forms/expense-form/{use-invoice-files,use-receipt-generation}.ts` · EX-645 split one flow across two homes: both hooks are expense-form-only (verified at the base commit too) yet sat in the cross-form `forms/hooks/`, while the new `use-invoice-ingest.tsx` correctly colocated. **Fix:** both `git mv`d into `expense-form/`, two import sites updated. (`feature-first` read this as the branch _reducing_ scatter; scatter-audit's base-commit evidence is better and wins.)
- [x] 🟡 WARNING · fixed · `impl-review` · `context/archive/2026-07-27-kosztorys-section-footer-row/` · commit `8fb3b65e` **deleted** EX-607's `plan.md` (443 lines) and `plan-brief.md` (102) instead of archiving them. AGENTS.md permits deleting "only pure scaffolds with zero unique rationale"; 545 lines is not that. **Fix:** both restored from `8fb3b65e^` into the archive folder.
- [x] fixed · `code-review` · `.gitignore:96-98` · unanchored `test.js` ignored _any_ `test.js` at any depth for every contributor, permanently — a later legitimate fixture would vanish from `git status` with no obvious cause. **Fix:** anchored to `/test.js` (the root file it targets is still ignored — verified).
- [x] fixed · `comment-noise` · 1 rewrite + 6 trims · vanished-state openers and body-narration leftovers: `__tests__/helpers/kosztorys-db-tree.ts:4`, `use-invoice-ingest.tsx:37` and `:76`, `use-kosztorys-editor.ts:847`, `serialize-restore-roundtrip.test.ts:180`, `restore-duplicate-display-order.test.ts:37`, `expense-form.tsx:79`. Each kept its real _why_; only the restatement went.
- [x] fixed · `impl-review` · `src/lib/kosztorys/apply-preset.ts:20-24` · `droppedWorkerAssignments` is discarded on the preset path. Unreachable today — `serialize-preset.ts` hard-codes `stages: []` — but nothing enforces that invariant and the comment at `:12-13` anticipates extension. **Fix:** one comment recording _why_ the discard is safe, so a future stages-carrying preset trips over the reason.

- [x] partly fixed, rest accepted · `code-review` · `sheet-setup-dialog.tsx:66`, `stage-header.tsx:172`, `save-preset-dialog.tsx:95`, `line-items-field.tsx:261`, `file-input.tsx:128` · the EX-647 `Description` adoption renders an `Info`/`TriangleAlert` glyph at five sites that previously had none (`withIcon` defaults true; pre-existing no-icon sites pass `withIcon={false}` explicitly — verified). Resolved per site from the layout rather than by eyeball:
      · **fixed** — `line-items-field.tsx:261` gets `withIcon={false}`. It sits in `flex items-start gap-2` holding Kwota (`w-28`) + optional Netto (`w-28`) + Opis (`flex-1`) + optional kategoria (`flex-1`) + a `size-9` delete slot, and the note is `shrink-0 whitespace-nowrap` — so a glyph's ~1rem comes straight off the two `flex-1` inputs on a narrow viewport. `tone="error"` already carries the alarm.
      · **accepted** — the other four. `file-input.tsx:128` is a full-width inline error under a field (`TriangleAlert` is what it wants; `role="alert"` preserved, and `<div>`→`<p>`, both block, changes no layout); the three dialog/menu notes are full-width blocks with room for the glyph. The icon IS the primitive's default, so rendering it is what "adopt `Description`" buys — cheap to reverse per site with `withIcon={false}` if the owner dislikes it.
- [x] fixed · `feature-first` · `src/components/forms/pending-submit-indicator.tsx` + `submit-pill.tsx` → `src/components/ui/` · the indicator is not a forms component: mounted once in `(frontend)/layout.tsx`, and this branch made it read a store the _kosztorys editor_ raises. The two audits disagreed on the destination (`components/ui/` vs a shell/nav home); repo evidence settles it — its sibling in that same layout slot, `EnvBadge`, lives in `components/ui/`, and `components/nav/` holds navigation chrome (sidebar, top-nav, footer, crumb), which a save pill is not. `SubmitPill` moved with it: props-in / portal-out, no store and no form knowledge — a textbook `ui/` primitive.

- [x] fixed · `reuse-scan` · `src/components/dialogs/sheet-setup-dialog.tsx:70-77` · EX-647 adopted `Description` at `:66` but left its immediate sibling — same `text-muted-foreground text-xs` note — as a raw `<p>`. **Fix:** migrated to `<Description size="xs" withIcon={false}>`; `withIcon={false}` keeps the rendering byte-identical, so it does not join the open icon question below.
- [x] dropped · `reuse-scan` · repo root · the skill asks for a `.reuse-scan.json` primitive-homes map on first run. Not created: a durable repo-config dotfile has no business landing on a throwaway review branch, and AGENTS.md is the canonical home if it is ever wanted.

- [x] dismissed · `code-review`+`module-cohesion`+`impl-review` · `use-kosztorys-editor.ts:155,207,215` · three `eslint-disable react-hooks/refs` directives dropped inside the pending-store commit with no explanation. Independently verified benign by two agents — `eslint-plugin-react-hooks@7.0.1` reports zero problems on the file; the directives were stale. Blank-line residue folded into the comment-noise fix.
- [x] dismissed · `module-cohesion` · `use-kosztorys-editor.ts` (1349 LOC) · god module by size, real seams — but pre-existing and already tracked as consciously-deferred debt under EX-515 ("cohesive stateful unit, needs a test harness first"). The branch's net effect on the file is a shrink. Re-filing would manufacture duplicate backlog.
- [x] dismissed · `impl-review` · `src/stores/pending-store.ts:28-30` · `firstPendingLabel` exported from the store rather than living in the indicator's selector, contra the plan. The export is what the spec asserts against — better than planned, not drift.
- [x] dismissed · `impl-review` · `serialize-apply-preset.test.ts:226-302` · four standalone `payload.create` calls migrated beyond the plan's stated "each `beforeAll`" scope. Rows verified identical field-by-field; scope creep in the consistent direction.
- [x] dismissed · `code-review` · `pending-store.ts:28-30` + `pending-submit-indicator.tsx:14-18` · oldest-label-wins means a scan in flight keeps the pill while a later optimistic save goes unacknowledged. Both are genuinely in flight and the label is not a lie — deliberate design, benign.
- [x] dismissed · `comment-noise` · `restore-deleted-worker.test.ts:12` · near-verbatim copy of `insert-kosztorys-tree.ts:23`, but it ends on a different why (justifying the _test layer_: a mocked insert would accept the dangling id). Earns its bytes.
- [x] dismissed · `tailwind-v4-audit` · whole diff · zero findings — no arbitrary values, no `var(--token)` in brackets, no inline styles, no responsive variants touched. The diff moved _toward_ the v4 target state.

- [x] dropped · `impl-review` · `src/components/forms/pending-submit-indicator.tsx:16,18` · `!label` (falsy) vs `label ?? …` (nullish) use different emptiness notions, so `start(key, '')` would never render. No caller does this; guarding it would add a branch for a hypothetical.
- [x] dropped · `impl-review` · `__tests__/helpers/kosztorys-db-tree.ts:92,94` · `wToolsOverrideValue ?? 0` / `ownToolsOverrideValue ?? 0` coerce an explicitly-passed `null` to `0` on nullable columns. No spec passes null there; the other 16 defaults honour the plan's null-survival rule. Latent asymmetry, not a defect.
- [x] dropped · `structure-scatter` · `__tests__/helpers/kosztorys-db-tree.ts` · shared domain noun with the sibling `kosztorys-tree.ts`. The file's own header already disambiguates the two, and `db` is an established marker in this repo (`*.db.test.ts`). A rename would erase a ~1-second hesitation at the cost of real churn — the audit itself dropped it rather than proposing it.
- [x] dropped · `feature-first` · `src/components/forms/hooks/` · holding expense-only hooks is a competing home that predates the branch. Superseded by the fix-now scatter finding above, which resolves it properly rather than recording it twice.

## Simplify pass

Ran the mutating pass directly in the main thread (the built-in `/simplify` is a user-invoked
command, not agent-callable) plus `primitive-reuse-scan` diff-scoped — 11 applied, 1 dropped,
2 open; each finding folded into `## Findings` above (tagged `simplify` / `reuse-scan`). No
separate report.

Reuse-scan catalogue check: `stores/pending-store.ts` reinvents nothing (no existing pending/
submitting flag anywhere in `src/stores`); `lib/utils/is-active-ref.ts` and the two test-tree
helpers were already triaged above. `.reuse-scan.json` deliberately **not** created — a durable
repo-config dotfile does not belong on a throwaway review branch; AGENTS.md is its home if it
is ever wanted.

## Tests & suite

- `pnpm typecheck` — **pass** (clean; needed `pnpm generate:importmap` first, since the generated
  import map is gitignored and absent from a fresh worktree). Re-run clean after the two open
  findings were closed.
- `pnpm lint` — **pass**, 0 errors / 80 pre-existing warnings (all `no-unused-vars` in migrations
  and scripts, none in touched files). Touched files also run through `prettier --write`.
- `pnpm exec vitest run src/__tests__/stores/pending-store.test.ts src/__tests__/lib/utils/is-active-ref.test.ts`
  — **11 passed**. Scoped to the non-DB specs covering touched code.
- Full suite (`test` / `test:integration` / `test:e2e` / `build`) — **not run**: the DB-backed legs
  share the 5435 `db-test` container with the parallel session in the main worktree. Owed before
  archive, on the user's go.
