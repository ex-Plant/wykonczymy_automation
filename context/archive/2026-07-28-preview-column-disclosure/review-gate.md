# Review-gate ledger — EX-591 preview column disclosure · 2026-07-28 (archived)

The ruling this slice implements: **in the client-facing preview, only `PREVIEW_VISIBLE_COLUMNS`
decides which columns render** — no per-browser reading preference (hidden columns, money axis,
layer, progress display, price plane, panel tab) may narrow or shape what a client is served.

Scope: the preview/client-view disclosure fix + the `clientView` → `preview` terminology split.
Deliberately excluded other agents' in-flight files in the shared working tree.

Fixed findings were trimmed at archive (the fix is now just the code — the rationale lives in
`selectV2Columns` and `assertDisclosurePair`). What remains is the decisions.

## Findings

- [x] **deviation from the ruling · kept deliberately** ·
      `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:selectV2Columns` ·
      the literal reading ("only the allowlist, nothing else") also dropped the `globalDiscountActive`
      gate, so an investment with a global discount would print the four per-item rabat columns on the
      client's offer. `lib/kosztorys/calc.ts` `applyDiscount` short-circuits on `globalDiscountActive`
      **before** reading `discountType` — the per-item rabat is bypassed, not cleared — so the page
      would show „Rabat 10 %" beside „Kwota rabatu 0,00". That one gate stayed, **inside** the preview
      branch, and the code now names the split: preference gates are skipped, the discount gate is not
      a preference — it is investment state, identical for every reader. Owner informed; reversal is
      one line if he ever disagrees.
- [x] dismissed · code-review · `src/lib/kosztorys/column-config.ts` ·
      „`PREVIEW_VISIBLE_COLUMNS` does not keep subcontractor figures off the page" — true but not a
      defect: the plane is pinned in `use-kosztorys-editor.ts` and `assertDisclosurePair` throws on the
      mismatch. The **comment** was wrong (it credited the allowlist for a lock the plane holds) and
      was rewritten.
- [x] dismissed · code-review · `use-kosztorys-editor.ts:effectiveMoneyAxis` · the removed preview
      branch is unreachable — the returned value's only external consumer is the toolbar view menu,
      absent in preview; the Podsumowanie panel derives its own axis from `settlementMode`.
- [x] skipped · feature-first-structure + module-cohesion (both agents) · move
      `PREVIEW_VISIBLE_COLUMNS` + `assertDisclosurePair` into a new `lib/kosztorys/preview-disclosure.ts` ·
      `structure-scatter-audit` argued the opposite and is right: `assertDisclosurePair` validates
      `BuildV2ColumnsOptsT`, which `grid/` owns, so moving it to `lib/` inverts the dependency. Took
      the scatter reading and collapsed the duplicated **rationale** instead of the code.
- [x] skipped · verify · column widths (`kosztorys-v2-col-widths`) still leak into the preview ·
      deliberate: a width cannot disclose a figure, and the `widths` prop is what keeps the grid from
      reflowing per client. Folded into EX-629 as an explicit opt-out.
- [x] dropped · efficiency · the preview grid now assembles ~58 columns instead of ~32 at 10 stages
      (netto + brutto + every stage-value group ride together). The ruling's intended consequence, not
      a regression — recorded so the number isn't rediscovered as a bug.
- [x] filed **EX-629** · verify + altitude · the whole `table-columns:` preference family · the "no
      per-browser preference reaches a client" rule is enforced by three mechanisms in three places and
      already missed one (`use-totals-panel-open`, which got a UI workaround instead). Belongs at
      `usePersistedEnum` / a `(share)` provider — edits a primitive shared by six hooks, so its own
      review.
- [x] filed **EX-628** (`e2e-backlog`) · verify · browser coverage of both 🔴 fixes · poisoned
      localStorage reaching `/k/<token>` and `/podglad-klienta/<id>`; unit specs can only approximate it
      by handing opts straight to `buildV2Columns`.
      test: test-driven-debugging · e2e — disposition recorded in the issue so the guard travels with
      the fix.
- [x] filed **EX-630** · simplify (reuse) · five specs hand-copy the same `next/cache` mock; belongs in
      `src/__tests__/stubs/next-cache.ts`. Three of the five sat outside this slice and were in another
      agent's working tree at review time.
- [x] filed **EX-631** · owner decision · the settlement-mode money axis no longer narrows the preview,
      so a client's document carries netto **and** brutto side by side regardless of `settlementMode`.
      Follows from the ruling, but changes what a client sees on a net-settled investment. Owner's call
      (2026-07-28): leave it, revisit at preview dogfooding — the question is domain, not technical.

**8 fixed (trimmed), 4 filed, 2 skipped, 1 dropped, 2 dismissed · 0 open.**

## Simplify pass

Ran `/simplify` (4 agents: reuse / simplification / efficiency / altitude), scoped to this slice's
files only. 5 applied, 1 proposed (→ EX-629), 2 dismissed.

## Tests & suite

- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec vitest run src/__tests__/components/kosztorys/` — **7 files, 61 tests passed**
  (`preview-columns.test.ts` 9, `v2-columns-readonly.test.ts` 5).
- Full suite — **not run**. Owner closed the gate before it; the shared working tree held other
  agents' in-flight files, so a full run would have reported on their work as much as on this slice.
  The pre-push hook runs typecheck + tests, so the suite is owed at push time.
