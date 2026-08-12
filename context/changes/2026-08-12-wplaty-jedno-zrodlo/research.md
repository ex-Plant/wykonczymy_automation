---
date: 2026-08-12T18:09:23+02:00
researcher: Claude
git_commit: 90ff578dd25165787fc0893439a81326b34c41c1
branch: konradantonik/ex-557-inna-wplata-zasilenie-bez-inwestycji
repository: wykonczymy
topic: 'Wpłaty per inwestycja — dwie ścieżki wyliczenia jednej figury'
tags: [research, codebase, wplaty, deriveFinancials, kosztorys-summary, preview]
status: complete
last_updated: 2026-08-12
last_updated_by: Claude
---

# Research: Wpłaty per inwestycja — dwie ścieżki wyliczenia jednej figury

**Date**: 2026-08-12T18:09:23+02:00
**Git Commit**: `90ff578`
**Branch**: `konradantonik/ex-557-inna-wplata-zasilenie-bez-inwestycji`

## Research Question

Figura „wpłaty" dla jednej inwestycji liczy się dwiema drogami o różnym zestawie typów. Którą
zostawić, gdzie dokładnie się rozjeżdżają i co pilnuje ich równości?

## Summary

Postawienie pytania jako „dwie powierzchnie się nie zgadzają" jest **za wąskie**. Faktyczny stan:
**jeden prop — `wplatyNet` — jest karmiony z dwóch różnych źródeł na trzech wejściach do tego samego
komponentu**, a trzy komentarze w kodzie twierdzą, że te wejścia są ze sobą zgodne.

1. **Dwie ścieżki wyliczenia** (jak w `change.md`): `financials.totalIncome` (bucket `income`, wszystkie
   trzy typy wpłat) vs `sumDepositAmounts(...)` (Σ listy, `INVESTOR_DEPOSIT` only).
2. **Trzecie wejście — podgląd/share — miesza obie**: bierze total z pierwszej ścieżki, a listę zostawia
   pustą. To jest **realny, dziś widoczny defekt**, nie hipotetyczny rozjazd (szczegóły niżej).
3. **Kierunek z `change.md` (czytać `totalIncome`) sam z siebie nie daje równości.** Równość trzyma się
   wyłącznie na niezmienniku „żaden aktywny wiersz wpłaty inny niż `INVESTOR_DEPOSIT` nie ma
   `investment_id`" — który EX-557 dopiero co uczynił egzekwowalnym przy zapisie. Punkt 3 kierunku
   (guard) nie jest dodatkiem do punktów 1–2; **jest ich fundamentem**.

## Detailed Findings

### Ścieżka A — `financials.totalIncome`

`src/lib/db/investment-financials.ts:103` — `totalIncome: sumBucket(rows, 'income')`. Bucket `income`
obejmuje `INVESTOR_DEPOSIT`, `COMPANY_FUNDING`, `OTHER_DEPOSIT` (`TRANSFER_TYPE_SPECS`, kolumna
`financialBucket`).

Konsumenci: listing (`shape-investments.ts:51`), bilans (`calculate-balance.ts:11`), rozbicie kosztów
(`map-category-costs.ts:129`), **podgląd kosztorysu** (`preview-kosztorys.ts:62`).

### Ścieżka B — Σ listy `INVESTOR_DEPOSIT`

`src/lib/db/sum-transfers.ts:303-342` — `getDepositTransactions` filtruje `type = 'INVESTOR_DEPOSIT'`
i `cancelled = false`; `sumDepositAmounts` (`investment-transactions.ts:74`) sumuje dokładnie te wiersze.

Konsumenci: `kosztorys_v2/page.tsx:77` i `investment-summary-panel.tsx:64` — oba `const wplatyNet =
sumDepositAmounts(depositTransactions)`.

### Trzecie wejście: podgląd klienta / share — total bez listy

`preview-kosztorys.ts:36` deklaruje: _„Mirrors the admin page's fetches (kosztorys_v2/page.tsx) so the
client body reads the same figures."_ Nie mirrorruje. Zwracany obiekt (`preview-kosztorys.ts:56-67`)
podaje `wplatyNet: financials.totalIncome` i **nie podaje `depositTransactions` w ogóle**.
`kosztorys-editor-body.tsx:60` defaultuje je do `[]`.

Skutki na obu stronach share (`(share)/k/[token]/page.tsx`, `(share)/podglad-klienta/[id]/page.tsx`):

- lista wpłat w Podsumowaniu jest **pusta**, mimo niezerowego totalu;
- `bucketDepositsByPlane([])` (`summary-economics.ts:246-257`) daje `paidNet = 0`, `paidGross = 0`;
- w **trybie mieszanym** `buildSettlementGroups` (`settlement-groups.ts:76,103`) odejmuje więc
  `−0,00 zł` w obu torach, a „Do zapłaty" wychodzi zawyżone o całą kwotę wpłat. Tryb rozliczenia
  jedzie na drzewie (`types.ts:127 settlementMode`), więc share renderuje ten, który ustawił
  właściciel — **mieszany jest osiągalny**;
- w trybie niemieszanym wiersz „Wpłaty" pokazuje poprawny total, ale link „do wpłat" prowadzi do
  pustej listy (`linkToDeposits: true`, `settlement-groups.ts:48`).

To jest osobny, cięższy defekt niż sam rozjazd definicji i **powinien wejść do zakresu tej zmiany** —
ma tę samą przyczynę źródłową (figura i jej lista pochodzą z dwóch miejsc).

### Komentarze twierdzące zgodność, której nie ma

Trzy miejsca zapewniają czytelnika o czymś nieprawdziwym — do poprawienia razem z kodem:

- `preview-kosztorys.ts:36` — „Mirrors the admin page's fetches" (patrz wyżej).
- `summary-panel-content.tsx:53-55` — „required on every host" o `depositTransactions`; typ ma je
  opcjonalne (`types.ts:167`), a share ich nie podaje.
- `types.ts:141-143` — „Assembled identically by the admin page, the owner preview, and the public
  share read — one shape so those three can't drift". Właśnie się rozjechały.
- `summary-panel-content.tsx:66-67` — dokumentuje `wplatyNet` jako „(totalIncome — every deposit on
  the investment)", co jest prawdą tylko na jednym z trzech wejść.

### Czego NIE ruszamy — `/raporty`

`raporty/page.tsx:44` woła to samo `deriveFinancials` na wierszach **nieprzypiętych do inwestycji**,
gdzie „Inna wpłata" i „Zasilenie z konta firmowego" są poprawnymi wpłatami firmowymi. Przestawienie
`financialBucket` na `'none'` cicho wycięłoby oba typy z raportu firmowego. **Definicja jest dobra;
zła jest liczba ścieżek.** (Potwierdzenie ustalenia z `change.md`.)

### Dlaczego kierunek „czytaj totalIncome" nie wystarcza sam

Istniejący test DB `src/__tests__/lib/db/get-deposit-transactions.test.ts:61-75` zakłada dokładnie ten
wiersz, który psuje równość: tworzy aktywne `COMPANY_FUNDING` (7000) i `OTHER_DEPOSIT` (1000)
**z inwestycją** i pinuje, że lista ich nie zawiera (Σ = 8000). W tym scenariuszu `totalIncome` = 16000.
Po ujednoliceniu na `totalIncome` Podsumowanie pokazałoby 16000 nad listą sumującą się do 8000 —
czyli rozjazd przeniósłby się z „dwie powierzchnie" na „total kontra własna lista", co jest gorsze.

Na produkcie tego wiersza nie ma (pomiar 2026-08-12: `COMPANY_FUNDING` 26 aktywnych / **0**
z inwestycją, `OTHER_DEPOSIT` 5 / **0**), a EX-557 zamknął drogę zapisu: oba typy wypadły
z `INVESTMENT_TYPES`, więc `showsInvestment === false` → `validate.ts` zeruje `investment` na każdej
ścieżce zapisu. **Równość obu ścieżek jest więc konsekwencją EX-557, nie własnością samej figury** —
i dlatego guard z punktu 3 kierunku jest warunkiem koniecznym, nie ozdobą.

## Code References

- `src/lib/db/investment-financials.ts:103` — `totalIncome` = Σ bucket `income`
- `src/lib/db/sum-transfers.ts:294-342` — `getDepositTransactions`, filtr `INVESTOR_DEPOSIT`
- `src/lib/queries/investment-transactions.ts:69-76` — `sumDepositAmounts` + jej kontrakt
- `src/lib/queries/preview-kosztorys.ts:36,62` — komentarz „mirrors" + `wplatyNet: totalIncome`
- `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:77` — ścieżka B
- `src/components/investments/investment-summary-panel.tsx:64` — ścieżka B
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx:60` — `depositTransactions = []`
- `src/components/kosztorys/summary/summary-panel-content.tsx:53-55,66-67,197` — kontrakt propa + buckety
- `src/lib/kosztorys/summary-economics.ts:246-257` — `bucketDepositsByPlane`
- `src/components/kosztorys/summary/settlement-groups.ts:39-121` — gdzie `paidNet`/`paidGross` = 0 boli
- `src/lib/kosztorys/types.ts:141-143,157,167` — kontrakt `KosztorysEditorDataT`
- `src/app/(frontend)/raporty/page.tsx:44` — powód, dla którego bucket zostaje
- `src/__tests__/lib/db/get-deposit-transactions.test.ts:61-75` — pin ścieżki B

## Architecture Insights

- **Figura i jej lista muszą pochodzić z jednego zapytania.** Total liczony agregatem SQL, a lista
  osobnym `find` z innym filtrem, to dwa źródła prawdy dla jednej liczby — i dokładnie tak powstał
  defekt podglądu. Docelowo `wplatyNet` powinno dać się wyprowadzić z listy, którą komponent i tak
  dostaje.
- **`totalIncome` jest figurą firmową**, nie klienta. Na powierzchni per-inwestycja działa poprawnie
  tylko dzięki niezmiennikowi z EX-557. Nazwa tego nie mówi.
- **Opcjonalny prop z komentarzem „required on every host"** to zaproszenie do tego błędu — typ
  pozwolił share'owi pominąć `depositTransactions` bez jednego błędu kompilacji.

## Historical Context

- `context/changes/2026-08-12-ex-557-legacy-deposit-types/change.md` — pomiar produkcyjny, korekta
  zasady 5 (anulowane wiersze), decyzja o `showsInvestment` jako jedynym predykacie. To stamtąd
  pochodzi niezmiennik, na którym stoi cała równość.
- Brak wcześniejszych dokumentów dotykających `sumDepositAmounts` (grep po `context/` — tylko
  `change.md` tej zmiany).

## Rozstrzygnięcia właściciela (2026-08-12)

1. **Share pokazuje listę wpłat.** `preview-kosztorys.ts` dociąga
   `getDepositTransactionsForInvestment` i podaje `depositTransactions` — jedno zapytanie więcej,
   już objęte `CACHE_TAGS.transfers` w tym samym wpisie cache. Znika i pusta lista, i zerowy split
   `paidNet`/`paidGross` w trybie mieszanym.

2. **Guard pilnuje przyczyny, nie skutku**: sprawdzamy niezmiennik „żaden aktywny wiersz wpłaty inny
   niż `INVESTOR_DEPOSIT` nie ma `investment_id`", nie równość `Σ listy === totalIncome`.

   Powód, dla którego wybór nie jest kosmetyczny: po pkt. 1 wszystkie trzy wejścia biorą figurę
   **z tej samej listy**, więc asercja równości pinowałaby własną implementację — byłaby tautologią
   przechodzącą na zielono także wtedy, gdy dane są zepsute. Sprawdzenie `investment_id` działa na
   poziomie danych i łapie przyczynę niezależnie od tego, co która powierzchnia akurat renderuje.

## Open Questions

Brak — oba pytania rozstrzygnięte wyżej.
