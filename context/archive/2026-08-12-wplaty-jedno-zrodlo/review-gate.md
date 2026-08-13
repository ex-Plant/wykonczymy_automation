# Review-gate ledger — wplaty-jedno-zrodlo (EX-680) · 2026-08-12

Diff pod przeglądem: `f49b320e~1..HEAD` (3 commity, 19 plików).
Checks: `/10x-impl-review`, `/code-review`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.
Odpada: `tailwind-v4-audit` (zero zmian w CSS/klasach).
Step 0.5 (verification pass) pominięty — checki manualne są w rejestrze, nieodhaczone.

## Findings

Bilans: 18 znalezisk, 0 otwartych — 13 `fixed`, 4 `dismissed`, 1 `dropped`.
Wpisy `fixed` usunięte przy archiwizacji (poprawka jest już kodem). Zostają decyzje:

- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/queries/preview-kosztorys.ts:56,74` → `summary-overview-tab.tsx:154-166` · share renderuje teraz pojedyncze wiersze wpłat, nie tylko sumę — zmiana powierzchni ujawnienia na publicznym URL. Świadoma: właściciel to zamówił („share ma pokazywać listę wpłat"), plan tego wymaga, link „do wpłat" jest poprawnie wygaszony na `!preview`. Zarejestrowane jako check manualny.
      test: no automated test — decyzja produktowa, nie defekt; potwierdzenie idzie przez checki manualne
- [x] 🔵 OBSERVATION · dropped · impl-review · `investment-write-guard.db.test.ts:49` · `skipRevalidation` jest na `transactions` no-opem (czyta go tylko `hooks/revalidate-collection.ts`). Zostawione: identyczna konwencja we wszystkich sąsiednich spec-ach DB, a realny guard (`skipSheetSync`) doszedł obok — usuwanie samego tego flagu to churn bez zysku.
- [x] dismissed · module-cohesion · `src/lib/kosztorys/summary-economics.ts` · skaner flaguje 19 eksportów / mieszanie typów z wartościami. Pre-existing i spójne kontraktowo (typy to zwrotki funkcji obok), 257 LOC; diff ruszył tam jedną nazwę parametru.
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

Zarchiwizowane 2026-08-12 przy zamkniętych wszystkich znaleziskach. Pozostaje jeden dług:
**5 checków manualnych EX-680** (`context/foundation/manual-checks.md`) jest nieodhaczonych, więc
EX-680 zostaje **In Progress `[in review]`**, nie `Done` — kartę zamyka człowiek po ich przejściu.
Trwała nauka wyciągnięta do `context/foundation/lessons.md` („A total and the list it summarises must
come from ONE query…").
