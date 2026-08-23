# Plan Brief: tryb mieszany — utwardzenie spike'u

**Change**: `2026-08-20-mixed-settlement-both-planes` · **Plan**: `plan.md` · **Data**: 2026-08-23

## Co budujemy

Spike z 20–23 sierpnia przeprojektował rozliczenie wpłat trzy razy i świadomie nie pisał testów.
Model stoi i został ręcznie zweryfikowany. Ten plan nie projektuje niczego nowego — wykonuje to,
czego spike nie mógł zrobić: przywraca bramkę testową, domyka kontrakt „lista pokazuje tę samą kwotę
co panel", zamyka trzy dziury w ścieżce zapisu i kasuje martwą drugą formułę bilansu.

## Stan wyjściowy

| Bramka                | Stan                                          |
| --------------------- | --------------------------------------------- |
| `npx tsc --noEmit`    | 37 błędów, wyłącznie w 4 plikach specyfikacji |
| `pnpm test`           | 41 czerwonych, te same 4 pliki                |
| `pnpm test:parity`    | czerwony na **każdej** inwestycji             |
| pokrycie modelu wpłat | zerowe                                        |

Cały spike leży niescommitowany: 38 zmodyfikowanych plików + 5 nowych.

## Kluczowe odkrycia

- **`shapeInvestments` ma piąty parametr z wartością domyślną i to jest defekt.**
  `depositPlaneSumsRecord: DepositPlaneSumsMapT = {}` zamienia zapomniany argument w cichą złą kwotę
  zamiast w błąd typu. Parity dokładnie w to wdepnął (woła z czterema argumentami) i przespał rozjazd
  **63 278,90 zł** na inwestycji #34 — co do grosza jedyny `INVESTOR_DEPOSIT` tej inwestycji.
  To nie jest rozjazd produkcyjny, tylko martwa bramka.
- **Wiersz „bilans brutto" w parity ma zły oracle** — porównuje bilans v2 (płaszczyzna kosztorysu)
  z `grossBalance`, formułą v1 (płaszczyzna transakcji). To jedyne żywe wywołanie tej funkcji poza
  jej własnym specem, więc naprawa oracle'a i usunięcie pliku to jeden ruch.
- **`vatPlane` da się dziś przepisać dwiema drogami** wbrew rozstrzygnięciu „tagu się nie edytuje":
  przez panel admina (brak `access.update`) i przez `updateTransferAction` (jawny zapis).
  Zamknięcie jednej zostawia drugą otwartą — `overrideAccess: true` w Local API omija field-level access.
- **`validate.ts` czyści `netAmount`, ale nie `vatPlane`** — gotowy wzorzec czeka dwie linijki obok.
- **`createTransferAction` rozlewa surowe `data`** zamiast `parsed.data`, więc zwężenie Zoda nie
  dociera do zapisu.

## Kluczowe decyzje

| Decyzja                                           | Wybór                                                                                                    | Źródło                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------- |
| Zakres testów                                     | Przepisać 4 czerwone pliki **plus** pokryć cały nowy model wpłat **plus** test cross-surface lista=panel | Plan                   |
| Dziury serwerowe                                  | Zamknąć wszystkie trzy (`vatPlane` w hooku, `parsed.data`, tag nieedytowalny)                            | Plan                   |
| Tryb mieszany                                     | Zostaje — bez niego trzy komunikaty nie mają czego zaproponować; uzasadnienie do living doc              | Plan                   |
| `gross-balance.ts`                                | Skasować razem ze specem po naprawie oracle'a                                                            | Plan                   |
| Nazwa kolumny „Rozliczenie netto/brutto"          | Domknąć w tym planie → „Forma wpłaty"                                                                    | Plan                   |
| E2E dialogu przy księgowaniu                      | Do backlogu jako issue z etykietą `e2e-backlog`, nie pisane teraz                                        | Plan                   |
| Model wpłat (nic nie przechodzi przez VAT)        | Nie relitygowany                                                                                         | Research / `change.md` |
| Materiały po face value w każdym trybie           | Nie relitygowany                                                                                         | Research / `change.md` |
| Ostrzeżenie zamiast blokady; lekarstwem jest tryb | Nie relitygowany                                                                                         | Research / `change.md` |

## Fazy

| #   | Faza                                                                                                                     | Rusza kod produkcyjny   |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| 1   | Model wpłat w testach — `deposit-planes`, `settlement-mode`, oba predykaty obok siebie                                   | nie                     |
| 2   | Arytmetyka rozliczenia — `summary-economics`, `settlement-groups`, trzy strażniki regresji                               | nie                     |
| 3   | Kontrakt lista ↔ panel — parity dostaje wpłaty i właściwy oracle; piąty parametr traci default; `gross-balance.ts` znika | tak                     |
| 4   | Ścieżka zapisu — trzy dziury, każda test-driven debugging                                                                | tak (zmiana zachowania) |
| 5   | Nazewnictwo — kolumna transferów i etykieta kwoty przy gotówce                                                           | tak (etykiety)          |
| 6   | Domknięcie — living doc, lessons, rejestr sprawdzeń, issue e2e-backlog, archiwizacja                                     | nie                     |

Testy najpierw, zmiany zachowania po zielonym drzewie. Fazy 1–2 przywracają bramkę, która przez trzy
dni nic nie mówiła. Faza 3 usuwa default jako **poprawkę defektu**, nie sprzątanie. Faza 4 idzie po
zielonych testach, z testem odtwarzającym przed każdą poprawką.

## Czego nie robimy

Nie projektujemy modelu od nowa. Nie kasujemy trybu mieszanego. Nie piszemy E2E. Nie backfillujemy
legacy wpłat. Nie ruszamy v1. Nie ma migracji ani dotknięcia bazy produkcyjnej.

## Ryzyka

- **Faza 3 łamie kompilację czternastu wywołań** w specu `shape-investments` — muszą być poprawione
  w tym samym kroku, inaczej faza kończy się czerwonym typecheckiem o niczym.
- **`pnpm test:integration` nie odkrywa parity** (jest jawnie wykluczony razem z golden masterem),
  więc bramką fazy 3 jest wyłącznie `pnpm test:parity`.
- **Faza 4 zmienia zachowanie panelu admina** — pole tagu staje się tylko do odczytu; wymaga
  sprawdzenia ręcznego, nie tylko testu.

## Bramka całości

`npx tsc --noEmit` · `pnpm lint` · `pnpm test` · `pnpm test:integration` · `pnpm test:parity` · `pnpm build`
