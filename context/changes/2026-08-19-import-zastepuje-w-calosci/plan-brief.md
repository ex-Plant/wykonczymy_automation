# Import zastępuje całą rozpiskę — Plan Brief

> Full plan: `context/changes/2026-08-19-import-zastepuje-w-calosci/plan.md`
> Decisions record: `context/changes/2026-08-19-import-zastepuje-w-calosci/change.md`
> Branch: none — work lands on `staging` directly (owner).

## What & Why

Investment 90 shows 456 prace against the sheet's 373. The extra 83 are duplicate copies the import
made. „Pobierz z arkusza Google" advertises replacement but silently _retains_ every praca the sheet
doesn't match, appending it beside the sheet's own copy. „Popraw literówki w opisie prac" then
guarantees mismatches: the identity key folds case, diacritics and whitespace, while the cleaner
rewrites letters. One cleaning run on investment 90 took the unmatched count 83 → 137.

## Starting Point

`replaceTreeWithSnapshot` already does an honest wholesale replacement — investment lock, forced
`manual` snapshot, total wipe, re-insert, one transaction — and both the import and the preset reload
go through it. The bug is one layer up: `buildImportPlan` composes the tree it is handed, and it
composes sheet prace **plus** unmatched app prace. So this is a deletion plus a key composition, not
new plumbing.

## Desired End State

Fixing a typo no longer costs a praca its identity. „Pobierz z arkusza Google" replaces the rozpiska
outright, and the preview names what will disappear, marking the prace that carry wpisane etapy.
„Wyczyść kosztorys" empties the rozpiska in one snapshotted, undoable click. Investment 90 reads
373 / 373 / 0.

## Key Decisions Made

| Decision            | Choice                                                           | Why                                                                                                           | Source |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------ |
| Identity key        | `fold(cleanDescription(opis))`, not a wider `fold()`             | Keeps one definition per purpose; widening `fold()` would make it a fuzzy matcher for every other consumer    | Plan   |
| Import semantics    | Full replace — unmatched app prace disappear                     | „Import mówi o zastępowaniu i raczej powinien zastępować" — part-replace/part-append is what made the copies  | Owner  |
| Safety net          | The forced pre-import `manual` snapshot, not retention           | Already exists, 365-day and prune-exempt; „nic nie jest usuwane" was never what protected the rozpiska        | Plan   |
| Preview copy        | „X prac zniknie", with an etapy marker on the ones that hurt     | The preview is the last moment before the write; it must warn, not reassure                                   | Plan   |
| Reset               | Separate „Wyczyść kosztorys" button, confirm dialog, destructive | „na pewno potrzebuje móc zresetować arkusz — osobny button"                                                   | Owner  |
| Reset scope         | Wipes rozpiska + rabat globalny; keeps VAT and współczynniki     | „Wyczyść" means empty; a surviving amount discount would price the next import below its own total            | Plan   |
| Investment 90 sweep | Reset button + clean import, no repair script                    | The copies are byte-identical, so a re-import alone can't match them — they need the wipe the button provides | Plan   |
| Branch              | None                                                             | „dawaj od razu i nie robimy osobnej gałęzi"                                                                   | Owner  |

## Scope

**In scope:** `item-key.ts` keying through `cleanDescription` + its spec · deleting the retain block in
`build-import-plan.ts` and flipping `ImportReportT.retained` → `dropped` (with an etapy flag) ·
rewriting the five retain tests · reworking `RetainedBlock` into a „co zniknie" warning ·
`clearKosztorysAction` + confirm dialog + menu entry · sweeping investment 90 through the new UI.

**Out of scope:** a repair script · any data-preservation path for dropped prace · a per-row
merge/reconcile picker · changing `fold()` · changing append-from-preset · a separate branch.

## Architecture / Approach

Phase 1 lands the key fix alone, because it redefines „the same praca" for all three consumers at once
(import, compare, measured-qty refresh) and its effect should be visible before the retain removal
hides it. Phase 2 is a deletion — the five existing tests are the specification of the removed
behaviour and are rewritten in the same phase, plus one new case pinning that a **matched** praca
keeps its wpisane etapy, which is the only real risk the deletion carries.

Keying through `cleanDescription` makes that function's idempotency load-bearing: a `TYPO_FIXES` rule
whose output another rule rewrites again would put the two sides of the comparison on different
strings.

## Phases

1. **Identity key survives a typo fix** — `item-key.ts` + new spec.
2. **Import replaces the whole rozpiska** — drop the retain block, `retained` → `dropped`, rewrite the tests.
3. **The preview says what disappears** — `DroppedBlock` + an etapy marker in `ItemList`.
4. **„Wyczyść kosztorys"** — action, confirm dialog, menu entry.
5. **Sweep investment 90** — no code; clear → import → compare reads 373 / 373 / 0.

## Risks

- The `retained` → `dropped` rename is deliberately a compile error at both consumers — that is what
  stops a stale „zostanie zachowanych" string from surviving the deletion.
- A re-import alone will **not** clear the existing 83 copies, even with the key fixed: identical text
  keys as occurrence #1 while the sheet supplies only #0. Phase 5 depends on Phase 4 shipping.
- No `stage_progress` row hangs on any item of investment 90, so its sweep loses nothing — that will
  not be true of other investments, which is why Phase 3 exists.

## Testing

Unit only. The key fix is a table of opis pairs; the retain removal is the five rewritten
`build-import-plan` cases plus the matched-praca-keeps-its-etapy guard. No integration test —
`replaceTreeWithSnapshot` is unchanged and the reset is just a fourth caller.
