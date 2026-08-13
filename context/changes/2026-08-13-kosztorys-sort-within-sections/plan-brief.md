# Sortowanie pozycji wewnątrz sekcji — brief

> Pełny plan: `context/changes/2026-08-13-kosztorys-sort-within-sections/plan.md`
> Linear: EX-682 (widok), EX-683 (zapis)

## What & Why

Sortowanie kolumny w edytorze kosztorysu leci dziś po całym płaskim zbiorze wierszy, więc rozbija
podział na sekcje — a skoro rozbija, edytor na czas sortowania **wygasza pasy sekcji** (nagłówek,
podsumowanie, zwijanie). Chcemy sortować pozycje **wewnątrz** każdej sekcji i móc taką kolejność
zapisać na stałe.

## Starting Point

`display_order` trzyma kolejność (pozycja w sekcji, sekcja w inwestycji) i jest już zapisywalne przez
▲▼ (`swapDisplayOrder`). Widok ma osobne, ulotne sortowanie kolumny (`sortRows` + `columnSortValue`),
które nic nie zapisuje i wyłącza pasy sekcji oraz akcje kolejności.

## Desired End State

Sortowanie po dowolnej kolumnie układa pozycje w obrębie sekcji, pasy sekcji i zwijanie działają
przez cały czas, a „Utrwal kolejność" w menu sekcji zapisuje bieżący porządek do `display_order` —
przeżywa odświeżenie i cofa się przez Cmd+Z.

## Key Decisions Made

| Decyzja                         | Wybór                        | Dlaczego                                                                               | Źródło |
| ------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------- | ------ |
| Semantyka trwałej akcji         | „Utrwal bieżące sortowanie"  | Jeden komparator z częścią widokową; alfabetycznie = posortuj po „Opis" i utrwal       | Plan   |
| Zasięg zapisu                   | Jedna sekcja, z jej menu     | Mały odwracalny zapis; wariant „wszystkie sekcje" to inny rozmiar przy 1000+ pozycjach | Plan   |
| ▲▼ i wstawianie przy sortowaniu | Nadal wyłączone              | Sąsiad na ekranie ≠ sąsiad w `display_order`; drogą wyjścia jest utrwalenie            | Plan   |
| Źródło kolejności do zapisu     | Pełny `rows`, nie `viewRows` | Przy aktywnej wyszukiwarce sekcja ma w widoku tylko część pozycji                      | Plan   |

## Scope

**W zakresie:** sortowanie w obrębie sekcji, pasy sekcji przy aktywnym sortowaniu, przenumerowanie
`display_order` jednej sekcji (akcja serwerowa + guard przynależności), pozycja w menu „Sekcja",
cofanie.

**Poza zakresem:** sortowanie samych sekcji, akcja „wszystkie sekcje naraz", osobna sztywna
„Posortuj alfabetycznie", odblokowanie ▲▼ pod sortowaniem, E2E (bramka przeglądu), zmiany schematu.

## Architecture / Approach

Widok: `viewRows` → grupowanie po `sectionId` (kolejność pierwszego wystąpienia) → `sortRows` per
grupa → sklejenie; `buildSectionBandRows` bez zmian, bo znów dostaje wiersze ciągłe w sekcji.
Zapis: czysta funkcja `planSectionRenumber` liczy `before`/`after` z pełnego zbioru → akcja
`renumberItemOrderAction` (jeden `UPDATE … FROM (VALUES …)` z blokadami `ORDER BY id FOR UPDATE`) →
`pushCommand` na istniejącym stosie cofania.

## Phases at a Glance

| Faza                                   | Co dowozi                                                | Główne ryzyko                                                           |
| -------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Sortowanie w obrębie sekcji (widok) | Sort per sekcja + pasy sekcji działające przy sortowaniu | Pasy zakładają ciągłość wierszy — regresja byłaby wizualna, nie błędem  |
| 2. Przenumerowanie (serwer)            | `renumberDisplayOrder` + akcja z guardem sekcji          | Zakleszczenie z `shiftDisplayOrderFrom` bez tych samych blokad (EX-632) |
| 3. Menu + cofanie                      | „Utrwal kolejność" z optymistyczną zmianą i undo         | Rozjazd optymistycznego stanu z zapisem przy nieudanej akcji            |

**Wymagania wstępne:** brak — gałąź odbita od `pomiar-bez-etapu`.
**Szacowany rozmiar:** ~1 sesja na fazę 1, ~1-1,5 sesji na fazy 2-3.

## Open Risks & Assumptions

- Gałąź wychodzi z **zacommitowanego** czubka `pomiar-bez-etapu`; w głównym drzewie tamten agent ma
  niezacommitowane zmiany w `sort-value.ts`, `use-kosztorys-editor.ts` i `kosztorys-editor-body.tsx` —
  czyli dokładnie w plikach fazy 1. Konflikt przy scalaniu jest pewny, tylko drobny.
- `renumberItemOrderAction` przyjmuje identyfikatory od klienta — guard przynależności do sekcji jest
  po stronie serwera warunkiem, nie ozdobą.
- Utrwalenie nie czyści sortowania widoku; jeśli w dogfoodingu okaże się mylące, czyszczenie to
  jedna linia w handlerze.

## Success Criteria (Summary)

- Sortowanie po „Opis" porządkuje pozycje wewnątrz sekcji, a pasy sekcji zostają na ekranie.
- „Utrwal kolejność" przeżywa odświeżenie strony i cofa się przez Cmd+Z.
- Utrwalenie przy aktywnej wyszukiwarce porządkuje całą sekcję, nie tylko widoczne wiersze.
