# Import brakujących prac ze starych arkuszy — plan brief

> Pełny plan: `context/changes/2026-08-31-legacy-sheet-work-import/plan.md`
> Ustalenia z właścicielem: `context/changes/2026-08-31-legacy-sheet-work-import/change.md`

## Co i po co

Katalog prac to dziś wzór jeden do jednego — 194 pozycje wprost z inwestycji 90. Część prac żyje
wyłącznie w starych arkuszach inwestycji i do katalogu nigdy nie trafiła. Jednorazowa akcja (EX-753)
wyciąga je z 57 arkuszy i dokłada do katalogu z wyraźnym dopiskiem, żeby przy przeglądzie było widać,
co przyszło z zewnątrz.

## Punkt wyjścia

Katalog istnieje i jest wypełniony wzorem, więc blokada kolejnościowa z `change.md` jest zdjęta.
Klucz tożsamości pracy (`catalogueKey`) już zdejmuje sekcję i numer wystąpienia, a maszyneria
grupowania z raportem rozbieżności stoi w `buildCatalogueSeed` — różni się od potrzebnej wyłącznie
regułą zwycięzcy. Czytanie arkusza to 3 wywołania API, bez retry i bez backoffu w całej ścieżce.

## Stan docelowy

Lokalny katalog niesie wzór plus wszystkie prace znalezione w starych arkuszach, każda z ceną,
j.m., kategorią, stawkami i dopiskiem `[stary arkusz]`. Obok leży raport mówiący dla każdej dołożonej
pracy, ile razy wystąpiła, w jakich arkuszach, jaki jest rozrzut jej cen i skąd wzięto cenę zwycięską.
Po ręcznym przeglądzie katalog jedzie na produkcję jako plik JSON wgrywany insert-only.

## Podjęte decyzje

| Decyzja                | Wybór                                                  | Dlaczego                                                                                                                                      | Źródło                 |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Baza cenowa            | Wzór (inwestycja 90)                                   | Katalog JEST wzorem; żaden stary arkusz nie nadpisuje ceny pracy, która we wzorze stoi                                                        | Właściciel             |
| Cena pracy spoza wzoru | Z najświeższego arkusza, w którym występuje            | Świeższa budowa niesie świeższą cenę                                                                                                          | change.md              |
| Miara świeżości        | `investments.created_at`, remis po `investments.id`    | 55 różnych dat vs 17 w `kosztoryses.created_at`, gdzie połowa arkuszy podpięta hurtem jednego dnia                                            | Plan                   |
| Arkusz nieczytelny     | Pomiń, wypisz w raporcie                               | Akcja jednorazowa ma się skończyć za pierwszym podejściem; lista mówi, co ewentualnie dobrać ręcznie                                          | Właściciel             |
| Sporne stawki          | `NULL` = auto, nigdy 0                                 | `resolveItemRates` zwraca 0/0 przy konflikcie, a w katalogu 0 zł to prawdziwa zamrożona kwota, której przy przeglądzie nikt nie zakwestionuje | Właściciel             |
| Normalizacja j.m.      | Interpunkcja i zapis znakowy (`szt.`→`szt`, `m²`→`m2`) | Skleja wyłącznie to, co bezspornie jest tą samą jednostką                                                                                     | Właściciel             |
| Literówki j.m.         | Zostają osobno, idą do raportu                         | `klp` (38×) i `n2` (1×) — słownik literówek to decyzja na ślepo                                                                               | Właściciel             |
| Warianty nazw          | Nie sklejamy; raportujemy kandydatów                   | Duplikat widać i się go kasuje; złej ceny po złym sklejeniu nie widać nigdy                                                                   | change.md + właściciel |
| Eksport na produkcję   | JSON + skrypt wsadowy insert-only                      | Kształt `seed-work-catalogue.ts`, więc przeróbka; plik widać w diffie przed wgraniem                                                          | Właściciel             |

## Zakres

**W zakresie:** normalizacja j.m. w kluczu katalogu i przeliczenie 194 istniejących kluczy;
zassanie 57 arkuszy na dysk; analiza offline z raportem; wsad kandydatów do lokalnego katalogu;
eksport całego katalogu do pliku i skrypt wgrywający go do wskazanej bazy.

**Poza zakresem:** sklejanie wariantów nazw; słownik literówek j.m.; naprawianie arkuszy, których
nie da się przeczytać; testy do kodu jednorazowego; pole w bazie na znacznik; zmiany w `itemKey`
i w ścieżce importu arkusza do kosztorysu; jakikolwiek dostęp skryptu importu do produkcji.

## Podejście

Trzy przebiegi rozdzielone dyskiem — zassanie (sieć, sekwencyjnie, wznawialne) → analiza (bez sieci,
powtarzalna do skutku) → raport i wsad. Rozdzielenie jest wymuszone brakiem backoffu w kliencie
Sheets: 57 arkuszy to 171 zapytań, a 429 w połowie nie może kosztować całego przejścia. Kod
jednorazowy mieszka w `src/scripts/legacy-sheet-import/` i po akcji znika w całości. Jedyna trwała
zmiana w aplikacji to normalizacja j.m. w `catalogueKey` — musi tam być, bo klucz jest wspólny dla
importu i dla aplikacji.

## Fazy

| Faza                             | Co daje                                            | Główne ryzyko                                                                                |
| -------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. Normalizacja j.m. w kluczu    | `m²` i `m2` to jedna praca; 194 klucze przeliczone | Zmiana dotyka pickera i „Porównaj z cennikiem"; dwa wiersze mogą zejść się do jednego klucza |
| 2. Przebieg A — zassanie         | 57 arkuszy na dysku, wznawialnie                   | 429 z Google przy braku backoffu; arkusze nieczytelne                                        |
| 3. Przebieg B — analiza i raport | Lista prac do dołożenia z pełnym uzasadnieniem     | Rozpoznanie kolumn pada na nieznanej części z 54 arkuszy bez mapowania                       |
| 4. Wsad i eksport                | Katalog uzupełniony lokalnie; plik na produkcję    | Dopisek zmienia opis, więc `matchKey` musi liczyć się z opisu surowego                       |

**Warunki wstępne:** katalog wypełniony wzorem (spełnione — 194 wiersze); `GOOGLE_SERVICE_ACCOUNT_JSON`
z dostępem Viewer do arkuszy; lokalna baza z odtworzonego dumpa produkcyjnego.

**Szacowany rozmiar:** ~2 sesje na fazy 1–3, plus osobna sesja na przegląd katalogu przez właściciela
i wsad na produkcję.

## Otwarte ryzyka i założenia

- **Ile z 54 arkuszy bez mapowania kolumn w ogóle się sparsuje, nie wie dziś nikt.** Faza 3 to
  odpowie; jeśli odsetek okaże się wysoki, akcja może być warta niewiele i decyzja o ręcznym
  uzupełnieniu mapowań wraca na stół.
- Zakładam, że rozrzut cen w raporcie wystarczy do oceny wiarygodności pozycji. Gdyby nie wystarczał,
  raport trzeba będzie rozszerzyć, nie zmieniać reguły ceny.
- Przeliczenie `match_key` może wykryć kolizję (ta sama praca zapisana raz z `m2`, raz z `m²`).
  Skrypt ma to wypisać do decyzji, a nie wysypać się na unikalności.

## Kryteria powodzenia

- Katalog niesie prace, których wcześniej nie było, a każda z nich jest rozpoznawalna po dopisku.
- Żadna z 194 pozycji wzoru nie zmieniła ceny ani stawek.
- Przegląd katalogu robi się raz, a produkcja dostaje jego wynik — bez powtarzania zassania,
  analizy i przeglądu.
