# Review-gate ledger — investment-settlement-mode · 2026-07-26

Base: `744aacfe` (staging). Linear: **EX-588**.
Step 0.5 (browser verification pass): **skipped by user** — the 11 manual checks in
`context/foundation/manual-checks.md` (`## EX-588`) stay unticked and remain an archive blocker.

Checks that ran (Step 1, read-only, in parallel): `/10x-impl-review`, `/code-review` (manual
equivalent — the built-in slash command is `disable-model-invocation`), `tailwind-v4-audit`,
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`
(flag-only). Step 2 (serial, mutating): `/simplify` 4-angle fan-out + `primitive-reuse-scan`.

## Findings

- [ ] blocker · verify · `context/foundation/manual-checks.md` `## EX-588` · all 11 manual checks unticked — Step 0.5 was skipped by the user, and the slice's central claims (client sees the owner's stored plane from a second browser profile; grid and panel agree; the warning is owner-only) have **no automated coverage at all**. Archive is blocked until these are driven.
      test: no automated test — the plan explicitly declined an E2E; these 11 boxes are the only evidence that will exist.

- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/collections/investments.ts:116` · field lacked `required: true` while the column is `NOT NULL DEFAULT 'NET'` — clearing the select in `/admin` wrote `null` and surfaced as a raw pg constraint 500 instead of a field error, plus permanent `migrate:create` drift. Added `required: true`; the typegen ripple forced `settlementMode: 'NET'` at 12 `payload.create` sites + 2 seed scripts (precedent: `cash_registers.type`).
      test: no automated test — the guard is Payload validation config, not app code; `tsc` + the 1707-test suite are the signal. The recurring fixture tax it exposed is filed as EX-592.
- [x] 🟡 WARNING · filed EX-589 · impl-review · `src/lib/kosztorys/reconciliation.ts` · `GROSS` mode + legacy untagged (`vatPlane = null`) wpłaty makes the scream fire on the entire deposit total, permanently and unclearably — `vatPlane` is create-only. The plan sanctioned the null→netto conflation, so this is a flaw in the rule, not a deviation. Fix widens `bucketDepositsByPlane`'s `DepositPlaneSumsT`, which has other readers.
      test: test-driven-debugging · unit — recorded on EX-589; the repro is a pure call once a `paidUnmarked` bucket exists.
- [x] 🟡 WARNING · filed EX-590 · code-review · `src/components/kosztorys/summary/settlement-mode-select.tsx:28` · `disabled={vatRate === 0}` was carried over from the deleted localStorage axis picker; it now freezes **persisted** state, so a `GROSS`/`MIXED` investment whose VAT is later zeroed is strandable with no edit surface but the Payload admin. Also `MIXED` is not the no-op `ZeroVatWarning` claims. The correct behaviour is a product call, not a mechanical fix.
      test: test-driven-debugging · unit — recorded on EX-590; assert `MIXED` vs `NET` project differently at `vatRate: 0`.
- [x] 🟡 WARNING · fixed · impl-review (F3) · `src/components/kosztorys/summary/settlement-plane-warning.tsx` · a third scream affordance was cloned from `ZeroVatWarning` instead of reusing one. Extracted `src/components/ui/warning-banner.tsx`; both warnings now render through it.
- [x] 🟡 WARNING · fixed · impl-review (F4) · `src/components/kosztorys/editor/use-kosztorys-editor.ts:154` · the "grid can't disagree with the panel" comment read as an unconditional guarantee, but the owner branch still resolves from `useMoneyAxis`. Amended to state the guarantee is client-side only and the owner's „Kwoty" pick is deliberately a per-person column preference.
- [x] 🔵 OBSERVATION · fixed · impl-review (F5) + code-review · `use-kosztorys-editor.ts:1031` · a mode flip was not on the undo stack, unlike all three sibling investment settings — Ctrl+Z silently reverted an unrelated edit. Now `pushReversible('Zmiana sposobu rozliczenia', …)`.
- [x] 🔵 OBSERVATION · fixed · impl-review (F6) · `src/collections/investments.ts` · admin select options were Polish-only while every sibling select uses `{ en, pl }`. Added `SETTLEMENT_MODE_ADMIN_OPTIONS`; the panel keeps the pl-only list.
- [x] 🔵 OBSERVATION · filed EX-591 · code-review · `use-kosztorys-editor.ts:298` · `isHidden` (per-browser `table-columns:kosztorys`) is still applied under `clientView`, so an owner who unticked „Wartość brutto" sees a money-less client-preview grid on a `GROSS` investment. Preview fidelity, not client-facing — a real client degrades to `DEFAULT_HIDDEN_COLUMNS`.
      test: no automated test at the unit layer — browser-level (localStorage × route); recorded on EX-591 for the client-preview E2E.
- [x] 🔵 OBSERVATION · skipped · code-review + simplify(efficiency) · `use-kosztorys-editor.ts:1031` · the mode flip has no optimistic state, so the controlled `SimpleSelect` lags a full `router.refresh()`. Its siblings patch **rows**, which works only because `vatRate`/coeffs are denormalized per row; `settlementMode` rides the tree, which is a server prop with no local mirror. Adding one is behaviour-changing and uncertain — not auto-applied.
- [x] fixed · cohesion + scatter + placement · `src/lib/kosztorys/money-axis.ts` · the file carried two concepts under one name, and the settlement half dragged `column-config` into the Payload CLI graph via `collections/investments.ts`. Extracted `src/lib/kosztorys/settlement-mode.ts`; this also makes the spec filename mirror a real source file, closing the scatter audit's finding in the same stroke.
- [x] fixed · cohesion · `src/components/kosztorys/summary/kosztorys-totals-panel.tsx` · a layout shell had absorbed the settlement control with its own business rules. Extracted `settlement-mode-select.tsx` (owns the options, the `Description` copy, the VAT-0 rule and the `ZeroVatWarning` pairing). The verdict computation stays in the panel — its inputs are already there.
- [x] fixed · cohesion (nit) · `settlement-plane-warning.tsx` · value→label lookup over an options array with an `?.` that could render `Rozliczenie: undefined`. Replaced with `settlementModeLabel()` over a `Record`.
- [x] fixed · scatter · `src/__tests__/lib/kosztorys/settlement-mode.test.ts` · the spec split `reconciliation.ts`'s coverage across two homes and was named for a concept with no source file. The verdict block moved to `reconciliation.test.ts`; the projections block stays, and now mirrors the extracted `settlement-mode.ts`.
- [x] fixed · comment-noise · 10 files · 7 comments deleted, 7 trimmed — dominated by one ruling ("the mode is stored on the investment") restated at five sites, plus a textbook vanished-state tail (`it used to be a localStorage…`) in `collections/investments.ts`. Kept the canonical copy at `SETTLEMENT_MODES`.
- [x] fixed · reuse-scan · `src/lib/kosztorys/settlement-mode.ts:13` · a second, unlinked NET/GROSS enum + Polish label table beside the existing `VAT_PLANES` / `VAT_PLANE_LABELS` (`src/lib/constants/transfers.ts:352`) — while `buildSettlementPlaneVerdict` compares the mode against buckets derived from `vatPlane`. Now `SETTLEMENT_MODES = [...VAT_PLANES, 'MIXED']`, `SettlementModeT = VatPlaneT | 'MIXED'`, pl labels sourced from `VAT_PLANE_LABELS`.
- [x] fixed · simplify + reuse-scan · `src/lib/kosztorys/settlement-mode.ts:43` · both projections were if-chains with a fallthrough default, in a file whose own comment argues a `Record` makes a missing mode a compile error. Converted to `PANEL_AXIS_BY_MODE` / `GRID_AXIS_BY_MODE`.
- [x] fixed · simplify(altitude) · `src/lib/kosztorys/reconciliation.ts:61` · the view re-derived the offending plane with a two-branch ternary over a three-value mode, correct only because the builder forces `offendingAmount = 0` for `MIXED` in another module. `SettlementPlaneVerdictT` now carries `offendingPlane: VatPlaneT | null`; the warning renders it (and returns `null` when there is none). Spec updated.
- [x] fixed · simplify(altitude) · `kosztorys-editor-body.tsx:299` + `kosztorys-totals-panel.tsx:91` · read-only was encoded twice — `clientView` **and** a nulled `onSettlementModeChange` — so a caller passing both would have compiled into an editable select in the client share view. Handler is now required; the panel gates on `!clientView` like every other owner-only affordance.
- [x] fixed · simplify · `kosztorys-totals-panel.tsx:144` · `displayAxis` hand-rolled `mixed → both`, a second mode→`MoneyAxisT` mapping reached via a `PanelAxisT` detour. Now `settlementModeToGridAxis(settlementMode)` — the same projection the grid uses.
- [x] fixed · simplify · `src/lib/queries/kosztorys.ts:151` · `?? SETTLEMENT_MODE_DEFAULT` became dead once `required: true` made the generated type non-optional against a `NOT NULL` column. Removed with its import.
- [x] fixed · simplify + reuse-scan · `settlement-mode-select.tsx:11` · `SETTLEMENT_SELECT_OPTIONS` was a single-use alias that also widened the `value` literal union to `string`. Deleted.
- [x] fixed · reuse-scan · `settlement-mode.test.ts:27`, `reconciliation.test.ts:298` · two "for any mode" guards iterated a hardcoded `['NET','GROSS','MIXED']`, so a mode added later would not be covered. Both iterate `SETTLEMENT_MODES`.
- [x] filed EX-592 · reuse-scan · `src/__tests__/**` · no shared `makeTree()` / `createTestInvestment()` — one new investment field taxed 6 tree-literal specs + 12 `payload.create` sites + 2 seed scripts. A 15-file fixture refactor, review-worthy on its own and unrelated to this slice's behaviour.
- [x] filed EX-593 · reuse-scan · `src/lib/actions/kosztorys.ts:152` · `updateInvestmentSettlementModeAction` is the 4th verbatim copy of the investment-setting action body. A factory must preserve each action's perf-log name and its deliberately narrow cache-tag list — a generalization deserving its own review, not a mechanical dedup.
- [x] skipped · simplify(efficiency) · `use-kosztorys-editor.ts:154` · `useMoneyAxis()` stays mounted under `clientView` where its value is now unused, costing a per-render `localStorage.getItem` on the public share route. Unmounting it means a conditional hook or a restructure of the editor hook (EX-515 territory) — not auto-applied.
- [x] dismissed · placement · `money-axis.ts` constants → `constants.ts` · superseded: the cohesion extraction moved them to `settlement-mode.ts`, which also removes the `column-config` leak that was this finding's second motive.
- [x] dismissed · cohesion · `src/lib/kosztorys/reconciliation.ts` · two verdict families in one 108-LOC module. Both answer the file's one question; the trigger to split is a third family. Watch item, not a defect.
- [x] dismissed · cohesion · `src/lib/actions/kosztorys.ts` (637 LOC) and `use-kosztorys-editor.ts` (1248 LOC, EX-515) · pre-existing god modules; this slice added one action beside its siblings and net-simplified the editor's axis derivation. Not worsened.
- [x] dismissed · code-review · access control, Zod derivation, cache tags, migration up/down, `buildSettlementPlaneVerdict` null-safety, post-hook-removal React derivation, dead-reference sweep · all verified benign, in detail, against the source.
- [x] dismissed · simplify · `src/lib/actions/investments.ts:53` · the explicit `settlementMode: SETTLEMENT_MODE_DEFAULT` looks redundant against the collection `defaultValue`, but `required: true` makes it mandatory in the generated create-data type. Load-bearing for `tsc`.
- [x] dropped · tailwind-v4-audit · repo-level · zero findings in the diff; the audit's only actionable item is that no Tailwind-aware ESLint plugin is wired, so arbitrary values are invisible to CI. A repo-infra suggestion, not a finding against this slice.
- [x] dropped · code-review · `src/lib/kosztorys/snapshot-format.ts:28` · `SnapshotSettingsT` omits `settlementMode`, so a restore leaves it untouched — consistent with `globalDiscount`'s deliberate exclusion, and the mode shapes no stored price.
- [x] dropped · code-review · `use-kosztorys-editor.ts:758` · `settlementMode` threaded into `treeToRows` purely to satisfy `KosztorysTreeT`; harmless type-satisfaction.
- [x] dropped · simplify · `use-kosztorys-editor.ts:161` · the 4-deep `effectiveMoneyAxis` ternary. Pre-existing shape with one branch swapped; hoisting it to a helper trades nesting for indirection and the comment above it already carries the reasoning.
- [x] dropped · simplify · `settlement-mode.ts:31` · three exports off one label record. `SETTLEMENT_MODE_OPTIONS` and `SETTLEMENT_MODE_ADMIN_OPTIONS` serve two genuinely different consumers (pl-only UI select vs the admin's bilingual shape) off a single source record.
- [x] dropped · simplify · `kosztorys-totals-panel.tsx:215` ↔ `summary-overview-tab.tsx:66` · the `mixed → both` collapse is derived in both. Collapsing it means reshaping the tab's props for one ternary; both read the same single source.
- [x] dropped · reuse-scan · seed scripts + 12 test sites spell the literal `'NET'` rather than `SETTLEMENT_MODE_DEFAULT` · matches the sibling `status: 'active'` literal style in the same object; the structural fix is EX-592.

## Simplify pass

Ran `/simplify` (4-angle fan-out: reuse, simplification, efficiency, altitude) + `primitive-reuse-scan`
— **9 applied, 0 proposed-open, 2 filed (EX-592, EX-593), 5 dropped, 1 dismissed, 1 skipped**; every
finding is folded into `## Findings` above (tagged `simplify` / `reuse-scan`). No separate report file
— this ledger is the single source of truth. `.reuse-scan.json` already carried the primitive-home map.

## Tests & suite

| Leg | Result |
| --- | --- |
| `pnpm exec tsc --noEmit` | **0 errors** |
| `pnpm lint` | **0 errors**, 85 warnings (all pre-existing `db` unused-arg in `src/migrations/*`) |
| `pnpm test` | **1707 passed / 57 skipped** (122 files) |
| `pnpm exec vitest run …/reconciliation.test.ts …/settlement-mode.test.ts` | **21/21 passed** (incl. the 3 new `offendingPlane` asserts) |
| `pnpm test:e2e` | **not run** — the plan declined an E2E for this slice; no browser spec was added |
| `pnpm test:integration` | **not run** — needs the 5435 `db-test` container; the 12 touched DB specs skipped locally |
| `pnpm build` | **not run** — `tsc` + `lint` cover the code planes; no build-time config changed |

New/changed specs this pass: 3 `offendingPlane` assertions in `reconciliation.test.ts`, and two
"for any mode" guards switched from a hardcoded list to iterating `SETTLEMENT_MODES`.
