---
change_id: import-zastepuje-w-calosci
title: Import zastępuje całą rozpiskę zamiast doklejać nierozpoznane prace
status: implementing
created: 2026-08-19
updated: 2026-08-19
archived_at: null
branch: staging
worktree: null
---

## Notes

Import kosztorysu ma zastępować całą rozpiskę zamiast doklejać nierozpoznane prace, klucz kojarzenia
prac odporny na poprawianie literówek, osobny przycisk „Wyczyść kosztorys", plus wymiecenie 83 kopii
z inwestycji 90.

Ustalenia z rozmowy poprzedzającej (2026-08-19):

- **Klucz kojarzenia prac.** `item-key.ts` keys on `fold(section)|fold(description)#occurrence`, and
  `fold()` only lowercases, strips diacritics and collapses whitespace. `cleanDescription`
  („Popraw literówki") rewrites letters (`fisnish`→`finish`, `ścianch`→`ścianach`,
  `ścian(pianka`→`ścian (pianka`), which `fold()` cannot absorb — so a cleaned praca stops matching
  its sheet twin. Fix: run the description through `cleanDescription` inside the key, on both sides.
  It is idempotent by contract, so applying it to already-clean text is a no-op. Measured on
  investment 90: unmatched prace jumped 83 → 137 right after a cleaning run.
- **Import ma zastępować w całości.** `buildImportPlan` currently appends every unmatched app praca
  into the section of the same name (`retainedItems`), so „zastąp" silently merges. Owner's ruling:
  one behaviour, matching the button's name — no „zachowaj prace spoza arkusza" checkbox. Safety
  comes from the pre-import snapshot plus a preview that says what WILL DISAPPEAR (list, with prace
  carrying wpisane etapy called out separately — the rozpiska is recoverable from the sheet,
  wykonano is not).
- **Osobny przycisk „Wyczyść kosztorys".** Snapshot first, wipe sekcje/prace/etapy, leave the
  investment's settings (VAT, mnożniki) and the global rabat alone — those are not the rozpiska.
- **Inwestycja 90 (preview DB) holds 83 kopie** — 456 wierszy for 373 unikalne prace: Podłogi and
  Klimatyzacja in triplicate, Wyburzenia doubled. No stage_progress row hangs on any of them, so
  nothing is lost by deleting. Note: a re-import will NOT sweep them even after the key fix — the
  copies carry identical text, so they key as occurrence #1/#2 and the sheet has only #0. They need
  the wipe (or the new full-replace import).
- **Origin of those 83 is unresolved and deliberately not chased further.** What the data proves:
  three separate non-wiping inserts (13:08 / 13:09 / 13:10 UTC) built the tree, all 456 rows existed
  before the first „Popraw literówki" (13:17), and the only preset in the DB („full", 324 prace) is
  itself clean. The full-replace + reset work closes the hole regardless of which click sequence
  opened it.
