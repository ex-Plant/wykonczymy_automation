# Archived — Kosztorys in-app editor POC (raw working docs)

The POC-unique working docs from the **`poc-kosztorys-in-app`** branch, archived here on
2026-07-08 so they survive independently of that branch. The POC proved the in-app kosztorys
editor approach and settled the shape; these are its raw brainstorm/design/plan artifacts.

**Not the source of truth, and not a build spec.** They are POC-grade notes — decisions may
have since changed or been superseded. The reconciled, current decisions live in:

- `context/foundation/roadmap.md` — the reconciled slice arc (F-01, S-01…S-19); its "Reconciled with
  the POC" note and "Open Roadmap Questions" section absorbed the MVP decision register that once
  lived at `context/changes/kosztorys-mvp/change.md` (deleted 2026-07-24 in a bulk cleanup, no
  distillation needed — everything it carried is already here or in roadmap.md).

Kept as archive (not deleted) because they carry unique rationale the distilled docs don't
fully capture — the reasoning behind each POC decision, the sheet-inspection findings, and the
editor bake-off. Per the doc-lifecycle rule: durable rationale extracted → raw docs archived.

**Provenance:** verbatim copies from `poc-kosztorys-in-app` (original paths under
`docs/superpowers/…` and `context/changes/kosztorys-poc-in-app/…`). The pre-reorg `docs/`
duplicates of docs already living under `context/` on the mainline, and two unrelated handoffs
(settled/correction parity; the 06-11 transfery sheet-tab), were deliberately excluded.

## Contents

Only `kosztorys-poc-in-app-change.md` survives — the POC's decision register, and the best
synthesis of everything the folder held. On **2026-08-08** the raw designs and plans were read
in full and deleted (the braindump had already been distilled into
`context/reference/kosztorys-editor-domain-notes.md`): the POC braindump, the POC design +
plan, the grid bake-off pair, and the per-slice design/plan pairs for add/remove struktura,
reorder, section subtotals, subcontractor pricing, CSV export and VAT-per-investment.

Their durable rationale was extracted first — the grid bake-off's two-mode-cell argument and
its rejected candidates, the DnD/sparse-ordering-key trap, the frozen-columns corollary, the
hierarchical-visibility rule and the drifted-implementation rule all live in
`context/foundation/lessons.md`; the section-subtotals ruling lives inline in
`kosztorys-poc-in-app-change.md` (#1). The archive commit was a rename, so `git log --follow`
on this folder still reaches every deleted file in full.
