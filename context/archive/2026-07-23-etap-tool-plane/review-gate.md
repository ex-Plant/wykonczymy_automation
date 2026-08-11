# Review-gate ledger — etap-tool-plane · 2026-07-24

## Findings
<!-- ONE checkbox per finding — every source folds in here. Most-severe first.
     Format: [box] [severity tag, bug-finding checks only] · disposition · `source` · `file:line` · what — reason -->

- [x] 🔵 OBSERVATION · skipped · `impl-review` · `src/lib/kosztorys/calc.ts:72` · Summary plane-split is rabat-free (`subcontractorDueByPlane` = qty × viewPrice), but the grid's per-etap value cells go through `netForQtyForView` which still applies rabat in subcontractor views — so with any per-item rabat present, Phase 5's "split rows + razem reconcile with the grid" fails **on this branch**. — **Merge-ordering artifact, not a slice defect.** Verified: branch was cut from `staging` at `7a733335`, before EX-564 (`2d474610`/`f4605bf4`, "subcontractor views are rabat-free") landed on staging. `subcontractorDueByPlane` correctly implements the target rabat-free behavior (matches `executedWorkNetPreRabat`). Self-resolves when the branch integrates staging's EX-564 `calc.ts`. No slice-code change is correct here. **Merge follow-up flagged in close-out** (integrate staging before/at merge; re-check reconciliation then).
      test: no automated test — the discrepancy is a cross-branch integration state, not a code path in this branch; the target (rabat-free) behavior is already guarded by `subcontractor-due-by-plane.test.ts`'s parity assertion.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/lib/kosztorys/settlement.ts` (`hasUnconfirmedPlane`) · Badge can appear for an unconfirmed etap with zero executed qty (total not actually affected), slightly broader than the hint's "may overstate" wording. — Benign/by-design: the warning is about *confirmation state*, not magnitude; an unconfirmed plane is genuinely unconfirmed regardless of qty. Correct to warn.
- [x] 🔵 OBSERVATION · dropped · `impl-review` · `src/lib/kosztorys/settlement.ts:96` · `executedWorkNetPreRabat` now has no production consumer (only the parity test). — Real but keeping it as the parity anchor documents the single-plane collapse invariant; plan explicitly permitted either. Too minor to churn.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `src/migrations/20260724_2_add_plane_to_kosztorys_stages.ts` · Migration filename differs from plan's `20260723_0`. — Inconsequential; sorts after all deps, registered last correctly.
- [x] dismissed · `comment-noise` · (borderline keeps: kosztorys-editor-body.tsx, subcontractor-summary PropsT) · Flagged borderline but each maps a field/invariant the names alone don't give — net keep.
- [x] dropped · `structure` · `src/components/ui/plane-unconfirmed-badge.tsx` vs `recon-mismatch-badge.tsx` · Near-identical construction; could share a `DestructiveHintBadge` primitive. — Intentional divergence (distinct aria-labels, recon's is E2E-asserted); two ~15-line semantic badges. Extracting adds an abstraction layer over an E2E-coupled file for marginal dedup — not worth it.
- [x] dropped · `structure` · `src/components/kosztorys/editor/plane-icons.tsx` · File named `plane-icons` also exports `PLANE_LABELS` (a label map). — Mild kind-mix; editor is the right tier and it's the single source. Rename only warranted if it grows.
- [x] dropped · `structure` · `src/lib/kosztorys/stage-keys.ts:14` · `STAGE_NA_LABEL` (display string) among key-builders. — Stage-related, shared by both render sites so colocation prevents drift; defensible.
- [x] dismissed · `structure` · `src/components/kosztorys/summary/tables/deposits-table.tsx:27` · Pre-existing second `PLANE_LABELS` (NET/GROSS VAT plane) name-collides with the tool-plane one. — Pre-existing, different concept, not touched by this slice; out of scope.
- [x] skipped · `simplify` (simplification/altitude/efficiency) · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:149` · `stageAppliesToView` is evaluated in three subsystems for the same (stage, view): the column factory (emits `naStageValueColumn`), the `columnTotals` loop (`continue`), and the `naStageColumnIds` memo. — Real redundancy, but the proposed fix (tag NA columns via `columnData`, read in `withTotalsRow`, delete the memo + `naColumnIds` param) rewrites the column↔totals contract. Efficiency agent confirms NO perf harm (all O(stages), off the per-row hot path); altitude agent calls the current form "defensible… reasonable to leave as-is" (cells vs. pinned totals are separate subsystems each applying one shared predicate). Review-worthy refactor, not churned inside the gate.
- [x] dropped · `simplify` (reuse) · `src/components/kosztorys/editor/grid/stage-header.tsx:21` · `STAGE_PLANES: StagePlaneT[] = ['w_tools','own_tools']` literal echoes `PLANE_LABELS`'s key order. — `Object.keys(PLANE_LABELS) as StagePlaneT[]` trades a compile-checked literal for a cast; not worth the safety loss for a 2-element list.
- [x] dropped · `simplify` (simplification/efficiency) · `src/lib/kosztorys/settlement.ts:143` · `combined` is derivable (`wTools + ownTools`) and `hasUnconfirmedPlane` is a second `stages` scan. — `combined` is a justified convenience the "Z + Bez = razem" invariant leans on; the extra O(stages) scan is off the render hot path. Micro-nits, not worth the churn.

## Simplify pass

Ran `/simplify` (4 cleanup agents: reuse / simplification / efficiency / altitude) against `git diff staging...HEAD` + working-tree trims. **2 applied, 0 proposed, 4 dropped/skipped/dismissed** — each folded into `## Findings` above (tagged `simplify`). No separate report file (folded here per the gate). The slice was already reuse-disciplined (single-source `planeIcon`/`PLANE_LABELS`/`STAGE_NA_LABEL`/`stageAppliesToView`, no settlement-math duplication); the one real depth finding (duplicated stage action) is now fixed.

## Tests & suite

- [x] filed EX-568 · `test-coverage` · browser-level E2E owed by this slice (header plane pick → warning clears → grid „nie dotyczy" → subcontractor summary rebuild → klient view untouched). Deferred — implementation-only run (no local migration applied, no running app during the gate). Filed to `e2e-backlog` (Ex-plant / Wykonczymy) → **EX-568**.
      test: e2e — deferred with the spec into EX-568.

**Unit** — `subcontractor-due-by-plane.test.ts` (the money-critical new logic) authored in-slice: single-plane parity, mixed planes, null→unconfirmed, per-item-rabat + global-discount invariance, per-row overrides, empty. `stageAppliesToView` is a 2-line pure predicate exercised through the column tests; no dedicated spec added (trivial, covered by consumers). No new implementation-coupled specs owed after `/simplify` (the one structural fix — `updateStageAction` — is a thin action wrapper, guarded by tsc + the existing kosztorys suite).

**Suite run (this gate):**
- typecheck — ✅ 0 errors (only pre-existing migration `no-unused-vars` warnings).
- lint — ✅ 0 errors, 87 pre-existing warnings.
- vitest `src/__tests__/lib/kosztorys/` — ✅ 242 passed, 11 skipped (DB-dependent, need local Postgres).
- Full `pnpm test` / `test:e2e` / `build` — not run this gate (build needs `--webpack` in the worktree per plan box 5.4; E2E deferred to EX-568). Ask before a full-suite run at merge time.
