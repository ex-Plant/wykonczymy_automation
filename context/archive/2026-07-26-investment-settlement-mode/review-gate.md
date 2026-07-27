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

- [x] 🟡 WARNING · filed EX-589 · impl-review · `src/lib/kosztorys/reconciliation.ts` · `GROSS` mode + legacy untagged (`vatPlane = null`) wpłaty makes the scream fire on the entire deposit total, permanently and unclearably — `vatPlane` is create-only. The plan sanctioned the null→netto conflation, so this is a flaw in the rule, not a deviation. Fix widens `bucketDepositsByPlane`'s `DepositPlaneSumsT`, which has other readers.
      test: test-driven-debugging · unit — recorded on EX-589; the repro is a pure call once a `paidUnmarked` bucket exists.
- [x] 🟡 WARNING · filed EX-590 · code-review · `src/components/kosztorys/summary/settlement-mode-select.tsx:28` · `disabled={vatRate === 0}` was carried over from the deleted localStorage axis picker; it now freezes **persisted** state, so a `GROSS`/`MIXED` investment whose VAT is later zeroed is strandable with no edit surface but the Payload admin. Also `MIXED` is not the no-op `ZeroVatWarning` claims. The correct behaviour is a product call, not a mechanical fix.
      test: test-driven-debugging · unit — recorded on EX-590; assert `MIXED` vs `NET` project differently at `vatRate: 0`.
- [x] 🔵 OBSERVATION · filed EX-591 · code-review · `use-kosztorys-editor.ts:298` · `isHidden` (per-browser `table-columns:kosztorys`) is still applied under `clientView`, so an owner who unticked „Wartość brutto" sees a money-less client-preview grid on a `GROSS` investment. Preview fidelity, not client-facing — a real client degrades to `DEFAULT_HIDDEN_COLUMNS`.
      test: no automated test at the unit layer — browser-level (localStorage × route); recorded on EX-591 for the client-preview E2E.
- [x] 🔵 OBSERVATION · skipped · code-review + simplify(efficiency) · `use-kosztorys-editor.ts:1031` · the mode flip has no optimistic state, so the controlled `SimpleSelect` lags a full `router.refresh()`. Its siblings patch **rows**, which works only because `vatRate`/coeffs are denormalized per row; `settlementMode` rides the tree, which is a server prop with no local mirror. Adding one is behaviour-changing and uncertain — not auto-applied.
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
