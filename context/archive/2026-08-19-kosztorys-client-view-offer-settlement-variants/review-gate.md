# Review-gate ledger — kosztorys-client-view-offer-settlement-variants · 2026-08-20

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (all read-only, diff-scoped).

## Findings

**Trimmed at archive (2026-08-20).** Pre-trim tally: **15 fixed, 1 filed, 2 dropped,
2 dismissed · 0 open**. Every `fixed` finding is gone from this list — its durable record is
the commit that fixed it (`c7164447`), and the fix itself is now just the code, readable at
face value. What survives is the negative space git cannot hold: what was looked at and
deliberately NOT changed, and why. The one exception kept below in condensed form is the
finding that also filed an issue — a filing leaves no commit of its own.

- [x] 🔵 OBSERVATION · dismissed · code-review · `…/actions/investor-actions.tsx:47` · „a second `readSettings()` can land mid-edit and stomp the draft" — unreachable: both dialogs are modal, the menu items that call it are behind the closed dropdown, and `useLatestRequest` already makes the read latest-wins. Both dialogs re-read on open by design.
- [x] fixed · module-cohesion · `…/editor/hooks/use-kosztorys-settings.ts` · the staged-confirm machinery (state + the whole `investorImpactConfirm` props block) was about to exist twice — once for the two trybs rozliczenia, once for the variant flip. Extracted `useInvestorImpactConfirm()`; `use-client-view-mode-confirm.ts` is now a thin policy wrapper over it.
- [x] fixed · structure-scatter · `src/lib/kosztorys/investor-impact.ts` (new) · `INVESTOR_IMPACT_TITLE` and the impact strings were module-private to a hook while a second home needed them. Promoted to one React-free module beside the other kosztorys logic — the wording can no longer drift between the controls that raise the dialog.
- [x] fixed · module-cohesion · `src/lib/kosztorys/investor-impact.ts:13` · the `'OFFER' | 'SETTLEMENT'` union was re-declared inline. Now `Record<ClientViewModeT, string>`, so a third variant fails the typecheck instead of silently missing a message.
- [x] fixed · feature-first-structure · `src/lib/kosztorys/client-view-settings.ts:15,113` · `CLIENT_VIEW_MODES` and `sameClientViewSettings` were exported but consumed only inside the module. Unexported (dead-export removal gated on `pnpm typecheck`, not grep).
- [x] fixed · comment-noise · `…/hooks/use-kosztorys-settings.ts:24` · header comment orphaned by the extraction — it described constants that had moved. Deleted.
- [x] fixed · comment-noise · `src/lib/queries/kosztorys-client-view.ts` · comment above `getClientViewSettings` restated the one-line body. Deleted. The `clientViewSettingsForMode` comment trimmed to the one fact code can't say („the only place the active variant is picked").
- [x] fixed · impl-review · `change.md`, `plan-brief.md` · doc drift — three decision rows still described the pre-fix behaviour (inline warning banner instead of the confirm dialog; defaults writing the firm mode; the mixed add+drop migration). Rewritten; the three deviations also recorded in `plan.md` under „Odstępstwa od planu".
- [x] dropped · comment-noise · 7 sites across the diff · „would-trim" leads on comments that carry real rationale (why `overrideAccess` must stay on, why both reads are issued at once, why the hidden set is stored rather than the visible one). They pass the STRIP TEST — deleting them loses the reason. Not worth the churn.
- [x] dropped · impl-review · `plan.md` · cosmetic mismatches between the plan's prose and what shipped (`_1_` vs `_0_` in the migration filename, „varchar" where the column is a pg enum). Real but purely cosmetic in a document being archived.
- [x] dismissed · tailwind-v4-audit · — · no findings: the diff adds no arbitrary values, no `var(--x)` in brackets, no dynamic class names; `ToggleGroup` and `Description` are existing `components/ui` primitives.
- [x] filed EX-721 · deferred · gate-step-3 · `e2e/` · browser-level obligation for this slice: variant flip → confirm dialog appears only on a real change → cancel writes nothing → `/k/:token` serves the new variant cookie-less → „Zapisz jako domyślne" leaves the other variant and the firm mode alone. Out of scope to author now (E2E runs are ~1h and were not requested).
      test: e2e — multi-boundary (client dialog → server action → public route); disposition recorded in the issue so the guard travels with the work.

## Simplify pass

Ran `/simplify` — 6 applied, 0 proposed, 1 dismissed; every finding folded into `## Findings` above
(tagged `module-cohesion` / `structure-scatter` / `feature-first-structure` / `comment-noise`), no
separate list. Applied in-thread rather than via a temp report: the mutating pass ran against the
already-triaged fan-out, and the dedup it produced (`useInvestorImpactConfirm`,
`src/lib/kosztorys/investor-impact.ts`) is in the diff the tests below cover. Second read of the
untouched-by-triage files (`collections/kosztorys-client-view.ts`,
`globals/kosztorys-client-view-defaults.ts`, `client-view-settings-form.tsx`,
`client-view-settings-endpoint.ts`, `investor-actions.tsx`) surfaced nothing further; the dead
`client-view-mode-warning.tsx` was deleted rather than left orphaned.

## Tests & suite

- `pnpm typecheck` — clean.
- ESLint on the 13 touched source files — clean; prettier applied.
- `src/__tests__/lib/actions/kosztorys-client-view-defaults.test.ts` — 3 passed (new, DB).
- `src/__tests__/lib/kosztorys/client-view-settings.test.ts` — 12 passed.
- `src/__tests__/lib/queries/kosztorys-client-view.test.ts` — 6 passed (DB).
- kosztorys share-token specs — 3 passed.
- `pnpm test:e2e` — not run (never run unprompted; the browser-level risk is filed as EX-721).
- Full suite (`lint` + `test` + `build` over the whole tree) — offered to the user at close-out.

_Condensed from a trimmed `fixed` finding (it filed an issue, so nothing else records it):_
the additive migration leaves `hidden_columns` / `hide_empty_rows` alive in prod; the DROP is a
separate migration owed **after** this deploy is live — **EX-722**. Rationale distilled into
`context/foundation/lessons.md`.
