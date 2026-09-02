# „Problemy": ta sama praca wyceniona różnie — brief

> Pełny plan: `context/changes/2026-09-02-divergent-price-for-same-work/plan.md`

## What & Why

Kosztorys potrafi wyceniać tę samą pracę różnie w różnych sekcjach, a edytor nie mówi o tym nic.
Wsad katalogu widzi na samym wzorze 46 rozbieżności (9 na „Cena j.m."), ale melduje je na konsolę.
Dokładamy jedną diagnostykę do „Problemy", która takie pozycje zapala. Zakres to **wyłącznie
widoczność** — właściciel sam rozstrzyga, czy dana różnica jest błędem.

## Starting Point

`ROW_CONDITIONS` sądzi jeden wiersz naraz. Fakt spoza wiersza wchodzi przez `RowConditionCtxT` —
`hasSettledMaterial` jest dokładnym precedensem. Klucz grupujący `catalogueKey(opis, j.m.)` już
istnieje, zdejmuje sekcję i skleja `m²` z `m2`.

## Desired End State

W „Problemy" jest wiersz „Pozycje z inną ceną j.m. niż ta sama praca gdzie indziej (9)". Znika przy
zerze, kliknięty zawęża grid do tych pozycji i odsłania „Cena j.m.". Ton „do przejrzenia".

## Key Decisions Made

| Decyzja               | Wybór                     | Dlaczego                                                   | Źródło     |
| --------------------- | ------------------------- | ---------------------------------------------------------- | ---------- |
| Ton                   | `worklist`                | Inna łazienka może być świadomie droższa — to nie usterka  | Właściciel |
| Licznik               | pozycje, nie grupy        | Zgodnie z resztą rejestru i z tym, co widać po kliknięciu  | Właściciel |
| Rabat                 | poza zakresem             | Diagnostyka sądzi „Cena j.m."                              | Właściciel |
| Pozycja bez ceny j.m. | nie wchodzi do porównania | Ma już dwie własne diagnostyki; liczniki zostają rozłączne | Plan       |
| Pusty opis            | nigdy nie grupuje         | Dwie puste pozycje to nie „ta sama praca"                  | Plan       |
| Zasięg grupy          | cały kosztorys            | Rozjazd właściciela biegnie Łazienka 1 ↔ Kuchnia           | Plan       |
| Zwijanie sekcji       | `sectionLabel: null`      | Zwinięcie sekcji po rozjeździe cen chowałoby wycenę        | Plan       |

## Scope

**W zakresie:** czysta funkcja grupująca + jej spec; jeden wpis w rejestrze; nowe pole w ctx
przeszyte przez pięć hostów; case'y w specu rejestru.

**Poza zakresem:** rabat, stawki wykonawcy, liczenie grup, jakakolwiek automatyczna poprawka,
zmiany we wsadzie katalogu, migracje, nowa kolumna w gridzie.

## Architecture / Approach

Grupowanie liczy się raz, w memo huka, i wchodzi do `RowConditionCtxT` jako `Set<number>`. Reguła
w rejestrze zostaje jednowierszowa i O(1). Funkcja mieszka w `src/lib/kosztorys/`, więc testuje się
bez renderera.

## Phases at a Glance

| Faza                     | Co dostarcza                        | Ryzyko                                    |
| ------------------------ | ----------------------------------- | ----------------------------------------- |
| 1. Funkcja grupująca     | `divergentPriceRowIds(rows)` + spec | Wariant j.m. — pokryty testem z EX-761    |
| 2. Wpięcie do „Problemy" | Wpis rejestru + przeszycie ctx      | Grupowanie w `matches` = koszt kwadratowy |

**Warunki wstępne:** żadnych. **Rozmiar:** jedna sesja, ~150–200 linii netto.

## Open Risks & Assumptions

- Liczba 9, którą melduje wsad katalogu, może nie zgodzić się z licznikiem: wsad liczy rozbieżne
  **prace**, a my liczymy **pozycje**. To nie defekt, tylko dwie różne jednostki.
- Zakładam, że folding opisu w `catalogueKey` nie skleja prac, których właściciel uważa za różne —
  ta sama reguła stoi już za katalogiem, więc rozjazd byłby jego, a nie nasz.

## Success Criteria (Summary)

- Na wzorze problem zapala się i pokazuje pozycje „Dwukrotne gruntowanie…" ze wszystkich sekcji.
- Na kosztorysie bez rozjazdów wiersz w ogóle się nie renderuje.
- Żadna pozycja nie jest liczona jednocześnie tu i w „bez ceny j.m.".
