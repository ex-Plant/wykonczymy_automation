# Review-gate ledger — 2026-08-11-investments-listing-expense-plane · 2026-08-11

Scope: `staging...konradantonik/investments-listing-expense-plane`, excluding `bd5e5063`
(`kosztorys-totals-panel-toggle.tsx`) — a parallel agent's commit that landed on this branch and is
not part of this slice.

Run in an isolated worktree (`wykonczymy-worktrees/investments-listing-expense-plane`) because a
parallel session holds the main checkout; the mutating `/simplify` pass must not touch its tree.

Step 0.5 (verification pass) skipped: no `verify-manual-checks` skill in this install.

## Findings

_Trimmed at archive (2026-08-12): the 20 `fixed` findings were dropped — a fixed finding's durable
record is its commit, verifiable by reading the code. What survives below is the negative space git
cannot hold: what was deliberately NOT changed, and why. Pre-trim tally: 20 fixed, 2 filed, 1
dismissed, 1 dropped · 0 open._

- [x] filed EX-669 · deferred · structure-scatter · `src/components/tables/investments.tsx:20` · `InvestmentRowT` / `CashRegisterRowT` eksportowane z komponentów tabel, a importowane przez `lib/queries` i skrypt node — inwersja warstw. Przeniesienie dotyka wszystkich konsumentów obu typów; szeroka zmiana, własny przegląd.
- [x] filed EX-670 · deferred · impl-review · `src/lib/db/map-category-costs.ts:105` · kafelki kategorii na karcie inwestycji zostały na płaszczyźnie paragonu, lista jest na płaszczyźnie do zapłaty — ta sama etykieta, dwie liczby. Zmienia to, co widzi użytkownik, i rusza bilans w nagłówku (jest sumą kafelków) → decyzja właściciela. Obejmuje też „Koszty inwestora".
- [x] filed EX-668 · deferred · suite · E2E odłożone: baza testowa nie ma dziś fixture'u ze stawką materiałów, więc test na niej przechodziłby na samych zerach.
- [x] dismissed · code-review · `src/lib/kosztorys/summary-economics.ts:106` · `grossBalance` jako rzekome powielenie `toGross` — inna podstawa i inny kierunek (odejmuje VAT od bilansu, nie ubruttawia figury). Nie jest duplikatem.
- [x] dropped · reuse-scan · `src/lib/queries/shape-investments.ts:35` · `uncategorisedCorrection` liczona jak prywatna `uncategorisedRemainder`, ale na płaszczyźnie do zapłaty, nie surowej — inne dane wejściowe, wspólnej postaci nie ma. Za drobne, żeby zakładać issue.

## Simplify pass

Ran `/simplify` + `primitive-reuse-scan` — 12 fixed, 0 proposed, 1 dismissed, 1 dropped; każde ustalenie
wpięte do `## Findings` (tag `simplify` / `reuse-scan` / `comment-noise`). Bez osobnego raportu: ta lista
jest raportem. `.reuse-scan.json` już istniał (homes: `src/components/ui`, `src/hooks`, `src/lib/**`, `src/types`).

## Tests & suite

- `pnpm typecheck` — zielony
- `pnpm exec vitest run src/__tests__/lib/**` — 432 passed / 33 skipped
- `pnpm test:parity` — 3 passed (105 inwestycji, 5 figur, 0 rozjazdów)
- `node --env-file=.env --import tsx src/scripts/audit-investment-parity.ts` — 96 inwestycji, 0 outlierów
- E2E — **odłożone i zgłoszone**: EX-668 (`e2e-backlog`). Baza testowa nie ma dziś fixture'u ze stawką
  materiałów, więc test na niej przechodziłby na samych zerach.
- `pnpm lint` — 0 errors, 81 warnings (wszystkie zastane, w `src/migrations/**`)
- `pnpm test` — 2036 passed / 86 skipped, 0 failed
- `pnpm build` / `pnpm test:e2e` — nieuruchomione (decyzja użytkownika; e2e i tak wisi na EX-668)
