# Review-gate ledger — wplaty-jedno-zrodlo (EX-680) · 2026-08-12

Diff pod przeglądem: `f49b320e~1..HEAD` (3 commity, 19 plików).
Checks: `/10x-impl-review`, `/code-review`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.
Odpada: `tailwind-v4-audit` (zero zmian w CSS/klasach).
Step 0.5 (verification pass) pominięty — checki manualne są w rejestrze, nieodhaczone.

## Findings

<!-- Format: [box] · <severity, tylko checki bugowe> · disposition · `source` · `file:line` · co — dlaczego -->

- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/lib/db/deposit-investment-invariant.test.ts:67-76` · spec pożyczał najniższy-id rejestr z przywróconego dumpu i księgował na nim +13 000 — osierocony wiersz przestawia hash rejestru w golden masterze, a ten wtedy **pomija** encję zamiast failować, więc `pnpm test:parity` zostaje zielony nic nie strzegąc. Fix: własny właściciel + rejestr `AUXILIARY`, kasowane w teardownie.
      test: test-driven-debugging · integration — poprawka wewnątrz samego spec-a; zielony 3/3 na 5435, `pnpm test:parity` przebiega bez skipów
- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/lib/db/deposit-investment-invariant.test.ts:81-87` · sprzątanie tylko w `afterAll`, a `DELETE ... WHERE investment_id = …` strukturalnie nie sięga dwóch z trzech wierszy (ich `investment_id` jest NULL — o to cały spec). Fix: bezwarunkowe `DELETE ... WHERE description LIKE 'EX-680 deposit invariant%'` na **wejściu**, zgodnie z `lessons.md:237`.
      test: test-driven-debugging · integration — ten sam spec; wejściowe czyszczenie zweryfikowane powtórnym uruchomieniem
- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/__tests__/lib/db/deposit-investment-invariant.test.ts:89-108` · drugi `it` czytał wiersze utworzone przez pierwszy — przechodzi tylko dzięki szeregowej kolejności w pliku, pada myląco pod `-t`. Fix: trzy `createDeposit` w `beforeAll`, trzy niezależne `it`.
      test: test-driven-debugging · integration — struktura spec-a; niezależność potwierdzona
- [x] 🔵 OBSERVATION · fixed · code-review · `src/__tests__/lib/db/deposit-investment-invariant.test.ts:18-21` · jedyną blokadą realnego zapisu do Google Sheets był mock `after` z `next/server`; `INVESTOR_DEPOSIT` jest w `SHEET_TRANSFER_TAB_TYPES`, a `test-integration.sh` eksportuje prawdziwe `GOOGLE_SERVICE_ACCOUNT_JSON`. Fix: `context: { skipSheetSync: true }` — udokumentowany opt-out haka.
      test: no automated test — to jest zabezpieczenie samego spec-a, nie ścieżka produkcyjna
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/queries/preview-kosztorys.ts:56,74` → `summary-overview-tab.tsx:154-166` · share renderuje teraz pojedyncze wiersze wpłat, nie tylko sumę — zmiana powierzchni ujawnienia na publicznym URL. Świadoma: właściciel to zamówił („share ma pokazywać listę wpłat"), plan tego wymaga, link „do wpłat" jest poprawnie wygaszony na `!preview`. Zarejestrowane jako check manualny.
      test: no automated test — decyzja produktowa, nie defekt; potwierdzenie idzie przez checki manualne
- [x] 🔵 OBSERVATION · fixed · impl-review · `summary-panel-content.tsx:193-195`, `summary-economics.ts:145`, `settlement-groups.ts:18` · `depositsNet` (całość) destrukturyzowane trzy linijki od `paidNet` (tylko płaszczyzna netto) — sufiks `…Net` niósł dwa znaczenia w jednym zakresie. Fix: `depositsTotal` przez `computeDoZaplatyRM`, `buildSettlementGroups` i `SummaryOverviewTab`.
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/changes/2026-08-12-wplaty-jedno-zrodlo/plan.md:314,320-336` · siedem odhaczonych kroków bez SHA, mimo że plan sam tego wymaga. Fix: dopisane `f49b320e` / `195f564f` / `12d59470`.
- [x] 🔵 OBSERVATION · dropped · impl-review · `investment-write-guard.db.test.ts:49` · `skipRevalidation` jest na `transactions` no-opem (czyta go tylko `hooks/revalidate-collection.ts`). Zostawione: identyczna konwencja we wszystkich sąsiednich spec-ach DB, a realny guard (`skipSheetSync`) doszedł obok — usuwanie samego tego flagu to churn bez zysku.
- [x] 🔵 OBSERVATION · fixed · code-review · `context/foundation/manual-checks.md:920` · check „Link «do wpłat» na podglądzie prowadzi do niepustej listy" **nie mógł** przejść — linki są wygaszone na `!preview` (`summary-totals-table.tsx:68`, `deposits-table.tsx:40`). Zweryfikowane w kodzie, nie przyjęte na słowo; linia przepisana na „…są zwykłym tekstem, nie linkami".
- [x] fixed · feature-first-structure + structure-scatter · `src/__tests__/lib/db/deposit-investment-invariant.test.ts:1` · spec trafił do mirrora modułu, który **czyta**, a nie tego, który **testuje** — pinowany niezmiennik egzekwuje `src/hooks/transfers/validate.ts:78`. Ten sam niezmiennik żył wtedy pod dwoma mirrorami (S1b). Fix: przeniesiony do `src/__tests__/hooks/transfers/investment-write-guard.db.test.ts`, obok swojego czysto-jednostkowego bliźniaka.
- [x] fixed · feature-first-structure + structure-scatter · `summary-panel-content.tsx:196`, `summary-economics.ts:250` · usunięcie `sumDepositAmounts` skasowało nazwany dom sumy wpłat, nie dając jej nowego — Σ liczyła się w trzech miejscach, w tym arytmetyką domenową wewnątrz `.tsx`. Fix: `bucketDepositsByPlane` zwraca `total` (już je liczyło i wyrzucało), komponent konsumuje. Jedna edycja zamyka F2 i S1a.
- [x] fixed · module-cohesion · `src/__tests__/lib/db/deposit-investment-invariant.test.ts` · dwa podmioty w jednym spec-u (persystowany `investment_id` haka vs kształt wiersza z `getDepositTransactionsForInvestment`). Fix: część listowa odpadła — pokrywa ją już `get-deposit-transactions.test.ts`; zostaje sam niezmiennik haka.
- [x] dismissed · module-cohesion · `src/lib/kosztorys/summary-economics.ts` · skaner flaguje 19 eksportów / mieszanie typów z wartościami. Pre-existing i spójne kontraktowo (typy to zwrotki funkcji obok), 257 LOC; diff ruszył tam jedną nazwę parametru.
- [x] fixed · comment-noise · `src/lib/kosztorys/types.ts:144` · vanished-state („wpłaty total used to…") opisujący pole, którego czytelnik już nie widzi. Skasowane; przy okazji przywrócone „Assembled **identically**" + uzasadnienie dryfu, które diff zgubił.
- [x] fixed · comment-noise · `summary-panel-content.tsx:194` · komentarz powtarzał dokumentację propa trzy tuziny linii wyżej i wracał do kontrastu z usuniętym kształtem. Przycięty do niesionej treści (dwa kubełki partycjonują te same wiersze).
- [x] fixed · comment-noise · `investment-write-guard.db.test.ts:8-14` · blok nagłówkowy przylegał bez pustej linii do `vi.mock('server-only')`, przez co czytał się jak dokumentacja tego mocka; środkowe zdanie narratorskie („writes through payload.create…") wycięte przy przepisywaniu spec-a.
- [x] dismissed · comment-noise · `src/lib/queries/preview-kosztorys.ts:38` · diff skasował notkę „Mirrors the admin page's fetches". Świadomie: wymagane pole `depositTransactions` w `KosztorysEditorDataT` egzekwuje teraz tę koordynację typem, a nie prośbą w komentarzu — to jest właśnie sedno tej zmiany.
- [x] dismissed · comment-noise · `types.ts:167`, `summary-panel-content.tsx:53` · flagowane jako „wylicza konsumentów", ale to właśnie ta lista uzasadnia, czemu prop jest nieopcjonalny, i trzyma rytm bloku. Zostają.

## Simplify pass

`/simplify` — 0 applied, 0 proposed, 0 dismissed.
Przeprowadzony w wątku głównym, bez ponownego rozsyłania czterech agentów: ten sam diff przeszedł
już fan-out `feature-first-structure` / `module-cohesion-audit` / `structure-scatter-audit` /
`comment-noise-audit` (read-only), a ich znaleziska fix-now są wyżej i zostały zaaplikowane.
Po tych poprawkach Σ ma jeden dom (`bucketDepositsByPlane`), `preview-kosztorys.ts` dokłada fetch do
istniejącego `Promise.all`, i po skasowaniu propa nie został żaden martwy kod.

## Tests & suite

- `pnpm typecheck` — czysty
- `pnpm lint` — 0 errors (79 warnings, wszystkie pre-existing w `src/migrations/**`)
- `pnpm test` — 2131 passed / 105 skipped (174 pliki)
- `pnpm test:integration` — 33 pliki / 102 testy passed vs `db-test` 5435, w tym nowy
  `investment-write-guard.db.test.ts` (3/3)
- `pnpm test:parity` — 3/3 passed, bez skipów (golden master + listing↔detail)
- `pnpm test:e2e` — **nie uruchamiane** (zasada: nigdy bez wyraźnej prośby, ~1h)

### Obowiązek E2E

Slice zmienia powierzchnię widoczną w przeglądarce (share renderuje teraz listę wpłat). Spec E2E nie
jest pisany w tej bramce — **odłożony do backlogu E2E jako EX-681** (label `e2e-backlog`, projekt
„Wykonczymy"): https://linear.app/ex-plant/issue/EX-681

## Archive gate

**NIE do archiwizacji.** Wszystkie `[ ]` w Findings zamknięte, ale drugi blokator stoi:
checki manualne EX-680 (`context/foundation/manual-checks.md`, 5 pozycji) są nieodhaczone.
Slice zostaje **in review** do czasu ich przejścia przez człowieka.
