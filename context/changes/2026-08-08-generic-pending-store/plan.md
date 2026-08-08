# Generic pending store — Implementation Plan

## Overview

`PendingSubmitIndicator` is the app's one global progress signal, but it reads a single dialog-shaped
source. Give it a second, generic source — a keyed Zustand store any caller can signal into — so a
save that isn't a dialog submit gets the same pill without mounting one itself.

## Current State Analysis

- `src/app/(frontend)/layout.tsx:39` mounts `<PendingSubmitIndicator />` once, outside every page.
- `src/components/forms/pending-submit-indicator.tsx` reads exactly
  `useOptimisticFormStore((s) => s.submission?.status === 'pending')` and renders
  `<SubmitPill label="Zapisywanie…" />` — the label is a literal, not a parameter.
- `src/components/forms/submit-pill.tsx` portals to `document.body`, so a pill survives a transformed
  ancestor — but not the unmount of whoever rendered it.
- `useOptimisticFormStore.submitOptimistically(formId, invoiceFiles, action, successMessage, onSuccess)`
  (`src/stores/optimistic-form-store.ts:58`) needs a form id and a file snapshot and reopens a dialog
  on failure. Nothing about a `useTransition()` save fits that contract.

Two callers therefore sit outside it:

| Caller                                                  | Today                                             | Why it can't use the store                                                                                |
| ------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| „Opcje rozliczenia" (`summary-investment-settings.tsx`) | **no signal at all** — only `disabled={isSaving}` | the save is `useTransition()` at `use-kosztorys-editor.ts:162`, funnelled through `saveSetting` (`:1076`) |
| Receipt scan (`expense-form.tsx:398`)                   | mounts `SubmitPill` itself                        | needs the label „Odczytywanie paragonów…", which the indicator hardcodes away                             |

### Key discoveries

- `saveSetting` (`use-kosztorys-editor.ts:1076`) is the single funnel for all four „Opcje rozliczenia"
  writes — one start/stop pair there covers VAT, rabat globalny, tryb rozliczenia and materiały netto.
- `use-receipt-generation.ts` already brackets its work with `setIsGenerating(true)` (`:49`) /
  `setIsGenerating(false)` (`:104`), so the signal pairs onto existing lines — no `useEffect` mirror
  of a boolean, which the React rules rule out anyway.
- A Zustand action can be called imperatively via `usePendingStore.getState()`, so neither caller has
  to become a subscriber just to signal.

## Desired End State

Any code path can raise the global pill with its own label by calling `start(key, label)` and clear it
with `stop(key)`, without rendering anything. „Opcje rozliczenia" has a progress signal again;
`expense-form.tsx` no longer mounts a pill; `submitOptimistically` is untouched.

## What We're NOT Doing

- Not migrating the dialog path onto the new store — `submitOptimistically`'s failure-reopen behaviour
  is a separate concern and works.
- No queue/stack UI for concurrent pending work. Two things pending at once isn't a real case here;
  first-in wins and the second's label is simply not shown (its key still holds the pill up).
- No spec for the indicator's two-source read — a thin render concern (see Testing Strategy).

## Implementation Approach

One phase. The store is new and pure; the indicator gains an `??`; the two callers add a start/stop
pair each. Nothing changes shape for existing dialog submits.

**Keyed, not a boolean.** Two concurrent pending writes sharing one flag means the first to finish
clears the pill while the second is still running. A `Map<string, string>` keyed by caller keeps the
pill up until the last one stops, and carries each caller's label.

**Insertion order is the tie-break.** `Map` preserves it, so "the first still-pending label" is just
`pending.values().next().value` — no timestamps, no priority field.

## Critical Implementation Details

**Zustand + Map identity.** Zustand compares by reference, so `start`/`stop` must build a **new** Map;
mutating the existing one in place would not re-render the indicator.

**`stop` must be unconditional.** Callers pair it in a `finally`, so `stop` on a key that isn't
pending is a no-op, never a throw.

---

## Phase 1: The store, the indicator, and both callers

### Changes Required

#### 1. The store

**File**: `src/stores/pending-store.ts` (new)

**Intent**: Let any caller raise and clear the global pill by key, carrying its own label, without
rendering anything.

**Contract**:

```ts
type PendingStoreT = {
  pending: ReadonlyMap<string, string> // key → label
  start: (key: string, label: string) => void
  stop: (key: string) => void
}
```

`start` on a key already pending replaces its label (last write wins for that key, its position in the
order is kept). `stop` on an unknown key is a no-op. Both produce a new Map instance.

#### 2. The indicator reads both sources

**File**: `src/components/forms/pending-submit-indicator.tsx`

**Intent**: Render when either source is pending, showing the generic store's label when it has one and
falling back to „Zapisywanie…" for the dialog path (which carries no label).

**Contract**: two selectors — the existing optimistic-submission boolean, plus the first still-pending
label from `usePendingStore`. Returns `null` only when neither is pending.

#### 3. „Opcje rozliczenia" signals

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Restore the progress signal the block lost when it became a popover — and make it survive
the popover closing mid-save, which is why a self-mounted pill was never an option here.

**Contract**: inside `saveSetting`'s transition, bracket the `await apply(next)` with
`start('kosztorys-settings', 'Zapisywanie…')` / `stop('kosztorys-settings')` in a `finally`, read off
`usePendingStore.getState()`. `isSavingSettings` stays exactly as-is — it drives `disabled`, which is a
different job.

#### 4. Receipt scan signals instead of mounting

**Files**: `src/components/forms/hooks/use-receipt-generation.ts`,
`src/components/forms/expense-form/expense-form.tsx`

**Intent**: Move the scan's pill to the global host so it can't die with the form, and drop the
component-level mount.

**Contract**: pair `start('receipt-generation', 'Odczytywanie paragonów…')` with the existing
`setIsGenerating(true)` (`:49`) and `stop('receipt-generation')` with `setIsGenerating(false)`
(`:104`) — including the early `return` at `:47`, which must not leave a key pending. Delete
`expense-form.tsx:398` and its now-unused `SubmitPill` import. `isGenerating` itself stays; it drives
other UI.

### Success Criteria

#### Automated Verification:

- New spec passes: `pnpm exec vitest run src/__tests__/stores/pending-store.test.ts`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Existing test suite passes: `pnpm exec vitest run`
- `SubmitPill` is imported only by `pending-submit-indicator.tsx`

#### Manual Verification:

- Changing tryb rozliczenia / VAT / rabat globalny / materiały netto raises the pill, and it stays up
  after closing the popover mid-save
- Running a receipt scan raises the pill with „Odczytywanie paragonów…" and clears it when the scan ends
- A scan with no eligible rows (early return) does not leave the pill up
- A normal dialog submit still shows „Zapisywanie…" exactly as before

---

## Testing Strategy

### Unit Tests

`src/__tests__/stores/pending-store.test.ts` — TDD, per the issue's disposition. Behaviour worth
pinning: a started key raises a label; two keys keep the pill up until both stop (the reason the store
is keyed rather than a boolean); the label is the first still-pending one; `stop` on an unknown key is
a no-op; re-`start` on a live key replaces its label without changing the order.

### Browser E2E

None owed. The behaviour is a store plus two call sites; the manual checks above cover the render.

### Manual Testing Steps

1. `INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`, open the editor
2. „Opcje rozliczenia" → change tryb rozliczenia, close the popover immediately — the pill must stay up
3. Open the expense form, attach two receipts, run the scan — the pill shows „Odczytywanie paragonów…"
4. Submit a normal transfer dialog — the pill still reads „Zapisywanie…"

## Performance Considerations

None. One extra store subscription in a component that is mounted once.

## Migration Notes

None — no schema, data, or persisted-shape change.

## References

- Issue: EX-648
- Global host: `src/app/(frontend)/layout.tsx:39`
- Dialog-shaped store left alone: `src/stores/optimistic-form-store.ts:58`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The store, the indicator, and both callers

#### Automated

- [x] 1.1 New spec passes: `pnpm exec vitest run src/__tests__/stores/pending-store.test.ts`
- [x] 1.2 Type checking passes: `pnpm typecheck`
- [x] 1.3 Linting passes: `pnpm lint` (0 errors, 83 pre-existing warnings)
- [x] 1.4 Existing test suite passes: `pnpm exec vitest run` (1923 passed, 30 files skipped — DB specs)
- [x] 1.5 `SubmitPill` is imported only by `pending-submit-indicator.tsx`
