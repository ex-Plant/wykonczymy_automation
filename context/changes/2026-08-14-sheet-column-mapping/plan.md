# Plan: Import kosztorysu — ręczne przypisanie kolumn i czytelne komunikaty, gdy arkusz się nie odczyta

**Change ID:** `sheet-column-mapping` · **Linear:** EX-690
**Upstream:** `change.md` (dowód z Żupniczej, decyzje właściciela)

## Overview

Dwie ślepe uliczki w jednym oknie „Pobierz kosztorys z arkusza Google", obie kończące się
komunikatem, po którym nie da się nic zrobić:

1. **Nierozpoznana kolumna.** Żupnicza 18/73 (inwestycja 84) rozbija wartość netto na `S = „Wartość
netto przedmiar"` i `T = „Wartość netto pomiar z natury"`, a dopasowanie szuka dokładnie
   `wartosc netto`. Arkusz czyta się w całości, zakładka jest, wszystkie inne kolumny rozpoznane —
   i jedyne wyjście to zmiana nagłówka w arkuszu klienta.
2. **Nieudany odczyt.** Brak udostępnienia arkusza kontu serwisowemu, martwy identyfikator i realna
   awaria Google dają jedno zdanie: „Spróbuj ponownie za chwilę". Przy braku dostępu to rada, która
   nigdy nie zadziała.

Rozwiązanie: rozpoznawanie kolumn przy porażce **oddaje kandydatów** — kolumny bloku nagłówkowego,
które nie poszły pod żadne pole — a właściciel wskazuje właściwą. Wskazanie zapisuje się **przy
kosztorysie** i działa **wyłącznie awaryjnie**: dopasowanie po nazwie zawsze idzie pierwsze, do
zapisu sięgamy tylko dla pól, których nie rozwiązało. Osobno rozdzielamy trzy przyczyny nieudanego
odczytu i przy braku dostępu podajemy adres konta, któremu trzeba arkusz udostępnić.

## Current State Analysis

- `resolveRobocizna` (`src/lib/kosztorys/sheet-import/resolve-columns.ts:130`) jest totalna: przy
  porażce zwraca `{ ok: false, problems: string[] }` — same zdania, żadnych danych, na których dałoby
  się zbudować wybór.
- **`netValue` nie trafia do żadnej pracy.** Czytają ją dokładnie dwa miejsca:
  `footer-totals.ts:89` (współrzędna kolumny, spod której bierzemy liczbę z wiersza podsumowania)
  i `formula-health.ts:79` (skan błędów formuł). Wartość każdej pracy liczy `calc.ts` z ilości, ceny
  i rabatu — `parse-robocizna.ts` tej kolumny nie dotyka. Import odmawia więc przez kolumnę, która
  nie wnosi do kosztorysu ani złotówki.
- Dzięki temu pytanie „S czy T" jest niegroźne: `compareFooterTotals` sprawdza odczytaną liczbę po
  kolei ze wszystkimi trzema sumami, które umiemy policzyć (`CANDIDATES`, `footer-totals.ts:113`),
  i sam raportuje, z którą się zgadza (`matchedAgainst`). Wskazanie S albo T przesuwa tylko to,
  którą liczbę czytamy z wiersza podsumowania.
- Nieudany odczyt wraca jako `{ success: false, error }` (`kosztorys-import.ts:59-64`), czyli goły
  toast. Struktura (przyczyna, adres konta) nie ma którędy dojechać do okna.
- „Porównaj z arkuszem" **nie ma okna z listą problemów** — `compareWithSheet` zwraca
  `problems.join(' ')` jako błąd (`kosztorys-import.ts:133,143`), więc nierozpoznana kolumna
  psuje tę funkcję bezpowrotnie. To jest powód, dla którego wskazanie musi się zapisywać.
- Kosztorys ma własny wiersz w bazie: kolekcja `Sheets` (`src/collections/sheets.ts:13`, slug
  `kosztoryses`) z trzema płaskimi polami. Payloadowy typ `json` jest już w projekcie używany
  (`src/collections/leads.ts:70`) i daje kolumnę `jsonb`.
- Zapisy w tej kolekcji to nazwane akcje w `src/lib/actions/sheets.ts` (wzór:
  `linkSheetToInvestmentAction`, :123). Migracje pisze się ręcznie i rejestruje w
  `src/migrations/index.ts` — najbliższy wzór jednokolumnowy: `20260707_1_add_lead_form_questions.ts`.
- Gotowe do użycia: `columnLetter` (`@/lib/google/sheet-configs`), `copyToClipboard`
  (`@/lib/utils/copy-to-clipboard`), `createServiceAccountJWT` (`src/lib/google/auth.ts:9`, ma już
  sparsowany `client_email`).

## Desired End State

Żupnicza wczytuje się bez dotykania arkusza klienta: okno pokazuje pole „Wartość netto" bez kolumny
i listę nieprzypisanych kolumn z literą i nagłówkiem; po wskazaniu `S` wybór zapisuje się od razu,
podgląd przelicza się, „Pobierz i zastąp" odblokowuje. „Porównaj z arkuszem" na tym samym arkuszu
działa bez dodatkowej decyzji. Arkusz nieudostępniony kontu serwisowemu mówi to wprost i podaje adres
do skopiowania. Poprawiony nagłówek w arkuszu wygrywa ze starym wskazaniem, a właściciel widzi, że
wskazanie istnieje, i może je usunąć.

### Key Discoveries

- `columns.netValue` czyta tylko `footer-totals.ts:89` i `formula-health.ts:79` — nigdy nie wchodzi
  do wiersza kosztorysu.
- `DEFAULT_CANDIDATE` (`footer-totals.ts:119`) po commicie `d8c2fdbc` paruje wiersz „wartość netto"
  z sumą liczoną z Pomiaru — porównanie jest samo-korygujące i wybór S/T go nie zepsuje.
- `evaluateImportGate` (`sheet-import-gate.ts`) blokuje wyłącznie na `problems` — sumy nie blokują
  nigdy. Ta zasada zostaje.
- `SheetReportDialog` renderuje `children` jako funkcję od `data` — nieudany odczyt musi więc
  przyjechać **w danych sukcesu**, nie jako `success: false`, żeby okno miało co wyrenderować.
- `readImportGrids` woła Google dwa razy (`spreadsheets.get`, dwa `values.batchGet`) — klasyfikacja
  błędu musi objąć obie ścieżki.

## What We're NOT Doing

- Nie luzujemy dopasowań po nazwie. Prefiks `wartosc netto` złapałby na Żupniczej S i T naraz i
  zamienił odmowę „nie znaleziono" na odmowę „pasuje do 2 kolumn".
- Nie blokujemy pobrania na kolumnach opcjonalnych — arkusze bez rabatu (Ryżowa) mają się wczytywać
  jak dziś (decyzja właściciela).
- Nie robimy globalnego ani per-inwestycyjnego słownika nagłówków — zapis jest per wiersz
  `kosztoryses`.
- Nie pozwalamy wskazać kolumny już zajętej przez inne pole.
- Nie ruszamy zapisu do arkusza ani ścieżki materiałów — import jest tylko do odczytu.
- Nie rozróżniamy limitów Google ani przekroczenia czasu — dla właściciela to jedno „spróbuj
  później".

## Implementation Approach

Cztery fazy w kolejności taniości, nie ważności. Faza 1 (komunikaty) wygląda na poboczną, ale to ona
przenosi nieudany odczyt z toasta do danych okna — a faza 4 potrzebuje dokładnie tej struktury, żeby
„Porównaj z arkuszem" miało gdzie pokazać wybór kolumn. Faza 2 rozszerza kontrakt rozpoznawania
kolumn o dane bez zmiany zachowania, faza 3 dokłada zapis, faza 4 dopina interfejs.

---

## Faza 1: Dlaczego arkusz się nie odczytał

### Overview

Trzy przyczyny zamiast jednej, adres konta serwisowego do skopiowania, i nieudany odczyt jako dane
okna zamiast czerwonego toasta.

### Changes Required

#### 1. Klasyfikacja błędu odczytu

**File**: `src/lib/kosztorys/sheet-import/read-sheet.ts`

**Intent**: Zamienić błąd Google na przyczynę, którą da się przełożyć na czynność właściciela.
Zamiast dokładać kolejne klasy wyjątków — jedna funkcja klasyfikująca, bo wołający i tak potrzebuje
wartości, nie typu.

**Contract**: `export type SheetFailureReasonT = 'forbidden' | 'not-found' | 'missing-tab' | 'unknown'`
oraz `export function classifySheetFailure(error: unknown): SheetFailureReasonT`. `403` (także
`PERMISSION_DENIED`) → `forbidden`, `404` → `not-found`, `MissingRobociznaTabError` → `missing-tab`,
reszta → `unknown`. Status czytany defensywnie z `error.status ?? error.code ?? error.response.status`
— googleapis podaje go w kilku miejscach zależnie od warstwy. `MissingRobociznaTabError` zostaje bez
zmian.

#### 2. Adres konta serwisowego

**File**: `src/lib/google/auth.ts`

**Intent**: Wystawić `client_email`, który ta funkcja już parsuje — bez tego rada „udostępnij arkusz"
jest tak samo pusta jak dzisiejsze „spróbuj później".

**Contract**: `export function getServiceAccountEmail(): string`. Ten sam parse co
`createServiceAccountJWT`, wyciągnięty do wspólnego, prywatnego helpera w tym pliku.

#### 3. Nieudany odczyt w danych okna

**File**: `src/lib/actions/kosztorys-import.ts`

**Intent**: Przenieść nieudany odczyt z `success: false` do payloadu, żeby okno mogło pokazać
przyczynę, adres i przycisk kopiowania. `applyKosztorysImport` zostaje przy twardym błędzie — tam
nie ma nic do wyrenderowania, a akcja ma odmówić zapisu.

**Contract**: `export type SheetFailureT = { reason: SheetFailureReasonT; serviceAccountEmail: string | null }`
(adres wypełniony tylko dla `forbidden` — nigdzie indziej nie jest odpowiedzią). `ImportPreviewT`
i `SheetCompareResultT` dostają `failure: SheetFailureT | null`; dotychczasowe pola stają się
opcjonalne dla przypadku porażki. `sheetFailureMessage` zostaje wyłącznie dla `applyKosztorysImport`
i mapuje przyczynę na zdanie. Log `TODO(EX-449) SENTRY-REQUIRED` zostaje, ale tylko dla `unknown` —
brak uprawnień nie jest awarią do zgłaszania.

#### 4. Blok „nie udało się odczytać" w obu oknach

**File**: `src/components/kosztorys/editor/dialogs/sheet-access-block.tsx` (nowy)

**Intent**: Jedno zdanie na przyczynę i jedna czynność. Wspólny dla obu okien, bo oba czytają ten sam
arkusz tą samą ścieżką i rozjechane komunikaty byłyby czystym długiem.

**Contract**: `SheetAccessBlock({ failure }: { failure: SheetFailureT })`, zbudowany na
`SheetReportBlock` ze `status="warn"`. Teksty: `forbidden` → udostępnij arkusz temu adresowi (adres
w tekście + przycisk kopiujący przez `copyToClipboard`), `not-found` → arkusz o tym identyfikatorze
nie istnieje albo został usunięty, popraw powiązanie inwestycji, `missing-tab` → arkusz nie ma
zakładki `kosztorys_robocizny`, `unknown` → awaria po stronie Google, spróbuj za chwilę.

#### 5. Podpięcie w oknach

**Files**: `src/components/kosztorys/editor/dialogs/sheet-import-dialog.tsx`,
`src/components/kosztorys/editor/dialogs/sheet-compare-dialog.tsx`

**Intent**: Gdy `failure` jest ustawione, okno pokazuje wyłącznie ten blok — reszta bloków opisuje
odczyt, którego nie było. Przy okazji znika błędna podpowiedź „Popraw nagłówki w arkuszu" z bloku
problemów przy braku zakładki: nagłówki nie mają z tym nic wspólnego.

**Contract**: Warunek na `failure` przed dotychczasowym rozgałęzieniem na `problems`.
`confirmDisabled` musi być prawdziwe przy `failure` — do `evaluateImportGate` dochodzi ten sam
warunek.

### Success Criteria

#### Automated Verification:

- Nowy spec `src/__tests__/lib/kosztorys/sheet-import/read-sheet-failure.test.ts` przechodzi:
  403/404/inny błąd oraz `MissingRobociznaTabError` mapują się na cztery przyczyny, a status czytany
  jest z każdego z trzech miejsc, w których googleapis go podaje
- `src/__tests__/components/kosztorys/editor/dialogs/sheet-import-gate.test.ts` rozszerzony o
  blokadę przy `failure` i przechodzi

#### Manual Verification:

- Arkusz nieudostępniony kontu serwisowemu: okno mówi, komu go udostępnić, a przycisk kopiuje adres
- Inwestycja z podmienionym na śmieciowy identyfikatorem arkusza: komunikat o nieistniejącym arkuszu,
  bez rady „spróbuj później"
- Arkusz bez zakładki `kosztorys_robocizny`: komunikat mówi o zakładce, nie o nagłówkach

**Implementation Note**: Po przejściu weryfikacji automatycznej commit i dalej — bez pauzy na
potwierdzenie manualne.

---

## Faza 2: Kandydaci z rozpoznawania kolumn

### Overview

Rozpoznawanie kolumn przy porażce przestaje zwracać same zdania: oddaje pola bez kolumny i kolumny
bez pola. Zachowanie się nie zmienia — to dane, na których faza 4 zbuduje wybór.

### Changes Required

#### 1. Kandydaci i pola nierozwiązane

**File**: `src/lib/kosztorys/sheet-import/resolve-columns.ts`

**Intent**: Wystawić obie strony nieudanego dopasowania. Kandydat musi dać się rozpoznać w arkuszu,
więc niesie literę kolumny i teksty nagłówka — z wiersza 1 i 3, bo to dwie różne podpowiedzi
(wiersz 1 bywa adresem klienta, wiersz 3 właściwą nazwą).

**Contract**:

```ts
export type CandidateColumnT = { column: number; letter: string; labels: string[] }
export type MissingFieldT = { field: ColumnFieldT; required: boolean; reason: UnresolvedReasonT }
```

`ResolveFailureT` → `{ ok: false; problems: string[]; missingFields: MissingFieldT[]; candidates: CandidateColumnT[] }`.
`ResolvedRobociznaT` dostaje te same dwa pola (przy sukcesie `missingFields` niesie wyłącznie
opcjonalne). Kandydat = kolumna bloku nagłówkowego, która nie została przypisana do żadnego pola,
nie należy do pasa etapów i ma niepustą treść w którymkolwiek wierszu bloku; `labels` bez duplikatów,
z zachowaną kolejnością wierszy. Litera przez `columnLetter` z `@/lib/google/sheet-configs`.
Kolumny `section` i `description` (wyliczane z pozycji pasa etapów) też są zajęte.

#### 2. Przekazanie do raportu

**File**: `src/lib/kosztorys/sheet-import/build-import-plan.ts`

**Intent**: Przepuścić kandydatów i pola nierozwiązane do raportu i do gałęzi porażki — dziś
`buildImportPlan` gubi wszystko poza `problems` (`:77`).

**Contract**: `ImportPlanT`'s failure branch niesie `missingFields` i `candidates`. `ImportReportT`
dostaje `candidates: CandidateColumnT[]`, a `MissingColumnT` — pole `field: ColumnFieldT`, żeby blok
„Czego nie odczytaliśmy" mógł w fazie 4 podpiąć wybór do konkretnego pola.

#### 3. Próbka nagłówka Żupniczej

**File**: `src/__tests__/fixtures/kosztorys-sheet/header-blocks.ts`

**Intent**: Utrwalić układ, który dziś odmawia — dwie kolumny wartości netto rozbite na przedmiar
i pomiar.

**Contract**: `ZUPNICZA_ROBOCIZNA_HEADER` w konwencji istniejących próbek (`row({ ... })`), z
`S = „Wartość netto przedmiar"`, `T = „Wartość netto pomiar z natury"`, `U = „komentarz"`
i pasem `V–AF` wartości. Bez danych osobowych — pilnuje tego `no-pii.test.ts`.

### Success Criteria

#### Automated Verification:

- `src/__tests__/lib/kosztorys/sheet-import/resolve-columns.test.ts` rozszerzony i przechodzi:
  próbka Żupniczej odmawia z `missingFields` zawierającym `netValue` jako wymagane, a `candidates`
  zawiera kolumny `S` i `T` z ich nagłówkami; kolumna już przypisana do innego pola nie jest
  kandydatem; kolumna pasa etapów nie jest kandydatem; kolumna z pustym nagłówkiem nie jest
  kandydatem
- `src/__tests__/lib/kosztorys/sheet-import/build-import-plan.test.ts` przechodzi z kandydatami
  przepuszczonymi do raportu

#### Manual Verification:

- Brak — faza nie zmienia niczego, co widać w aplikacji

---

## Faza 3: Zapis wskazania przy kosztorysie

### Overview

Jedna kolumna w bazie, wskazanie używane **wyłącznie** dla pól nierozpoznanych po nazwie, akcje
zapisu i usunięcia.

### Changes Required

#### 1. Pole w kolekcji

**File**: `src/collections/sheets.ts`

**Intent**: Trzymać wskazania tam, gdzie już leży identyfikator arkusza — to cecha arkusza klienta,
nie inwestycji i nie kliknięcia.

**Contract**: pole `sheetColumnMapping`, typ `json`, opcjonalne, bez wartości domyślnej; komentarz
przy polu mówi, że to zapis awaryjny, nie nadrzędny. Kształt:
`Partial<Record<ColumnFieldT, number>>` — pole → indeks kolumny. Kolumna w bazie:
`kosztoryses.sheet_column_mapping jsonb`.

#### 2. Migracja

**Files**: `src/migrations/20260814_0_add_sheet_column_mapping_to_kosztoryses.ts` (nowy),
`src/migrations/index.ts`

**Intent**: Ręcznie pisana, bo `migrate:create` w tym repo emituje fantomowy drift.

**Contract**: Struktura skopiowana z `20260707_1_add_lead_form_questions.ts` — `up` z
`ALTER TABLE "kosztoryses" ADD COLUMN IF NOT EXISTS "sheet_column_mapping" jsonb;`, `down` z
`DROP COLUMN IF EXISTS`. Rejestracja w `index.ts`: import plus wpis na końcu tablicy.

#### 3. Odczyt wiersza kosztorysu

**File**: `src/lib/google/sheet-lookup.ts`

**Intent**: Ścieżka importu potrzebuje teraz dwóch pól z tego samego wiersza, a dzisiejszy helper
zwraca sam identyfikator i wyrzuca resztę.

**Contract**: `export async function getInvestmentSheet(payload, investmentId): Promise<{ id: number; googleSheetId: string; columnMapping: SheetColumnMappingT | null } | undefined>`.
`getInvestmentSheetId` zostaje jako cienka nakładka — ma sześć innych wołających i nie ma powodu ich
ruszać.

#### 4. Wskazanie jako awaryjne dopasowanie

**File**: `src/lib/kosztorys/sheet-import/resolve-columns.ts`

**Intent**: To jest miejsce, w którym mieszka zasada domykająca całą zmianę: nazwa zawsze pierwsza,
zapis wyłącznie dla tego, czego nazwa nie rozwiązała. Dzięki temu poprawiony nagłówek w arkuszu
wygrywa ze starym wskazaniem, a wskazanie nie może zapiąć złej kolumny na siłę.

**Contract**: `resolveRobocizna(grid, mapping?: SheetColumnMappingT)`. Zapis stosowany dopiero po
przejściu wszystkich dopasowań po nazwie i tylko dla pól nierozwiązanych. Wskazanie jest ignorowane,
gdy kolumna wypada poza szerokość bloku albo jest już zajęta przez inne pole — cicho, bo to
nieaktualny zapis, a nie decyzja właściciela. Pola rozwiązane z zapisu raportowane jako
`resolvedFromMapping: ColumnFieldT[]` (potrzebne do linijki „wskazałeś ręcznie").
`buildImportPlan` i `buildMeasuredQtyRefresh` przyjmują `mapping` i przekazują dalej.

#### 5. Akcje zapisu i usunięcia

**File**: `src/lib/actions/sheets.ts`

**Intent**: Dołożyć do istniejącego domu zapisów tej kolekcji, wzorem
`linkSheetToInvestmentAction`. Zapis dzieje się w chwili wskazania (decyzja właściciela), więc to
osobna akcja, nie efekt uboczny pobrania.

**Contract**: `saveSheetColumnMappingAction(investmentId: number, field: ColumnFieldT, column: number)`
oraz `clearSheetColumnMappingAction(investmentId: number, field?: ColumnFieldT)` (bez `field` czyści
całość). Obie przez `protectedAction` z rewalidacją `['kosztoryses', 'investments']`. Zapis scala
się z istniejącym obiektem, nie nadpisuje go w całości. Kolumna spoza zakresu i pole spoza
`ColumnFieldT` odrzucane po stronie serwera — przeglądarka nie decyduje, co wchodzi do bazy.

#### 6. Podanie wskazania do odczytu

**File**: `src/lib/actions/kosztorys-import.ts`

**Intent**: Wszystkie trzy ścieżki (podgląd, pobranie, porównanie) muszą czytać ten sam zapis,
inaczej okno pokazuje jeden odczyt, a pobranie robi inny.

**Contract**: `derivePlan` i `compareWithSheet` biorą wiersz przez `getInvestmentSheet` i przekazują
`columnMapping` w dół.

### Success Criteria

#### Automated Verification:

- Nowy spec `src/__tests__/lib/kosztorys/sheet-import/resolve-columns-mapping.test.ts` przechodzi:
  wskazanie rozwiązuje kolumnę, której nie rozpoznała nazwa (próbka Żupniczej + `{ netValue: 18 }`);
  poprawiona nazwa w arkuszu wygrywa ze wskazaniem pokazującym inną kolumnę; wskazanie na kolumnę
  zajętą przez inne pole jest ignorowane; wskazanie poza szerokością bloku jest ignorowane;
  `resolvedFromMapping` wymienia dokładnie pola wzięte z zapisu
- `pnpm payload migrate` na lokalnej bazie (5433) przechodzi, a `pnpm generate:types` daje
  `sheetColumnMapping` w `Kosztoryse`

#### Manual Verification:

- Wskazanie zapisane na jednej inwestycji nie zmienia niczego na drugiej

---

## Faza 4: Wskazywanie kolumn w obu oknach

### Overview

Wybór kolumny w „Pobierz" i w „Porównaj", zapis w chwili wskazania, ślad po wskazaniu z możliwością
usunięcia.

### Changes Required

#### 1. Element wyboru

**File**: `src/components/kosztorys/editor/dialogs/sheet-column-picker.tsx` (nowy)

**Intent**: Jedno pole bez kolumny, jedna lista kandydatów. Wspólny dla obu okien, bo to jedna
decyzja — dwie kopie rozjechałyby się przy pierwszej zmianie.

**Contract**: `SheetColumnPicker({ field, label, required, candidates, saved, onPick, onClear })`.
Kandydat renderowany jako `„S — Wartość netto przedmiar / Wartość przedmiar"` (litera, potem
`labels` złączone). Po wskazaniu element jest zablokowany do czasu, aż rodzic przeładuje odczyt.
Gdy pole zostało rozwiązane z zapisu — linijka „wskazałeś tę kolumnę ręcznie" i akcja usunięcia.

#### 2. Okno pobierania

**File**: `src/components/kosztorys/editor/dialogs/sheet-import-dialog.tsx`

**Intent**: Blok problemów przestaje być ślepym zaułkiem: pola bez kolumny dostają wybór, a zdania,
których wyborem się nie naprawi (brak pasa etapów, brak kolumny sekcji, brak cennika), zostają
tekstem. Kolumny opcjonalne dostają ten sam wybór w bloku „Czego nie odczytaliśmy" — mechanizm jest
ten sam, a nieodczytany rabat to realna różnica w kwotach.

**Contract**: `MISSING_COLUMN_REASONS` zostaje. Blokada pobrania bez zmian: `evaluateImportGate`
dalej blokuje wyłącznie na `problems` i `failure`, więc brak kolumny opcjonalnej **nie** wstrzymuje
importu (decyzja właściciela). Po zapisie wskazania rodzic (`use-sheet-import.ts`) ponawia podgląd —
okno zostaje otwarte i przelicza się w miejscu.

#### 3. Okno porównania

**Files**: `src/components/kosztorys/editor/dialogs/sheet-compare-dialog.tsx`,
`src/lib/actions/kosztorys-import.ts`

**Intent**: „Porównaj z arkuszem" ma dziś tylko czerwony pasek. Skoro wskazywanie ma być również tam
(decyzja właściciela), nierozpoznane kolumny muszą przyjechać jako dane okna — tak jak nieudany
odczyt w fazie 1.

**Contract**: `compareWithSheet` przestaje sklejać `problems` w błąd i zwraca je w payloadzie razem
z `missingFields` i `candidates`; okno renderuje ten sam `SheetColumnPicker`. Po zapisie rodzic
ponawia porównanie. Odświeżenie zapisanego Pomiaru **nie wykonuje się**, gdy kolumn nie da się
rozpoznać — dziś też nie, i to zostaje: zapis liczby z nieodczytanego arkusza byłby gorszy niż jego
brak.

#### 4. Przeładowanie po zapisie

**File**: `src/components/kosztorys/editor/hooks/use-sheet-import.ts`

**Intent**: Wskazanie ma dać natychmiastowy efekt w otwartym oknie, inaczej właściciel nie wie, czy
zadziałało.

**Contract**: Hak wystawia `reload()`, wołane po udanym zapisie wskazania; `loaded` wraca na `false`
na czas ponownego odczytu. Analogicznie po stronie porównania.

### Success Criteria

#### Automated Verification:

- `src/__tests__/components/kosztorys/editor/dialogs/sheet-import-gate.test.ts` przechodzi:
  pobranie zablokowane, dopóki wymagane pole nie ma kolumny; brakująca kolumna **opcjonalna** nie
  blokuje; `failure` blokuje
- Nowy spec `src/__tests__/components/kosztorys/editor/dialogs/sheet-column-picker-options.test.ts`
  przechodzi: kandydaci zamieniają się na etykiety wyboru z literą i nagłówkami, kandydat bez
  nagłówka nie trafia na listę

#### Manual Verification:

- Inwestycja 84 (Żupnicza): okno pokazuje „Wartość netto" bez kolumny i kandydatów `S` oraz `T`;
  po wskazaniu `S` podgląd się przelicza, a „Pobierz i zastąp" odblokowuje
- Po zamknięciu okna bez pobierania „Porównaj z arkuszem" na tej samej inwestycji działa bez
  ponownego wskazywania
- Linijka „wskazałeś tę kolumnę ręcznie" jest widoczna, a usunięcie wskazania przywraca odmowę
- Po poprawieniu nagłówka w arkuszu na `Wartość netto` odczyt idzie po nazwie, mimo zapisanego
  wskazania na inną kolumnę
- Arkusz bez kolumny rabatu (Ryżowa) wczytuje się bez wskazywania czegokolwiek

---

## Testing Strategy

### Unit

- Klasyfikacja błędu odczytu: 403 / 404 / inny / brak zakładki (faza 1)
- Kandydaci i pola nierozwiązane na próbce Żupniczej, z przypadkami odrzucenia kandydata (faza 2)
- Zasada awaryjności wskazania — nazwa wygrywa, zajęta kolumna ignorowana, poza zakresem ignorowana
  (faza 3)
- Blokada pobrania: wymagane vs opcjonalne vs nieudany odczyt (faza 4)

### Integration

Brak nowych. Ścieżka od akcji do bazy jest jedną `payload.update` na wzorze, który ma już swoje
odpowiedniki; ryzyko siedzi w rozpoznawaniu kolumn, a to jest czysta funkcja pokryta unitami.

### Manual

Zebrane w `context/foundation/manual-checks.md` przy ostatniej fazie. Inwestycja 84 jest dowodem
z natury — bez niej cała zmiana opiera się na próbce.

## Migration Notes

Jedna kolumna `jsonb`, dokładana, nigdy nie czytana wstecz — brak zapisu znaczy „dopasowuj tylko po
nazwach", czyli dzisiejsze zachowanie. Bez backfillu i bez ścieżki wstecznej: `down` kasuje kolumnę,
a zapisane wskazania to dane, których nikt jeszcze nie ma. Migracja na produkcji uruchamiana
**ręcznie przez człowieka** (`pnpm db:migrate:prod`), przed wypchnięciem kodu, który tę kolumnę
czyta.

## Whole-tree Gate

Uruchamiane **raz**, po ostatniej fazie:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Aneks: kontrakty, które wylądowały inaczej (2026-08-14, bramka przeglądu)

Plan opisuje zamiar, nie kod. Pięć kontraktów zmieniło kształt w trakcie implementacji i bramki
przeglądu — spisane tutaj, żeby plan nie czytał się później jako opis tego, co stoi w repo.

1. **Pole wiersza `kosztoryses`: `columnMapping` → `sheetColumnMapping`** (linie 305, 346). Kolumna
   w bazie od początku nazywała się `sheet_column_mapping`; `InvestmentSheetT` niósł drugą nazwę tego
   samego pojęcia. Ujednolicone na `sheetColumnMapping` w całym łańcuchu (kolekcja → `sheet-lookup`
   → akcje), zgodnie z „jedno pojęcie, jedna nazwa" z `AGENTS.md`.
2. **`getInvestmentSheet` zwraca `SheetColumnMappingT`, nie `… | null`** (linia 305). Parsowanie
   jsonb (`parseSheetColumnMapping`) zawsze daje obiekt — pusty, gdy nic nie zapisano — więc `null`
   po stronie wywołującego był drugim wariantem tej samej „pustki". Wołający robią `{ ...mapping }`
   bez sprawdzania.
3. **`clearSheetColumnMappingAction(investmentId, field)` — `field` obowiązkowe** (linia 333).
   Gałąź „bez `field` czyści wszystko" nie miała wywołującego: UI kasuje wskazania pojedynczo
   („Usuń wskazanie" przy konkretnym polu). Usunięta wraz z martwym rozgałęzieniem.
4. **Kontrakty rozłożone na własne moduły.** Plan zostawiał je tam, gdzie stała reszta:
   `classifySheetFailure` + `SheetFailureReasonT` + `SheetFailureT` (linie 116, 140) mieszkają teraz
   w `sheet-import/classify-sheet-failure.ts` (nie w `read-sheet.ts` ani w `'use server'`
   `kosztorys-import.ts`), a kontrakt zapisu jsonb — `SheetColumnMappingT`, `parseSheetColumnMapping`,
   `isPointableColumn` — w `sheet-import/sheet-column-mapping.ts` (nie w `columns.ts`).
   Dodatkowo `UnresolvedColumnsT` stoi w `resolve-columns.ts`, przy słowniku, który go rodzi, a nie
   w `build-import-plan.ts`.

5. **`resolvedFromMapping` → `pointedFields`** (linie 321, 356). Przez chwilę ten sam zbiór miał dwie
   nazwy — `resolvedFromMapping` w resolverze, `pointedFields` w UI — i każdy wywołujący przepisywał
   go po drodze. Jedna nazwa, `pointedFields`, w całym łańcuchu; trójka
   `missingFields`/`candidates`/`pointedFields` mieszka raz, jako `UnresolvedColumnsT`, i wchodzi
   przez przecięcie do obu wariantów wyniku `resolveRobocizna`.

## References

- `context/changes/2026-08-14-sheet-column-mapping/change.md` — dowód z Żupniczej i decyzje
- `src/lib/kosztorys/sheet-import/footer-totals.ts:113-122` — dlaczego wybór S/T jest niegroźny
- `src/collections/leads.ts:70` + `src/migrations/20260707_1_add_lead_form_questions.ts` — wzór pola
  `json` i jednokolumnowej migracji
- `src/lib/actions/sheets.ts:123` — wzór akcji zapisującej pole wiersza `kosztoryses`

## Progress

> Konwencja: `- [ ]` do zrobienia, `- [x]` zrobione. Po wylądowaniu kroku dopisz ` — <commit sha>`.
> Nie zmieniaj tytułów kroków.

### Faza 1: Dlaczego arkusz się nie odczytał

#### Automated

- [x] 1.1 Spec klasyfikacji błędu odczytu przechodzi (403 / 404 / inny / brak zakładki) — 4777a191
- [x] 1.2 Spec blokady pobrania rozszerzony o `failure` i przechodzi — 4777a191

### Faza 2: Kandydaci z rozpoznawania kolumn

#### Automated

- [x] 2.1 Spec rozpoznawania kolumn z próbką Żupniczej i odrzucaniem kandydatów przechodzi — 1cc33d12
- [x] 2.2 Spec budowania planu importu z kandydatami w raporcie przechodzi — 1cc33d12

### Faza 3: Zapis wskazania przy kosztorysie

#### Automated

- [x] 3.1 Spec awaryjności wskazania przechodzi (nazwa wygrywa, zajęta i spoza zakresu ignorowane) — 76c9830d
- [x] 3.2 Migracja stosuje się lokalnie, a `generate:types` daje `sheetColumnMapping` — 76c9830d

### Faza 4: Wskazywanie kolumn w obu oknach

#### Automated

- [x] 4.1 Spec blokady pobrania przechodzi (wymagane blokuje, opcjonalne nie) — 94ffefd0
- [x] 4.2 Spec etykiet kandydatów przechodzi — 94ffefd0
