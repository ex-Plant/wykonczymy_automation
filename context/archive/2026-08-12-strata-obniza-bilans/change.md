---
change_id: strata-obniza-bilans
title: Strata obniża dług klienta jak rabat, pozostając osobną figurą raportową
linear: EX-675
status: archived
created: 2026-08-12
updated: 2026-08-13
archived_at: 2026-08-13T11:04:22Z
branch: konradantonik/ex-675-strata-obniza-dlug-klienta-jak-rabat-pozostajac-osobna
worktree: .claude/worktrees/ex-675-strata
---

## Notes

`LOSS` gets the same arithmetic as `RABAT` — ↓ marża, ↑ bilans — while staying a separately
summed figure, because the owner wants to report "ile mam strat". Investment becomes required
(`requiresInvestment('LOSS') → true`): prod carries 6 LOSS rows (3 live, 3 cancelled) and **every
one already has an investment**, so no backfill is owed. Verified against the FTP backup
`wykonczymy-backup-20260812-130516` — max id 4479, latest `created_at` 12:42 UTC. The local Docker
DB and `dumps/dump-latest.sql` were both stale and disagreed with prod on `cancelled` flags; read
prod through a fresh FTP backup, not either of those.

**The owner already stated the intent in the data.** The three live losses:

| id   | kwota  | inw. | opis                            |
| ---- | ------ | ---- | ------------------------------- |
| 3298 | 362,84 | 62   | „naprawa połogi kolejny raz"    |
| 3737 | 39,00  | 98   | „brak skasowania za to klienta" |
| 4470 | 142,65 | 47   | „strata źle zamówione coś tam"  |

3737's description _is_ this change's premise in the owner's own words: a strata means the client
was not charged. And he has already migrated his own workarounds onto the right types — cancelled
`OTHER_DEPOSIT` 1381 (142,65, inw. 47) reappears as live LOSS 4470 for the same amount and
investment, while cancelled `OTHER_DEPOSIT` 1171 (132,87, inw. 18) reappears as live `RABAT` 4467.
He picked strata in one case and rabat in the other, so the strata-vs-rabat distinction is his,
not ours to invent.

**The defect this closes.** Investment 62: two `INVESTMENT_EXPENSE` rows (222,88 + 139,96 =
362,84, `settled = false`) plus a `LOSS` of 362,84 („naprawa połogi kolejny raz"), robocizna 0,
wpłaty 0. Marża reads −362,84 (correct — the company ate the cost) but bilans reads −362,84,
i.e. the app claims the client still owes 362,84. The owner entered the strata precisely so the
client would not. Strata does half its job today: it eats the margin and leaves the debt standing.

Regression fixture: that exact shape → bilans 0, marża −362,84.

**Why not the existing `settled` checkbox.** „Wliczone w robociznę" on the wydatek produces the
same two numbers, but its label is false when robocizna is 0, and it cannot express a loss with no
cash expense behind it (kara, przestój, odpuszczona robocizna). Strata is the more general tool and
the one the owner reached for. Accepted consequence: two routes to one outcome — ticking the
checkbox _and_ adding a strata for the same amount would swing bilans to +362,84, which the code
cannot detect (two independent rows).

**VAT plane — settled with the owner (2026-08-12): face value, one rule, no flag.** A strata may
cover a cash expense _or_ odpuszczona robocizna, and those two sit on different VAT planes
(materiały carry none, prace carry 23%). The owner's ruling is to ignore that split rather than
model it: **the amount entered is the amount the client stops paying, identically in netto and in
brutto.** No 23% is ever added to or stripped from a strata.

So strata deducts at face value, like a wpłata — _not_ pre-VAT like rabat, despite „działa jak
rabat" being the origin of this change. The analogy holds for the direction (↓ marża, ↑ bilans) and
stops at the VAT plane.

Accepted consequence, and the one thing to tell the owner: on odpuszczona robocizna he must enter
the figure he wants taken off the client's bill — if he is thinking brutto, he types brutto. The app
will not gross it up for him.

This resolves consequence 3 below (face value was the reading it pointed at): no transaction figure
ever cuts the VAT base of a kosztorys figure.

## Blocked on EX-555 (2026-08-12)

Implementation waits for `context/changes/2026-08-12-ex-555-write-switch-labor-rabat` to land
(in flight on `konradantonik/ex-672-remove-print-csv-export`). It moves robocizna **and rabat** on
the investment listing onto a kosztorys source and hides `LABOR_COST` / `RABAT` from the expense
form; legacy rows stay. It rewrites the exact functions this change touches — `calculate-balance.ts`,
`calculate-margin.ts`, `shape-investments.ts`, `summary-reading.ts`, `summary-margin-tab.tsx`.
Re-verify this plan against the post-EX-555 shape before implementing. Four consequences:

1. **„Jak rabat" stops meaning „like the `RABAT` transfer".** After EX-555 rabat is a kosztorys
   figure (`rabatClientNet`); strata stays a transfer, because the arkusz has no strata column. The
   analogy survives in the arithmetic only — the plumbing must stay transaction-sourced.
2. **Scope shrinks: strata does NOT enter `SummaryReadingT`.** That pair is robocizna + rabat, both
   kosztorys-sourced. Strata rides alongside like materiały and wpłaty, so the v1↔v2 reconciliation
   never compares it and the false-mismatch risk noted below no longer applies.
3. ~~**The VAT assumption weakens.**~~ **Resolved above** — strata deducts at face value, so no
   transaction figure ever cuts the VAT base of a kosztorys figure. The two-planes seam this
   consequence warned about does not arise.
4. ~~Same double-counting family (id 2774, a rabat entered as a `CORRECTION`).~~ **Dead** — 2774 is
   cancelled on prod (`cancelled = t`), as is `OTHER_DEPOSIT` 1196. Both looked live only because the
   local DB and `dumps/dump-latest.sql` were stale. Nothing to coordinate here.

**Scope trap — v2 does not use `calculateBalance`.** The v2 panel and the kosztorys podsumowanie
compute the client figure through `computeDoZaplatyRM` / `computeMixedSettlement`
(`Robocizna post-rabat + Materiały − Wpłaty`), so `+ totalLoss` in `calculateBalance` alone fixes
only v1 (legacy) and the investment listing. Rabat reaches v2 by being baked into the kosztorys
(`rabatClientNet`); strata has no kosztorys row, so it needs its own explicit deduction row in the
settlement steps. `summary-reading.ts` currently asserts the opposite in prose — that strata never
enters those readings — and both readings must gain it identically or the v1↔v2 reconciliation
will report a false mismatch.
