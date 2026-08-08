---
change_id: generic-pending-store
title: Generic pending store so transition-based saves reuse the global indicator
status: implemented
created: 2026-08-08
updated: 2026-08-08
archived_at: null
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
