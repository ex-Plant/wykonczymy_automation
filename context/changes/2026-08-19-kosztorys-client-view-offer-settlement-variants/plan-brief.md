# Warianty „Oferta / Rozliczenie" w podglądzie inwestora — Plan Brief

> Pełny plan: `context/changes/2026-08-19-kosztorys-client-view-offer-settlement-variants/plan.md`
> Ustalenia: `context/changes/2026-08-19-kosztorys-client-view-offer-settlement-variants/change.md`

## What & Why

Inwestycja dostaje dwa zestawy kolumn podglądu inwestora naraz — `OFFER` i `SETTLEMENT` — plus
informację, który jest aktywny. Dziś jest jeden zestaw, więc przejście z etapu ofertowania do
rozliczania znaczy ręczne przeklikanie ~20 checkboxów w obie strony, za każdym razem, bo oferta
pokazuje przedmiar i cenę, a rozliczenie pomiar, etapy i % wykonania.

## Starting Point

Jeden wiersz `kosztorys-client-view` na inwestycję (`hiddenColumns` + `hideEmptyRows`), firmowy
global domyślnych o tym samym kształcie, resolver `getClientViewSettings` (wiersz ⟶ global ⟶
domyślna z kodu) i jedno ciało formularza dzielone przez okna „Ustawienia podglądu inwestora"
i „Udostępnij". Nikt nie odklikał jeszcze żadnego wariantu — nie ma danych do zachowania.

## Desired End State

W oknie ustawień na górze przełącznik „Oferta | Rozliczenie". Przełączenie zmienia edytowany zestaw
ticków i nic nie zapisuje. Gdy wybrany wariant różni się od zapisanego, nad stopką stoi ostrzeżenie,
że zapis zmieni to, co widzi inwestor, a przycisk nazywa skutek: „Zapisz i pokaż rozliczenie".
Ten sam przełącznik i to samo ostrzeżenie działają w kroku ustawień okna „Udostępnij".

## Key Decisions Made

| Decyzja                | Wybór                                                                         | Dlaczego                                                                                                                                          | Źródło  |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Czym jest wariant      | Trwały tryb inwestycji, nie preset w oknie                                    | Przełączenie etapu nie może kasować odklikanych kolumn drugiego wariantu                                                                          | Rozmowa |
| Edytowany vs aktywny   | Jedno i to samo                                                               | Nie ma sytuacji „edytuję ofertę, pokazuję rozliczenie"; dwa przełączniki w jednym oknie myliłyby się ze sobą                                      | Rozmowa |
| Potwierdzenie zmiany   | Okienko „Uwaga — zmiana widoczna dla inwestora!” + przycisk nazywający skutek | Wzorzec zmiany sposobu rozliczenia materiałów: dokładnie ten sam dialog i ten sam flow (korekta 2026-08-20 — patrz „Odstępstwa” w plan.md)        | Rozmowa |
| „Zapisz jako domyślne" | Jeden wariant (wybrany), bez domyślnego trybu                                 | Ślepe nadpisanie globalu skasowałoby domyślne drugiego wariantu; firmowy tryb przestawiłby naraz wszystkie żywe linki (korekta 2026-08-20)        | Rozmowa |
| Schemat                | Jeden `variants` (jsonb) + `mode`                                             | Jedna kolumna niezależnie od liczby wariantów; sanitizer i tak waliduje kształt                                                                   | Plan    |
| Okno „Udostępnij"      | Ten sam formularz z przełącznikiem                                            | Wspólne ciało zostaje jednym źródłem tego, co widać; generując link wybierasz wariant                                                             | Plan    |
| Nazwa w kodzie         | `ClientViewModeT` z prefiksem                                                 | `SettlementModeT` to sposób rozliczenia robocizny — inne pojęcie, to samo słowo                                                                   | Plan    |
| Migracja               | Addytywna: add + kasowanie wierszy, zero backfillu                            | Nikt nie odklikał jeszcze żadnego wariantu (owner, 2026-08-19); drop w tym samym kroku nie ma bezpiecznej kolejności deployu (korekta 2026-08-20) | Rozmowa |

## Scope

**W zakresie:** dwa warianty na inwestycję + tryb aktywny; osobne domyślne firmowe per wariant; dwa
różne domyślne z kodu; przełącznik + ostrzeżenie + wyraźny zapis w obu oknach; migracja i pola
Payloada; testy sanitizera i resolvera.

**Poza zakresem:** backfill i zgodność ze starym kształtem; skrót przestawiania trybu poza oknem
ustawień; trzeci wariant lub warianty definiowane przez użytkownika; zmiany w allowliście
`PREVIEW_VISIBLE_COLUMNS`, w podsumowaniu, w cache'owaniu i w torze wejścia po tokenie; E2E.

## Architecture / Approach

Rozdzielenie dwóch kształtów, które dziś są jednym typem. `ClientViewConfigT`
(`{ mode, variants: { OFFER, SETTLEMENT } }`) to kształt **zapisany** — widzą go okna, akcje zapisu
i baza. `ClientViewSettingsT` (dzisiejszy płaski `{ hiddenColumns, hideEmptyRows }`) to kształt
**serwowany** — widzi go podgląd, edytor i wejście po tokenie, i nie drga. Mostem jest jedna czysta
funkcja `clientViewSettingsForMode`, więc `getClientViewSettings` zachowuje sygnaturę i cały tor
podglądu zostaje nietknięty.

## Phases at a Glance

| Faza                 | Co dowozi                                                | Główne ryzyko                                                                             |
| -------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1. Model i sanitizer | Kształt, reguły domyślnych, most do kształtu serwowanego | Rozjazd między „domyślną z kodu" a sanitizerem — dziś to jedna funkcja i musi taką zostać |
| 2. Schemat           | Migracja + pola kolekcji i globalu                       | Destrukcyjny `DROP COLUMN` — kolejność wdrożenia na preview                               |
| 3. Odczyt i zapis    | Resolver, endpoint okien, akcje zapisu                   | Zapis domyślnych jednego wariantu kasujący drugi                                          |
| 4. UI                | Przełącznik, ostrzeżenie, wyraźny zapis w obu oknach     | Przełącznik zapisujący coś przed kliknięciem zapisu                                       |

**Prerequisites:** lokalny Postgres na 5433 (`docker compose up -d`).
**Estimated effort:** jedna sesja, cztery fazy.

## Open Risks & Assumptions

- Migracja jest destrukcyjna wobec **preview/staging** (kolumny tam są i kod je czyta): najpierw
  żywy deploy, potem `pnpm db:migrate:preview`; odwrotnie = Postgres 42703. Wobec **produkcji** jest
  addytywna — `main` nie ma jeszcze ani migracji bazowej, ani kolekcji.
- Oba domyślne zestawy pochodzą ze zrzutów właściciela (2026-08-19): rozliczenie to nadzbiór
  oferty o pomiar, razem netto, etapy i % wykonania. Jeden klik „Zapisz jako domyślne" i tak je
  nadpisuje, więc ewentualna pomyłka jest tania.

## Success Criteria (Summary)

- Inwestycja w trybie „Oferta" serwuje pod linkiem kolumny ofertowe; po przestawieniu na
  „Rozliczenie" ten sam link serwuje kolumny rozliczeniowe.
- Kolumny odklikane w jednym wariancie są nietknięte po przejściu do drugiego i z powrotem.
- Żadne przełączenie nie zapisuje niczego, dopóki nie klikniesz zapisu — a gdy zapis zmieni widok
  inwestora, mówi o tym wprost, zanim go klikniesz.
