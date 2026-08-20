# Review-gate ledger — kosztorys-client-view-offer-settlement-variants · 2026-08-20

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (all read-only, diff-scoped).

## Findings

- [x] 🔴 CRITICAL · fixed · code-review · `src/lib/actions/kosztorys-client-view.ts:58` · „Zapisz jako domyślne" wrote the firm-wide `mode` into the global — one button, pressed while looking at ONE investment, flipped what every investment without its own row serves on its live client link. Now the action writes only `variants[mode]`; `mode` scopes which variant is written and is never stored.
      test: test-driven-debugging · integration — red repro asserted the persisted global (`stored.mode` stayed `'OFFER'` after saving the SETTLEMENT variant); instrument validated by re-adding `mode,` and watching it fail. `src/__tests__/lib/actions/kosztorys-client-view-defaults.test.ts`
- [x] 🔴 CRITICAL · fixed · impl-review · `src/migrations/20260819_0_client_view_offer_settlement_variants.ts` · migration mixed ADD COLUMN with DROP COLUMN, and this table is read by the unauthenticated `/k/:token` entrance — so no deploy order was safe (migrate-first ⇒ live SELECT on a dropped column, push-first ⇒ SELECT on a column not yet added; Postgres 42703 either way). Rewritten purely additive + idempotent; the DROP is deliberately NOT authored yet and is owed as a follow-up migration once this deploy is live (recorded in `plan.md`).
      test: no automated test · — deploy-ordering property, not expressible as a spec; the guard is the AGENTS.md migration-direction rule plus the `.husky/pre-push` reminder.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/client-view-settings.ts:66` · the sanitizer failed OPEN: a missing variant, or one whose `hiddenColumns` was absent / not an array, produced an empty hidden set — and the stored value is the HIDDEN set, so „nothing hidden" serves the whole `PREVIEW_VISIBLE_COLUMNS` allowlist, discount figures included, off a schemaless json column any owner can hand-edit in /admin. Now falls back to the variant's default hidden set at every step.
      test: test-driven-debugging · unit — `it.each` over no-hidden-set / non-array / null asserts the default hidden set, plus a companion asserting an explicitly empty array is still honoured (that one IS a real choice). `src/__tests__/lib/kosztorys/client-view-settings.test.ts`
- [x] 🟡 WARNING · fixed · impl-review · `src/migrations/20260819_0_…ts` · rows written before this migration would survive with `variants = '{}'` — resolving to the CODE default and silently opting those investments out of the firm-wide default forever, with nothing on screen to say so. Migration now `DELETE FROM "kosztorys_client_view"` (no data to preserve — settings are re-picked in one dialog).
      test: no automated test · — one-shot migration effect against an empty prod table; a spec would assert the migration file, not behaviour.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/actions/kosztorys-client-view.ts:67` · the defaults write merged the _other_ variant through `sanitizeClientViewConfig`, materialising today's code default into the row — freezing a variant nobody had ever chosen, so a later change to the code default would never reach it. Now the untouched variant is carried over RAW.
      test: TDD · integration — „writes only the named variant, leaving the other absent rather than frozen" (`stored.variants.SETTLEMENT` `toBeUndefined()`).
- [x] 🟡 WARNING · fixed · code-review · `…/dialogs/kosztorys-client-view-dialog.tsx:44`, `kosztorys-share-dialog.tsx` · the dialogs published the RAW draft up to the parent while the server persisted the sanitized copy — editor state and DB disagreed after any save that dropped a key. Both now publish `sanitizeClientViewConfig(draft)`.
      test: no automated test · — covered indirectly by the sanitizer specs; the wiring itself is browser-level and rides on EX-721.
- [x] 🟡 WARNING · fixed · impl-review · `src/migrations/20260819_0_…ts` · `CREATE TYPE` was not idempotent, so a re-run aborted the whole migration. Wrapped in `DO $$ … EXCEPTION WHEN duplicate_object THEN null; END $$`, and both `ADD COLUMN`s made `IF NOT EXISTS`.
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/queries/kosztorys-client-view.ts:22` · inert `limit: 1` alongside `pagination: false`. Removed; the comment now says why there is no COUNT query.
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
