# Review-gate ledger — sortowanie-kolumn-spojne · 2026-08-18

Scope: commits `aeaf755f`, `e5a12767`, `2b0d9aee`. Files:
`src/lib/kosztorys/sort-value.ts`, `src/lib/kosztorys/stage-keys.ts`,
`src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts`,
`src/components/kosztorys/editor/grid/{sort-menu-items,sort-header,stage-header,kosztorys-v2-columns}.tsx`.

Step 0.5 (browser verification pass) not run — Playwright is never driven unprompted here; the
slice's manual checks are registered in `context/foundation/manual-checks.md`.
`tailwind-v4-audit` dropped — the diff adds no styling: every class in it is an existing utility
moved verbatim out of `sort-header.tsx`.

**Trimmed at archive (2026-08-18).** Pre-trim tally: **12 fixed, 5 dismissed, 0 filed, 0 open.**
The twelve `fixed` lines are gone — a fixed finding's durable record is its commit and the code it
produced, both readable today. What survives below is the negative space git cannot hold: the things
someone looked at and decided _not_ to change, which no diff will ever explain.

## Findings

- [x] 🔵 OBSERVATION · dismissed · code-review · `sort-value.ts:130` · `String(value)` on a row field
      typed outside `string | number` — no such field exists on `KosztorysV2RowT`, and the return
      type stays honest for every real column. Unreachable, no guard worth the noise.
- [x] 🔵 OBSERVATION · dismissed · impl-review/code-review · `sort-value.ts:122` · the `''`→`null`
      change reaches every text column, not only the five named groups. Intended and documented: the
      old coercion was also dropping a whole numeric column into `localeCompare` whenever one cell
      was cleared. Both effects are pinned by specs.
- [x] 🔵 OBSERVATION · dismissed · impl-review · `stage-header.tsx:88` · the read-only gate doesn't
      list `onSort`. It cannot fire without the other handlers (`editorOnly` nulls them as one set),
      and the gate's meaning is „no editor callbacks at all" — adding a fourth term would suggest a
      combination that does not exist.
- [x] 🔵 OBSERVATION · dismissed · code-review · `kosztorys-sort-value.test.ts:192` · the etap-qty
      case is characterization, not regression (that axis already sorted). Kept deliberately: it is
      the axis the change made _offerable_, and it pins the qty/wartość namespace split.
- [x] dismissed · comment-noise · `sort-menu-items.tsx:17` · flagged-uncertain, kept whole — it
      explains why this is a set of items rather than a menu, which the code cannot say.

## Simplify pass

Ran as the gate's mutating pass, folded into `## Findings` above (tagged `reuse` / `comment-noise` /
the reviewer that raised it): 11 applied, 0 proposed, 5 dismissed. No separate report file — this
ledger is the report.

## Tests & suite

- `pnpm exec tsc --noEmit` — clean.
- `pnpm lint` — 3 errors, all pre-existing and outside this diff (`src/hooks/use-latest-request.ts`,
  root `test.js`).
- `pnpm test` — full unit suite green (2421 passed / 130 skipped).
- E2E: none owed. The change adds no new browser-level flow — it widens an existing header-menu
  gesture to more columns, and the sort engine it drives is covered at unit level.
- Manual: 11 checks registered in `context/foundation/manual-checks.md`, unticked. Non-blocking by
  standing owner decision — the slice is closed with the checks left as a registry.
