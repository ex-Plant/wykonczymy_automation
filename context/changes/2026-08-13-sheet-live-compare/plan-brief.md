# Plan brief — porównanie z arkuszem na żywo

One-paragraph orientation for whoever picks up `plan.md` with no memory of the discussion.

## What and why

Dogfooding investment 31 showed the sheet claiming 508 196 zł and the app 491 519,25 zł. The
16 677,70 zł gap sits in 26 pozycje whose Pomiar z natury is the formula `=N` — a copied Przedmiar,
not a measurement. The importer refuses those on purpose, so the „Rozjazd" column is structurally
blind on them: **zero rozjazdów was reading as agreement when it actually meant nothing to compare
against.** This change adds an on-demand read of the live sheet that says so out loud, plus a way to
refresh the stored reference quantities without a full re-import.

## Decisions already made (do not re-litigate)

- **„Etapy są prawdą" is removed, not adapted** (owner: „nie powinno być wyjścia awaryjnego"). A
  rozjazd closes by fixing the sheet or filling the etapy. This is Phase 1 and it is what makes the
  refresh in Phase 4 a plain overwrite.
- **`=N` is reported, never imported.** `parse-robocizna.ts` needs no change.
- **Report only** — the comparison never offers to fix the sheet.
- **Three named formula classes**, not a generic anomaly detector.
- **The refresh writes immediately**, no preview. The comparison dialog _is_ the preview.
- **One fresh read per click**, no caching.
- **One error toast** for every failure mode, not a differentiated in-dialog message.
- **Folded under the importer slice (S-15)** in the roadmap, not a new slice number.
- **E2E is filed to the backlog**, not written now.

## Where the work lands

New pure modules under `src/lib/kosztorys/sheet-import/` (`item-key.ts`, `build-sheet-comparison.ts`,
`formula-health.ts`) carry all the logic and all the tests. The server read and the write action join
`src/lib/actions/kosztorys-import.ts` next to `previewKosztorysImport` — a recorded exception to the
`lib/queries` rule, justified in the plan under Critical Implementation Details. The dialog is a
sibling of `DropdownMenu` in `kosztorys-actions-menu.tsx` and is fetched **on the click** by the
parent, per the documented Radix behaviour.

## The trap

Row identity is content-based (`section|description#occurrence`) because the sheet has no ids. A
rename appears as one pozycja in _both_ unmatched lists — that is the honest answer, and the dialog
must present unmatched rows as a question, never as a fact. Do not reimplement the key; import it
from `item-key.ts` so the comparison and the import can never disagree about what matched.
