---
change_id: generic-pending-store
title: Generic pending store so transition-based saves reuse the global indicator
status: archived
created: 2026-08-08
updated: 2026-08-10
archived_at: 2026-08-10T10:12:43Z
branch: konradantonik/ex-648-generic-pending-store
worktree: null
linear: EX-648
---

## Notes

EX-648. `PendingSubmitIndicator` is mounted once in `(frontend)/layout.tsx` and portals a `SubmitPill`
to `document.body`, but it reads exactly one source: `useOptimisticFormStore.submission?.status ===
'pending'`. That store is dialog-shaped (`submitOptimistically(formId, invoiceFiles, action,
successMessage, onSuccess)` — form id, invoice-file snapshot, reopens a dialog on failure), so a save
that isn't a dialog submit can't use it and its caller mounts its own pill instead. A self-mounted
pill dies with the component that mounted it — which is why „Opcje rozliczenia" lost its progress
signal entirely when that block became a popover.

Proposal: a small keyed generic store (`key → label`) with `start`/`stop`; the indicator renders when
either source is pending. Callers signal, never mount. Migrate `summary-investment-settings.tsx`
(restores the missing signal) and `expense-form.tsx` (its own label „Odczytywanie paragonów…", which
the store's hardcoded „Zapisywanie…" can't express). Leave `submitOptimistically` alone.

Test disposition from the issue: `test: TDD · unit` — the store is a pure Zustand reducer, spec under
`src/__tests__/stores/pending-store.test.ts`. The indicator's two-source read is a thin render
concern and gets no spec.

## Reversed after review (2026-08-10, `154ebe8a`)

"Leave `submitOptimistically` alone" did not survive the branch review gate. The dialog path now
raises a pending key of its own and releases it in a `finally`, so the indicator reads **one** source,
not two — the `label ?? 'Zapisywanie…'` fallback is gone with it. `submitOptimistically` keeps every
bit of its recovery behaviour (form id, file snapshot, reopen-on-failure); it simply stopped also
being a render source. Keying on `formId` fixed what the boolean hid: a second dialog's save could
clear the first one's pill. Guards in `src/__tests__/optimistic-form-store.test.ts`.

Review record: `.review-gate/consolidated-gate.md` (branch-scoped gate, not a per-change
`reviews/impl-review*.md`).
