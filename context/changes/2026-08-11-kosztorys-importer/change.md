---
change_id: kosztorys-importer
title: Pull kosztorys data from the linked Google Sheet into the editor
status: implemented
created: 2026-08-11
updated: 2026-08-11
archived_at: null
branch: konradantonik/ex-417-kosztorys-importer
worktree: ../wykonczymy-worktrees/kosztorys-importer
---

## Notes

Roadmap slice **S-15** (`kosztorys-importer`, band 3). Its blocking open question — PRD Q8 /
roadmap open question 7, "what concretely triggers this importer" — is **answered**: a button in the
editor's "Opcje" menu, invoked per investment on demand. Not a one-shot migration.

### Shaped with the owner (2026-08-11)

**Direction and scope.** Sheet → app only. Imports **rabat, robocizna (stawki), etapy** and the item
tree. Deliberately untouched: settlement mode, materials net rate, global discount, VAT, the global
coefficients, per-etap tool plane + worker (EX-613), stage labels, section colors, notes — none of
that exists in any sheet, so it stays hand-entered per investment.

**Authority.** The `kosztorys_robocizny` tab is the item tree's source of truth (owner's ruling).
Rates come from **both** `zakres pracy` tabs, one tab chosen per row; every auto-resolution must be
listed in the preview, never applied silently. `Pomiar z natury` is ignored on purpose — the app
derives pomiar as the sum of etapy (EX-489).

**Column resolution.** Never by offset. Rows 1–3 are a header block; columns are found by label.
Validated against all 45 real sheets in the DB: "Przedmiar" lives in six different columns (I…N),
stage counts run 3–10, and stage headers get renamed to crew names — so stage columns are located by
row 2 == "wykonano", not by their label. 43/45 resolve; the 2 that don't (Dąbrowskiego 86, Ryżowa
66/127) are genuinely ambiguous and need one header cell fixed by the owner.

**Safety.** Preview → confirm → apply, with a shared plan builder so the two can't disagree; apply
re-derives server-side and never trusts the client payload (mirrors `lib/actions/sheets-sync.ts`).
Automatic snapshot before apply. Items that vanished from the sheet are **reported, never deleted**.

**Identity key:** (section name, item description, nth occurrence) — not row number. Validated on
Białostocka: 324/324 matched by description alone.

### Local rehearsal → prod strategy (decided 2026-08-11)

Rejected: a fourth database. The local dev DB on 5433 is already the staging ground, and crucially
it is restored from prod dumps, so **investment ids match prod** — an empty DB would have no
investments to attach to.

The durable artifact is **files**: one parsed JSON payload per investment, replayable into the DB
without touching Google. That survives `db:import` (which overwrites local with prod), makes sheet
edits visible as a diff between two reads, and doubles as the dev seed corpus.

**Prod does not receive migrated rows** — an OWNER clicks the same button on prod, which reads the
sheet itself. The local pass is a rehearsal whose output is a **list of corrections**, not data.

Where a correction lives (this was the crux):

- **In the sheet** — wrong header, typo, rate typed in only one tab. Travels for free and stays true.
  Expected to cover almost everything.
- **In the parser** — misresolved column or rate. Fix the code; the button ships the same code.
- **In app-only fields** — the out-of-scope list above. Safe, because sync never overwrites them.
- **Nowhere else.** A hand correction to a _synced_ field is silently clobbered by the next sync, so
  "correct locally, seed prod" is a trap, not a safety net — regardless of which DB it lives in.
  Contingency only: a committed exception file (investment id + row + value + why) applied after the
  sheet read. Deliberately ugly, visible in review, built only if the rehearsal proves it necessary.

**Quality gate:** each sheet carries its own footer totals (`wartość netto`, `R netto - suma prac
wykonannych`). Comparing the app's computed total against the sheet's own number, for all 45,
is automatic proof the parse is right — it depends on every price, rabat and quantity individually.
Located by label, since the footer row position varies per sheet.

### Sequencing (decided 2026-08-11)

**The button first, the 45-sheet scan later.** The owner does not have access to every sheet right
now, so the bulk rehearsal can't run yet. Build and prove the import on a single investment with a
linked sheet (Białostocka is the known-good fixture), then run the scan as a follow-up once access
is there. The footer-total gate still applies — it just runs per investment instead of over all 45.

### Sheets we can read (owner-shared, growing list)

All shared read-only with the service account in `GOOGLE_SERVICE_ACCOUNT_JSON`; tab
`kosztorys_robocizny`, `gid=70964819` on each. Dump one with:

```bash
SHEET_ID=<id> TABS="kosztorys_robocizny" MAX_ROWS=6 node --env-file=./.env scripts/inspect-sheet.mjs
```

| #   | Sheet id                                       | Etapy    | Przedmiar | What it proves                                                                                                                                                                  |
| --- | ---------------------------------------------- | -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `1EgNFob2baPlKUMTSQlfbzc2HJI5zmITPZUQsJbkomz4` | 10 (D–M) | N         | The wide baseline. Both footer rows present; `S = Pomiar × cena − rabat` with `O = N`, so „wartość netto" is the **offered** total here.                                        |
| 2   | `15zV_w5Z2EmGZCkWvm1wzXJgmGVAO0_V98-wufGF3Tn4` | 6 (D–I)  | **J**     | Narrow layout **and** stages renamed to crews in row 3 („1 etap PAWEL AES", „3 etap EKIPA MYKOLA"). The case that kills label-based stage detection.                            |
| 3   | `1ma2HMdjK8GirBNJeLJKy4l5ADJSI5Z20Ru1gsx3pBJM` | 10 (D–M) | N         | Wide like #1, but the wartość block starts at **V**, not U, with „komentarz" at U — a blank column between „Wartość netto" and the money block. Kills any adjacency assumption. |

Header-block facts that hold across all three:

- **Fields sit on different rows of the block.** `rabat` is labelled on row 1 only, `komentarz` on
  row 3 only, `j.m.` on both with different wording. A single-row resolver cannot work — this is why
  `resolveHeaders` (`src/lib/google/sheets.ts`) is unusable here, on top of its duplicate check.
- **Row 1 labels the qty block and the money block identically** (`V1` is literally `=D1`). **Row 2
  is the only discriminator**: „wykonano" over quantities, „wartość" over money. Without it an import
  reads twenty etapy instead of ten.
- **`section` and `description` have no header label at all** (row 1 of those columns holds the
  client's address). They are located relative to the resolved first stage column:
  `description = firstStage − 1`, `section = firstStage − 3` when the tab has one. The rate tabs have
  no section column, so they resolve to two leading columns instead of three.
- **A rate column is identified by a PAIR of labels.** In the `zakres pracy` tabs a banner groups two
  columns under „cennik z narzędziami" / „cennik bez narzędzi" and row 3 splits each into „cena j.m."
  and „wartość suma" — so „cena j.m." appears at three columns, one of them the client price. Match
  the banner together with the row-3 sub-label. Three traps in that banner (details in
  `research.md` §10): it may be spelled without diacritics („cennik z narz**e**dziami", #1's own
  z-narzędziami tab), it may name the split by **who works** instead of by tooling („cennik
  podwykonawca" / „cennik pracownik", #3), and it may sit on row 1, row 2 or both.
- **Never take the etap count from a rates tab.** Its „wykonano" run can be shorter than the
  kosztorys' — #1 has 6 markers there against 10 etapy. Read the run only to locate the description
  column next to it.
- **PII lives in the header block**: row 1 column C is the client's address, row 2 the phone, row 3
  the e-mail. Fixtures blank those cells; nothing reads them.

### Owed

- Sanity guard on rate auto-resolution: the _bez narzędzi_ rate may not exceed the _z narzędziami_
  one. Found by scoring the arithmetically impossible variant on Białostocka r104 "gruntowanie".
- PII check before any parsed payload is committed — sheet names carry client names, and row 1 is
  "Imię i nazwisko oraz adres inwestycji". Key files by investment id; verify content is name-free
  or keep the files out of git and commit only the report.
