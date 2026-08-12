# Review-gate ledger — 2026-08-11-investments-listing-expense-plane · 2026-08-11

Scope: `staging...konradantonik/investments-listing-expense-plane`, excluding `bd5e5063`
(`kosztorys-totals-panel-toggle.tsx`) — a parallel agent's commit that landed on this branch and is
not part of this slice.

Run in an isolated worktree (`wykonczymy-worktrees/investments-listing-expense-plane`) because a
parallel session holds the main checkout; the mutating `/simplify` pass must not touch its tree.

Step 0.5 (verification pass) skipped: no `verify-manual-checks` skill in this install.

## Findings

<!-- [box] · [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason -->

- [x] 🔴 CRITICAL · fixed · code-review · `src/lib/queries/shape-investments.ts:56` · „Bilans brutto" liczony jako `bilans + vatRate × robocizna` — zły znak (VAT to kolejne obciążenie klienta, więc odejmuje) i zła podstawa (prace przed rabatem). Rozjazd 22 095,10 zł na inwestycji 31. Naprawione czerwonym testem najpierw; wyliczenie wyprowadzone do `grossBalance`.
      test: test-driven-debugging · unit — dwa testy zamrażały złą formułę, przepisane na czerwono; doszedł przypadek z rabatem (`shape-investments.test.ts`)
- [x] 🔴 CRITICAL · fixed · verify · `src/lib/queries/balances.ts:57` + `src/lib/queries/reference-data.ts:148` · listing wywalała się na `Cannot read properties of undefined (reading 'find')`: zmiana poszerzyła kształty jadące przez `unstable_cache` (`netCategoryCosts`, `vatRate`), a wpis zapisany przed zmianą niesie stary kształt. Tag nie ratuje — oznacza wpis jako nieświeży, ale RAZ go jeszcze serwuje. Klucze przebite na `-v2`. Poszłoby to na produkcję.
      test: no automated test — każda ścieżka testowa woła zapytania wprost albo ma świeży cache, więc stary wpis nie istnieje w teście; to punkt kontrolny przy edycji, nie luka w pokryciu. Zapisane w `lessons.md`.
- [x] 🔴 CRITICAL · fixed · impl-review · `src/app/(frontend)/inwestycje/[id]/page.tsx` · `deriveFinancials` wołane bez 6. argumentu `netCategoryCosts` — karta inwestycji liczyła kategorie bez podzbioru netto, czyli inaczej niż lista. Dodany argument.
      test: no automated test — pokryte przez rozszerzony `investment-render-parity-db.test.ts` (patrz niżej)
- [x] 🟡 WARNING · fixed · impl-review · `src/app/(frontend)/raporty/page.tsx:45` · to samo pominięcie `netCategoryCosts` w raporcie zbiorczym; typ obiecuje, że podzbiór zawsze towarzyszy `categoryCosts`. Dodany + komentarz, dlaczego stawka/tryb zostają puste.
      test: no automated test — raport nie wycenia kategorii, więc dziś nic się nie zmienia; ryzyko jest przyszłe
- [x] 🟡 WARNING · fixed · code-review · `src/__tests__/investment-render-parity-db.test.ts` · detektor parzystości liczył listę własną kopią formuł (`calculateBalance` wprost) i porównywał tylko bilans + marżę — czyli był ślepy dokładnie na wadę, którą miał łapać. Przepięty na prawdziwy `shapeInvestments`, porównywane 5 figur (bilans, marża, wydatki inwestycyjne, bilans brutto, wliczone w robociznę). Zielony na 105 inwestycjach.
      test: test-driven-debugging · integration — to JEST ten test
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/queries/shape-investments.ts:19` · 13-kluczowy fallback wypisany inline — nowe pole `InvestmentFinancialsT` przechodziłoby po cichu jako brak. Zastąpiony typowanym `ZERO_FINANCIALS`, który się nie skompiluje.
- [x] fixed · module-cohesion · `src/lib/queries/shape-investments.ts` · składanie wiersza wyprowadzone z `queries/investments.ts` do własnego modułu — bez tego audyt parzystości ciągnie `server-only` i przepisuje formułę u siebie. Udokumentowane w `change.md`.
- [x] fixed · reuse-scan · `src/lib/kosztorys/summary-economics.ts:94` · ręczne `netCategoryCosts.find((c) => c.categoryId === id)?.total ?? 0` — to jest `costForCategory` z `lib/db/map-category-costs.ts:23`. Przepięte.
- [x] fixed · reuse-scan · `src/components/tables/investments.tsx:108` · literał `'Korekta (bez kategorii)'` powielony z `KOREKTA_LABEL`; ten moduł eksportuje już inne etykiety właśnie po to. Wyeksportowany i zaimportowany — jedna etykieta, jedno źródło.
- [x] fixed · comment-noise · `src/components/tables/investments.tsx:71` · komentarz powoływał się na `settlementModeToGridAxis`, którego ten plik ani kolumny nie wołają. Przeformułowany na powód, którego kod nie mówi.
- [x] fixed · comment-noise · `src/components/tables/investments.tsx:95` · komentarz opisywał to, co widać w `expenseCategories.map`. Zostawione samo sprzężenie międzyekranowe.
- [x] fixed · comment-noise · `src/types/reference-data.ts:30` · „trzy stawki" — restatement i nieprawda (`settlementMode` to tryb, nie stawka). Przycięte.
- [x] fixed · comment-noise · `src/lib/queries/shape-investments.ts:52` · komentarz obiecywał równość z figurą „Podsumowania" z płaszczyzny kosztorysu, której ten kod nie ustanawia. Przeformułowany.
- [x] fixed · code-review · `src/lib/db/map-category-costs.ts:27` · `uncategorisedRemainder` eksportowany bez ani jednego konsumenta. Zdjęty `export` (gate: `pnpm typecheck`).
- [x] fixed · code-review · `src/scripts/audit-investment-parity.ts:43` · alias `type AuditInvestmentT = InvestmentRefT` — nazwa bez treści. Usunięty, użycia na `InvestmentRefT`.
- [x] fixed · code-review · `src/__tests__/shape-rows.test.ts:286` · test niezmiennika Σ był tautologiczny — korekta jest WYLICZANA jako total − Σ kolumn, więc identyczność spełnia dowolna zła para. Dodane figury bezwzględne (1612 / 1020 / 400 / 192).
- [x] fixed · feature-first-structure · `src/__tests__/shape-rows.test.ts` · spec nie odwzorowywał ścieżki źródła i mieszał dwa moduły. Rozbity na `__tests__/lib/queries/shape-investments.test.ts` + `.../cash-registers.test.ts`.
- [x] fixed · structure-scatter · `src/__tests__/derive-financials-bucketing.test.ts` · formatowanie rozjechane z prettierem. `prettier --write`.
- [x] filed EX-669 · deferred · structure-scatter · `src/components/tables/investments.tsx:20` · `InvestmentRowT` / `CashRegisterRowT` eksportowane z komponentów tabel, a importowane przez `lib/queries` i skrypt node — inwersja warstw. Przeniesienie dotyka wszystkich konsumentów obu typów; szeroka zmiana, własny przegląd.
- [x] filed EX-670 · deferred · impl-review · `src/lib/db/map-category-costs.ts:105` · kafelki kategorii na karcie inwestycji zostały na płaszczyźnie paragonu, lista jest na płaszczyźnie do zapłaty — ta sama etykieta, dwie liczby. Zmienia to, co widzi użytkownik, i rusza bilans w nagłówku (jest sumą kafelków) → decyzja właściciela. Obejmuje też „Koszty inwestora".
- [x] fixed · code-review · `src/scripts/audit-investment-parity.ts:180` · audyt wywracał się na `ENOENT dumps/` — katalog jest gitignorowany, więc nie istnieje w świeżym klonie ani w worktree. `mkdirSync(..., { recursive: true })`.
- [x] dismissed · code-review · `src/lib/kosztorys/summary-economics.ts:106` · `grossBalance` jako rzekome powielenie `toGross` — inna podstawa i inny kierunek (odejmuje VAT od bilansu, nie ubruttawia figury). Nie jest duplikatem.
- [x] dropped · reuse-scan · `src/lib/queries/shape-investments.ts:35` · `uncategorisedCorrection` liczona jak prywatna `uncategorisedRemainder`, ale na płaszczyźnie do zapłaty, nie surowej — inne dane wejściowe, wspólnej postaci nie ma. Za drobne, żeby zakładać issue.

- [x] fixed · owner · `src/components/tables/investments.tsx:107` · kolumna „Korekta (bez kategorii)" zdjęta na polecenie właściciela — legacy w trzech inwestycjach, nie zasługuje na stałą kolumnę. Zdjęte też pole wiersza, figura audytu i asercje w specach; materiał bez kategorii nadal siedzi WEWNĄTRZ „Wydatków inwestycyjnych" (spec tego pilnuje) i nadal ma własny wiersz w panelu „Podsumowanie".

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
