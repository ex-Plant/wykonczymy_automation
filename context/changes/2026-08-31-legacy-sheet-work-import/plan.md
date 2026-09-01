# Import brakujących prac ze starych arkuszy do katalogu prac — plan

## Overview

Jednorazowa akcja (EX-753): katalog prac to dziś wzór jeden do jednego, a część prac żyje wyłącznie
w starych arkuszach inwestycji. Trzeba je stamtąd wyciągnąć i dołożyć do katalogu jako dodatkowe
pozycje z wyraźnym dopiskiem, żeby przy przeglądzie było widać, co przyszło z zewnątrz.

Akcja dzieje się w całości na lokalnej bazie. Produkcja dostaje wynik jako dane, nie powtórkę
przebiegów.

## Current State Analysis

**Katalog jest wzorem, dosłownie.** Inwestycja 90 („kosztorys wzór. nic nie dodajemy") niesie 373
pozycje w 14 sekcjach; szablon `kosztorys_presets` id=1 niesie te same 373 pozycje; katalog niesie
194 wiersze — dokładnie tyle, ile wychodzi unikalnych kluczy po deduplikacji. Wzór jest bazą i żaden
stary arkusz nie ma prawa nadpisać ceny pracy, która we wzorze stoi.

**Klucz tożsamości pracy dla katalogu już istnieje.** `catalogueKey(description, unit)`
(`src/lib/kosztorys/work-catalogue/catalogue-key.ts:15`) zdejmuje sekcję i numer wystąpienia — oba
zawężenia, o których mówi `change.md`, są już zdjęte. `itemKey`
(`src/lib/kosztorys/sheet-import/item-key.ts:39`) zostaje nietknięty; to osobny klucz dla importu
arkusza i on tych zawężeń potrzebuje.

**Maszyneria grupowania i raportowania rozbieżności też istnieje.** `buildCatalogueSeed`
(`src/lib/kosztorys/work-catalogue/build-catalogue-seed.ts:84`) grupuje po kluczu, zbiera wystąpienia
i raportuje konflikty na `clientPrice` / `wToolsRate` / `ownToolsRate`. Różni się od tego, czego
potrzebuje import, **wyłącznie regułą zwycięzcy**: tam wygrywa wartość najczęstsza, tu ma wygrać
najświeższy arkusz.

**Czytanie arkusza to 3 wywołania API na arkusz**, niezależnie od liczby zakładek: jeden
`spreadsheets.get` po tytuły zakładek i dwa `values.batchGet` (`UNFORMATTED_VALUE` + `FORMULA`),
`readImportGrids` (`src/lib/kosztorys/sheet-import/read-sheet.ts:56`). Przy 57 arkuszach to 171
zapytań. **W całej ścieżce Sheets nie ma ani retry, ani backoffu** — jedyna kontrola to 15-sekundowy
timeout na zapytanie (`read-sheet.ts:18`). Stąd rozdzielenie zassania od analizy.

**Rozpoznanie kolumn może paść i nigdy nie zgaduje.** `resolveLaborColumns`
(`src/lib/kosztorys/sheet-import/resolve-columns.ts:179`) przy dwuznaczności zwraca porażkę
(`:119-124`). Kolumny opisu i sekcji nie mają nagłówka — wyprowadza się je pozycyjnie z ciągu etapów
(`:196-207`). `sheet_column_mapping` jest wypełniony dla **3 z 57** arkuszy, więc 54 polegają na
automacie i nikt dziś nie wie, ile z nich się rozpozna.

**Konflikt stawek zwraca 0/0, nie „brak".** `resolveItemRates`
(`src/lib/kosztorys/sheet-import/resolve-rates.ts:212`) przy sporze między zakładkami woła
`unresolved` (`:113`), które daje `kind: 'conflict'` i zera. W katalogu 0 zł to prawdziwa zamrożona
kwota, a „brak" to `NULL` (auto, migracja `20260901_1_work_catalogue_auto_rates.ts`). Przepisanie
zer wprost wsypałoby do katalogu wyceny, których nikt nie ustalił.

**Warianty j.m. są policzalne, nie hipotetyczne.** W `kosztorys_items`: `szt` 1532, `m2` 1497, `mb`
1091, `kpl` 974, `pkt` 149, `klp` 38, `szt.` 22, puste 21, `kontener` 12, `m²` 6, `m.b.` 1, `n2` 1.
Dzisiejszy `fold()` (`src/lib/kosztorys/sheet-import/columns.ts:29`) robi lowercase, diakrytyki
i whitespace — `m2` i `m²` przechodzą przez niego jako dwie różne jednostki.

**Materiał: 57 arkuszy**, wszystkie przypięte do inwestycji (34 `active`, 23 `completed`), każdy
z `google_sheet_id` w `kosztoryses`. `investments.created_at` rozkłada się na 55 różnych dat od
2026-02-19 do 2026-08-30; `kosztoryses.created_at` ma tylko 17 różnych dat i połowę arkuszy
podpiętych hurtem 2026-06-09, więc jako sygnał świeżości jest bezużyteczny.

## Desired End State

Lokalny katalog prac zawiera wzór (194 pozycje, nietknięte) plus wszystkie prace znalezione
w starych arkuszach, których w nim nie było — każda z ceną, j.m., kategorią z sekcji arkusza,
stawkami podwykonawcy i wyraźnym dopiskiem `[stary arkusz]` w nazwie. Obok leży raport, z którego
widać dla każdej dołożonej pracy: ile razy wystąpiła, w jakich arkuszach, jaki jest rozrzut jej cen
i z którego arkusza wzięto cenę zwycięską. Osobne sekcje raportu wymieniają arkusze, których nie
udało się przeczytać, oraz pary nazw podejrzanie podobne do siebie.

Po ręcznym przeglądzie katalogu w aplikacji istnieje plik JSON z całym katalogiem i skrypt, który
wgrywa go insert-only do bazy nazwanej jawnie przy wywołaniu.

**Weryfikacja:** `select count(*) from work_catalogue_items` rośnie o dokładnie tyle, ile raport
zapowiedział; żadna z 194 pozycji wzoru nie zmieniła ceny ani stawek; każda nowa pozycja niesie
dopisek.

### Key Discoveries

- `catalogueKey` już zdejmuje sekcję i wystąpienie — `catalogue-key.ts:15`
- `insertCatalogueItems` jest insert-only z `ON CONFLICT (match_key) DO NOTHING` — `src/lib/db/work-catalogue.ts`
- `impliedCatalogueRate` zwraca `null` dla „auto" — `work-catalogue/catalogue-rate.ts:12`
- `stripSectionOrdinal` daje kategorię z nazwy sekcji — `work-catalogue/section-category.ts:3`
- Dice na bigramach z progiem 0.55 istnieje jako podpowiedź — `build-catalogue-comparison.ts:34`
- `readRateTabs` czyta **wszystkie** zakładki cennika, nie stałą parę — `resolve-rates.ts:189`
- `src/scripts/check-column-resolution.ts` to gotowy wzorzec pętli po arkuszach

## What We're NOT Doing

- **Nie sklejamy wariantów nazw.** Klucz zostaje dokładny; podobne pary idą do raportu jako
  kandydaci, decyzję podejmuje człowiek przy przeglądzie. Uzasadnienie z `change.md`: duplikat widać
  i się go kasuje, złej ceny po złym sklejeniu nie widać nigdy.
- **Nie poprawiamy literówek j.m.** `klp` (38×) i `n2` (1×) wchodzą jako osobne jednostki i lądują
  w raporcie jako podejrzane. Słownik literówek to decyzja podjęta na ślepo.
- **Nie naprawiamy arkuszy, których nie da się przeczytać.** Trafiają na listę z powodem, przebieg
  leci dalej.
- **Nie piszemy testów do skryptu jednorazowego** (`change.md`, ustalenie 8). Wyjątkiem jest
  `catalogue-key.test.ts` — normalizacja j.m. to trwała zmiana w kodzie aplikacji, a ten spec już
  istnieje i asercjonuje zachowanie j.m., więc musi zostać dociągnięty.
- **Nie dotykamy produkcji w trakcie akcji.** Skrypt importu nie ma ścieżki do innej bazy niż
  lokalna.
- **Nie dokładamy pola w bazie na znacznik** (`change.md`, ustalenie 5) — dopisek żyje w nazwie.
- **Nie ruszamy `itemKey`** ani ścieżki importu arkusza do kosztorysu.

## Implementation Approach

Trzy przebiegi rozdzielone dyskiem, dokładnie z powodu braku backoffu w kliencie Sheets: zassanie
(sieć, wolno, wznawialne) → analiza (bez sieci, powtarzalna do skutku) → raport i wsad. Kod
jednorazowy mieszka w `src/scripts/legacy-sheet-import/` i po akcji znika w całości. Jedyna zmiana,
która zostaje w aplikacji na stałe, to normalizacja j.m. w `catalogueKey` — musi tam być, bo klucz
jest wspólny dla importu i dla aplikacji.

## Critical Implementation Details

**Normalizacja j.m. musi wylądować w `catalogueKey`, nie w skrypcie.** Gdyby żyła tylko po stronie
importu, praca zapisana we wzorze jako `m2`, a w starym arkuszu jako `m²`, wyszłaby jako „brak
w katalogu" i wjechała duplikatem — czyli dokładnie ten skutek, któremu normalizacja ma zapobiec.
Konsekwencja: `match_key` w 194 istniejących wierszach trzeba przeliczyć, a zachowanie pickera
i „Porównaj z cennikiem" zmienia się (`m²` zacznie trafiać w `m2`). Produkcja tabeli jeszcze nie ma,
więc przeliczenie jest lokalnym `UPDATE`, nie migracją danych.

**Kolejność faz jest wymuszona.** Faza 1 musi wyprzedzić fazę 3, bo analiza porównuje znalezione
prace z istniejącymi `match_key` — przy starych kluczach „brakujące" policzyłoby się źle.

## Phase 1: Normalizacja j.m. w kluczu katalogu

### Overview

Ujednolicenie zapisu jednostki w kluczu katalogu i przeliczenie kluczy w istniejących wierszach.

### Changes Required:

#### 1. Normalizator jednostki

**File**: `src/lib/kosztorys/sheet-import/columns.ts`

**Intent**: Dołożyć obok `fold()` funkcję składającą wariant zapisu jednostki do jednej postaci —
zdjęcie kropek i uzgodnienie znaku `²` z cyfrą. Świadomie nie tyka literówek: `klp` i `n2` mają
zostać osobno.

**Contract**: `foldUnit(unit: unknown): string` — zbudowana na `fold()`, więc dziedziczy lowercase,
diakrytyki i whitespace. `szt.` → `szt`, `m.b.` → `mb`, `m²` → `m2`, `klp` → `klp`, `n2` → `n2`.
Mieszka obok `fold` w tym samym module, bo to ta sama warstwa składania nagłówków i komórek arkusza.

#### 2. Klucz katalogu

**File**: `src/lib/kosztorys/work-catalogue/catalogue-key.ts`

**Intent**: Przełączyć człon jednostki z `fold` na `foldUnit`. Człon opisu zostaje bez zmian —
sklejania wariantów nazw nie robimy.

**Contract**: `catalogueKey(description, unit)` — sygnatura bez zmian, zmienia się wyłącznie wartość
zwracana dla jednostek zapisanych wariantowo. Sentinel `NO_UNIT = '~'` zostaje.

#### 3. Przeliczenie kluczy w istniejących wierszach

**File**: `src/scripts/legacy-sheet-import/rekey-catalogue.ts`

**Intent**: Jednorazowy skrypt przeliczający `match_key` we wszystkich wierszach katalogu nową
funkcją. Musi wykryć sytuację, w której dwa wiersze schodzą się do jednego klucza (np. ta sama praca
zapisana raz z `m2`, raz z `m²`) i zamiast wysypać się na unikalności — wypisać taką parę do decyzji.

**Contract**: dry-run domyślnie, `--apply` zapisuje. Wypisuje liczbę wierszy przeliczonych, liczbę
kluczy zmienionych i listę kolizji. Baza brana z `DB_POSTGRES_URL`, czyli bare run trafia w lokalny
Docker.

#### 4. Spec klucza

**File**: `src/__tests__/lib/kosztorys/work-catalogue/catalogue-key.test.ts`

**Intent**: Dociągnąć istniejący spec o warianty zapisu jednostki i o to, czego celowo nie sklejamy.

**Contract**: przypadki `szt`/`szt.`, `m2`/`m²`, `mb`/`m.b.` dają ten sam klucz; `kpl`/`klp`
i `m2`/`n2` dają różne; pusta jednostka nadal daje `~`.

### Success Criteria:

#### Automated Verification:

- Spec klucza przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/catalogue-key.test.ts`
- Spec wsadu wzoru nadal przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-seed.test.ts`
- Po przeliczeniu katalog ma nadal 194 wiersze i zero duplikatów klucza: `select count(*), count(distinct match_key) from work_catalogue_items`

#### Manual Verification:

- Picker „Dodaj z katalogu" nadal pokazuje komplet pozycji i poprawnie oznacza te już wstawione do kosztorysu
- „Porównaj z cennikiem" na inwestycji z pozycjami w `m²` przestaje raportować je jako brak w cenniku

**Implementation Note**: gdy automatyczna weryfikacja przechodzi, commituj i leć dalej — ręczne
sprawdzenia zbieramy raz, na końcu, do rejestru manual-checks.

---

## Phase 2: Przebieg A — zassanie arkuszy na dysk

### Overview

Jedno przejście po wszystkich arkuszach, zapis surowych siatek na dysk, bez grama analizy.

### Changes Required:

#### 1. Skrypt zassania

**File**: `src/scripts/legacy-sheet-import/fetch-grids.ts`

**Intent**: Wyliczyć wszystkie arkusze z bazy, przejść po nich sekwencyjnie i zapisać na dysk to, co
zwraca `readImportGrids`, razem z metadanymi potrzebnymi później do reguły „najświeższy arkusz".
Przebieg ma być wznawialny — arkusz już leżący na dysku jest pomijany, żeby 429 albo timeout
w połowie nie kosztował całego przejścia.

**Contract**: enumeracja SQL-em z `kosztoryses` złączonym z `investments`, zwracająca
`{ sheetId, googleSheetId, sheetName, investmentId, investmentName, investmentCreatedAt }`
posortowane malejąco po `investments.created_at`, a przy remisie malejąco po `investments.id` — ta
kolejność JEST regułą świeżości i zapisuje się razem z siatkami. Klient przez
`getReadonlySheetsClient()`. Jeden plik na arkusz w katalogu roboczym, nazwany `google_sheet_id`.
Błąd pojedynczego arkusza klasyfikowany przez `classifySheetFailure` i zapisany jako plik porażki,
nie przerywa pętli. Katalog roboczy poza repo i poza `/tmp`, ścieżka konfigurowalna zmienną
środowiskową z sensownym domyślnym.

Sekwencyjność jest tu decyzją, nie niedopatrzeniem: w kliencie Sheets nie ma backoffu, a jedyny
bulkowy skrypt w repo (`scripts/share-sheets-with-reader.mjs:53`) też jest ściśle sekwencyjny.

### Success Criteria:

#### Automated Verification:

- Po przebiegu katalog roboczy zawiera plik dla każdego z 57 arkuszy — siatki albo zapis porażki
- Powtórne uruchomienie nie wykonuje żadnego zapytania do Google i kończy się od razu
- Skrypt kończy się kodem 0 mimo obecności arkuszy nieprzeczytanych

#### Manual Verification:

- Liczba arkuszy zakończonych porażką i rozkład powodów są sensowne (nie: „wszystkie 57 forbidden")

---

## Phase 3: Przebieg B — analiza offline i raport

### Overview

Parsowanie z dysku, zbudowanie listy prac brakujących w katalogu i wypuszczenie raportu do przeglądu.

### Changes Required:

#### 1. Parsowanie arkusza z dysku

**File**: `src/scripts/legacy-sheet-import/parse-dumped-sheet.ts`

**Intent**: Dla jednej zassanej siatki odtworzyć to, co robi ścieżka importu: rozpoznać kolumny,
sparsować zakładkę robocizny, wczytać zakładki cennika i rozstrzygnąć stawki. Arkusz, którego kolumny
się nie rozpoznają, zwraca porażkę z powodem zamiast rzucać.

**Contract**: wejście — jeden zapis z dysku plus jego `sheet_column_mapping` z bazy; wyjście — albo
lista prac `{ description, unit, clientPrice, wToolsRate, ownToolsRate, sectionName }`, albo
`{ failure, reason }`. Składane z istniejących `resolveLaborColumns`, `parseLaborTab`, `readRateTabs`
i `resolveItemRates`. Cena to `clientPrice` z pozycji przed rabatem — rabat jest właściwością
konkretnej budowy, nie pracy.

**Stawki:** `kind: 'agree' | 'single'` → kwota z rozstrzygnięcia; `kind: 'conflict' | 'missing'` →
`null`, czyli auto. Zera z `unresolved` nie mają prawa dojechać do katalogu; powód konfliktu leci do
raportu.

#### 2. Zebranie kandydatów

**File**: `src/scripts/legacy-sheet-import/collect-candidates.ts`

**Intent**: Zgrupować prace ze wszystkich przeczytanych arkuszy po `catalogueKey`, odrzucić te, które
już są w katalogu, i dla każdej pozostałej wybrać cenę oraz stawki z najświeższego arkusza, w którym
wystąpiła. Zachować pełną listę wystąpień, bo to ona jest treścią raportu.

**Contract**: `collectCandidates(sheets: readonly ParsedSheetT[], existing: ReadonlySet<string>)` →
`{ candidates: CandidateT[]; skipped: number }`, gdzie `CandidateT` niesie `CatalogueSeedItemT` plus
`occurrences: { sheetName, investmentName, clientPrice, wToolsRate, ownToolsRate }[]` w kolejności od
najświeższego. Zwycięzcą jest **pierwsze** wystąpienie — arkusze przychodzą już posortowane z fazy 2,
więc reguła świeżości nie jest tu wyliczana po raz drugi. Kategoria z `stripSectionOrdinal` nazwy
sekcji zwycięskiego wystąpienia. Nazwa dostaje prefiks `[stary arkusz] ` — prefiks, nie sufiks, bo
listing katalogu sortuje po `description` w obrębie kategorii, więc dopisane pozycje kleją się
w jedną grupę.

Uwaga na kolejność: dopisek zmienia opis, więc `matchKey` liczy się z opisu **surowego**, przed
doklejeniem prefiksu. Inaczej ta sama praca dołożona dziś i porównana jutro nie trafiłaby sama
w siebie.

#### 3. Kandydaci na duplikaty

**File**: `src/scripts/legacy-sheet-import/similar-names.ts`

**Intent**: Wskazać pary nazw podejrzanie podobne — kandydat do kandydata i kandydat do pozycji już
w katalogu — żeby człowiek mógł je scalić ręcznie. Wyłącznie sygnał do raportu; nic nie skleja.

**Contract**: miara Dice na bigramach, ta sama, którą liczy `build-catalogue-comparison.ts:34`,
wyciągnięta do wspólnego użycia zamiast przepisana. Próg 0.55 jak tam. Zwraca pary z wynikiem,
posortowane malejąco.

#### 4. Raport

**File**: `src/scripts/legacy-sheet-import/report.ts`

**Intent**: Złożyć wszystko w jeden czytelny plik do przejrzenia przed wsadem.

**Contract**: sekcje — (1) podsumowanie liczbowe: arkusze przeczytane / nieprzeczytane, prace
znalezione, już w katalogu, do dołożenia; (2) arkusze nieprzeczytane z powodem i nazwą inwestycji;
(3) prace do dołożenia, dla każdej: nazwa, j.m., kategoria, cena zwycięska z nazwą arkusza, stawki,
liczba wystąpień i rozrzut cen `min–max`, a przy stawce „auto" — powód; (4) podejrzane j.m. (`klp`,
`n2` i cokolwiek innego spoza znanego zbioru) z liczbą wystąpień; (5) kandydaci na duplikaty nazw.
Rozrzut cen jest **informacją przy weryfikacji**, nigdy oceną — nazywamy go „różni się od cennika",
nigdy „jest błędny" (napięcie z `roadmap.md:420`: ta sama praca kosztuje różnie w różnych
inwestycjach).

#### 5. Wejście przebiegu

**File**: `src/scripts/legacy-sheet-import/analyze.ts`

**Intent**: Spiąć fazę 3 w jedno wywołanie: wczytaj dysk, sparsuj, zbierz kandydatów, wypisz raport.
Bez ruchu sieciowego i bez zapisu do bazy.

**Contract**: czyta katalog roboczy z fazy 2 i `listCatalogueMatchKeys` z bazy; pisze raport do pliku
i wypisuje podsumowanie na stdout. Nie przyjmuje `--apply` — zapis jest fazą 4.

### Success Criteria:

#### Automated Verification:

- Przebieg kończy się bez ani jednego zapytania do Google (weryfikowalne odcięciem sieci)
- Raport powstaje i jego podsumowanie liczbowe zgadza się z sumą sekcji szczegółowych
- Żaden kandydat nie ma stawki równej 0 pochodzącej z `kind: 'conflict'`
- Suma „już w katalogu" + „do dołożenia" równa się liczbie unikalnych kluczy znalezionych w arkuszach

#### Manual Verification:

- Prace na liście „do dołożenia" wyglądają na realne prace, nie na wiersze nagłówkowe ani stopkę
- Rozrzut cen przy pozycjach z wieloma wystąpieniami jest wiarygodny (nie: 12 zł do 12 000 zł)
- Lista arkuszy nieprzeczytanych jest krótka na tyle, żeby akcja miała sens

---

## Phase 4: Wsad lokalny i eksport na produkcję

### Overview

Dołożenie kandydatów do lokalnego katalogu, a po ręcznym przeglądzie — przeniesienie całego katalogu
na produkcję jako dane.

### Changes Required:

#### 1. Wsad lokalny

**File**: `src/scripts/legacy-sheet-import/apply.ts`

**Intent**: Wziąć kandydatów z fazy 3 i wstawić ich do lokalnego katalogu. Dry-run domyślnie,
dokładnie jak `seed-work-catalogue.ts`.

**Contract**: `--apply` woła `insertCatalogueItems`, które jest insert-only z `ON CONFLICT
(match_key) DO NOTHING`, więc wsad nie ma jak nadpisać żadnej z 194 pozycji wzoru. Wypisuje liczbę
utworzonych. **Nie przyjmuje wskazania innej bazy** — akcja dzieje się lokalnie i skrypt nie ma
ścieżki na produkcję.

#### 2. Eksport katalogu

**File**: `src/scripts/legacy-sheet-import/export-catalogue.ts`

**Intent**: Po przeglądzie zrzucić cały katalog — wzór i dołożone prace razem — do jednego pliku,
który pojedzie na produkcję.

**Contract**: JSON z tablicą pozycji bez `id` (`CatalogueSeedItemT`), posortowaną po `category`,
`description`, żeby diff pliku był czytelny. `match_key` **przeliczany przy zapisie**, nie kopiowany
z bazy — inaczej ręczna zmiana nazwy przy przeglądzie zostawiłaby klucz wskazujący na starą.
Plik ląduje w repo, żeby był widoczny w diffie przed wgraniem.

#### 3. Wsad na wskazaną bazę

**File**: `src/scripts/legacy-sheet-import/import-catalogue.ts`

**Intent**: Wgrać plik z eksportu do bazy nazwanej jawnie przy wywołaniu.

**Contract**: kształt i nagłówek `seed-work-catalogue.ts` — dry-run domyślnie, `--apply` zapisuje,
baza z `DB_POSTGRES_URL` podanego przy wywołaniu, bare run trafia w lokalny Docker. Insert-only po
`match_key`, więc powtórne uruchomienie dokłada wyłącznie to, czego nie ma. Wypisuje liczbę pozycji
w pliku, ile już jest w bazie i ile powstanie.

### Success Criteria:

#### Automated Verification:

- Dry-run wypisuje liczbę do utworzenia i nie zmienia liczby wierszy w katalogu
- Po `--apply` liczba wierszy rośnie dokładnie o liczbę zapowiedzianą przez raport
- Wszystkie 194 pozycje wzoru mają niezmienione `client_price`, `w_tools_rate`, `own_tools_rate`
- Każda nowa pozycja niesie prefiks `[stary arkusz] ` w `description`
- Eksport wczytany z powrotem przez wsad na czystą bazę daje tę samą liczbę wierszy (round-trip)
- Powtórne uruchomienie wsadu tworzy 0 pozycji

#### Manual Verification:

- Katalog w aplikacji daje się przejrzeć: dopisane pozycje kleją się w grupę, dopisek widać
- Skasowanie dopisku przez edycję pozycji działa i nie psuje dopasowania w „Porównaj z cennikiem"
- Picker „Dodaj z katalogu" wstawia dołożoną pracę do kosztorysu z poprawną ceną i stawkami

---

## Testing Strategy

`change.md` (ustalenie 8) wyłącza testy dla kodu jednorazowego i to zostaje w mocy: skrypty pod
`src/scripts/legacy-sheet-import/` znikają po akcji, więc spec do nich byłby martwy w chwili
napisania. Sprawdzianem tego kodu jest raport, który człowiek czyta przed wsadem.

Wyjątek to faza 1: `catalogueKey` jest kodem aplikacji, ma istniejący spec i zmiana dotyka pickera
oraz porównania z cennikiem. Ten spec zostaje dociągnięty o warianty zapisu jednostki i o pary,
których celowo nie sklejamy.

## Migration Notes

Migracji schematu nie ma. Przeliczenie `match_key` w fazie 1 to lokalny `UPDATE` na 194 wierszach —
produkcja tabeli `work_catalogue_items` jeszcze nie ma, bo katalog żyje na gałęziach, nie na `main`.
Gdy katalog pojedzie na produkcję, poprawny klucz będzie już w pliku eksportu.

Kolejność wobec produkcji: merge katalogu na `main` → migracja `20260901_0` i `20260901_1` (dodają
tabelę, więc **przed** pushem, zgodnie z regułą kierunku migracji w AGENTS.md) → wsad pliku eksportu.
Wsad robi człowiek, nie agent.

## Whole-tree Gate

Uruchamiane **raz**, po ostatniej fazie.

- Typy: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy jednostkowe: `pnpm test`
- Build: `pnpm build`

## References

- Ustalenia z właścicielem: `context/changes/2026-08-31-legacy-sheet-work-import/change.md`
- Katalog prac (zbudowany): `context/changes/2026-08-31-work-item-catalog/plan.md`
- Wzorzec skryptu jednorazowego: `src/scripts/seed-work-catalogue.ts`
- Wzorzec pętli po arkuszach: `scripts/share-sheets-with-reader.mjs:53`, `src/scripts/check-column-resolution.ts`
- Napięcie „ta sama praca, różna cena": `context/foundation/roadmap.md:420`

## Progress

> Konwencja: `- [ ]` do zrobienia, `- [x]` zrobione. Dopisz ` — <commit sha>`, gdy krok wyląduje. Nie zmieniaj tytułów kroków.

### Phase 1: Normalizacja j.m. w kluczu katalogu

#### Automated

- [x] 1.1 Spec klucza przechodzi — f8476290
- [x] 1.2 Spec wsadu wzoru nadal przechodzi — f8476290
- [x] 1.3 Katalog ma 194 wiersze i zero duplikatów klucza po przeliczeniu — f8476290

### Phase 2: Przebieg A — zassanie arkuszy na dysk

#### Automated

- [x] 2.1 Katalog roboczy zawiera plik dla każdego z 57 arkuszy
- [x] 2.2 Powtórne uruchomienie nie odpytuje Google
- [x] 2.3 Przebieg kończy się kodem 0 mimo arkuszy nieprzeczytanych

### Phase 3: Przebieg B — analiza offline i raport

#### Automated

- [ ] 3.1 Przebieg działa bez ruchu sieciowego
- [ ] 3.2 Podsumowanie raportu zgadza się z sekcjami szczegółowymi
- [ ] 3.3 Żaden kandydat nie ma stawki 0 pochodzącej z konfliktu
- [ ] 3.4 „już w katalogu" + „do dołożenia" = liczba unikalnych kluczy z arkuszy

### Phase 4: Wsad lokalny i eksport na produkcję

#### Automated

- [ ] 4.1 Dry-run nie zmienia liczby wierszy
- [ ] 4.2 Po `--apply` przyrost zgadza się z raportem
- [ ] 4.3 194 pozycje wzoru mają niezmienione ceny i stawki
- [ ] 4.4 Każda nowa pozycja niesie prefiks `[stary arkusz] `
- [ ] 4.5 Eksport round-trip daje tę samą liczbę wierszy
- [ ] 4.6 Powtórne uruchomienie wsadu tworzy 0 pozycji
