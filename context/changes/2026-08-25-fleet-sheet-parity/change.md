---
change_id: fleet-sheet-parity
title: Fleet parity with the owner's vehicle-control sheet
status: implementing
created: 2026-08-25
updated: 2026-08-25
archived_at: null
branch: null
worktree: null
---

## Notes

Bring the fleet module to parity with the owner's vehicle-control spreadsheet
(`Kopia Kontrola_przegladow_i_ubezpieczen_samochodow.xlsm`, Drive id
`1Yq8Z1zqUpjtaju15lKNWJsuLQuDFDtpi` — an uploaded Office file, so `scripts/inspect-sheet.mjs`
cannot read it; pull it with the Drive API and unzip).

Five gaps found by comparing the sheet's columns against `vehicles` / `vehicle-inspections`:

1. **Ubezpieczyciel + Nr polisy** — no home in the app. Belongs on the INSURANCE inspection, not on
   the vehicle: both change with each polisa, and the event keeps the history honest.
2. **„bezterminowo"** — no way to mark a scheduled type not-applicable. The Przyczepa Knaus has no
   przegląd techniczny ever; today it reads as a permanent blind spot and `findMissingInspections`
   nags about it in the weekly digest forever.
3. **Uwagi** — a car-level remark ("tarcze i klocki do wymiany, poduszka silnika"). `note` exists
   only per-inspection.
4. **opony** — the tyre set currently ON the car (całoroczne / letnie / zima). The TYRES inspection
   is the change log, not the current state.
5. **aktualny przebieg** — a plain meter reading with no event behind it. `latestOdometer` is
   derived from inspections, so recording one today means inventing a fake inspection.

Sheet data quality (checked against the raw XML, 2026-08-25):

- The sheet is **clean** — an earlier "shifted columns" reading was an artifact of a broken dump
  script (a self-closing empty `<c/>` swallowed the next cell). Do not re-file it.
- `WF 7029W` (VW T4) — przegląd genuinely expired (2026-06-27); no oil history, no insurer, no
  policy number, but it does carry an insurance date.
- `WD776AL` (Przyczepa Knaus) — no VIN, no make/model split, przegląd is the literal text
  „bezterminowo", and it has a **policy number with no insurer**. So insurer must not be required
  alongside the policy number.
- Nr polisy must be **text**: `354E000003305` parses to infinity as a number and
  `22044 4672279` contains a space.
- „opony" is free prose in practice („do wymiany na cały sezon.", „całosezonowe ale do wymiany"),
  not a clean enum — a bare select would lose what the owner actually wrote.
- „aktualny przebieg" is filled on exactly one car (`WF7972X` = 177 500), which is the whole
  argument for a cheap standalone reading rather than a fake inspection.
