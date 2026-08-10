# Review-gate ledger — staging post-merge kosztorys refactors · 2026-07-25

Scope: 12 commits since merge `2fed8bf3` (`d5b80d37`..`8ef4a3e5`) — the grid-primitive
extraction batch (`EditableCellInput` / `ReadOnlyCellText` / `HeaderLabel` / `useInlineRename`),
the stage-plane single-sourcing, the column-width unification, the seed-etap fixes, and the
`StagePlaneT` + `CostVariantT` → `ToolPlaneT` union merge. 29 files, kosztorys editor.

No `plan.md` covers this batch (post-merge refactor run directly on `staging`) →
`/10x-impl-review` dropped from the fan-out. Ran: `/code-review`, `tailwind-v4-audit`,
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`,
`comment-noise-audit`.

**Trimmed at archive (2026-08-10).** The 20 `fixed` findings were removed: each one's durable record
is its commit, and a ledger line describing a change is strictly worse evidence than the change.
Kept in condensed form: the one finding that was deferred and **filed**, since a filing leaves no
commit. What else survives is the negative space git cannot hold — what a reviewer looked at and
chose **not** to act on, and why. Moved here from the `.review-gate/` fallback path, which had no
lifecycle of its own.

Final tally before the trim: **20 fixed, 12 dismissed, 10 dropped, 2 skipped, 1 deferred+filed, 0 open.**

`/code-review` found **no CRITICAL findings**. Explicitly verified clean: the inline-rename commit
path (Enter routes through `blur()` so `onBlur` is the single commit site; Escape now correctly skips
the commit); `EditableCellInput` swallows Enter/Escape _only_ when a handler is passed, so the three
handler-less callers still reach dsg exactly as before; `{...props}` spreads last so no caller prop
is clobbered; the `ToolPlaneT` merge erases no live distinction; no `PLANE_LABELS` collision; the
seed condition is neither inverted nor off-by-one, and zero stages is safe downstream.

## Findings

- [x] deferred+filed · `simplify` · `costVariant` / `defaultCostVariant` (schema) · Altitude traced every reference: both columns are written, read back, and plumbed onto every row object, but **nothing downstream branches on either** — v1 vestiges from before stages became the settlement source of truth (EX-489). The `ToolPlaneT` merge makes it worse: three dead fields now share a name with the one live carrier, so they read as load-bearing. Schema deletion + hand-written migration → its own review. Cheap under the throwaway-data rule. Filed **EX-575**.
- [x] skipped · `simplify` · `hooks/use-inline-rename.ts:27-31` + `grid/cells/editable-cell-input.tsx:8` · the hook returns `onEnter`/`onEscape`, which only `EditableCellInput` understands, so `kosztorys-section-row.tsx:32` has to destructure the abstraction apart and re-dispatch by hand. Both agents propose the hook return a native `onKeyDown`. Real and correct, but it reshapes a hook and a primitive across four files **that the parallel session is actively editing** — the one legitimate file-based hold in this gate. Worth doing as its own change.
- [x] skipped · `simplify` · `hooks/use-inline-rename.ts:6-8` · `editing` is derivable from `draft` (`draft: string | null`, `editing = draft !== null`), which also removes the impossible stale-draft state. Same parallel-session hold. `cancelledRef` and the Enter-routes-through-blur design were **verified correct and explicitly kept** by both agents.
- [x] dismissed · `code-review` · `read-only-cell-text.tsx:9` (`truncate`, `text-sm`) · intentional consistency, not drift: `ReadOnlyCellText` already carried both for the four disabled cells, ellipsizing beats overflowing into the neighbouring column, and the same batch raised the column-width floor to 140px so truncation is far less reachable. Only the `h-full` half was a defect.
- [x] dismissed · `tailwind-v4` · `src/styles/globals.css:257-259` · the new `.kosztorys-grid .dsg-cell-header { font-size: var(--text-xs) }` asserts the same value `HeaderLabel` bakes in. Not a v4 violation (reading a theme token in a stylesheet is correct; the anti-pattern is `text-[var(--text-xs)]` in JSX) and not dead — the CSS rule reaches dsg's vendor header chrome that `HeaderLabel` doesn't wrap. _(Superseded later in the same gate: the simplify pass proved every text-bearing title routes through `HeaderLabel`, and the rule was deleted.)_
- [x] dismissed · `tailwind-v4` · `grid/stage-header.tsx:54` · `className="min-w-0 px-1 text-xs"` overrides the primitive's `text-sm`/`px-2`. Legal utilities, tw-merge resolves correctly — a header-context caller against a body-cell-tuned default. Becomes a `size` variant only if more header callers appear.
- [x] dismissed · `tailwind-v4` · repo-wide · no Tailwind-aware ESLint plugin (`prettier-plugin-tailwindcss` sorts classes only), so these patterns are invisible to CI. A real gap, but wiring `eslint-plugin-better-tailwindcss` is repo-infra work with nothing to do with this diff.
- [x] dismissed · `module-cohesion` · diff-wide · **Zero cohesion findings — the diff made three files more cohesive.** `plane-icons.tsx` shed `PLANE_LABELS` to `constants.ts`; `stage-header.tsx` shed its inline-rename state machine; the `StagePlaneT`/`CostVariantT` merge gave the plane concept one home and collapsed five duplicated `z.enum` literals onto one.
- [x] dismissed · `module-cohesion` · `use-kosztorys-editor.ts` · 1118 LOC god module, but this diff's only contact is the 6-line `ToolPlaneT` rename. The **EX-515** deferral ("cohesive stateful unit, needs a test harness first") stands and this diff gives no new reason to revisit it.
- [x] dismissed · `comment-noise` · `use-inline-rename.ts:22`, `editable-cell-input.tsx:4`, `section-name-cell.tsx:6,27`, `kosztorys-v2-columns.tsx:169` · flagged borderline, inspected, kept. Each encodes a constraint the code can't state: `onEnter`/`onEscape` aren't DOM input props so the coupling is invisible; dsg selection swallowing; denormalized-name fan-out; external-rename staleness; the dsg minWidth-clamp-on-overflow behind the `140` floor.
- [x] dismissed · `feature-first` · `src/lib/kosztorys/{constants,types}.ts` · the tier crossings in this diff are all **correct**: `PLANE_LABELS` moved component-tree → domain tier, `TOOL_PLANES` and `ToolPlaneT` stayed in the domain tier. Nothing domain-aware leaked into `components/ui/`. (Noted: the union is spelled twice — deriving `ToolPlaneT` from `TOOL_PLANES` would single-source it but costs the type its home in `types.ts`; judgment call, not a defect.)
- [x] dismissed · `simplify` · `src/lib/kosztorys/seed-*.ts` · the no-etap rule is at the right level and genuinely not duplicated — you cannot factor out "neither of these does the thing", and `0f3b338f` correctly deleted the conditional insert rather than hoisting it. The regression test now guards a collision impossible by construction; keep it, it pins the invariant.
- [x] dismissed · `simplify` · `src/lib/kosztorys/types.ts:91` · the `ToolPlaneT` merge itself: verified correct depth, **do not re-split**. `settlement.ts:167` and `calc.ts:52` feed the same value through as a `PriceViewT` — the three DB columns were named apart by history, not meaning. AGENTS.md's "one concept, one name" mandates it.
- [x] dismissed · `simplify` · diff-wide (reuse) · the extraction is **fully swept**: one `bg-transparent` in the tree (the primitive itself), zero read-only cell spans outside `ReadOnlyCellText`, one `key === 'Escape'` (the helper), zero `justify-start` outside `button.tsx`, zero rename state machines outside the hook. Five candidate dupes checked and rejected with reasons.
- [x] dropped · `module-cohesion` · `grid/kosztorys-v2-columns.tsx` · 597 LOC god-by-size (`assembleV2Columns` is a ~250-line single function). Pre-existing; this diff's contact was cosmetic and **improving**. The proposed split into `grid/columns/*` is medium-cost — the builders share a wide opts type and four local helpers, and column _ordering_ is positional and load-bearing — so it's a review-worthy refactor, not gate churn.
- [x] dropped · `module-cohesion` · `src/lib/actions/kosztorys.ts` · ~20 server actions across four entities behind one filename. This diff **improved** it. Splitting means per-file `'use server'` directives and a barrel that must not break the action manifest — not worth it below ~700 LOC.
- [x] dropped · `structure-scatter` · `grid/cells/editable-cell-input.tsx` · the primitive lives in `cells/` but `grid/stage-header.tsx` (a header, not a cell) imports it — a naming tension inside one subtree, no competing home created. Subsumed by the placement question, resolved in the same gate.
- [x] dropped · `structure-scatter` · `src/lib/kosztorys/` · 36 flat `.ts` files, zero subdirs — the repo's clearest subdivide-in-place candidate. Single-kind, so not scatter, and **pre-existing**: this diff modified 6 files there and added none.
- [x] dropped · `comment-noise` · `seed-from-preset.ts:38` + `seed-blank.ts:11` · the "a seeded etap could only guess its plane / a guessed plane reads as confirmed" rationale is near-verbatim in both seed files. Load-bearing at both sites, so not a strip-test failure — deduping to one canonical statement plus a pointer trades a self-contained comment for an indirection. Not worth it for two files.
- [x] dropped · `simplify` · `grid/cells/editable-cell-input.tsx:1` · `forwardRef` is dead — six call sites, zero pass a `ref`, and on React 19 `ComponentProps<'input'>` already carries `ref` through the spread. Real but cosmetic; folded into the skipped hook/primitive change above rather than churned alone.
- [x] dropped · `simplify` · `grid/cells/read-only-cell-text.tsx:10` · `muted` vs the `className` passthrough are two spellings of one thing. Two call sites; `muted` names a domain state (derived, not yours to type). Not worth the churn either way.
- [x] dropped · `simplify` · `grid/stage-header.tsx:53` · `className="min-w-0 px-1 text-xs"` exists only to undo `EditableCellInput`'s `px-2 text-sm` — altitude wants a `cell`/`header` context variant. One caller; already dismissed at the same line by `tailwind-v4`. Revisit if a second header caller lands.
- [x] dropped · `simplify` · `components/ui/button.tsx:18` · `outlineDestructive` restates `outline`'s three base utilities for one call site, and the neighbouring `ghostDestructive` has zero call sites repo-wide (pre-existing). **Parallel session's file — not mine to touch.** The `align` variant in the same file was checked and is a genuine win; explicitly left.
- [x] dropped · `simplify` · three `MoneyAxisT` label pairs (`kosztorys-view-axis-options.tsx:32`, `grid/money-axis-toggle.tsx:11`, `summary/kosztorys-totals-panel.tsx:49`) · `{net: 'Netto', gross: 'Brutto'}` written three times — the exact analogue of the `VAT_PLANE_LABELS` extraction this batch performed one type over. Real, but each array keeps a distinct third entry, so the shared part is two words. Below the churn threshold.

## Simplify pass

Ran `/simplify` — 4 agents (reuse · simplification · efficiency · altitude). 7 fixed, 2 skipped
(parallel-session hold), 5 dropped, 4 dismissed, 1 deferred+filed. Findings folded into `## Findings`.

One correction worth keeping: the gate's Step-1 triage had dismissed the `HeaderLabel` /
`globals.css` header-typography pair as both-needed. **That was wrong.** The simplify pass traced
every text-bearing `title:` — all route through `HeaderLabel`; the only non-`HeaderLabel` titles
(`layerGap`'s empty `<span />`, `ResizableHeader`'s wrapper) carry no text, and the stage rename input
carries its own `text-xs`. The CSS rule was redundant and was deleted. The trace is what settled it.

## Tests & suite

- `pnpm typecheck` — pass (twice: after the min-width fix, after the `ToolPlaneT` sweep).
- `pnpm exec vitest run src/__tests__/lib/kosztorys/` — 268 passed, 12 skipped (23 files).
  The 12 skips are DB-backed specs needing the `db-test` container on 5435, which was **not running**.
  Two of them pin the new "seed installs no etap" contract, so that contract was unverified locally.
- No new tests authored: both Step-1 correctness findings are CSS/rendered-class geometry inside a
  third-party grid — a jsdom class assertion would pin the implementation without proving the visual
  result. They owe a **browser check**, not a unit spec.
- `pnpm lint` — 0 errors (87 pre-existing warnings, all `db` unused-arg in `src/migrations/`).
- Full suite (`test:e2e` / `build`) **not run**.

## Manual verification owed (blocked archive at the time)

1. Sorted column header renders at weight 600, not 500.
2. Computed money cells vertically centre and line up with the editable cells in the same row.
3. The trailing gap column still renders ~48px wide, and every column still opens at ≥140px.
4. Header text is still xs/medium after the `globals.css` rule was deleted.
