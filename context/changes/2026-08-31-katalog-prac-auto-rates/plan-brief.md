# Stawka „auto" w katalogu prac — Plan Brief

> Full plan: `context/changes/2026-08-31-katalog-prac-auto-rates/plan.md`

## What & Why

The katalog prac can only hold a frozen kwota for each subcontractor stawka, so a praca that priced
off an investment's global współczynnik gets that number welded into the cennik the moment it is
saved — and every future investment then inherits a rate nobody offered it. This change adds a third
possibility per plane: **auto**, meaning the katalog holds no stawka and the praca prices off the
target investment's own współczynnik.

## Starting Point

`work_catalogue_items.w_tools_rate` / `own_tools_rate` are `NOT NULL`, and `toCatalogueCandidate`
calls `subcontractorPrice` unconditionally, so even a row that overrode nothing freezes an amount.
`appendCatalogueItems` then writes both planes back as `'amount'` overrides. The pricing fall-through
that auto needs already exists — `subcontractorPrice` derives from the global współczynnik whenever
the override type is `null` — so nothing new is computed; the change is about which rows get an
override at all.

## Desired End State

A katalog stawka is either a kwota (travels verbatim, as today) or auto (`NULL`, prices off the
target investment). The two planes decide independently. „Auto" is always a deliberate choice — a
toggle in the formularz, the word „auto" in the listing and in both dialogs — never an empty field.

## Key Decisions Made

| Decision                | Choice                                                                                             | Why                                                                                                                             | Source |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Co trafia do cennika    | Własne nadpisanie (kwota lub mnożnik) → kwota na sztywno; brak nadpisania → auto; decyzja per plan | Kwota w cenniku ma znaczyć decyzję, a nie odbicie współczynnika inwestycji                                                      | Owner  |
| Pułap 80% a auto        | Guard milczy dla planu auto; wiersz sprawdzany dopiero w rozpiskie                                 | „Auto to auto, nie ma z czego liczyć 80%" — ten sam precedens co przy cenie j.m. = 0                                            | Owner  |
| Reprezentacja           | `NULL` w kolumnie stawki                                                                           | Dokładny odpowiednik `NULL` w typie nadpisania po stronie rozpiski — jeden brak, zapisany tak samo po obu stronach szwu         | Plan   |
| Formularz               | Przełącznik „auto" przy każdej stawce                                                              | Puste pole nadal znaczy „zapomniałem" i zostaje przy „jest wymagana" z wczorajszej poprawki                                     | Owner  |
| Porównanie z katalogiem | Auto liczone współczynnikiem tej inwestycji i porównane jako kwota                                 | Wiersz z własną kwotą wbrew cennikowi „auto" to prawdziwy rozjazd i musi być widoczny                                           | Owner  |
| Seed ze szablonu        | Ta sama reguła co „Zapisz do katalogu…"                                                            | Cennik nie może zależeć od tego, którą drogą praca do niego trafiła (137 z 373 prac szablonu nie ma nadpisania)                 | Owner  |
| Migracja                | Nowy plik `20260901_1`, nie edycja `20260901_0`                                                    | Tamta nie poszła na produkcję, ale JEST już zastosowana lokalnie i na `db-test` — edycja w miejscu byłaby po cichu bezskuteczna | Plan   |

## Scope

**In scope:** migracja + kolekcja + typy + warstwa dostępu do danych; `toCatalogueCandidate`,
`appendCatalogueItems`, `buildCatalogueComparison`, `buildCatalogueSeed`; formularz i oba dialogi
katalogu, lista /katalog-prac, dialog „Zapisz do katalogu…".

**Out of scope:** backfill i konwersja istniejących wierszy cennika (produkcja jest pusta, kwota
zostaje kwotą); komórki nadpisania w rozpiskie (już obsługują brak nadpisania); rozszerzanie guardu
o kontekst inwestycji; współczynnik po stronie katalogu; E2E (bramka review).

## Architecture / Approach

`NULL` przechodzi przez wszystkie warstwy jako „brak stawki". Każdy czytelnik sprowadza się do
jednego pytania na plan: liczba czy nie. Przy wstawianiu `NULL` → brak nadpisania, więc
`subcontractorPrice` samo bierze współczynnik inwestycji docelowej — nowej matematyki nie ma.

## Phases at a Glance

| Faza                    | Co dowozi                                                      | Główne ryzyko                                                                      |
| ----------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. Model danych         | Kolumny nullowalne end-to-end, bez zmiany zachowania           | `Number(null)` = 0 — nieuważny mapper zamienia auto w 0 zł                         |
| 2. Reguła auto w logice | Cztery moduły wiedzą, co znaczy auto                           | Reguła wygranej wartości w seedzie musi rozstrzygnąć „auto kontra kwota"           |
| 3. UI                   | Auto jako świadomy wybór w formularzu, na liście i w dialogach | Warunkowa walidacja kwoty musi widzieć siostrzane pole (`superRefine` na obiekcie) |

**Prerequisites:** migracja `20260901_0` zastosowana lokalnie (jest); reset `db-test` przed
specami DB-backed.
**Estimated effort:** ~1–2 sesje, 3 fazy.

## Open Risks & Assumptions

- Zakłada, że produkcja nadal ma zero wierszy kosztorysu i katalogu — sprawdzalne, i to warunek
  całego „bez backfillu".
- Wyliczenie auto po stronie cennika w porównaniu opiera się na cenie j.m. **z katalogu**, nie z
  rozpiski — jeśli obie ceny się różnią, raport pokaże dwa rozjazdy zamiast jednego.

## Success Criteria (Summary)

- Praca zapisana z rozpiski bez własnego nadpisania trafia do cennika jako auto, a z własnym
  mnożnikiem jako kwota — i widać to na liście.
- Ta sama praca auto wstawiona do dwóch inwestycji o różnych współczynnikach daje dwie różne stawki.
- Puste pole kwoty przy odznaczonym auto nadal daje „jest wymagana" pod polem, nie toastem.
