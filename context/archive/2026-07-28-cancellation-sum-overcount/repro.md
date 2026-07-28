# Repro — see both defects before touching any money formula

Run against the **local dev DB** (docker `wykonczymy`, port 5433 — a restore of the Neon prod dump),
dev server on `http://localhost:3000`. Numbers below were measured 2026-07-28 on that copy; they
shift as the dump is refreshed, so re-run the SQL rather than trusting the printed figures.

Both defects live in the same tile — **„Suma wybranych transakcji"** — which renders only when a
filter is active (`transfer-filters.tsx:220`, `hasAnyFilter`).

---

## Defect 1 — the tile counts anulowania (EX-574)

Open both URLs. **The list underneath is identical (379 rows); only the tile differs.**

```
http://localhost:3000/raporty?from=2026-03-01&to=2026-03-31
→ tile: 7 192 866,38 zł        ← wrong (+71%)

http://localhost:3000/raporty?from=2026-03-01&to=2026-03-31&type=OTHER_DEPOSIT,OTHER,CORRECTION,LABOR_COST,RABAT,LOSS,REGISTER_TRANSFER,INVESTOR_DEPOSIT,INVESTMENT_EXPENSE,PAYOUT,COMPANY_FUNDING
→ tile: 4 202 513,34 zł        ← correct
```

The second URL names every type _except_ `CANCELLATION` — the same set the default view already
shows. Same rows, two spellings of one filter, two numbers. That difference **is** the bug:
`stripCancelledFilters` keeps an `in` filter and discards the default `not_in`.

Ground truth (works on any month):

```bash
docker exec wykonczymy psql -U postgres -d wykonczymy-db -c "
SELECT to_char(date,'YYYY-MM') AS m,
  SUM(amount) FILTER (WHERE type <> 'CANCELLATION') AS lista,
  SUM(amount)                                       AS kafelek,
  SUM(amount) FILTER (WHERE type = 'CANCELLATION')  AS blad,
  COUNT(*)    FILTER (WHERE type = 'CANCELLATION')  AS n_anul
FROM transactions
WHERE cancelled IS NOT TRUE AND date >= '2026-01-01'
GROUP BY 1 ORDER BY 1;"
```

| m       | lista (poprawnie) |   kafelek (dziś) |          błąd | anulowania |
| ------- | ----------------: | ---------------: | ------------: | ---------: |
| 2026-01 |        354 675,00 |       354 675,00 |             — |          0 |
| 2026-02 |        191 030,00 |       191 030,00 |             — |          0 |
| 2026-03 |      4 202 513,34 | **7 192 866,38** | +2 990 353,04 |         55 |
| 2026-04 |      2 540 523,82 | **3 775 400,50** | +1 234 876,68 |         66 |
| 2026-05 |      1 707 302,83 |     1 779 566,48 |    +72 263,65 |         14 |
| 2026-06 |      3 496 989,15 | **4 697 025,70** | +1 200 036,55 |         95 |
| 2026-07 |      4 538 592,96 |     4 784 388,15 |   +245 795,19 |         26 |

January and February are the control: **zero anulowań, zero błędu.** The error is exactly the sum of
the cancellation rows, never anything else.

### Where it also shows (missing from the Linear issue)

The same tile sits on the **Pulpit** („Ostatnie transakcje", `manager-dashboard.tsx:37`), which builds
the same filters with no relational scope. Log in as a **MANAGER**, pick any date range:

```
http://localhost:3000/?from=2026-03-01&to=2026-03-31
```

Unaffected by design: `/inwestycje/[id]`, `/kasa/[id]`, `/pracownicy/[id]` — their Where carries a
relational column that survives the strip, and every anulowanie has that column NULL.

---

## Defect 2 — the amount filter's upper bound never reaches the tile

Independent of anulowania. Search by an exact amount:

```
http://localhost:3000/raporty?amount=500,00
→ list:  20 rows, together 10 000,00 zł
→ tile:  22 560 189,17 zł        ← the sum of EVERY transaction ≥ 500 zł
```

The list honours the range `[500, 500.01)`. The tile does not, because
`buildTransferFilters` emits `{ amount: { greater_than_equal, less_than } }` and
`where-to-sql.ts:82-92` has no `less_than` branch — an unrecognised operator falls through
silently, so the ceiling disappears and the query runs `amount >= 500` unbounded.

```bash
docker exec wykonczymy psql -U postgres -d wykonczymy-db -c "
WITH t AS (SELECT * FROM transactions WHERE cancelled IS NOT TRUE AND type <> 'CANCELLATION')
SELECT v.term,
  (SELECT COUNT(*)   FROM t WHERE amount >= v.low AND amount < v.low + 0.01) AS wierszy,
  (SELECT SUM(amount) FROM t WHERE amount >= v.low AND amount < v.low + 0.01) AS lista,
  (SELECT SUM(amount) FROM t WHERE amount >= v.low)                          AS kafelek
FROM (VALUES ('18,00',18::numeric),('500,00',500),('1000,00',1000),('2000,00',2000)) AS v(term,low);"
```

| term    | wierszy |     lista |       kafelek |
| ------- | ------: | --------: | ------------: |
| 18,00   |       2 |     36,00 | 17 045 206,67 |
| 500,00  |      20 | 10 000,00 | 16 818 392,89 |
| 1000,00 |      52 | 52 000,00 | 16 640 823,87 |
| 2000,00 |      43 | 86 000,00 | 16 298 374,16 |

(the `kafelek` column here already excludes anulowania, to isolate this defect from the first —
in the app today both errors stack, which is why the URL above prints 22 560 189,17 and not
16 818 392,89)

A **prefix** search — `?amount=500`, no decimal separator — takes the `like` branch instead
(`transfer-filters.ts:159-160`), which the translator does handle, so that path is correct. Only the
decimal form is broken.

---

## What "fixed" must look like

For every URL above: **the tile equals the sum of the rows the list is showing.** That is the whole
acceptance criterion, and it is the same sentence for both defects — one filter reaching SQL, one
not.
