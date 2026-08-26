# Bramka środowiskowa na zapisie do Google Sheets — plan wdrożenia

## Overview

Każdy zapis do Google Sheets przechodzi dziś przez klienta z zakresem `spreadsheets`, budowanego
w dwóch miejscach, bez żadnego sprawdzenia środowiska. Identyfikator arkusza pochodzi z bazy,
a każda baza nieprodukcyjna to przywrócony zrzut produkcji — więc localhost, preview i `db-test`
piszą do żywych arkuszy klientów. Plan zamyka to jedną bramką na szwie zapisu: poza produkcją
klient zapisowy powstaje **wyłącznie** dla arkusza wpisanego na jawną listę dozwolonych
identyfikatorów. Odczyty przenoszą się na klienta `readonly`, żeby praca nad importerem i podglądem
arkusza dalej działała lokalnie.

## Current State Analysis

- **7 zapisów, 2 fabryki, 0 strażników.** Cały ruch pisany wisi pod `getClient()`
  (`src/lib/google/sheets.ts:42-45`) i pod klientem tworzonym inline w `verifySheetAccess`
  (`src/lib/google/sheet-access.ts:32-33`). W repo nie istnieje inny sposób zdobycia tokenu z prawem
  zapisu — sprawdzone gripem po `auth/spreadsheets` i `google.sheets({`.
- **Wyzwalaczem jest hook kolekcji, nie akcja strony.** `syncSheetAfterChange` /
  `syncSheetAfterDelete` (`src/hooks/transfers/sync-sheet.ts:21,48`) siedzą na `transactions`
  (`src/collections/transfers.ts:77-78`), więc łapią formularz, `/admin`, REST/GraphQL i każdy skrypt
  przez Local API. To była świadoma decyzja („review T2.2") — ta sama własność, która daje pokrycie,
  odbiera możliwość postawienia bramki warstwę wyżej.
- **Zapis jest odroczony i połykany.** `after()` odkłada go za odpowiedź, a `sheets-sync.ts`
  łapie wyjątki w `catch` z logiem (`:300,381,435`). Odmowa nie wywali mutacji, ale też sama z siebie
  nie będzie widoczna — musi zostawić log.
- **Cztery odczyty jadą na kliencie zapisowym**: `readGrid` (`sheets.ts:92`), `tabGid` przez
  `ensureTab` (`sheets.ts:638`), `spreadsheets.get` w `setupTab` (`sheets.ts:303`) i
  `spreadsheets.get` w `verifySheetAccess` (`sheet-access.ts:35`). Bramka bez ich przeniesienia
  zamknęłaby lokalnie czytanie arkuszy.
- **`verifySheetAccess` pisze celowo** — przepisuje tytuł dokumentu na ten sam jako sondę uprawnień
  (`sheet-access.ts:26-30,37`), i połyka każdy błąd zwracając `null`, co UI tłumaczy na „udostępnij
  arkusz koncie usługowemu". Bramka rzucona w tym miejscu bez rozróżnienia dałaby mylący komunikat.
- **Istniejący precedens.** `blobTokenRefusal` (`src/lib/env/schema.ts:36-55`) — czysta funkcja
  zwracająca tekst odmowy albo `null`, testowana dwoma blokami w
  `src/__tests__/lib/env/schema.test.ts`. Kluczem jest `VERCEL_ENV`, nigdy `NODE_ENV` (lokalny
  `next build` ustawia `NODE_ENV=production`). `VERCEL_ENV` jest już zadeklarowany w `serverSchema`
  (`schema.ts:96`) jako opcjonalny.
- **Testy jednostkowe mockują `googleapis`** i przechodzą fikcyjne identyfikatory arkuszy: `'s'`
  (`src/__tests__/lib/google/sheets.test.ts`, `tab-rows.test.ts`) i `'golden-sheet'`
  (`sheets-golden.test.ts`). Stub `serverEnv` (`src/__tests__/stubs/env-server.ts`) czyta
  `process.env` leniwie, więc `VERCEL_ENV` jest tam `undefined` — bramka odmówi, dopóki spece nie
  wpiszą swoich identyfikatorów na listę dozwolonych.

## Desired End State

Zapis do arkusza jest możliwy wyłącznie wtedy, gdy `VERCEL_ENV === 'production'`, albo gdy docelowy
`spreadsheetId` figuruje w `GOOGLE_SHEETS_WRITE_ALLOWLIST`. W każdym innym przypadku klient zapisowy
w ogóle nie powstaje — funkcja rzuca przed pierwszym wywołaniem Google API.

Weryfikacja: uruchomienie aplikacji lokalnie (`VERCEL_ENV` nieustawiony) i dodanie wydatku
inwestycyjnego na inwestycji z podpiętym arkuszem nie zmienia arkusza, a w logu serwera pojawia się
odmowa z identyfikatorem arkusza. Odczyty — podgląd arkusza, import kosztorysu, porównanie
z arkuszem — działają bez zmian.

### Key Discoveries

- Szew jest jeden i domknięty: `sheets.ts:42-45` + `sheet-access.ts:32-33`. Żaden skrypt nie pisze
  (sprawdzone: `scripts/*.mjs` i `src/scripts/*.ts` mają 0 wywołań `values.update|append|clear|batchUpdate`).
- `getClient()` nie zna `spreadsheetId`, ale **wszystkie cztery wywołania** (`sheets.ts:92,189,301,638`)
  mają go w zasięgu jako parametr własnej funkcji — przewleczenie jest darmowe.
- `blobTokenRefusal` mieszka w `env/schema.ts`, bo `payload.config.ts` musi go zaimportować bez
  `server-only`. Ścieżka arkuszy tego ograniczenia **nie ma** — hook ładuje `sheets-sync` leniwie
  przez dynamiczny import wewnątrz `after()`, czyli w grafie Next, gdzie `serverEnv` jest legalny
  (`src/lib/google/auth.ts:2` już go importuje).
- `setupTab` robi `values.clear` na całej zakładce (`sheets.ts:343`) i wisi pod `ensureTab`
  (`sheets.ts:643`), więc potrafi wystartować ze zwykłego syncu, jeśli zakładki brakuje. To
  najcięższa operacja w zestawie i musi być po stronie zapisowej bez wyjątków.

## What We're NOT Doing

- **Nie ruszamy pozostałych czterech kanałów bez bramki** — poczty, OpenRoutera, Meta Graph i cronów.
  Powierzchnia arkuszy jest zamknięta w dwóch liniach i to tu udowodniono szkodę u klienta; reszta
  idzie osobnymi zmianami z tym samym wzorcem do skopiowania (`research.md` §2, §3).
- **Nie zerujemy `google_sheet_id` po restore** (`research.md`, pytanie otwarte #6). Bramka czyni to
  zbędnym jako zabezpieczenie, a zerowanie odebrałoby możliwość odtworzenia przepływów arkuszowych
  lokalnie. Osobna decyzja produktowa.
- **Nie naprawiamy `e2e/helpers.ts:46`** (`'Plac Hellera 3'` → „Plac Hallera 6"). Po bramce naprawa
  będzie bezpieczna, ale to osobna zmiana.
- **Nie sprzątamy arkuszy.** Cztery pozostałe brudne arkusze (inw. 19, 46, 72, 77) są świadomie
  zostawione — `cleanup-checklist.md`.
- **Nie dodajemy bramki po stronie `createServiceAccountJWT`** (`google/auth.ts:17`) — bije również
  token `readonly` dla importu kosztorysu i skryptów.
- **Nie robimy wyjątku dla „Zresetuj wydatki inwestycyjne".** Reset to najbardziej destrukcyjna
  operacja w zestawie; po zmianie naprawa arkusza klienta odbywa się z produkcji i nie ma innej drogi.

## Implementation Approach

Predykat odmowy jako czysta funkcja obok szwu, potem przewleczenie `spreadsheetId` przez fabrykę
klienta zapisowego, przy okazji rozdzielenie odczytów na klienta `readonly`. Trzy fazy, każda
zostawiająca drzewo w spójnym stanie.

**Dlaczego lista identyfikatorów, a nie flaga `ALLOW_WRITE=1`.** Flaga zostanie włączona w `.env`
przy pierwszej pracy nad importerem i już tam zostanie — dziura wraca cicho. Lista wiąże zgodę
z **tożsamością zasobu**, tak samo jak `blobTokenRefusal` wiąże token ze środowiskiem po id store'a:
nawet z furtką otwartą, zapis do arkusza klienta jest odmówiony, dopóki ktoś świadomie nie wklei jego
identyfikatora do własnego `.env`.

**Dlaczego nie wiążemy płaszczyzny bazy z płaszczyzną zasobu** (co `research.md` sugeruje jako
najmocniejszy wzorzec, `backfill-heic-media.ts:153-175`). Tam ma to sens, bo niebezpieczeństwo idzie
w obie strony. Tu jedynym groźnym kierunkiem jest „nie-produkcja pisze do produkcyjnego arkusza",
a to `VERCEL_ENV` odcina w całości. Jedyny przypadek, którego nie łapie — produkcja wskazana na
nieprodukcyjną bazę — wymagałby zaszycia hosta Neona w kodzie, a gałęzie Neona są rotowane
(`memory: debugging-neon-branch-deleted-by-retention`), więc bramka zaczęłaby odmawiać na produkcji
po rotacji. Zamiana pewnej awarii na hipotetyczną ochronę.

---

## Phase 1: Predykat odmowy i zmienna środowiskowa

### Overview

Czysta, testowalna funkcja rozstrzygająca „czy wolno pisać do tego arkusza" plus deklaracja nowej
zmiennej w warstwie env. Zero wpięcia — po tej fazie zachowanie aplikacji jest niezmienione.

### Changes Required

#### 1. Predykat

**File**: `src/lib/google/sheet-write-guard.ts` (nowy)

**Intent**: Jedno miejsce rozstrzygające, czy klient zapisowy może powstać dla danego arkusza.
Kolokowany ze szwem, który chroni — inaczej niż `blobTokenRefusal`, którego miejsce w `env/schema.ts`
wymusza graf Payloada; tu tego ograniczenia nie ma.

**Contract**: `sheetWriteRefusal(vercelEnv: string | undefined, spreadsheetId: string, allowlist: string | undefined): string | null`
— zwraca tekst odmowy albo `null`, bez side-effectów, bez importu `server-only`. Reguła:
`vercelEnv === 'production'` przepuszcza każdy arkusz; poza produkcją przepuszcza wyłącznie
identyfikator obecny na liście z `allowlist` (rozdzielana przecinkami, białe znaki przycinane, puste
wpisy pomijane). Tekst odmowy nazywa arkusz i wskazuje `GOOGLE_SHEETS_WRITE_ALLOWLIST` jako furtkę.
Dodatkowo eksportuje `parseSheetWriteAllowlist(raw: string | undefined): string[]`, żeby test
sprawdzał parsowanie osobno od reguły.

#### 2. Deklaracja zmiennej

**File**: `src/lib/env/schema.ts`

**Intent**: `GOOGLE_SHEETS_WRITE_ALLOWLIST` jako opcjonalna zmienna serwerowa — nieustawiona znaczy
„poza produkcją nie wolno pisać nigdzie", co jest właściwym domyślnym.

**Contract**: nowe pole `z.string().optional()` w `serverSchema`, obok pozostałych zmiennych Google.
**Bez `superRefine`** — nie ma tu zależności między polami do zwalidowania; reguła żyje w predykacie,
który jest wołany per-arkusz w runtime, nie raz przy parsowaniu env.

#### 3. Test jednostkowy predykatu

**File**: `src/__tests__/lib/google/sheet-write-guard.test.ts` (nowy)

**Intent**: Przypiąć regułę, zanim cokolwiek jej użyje.

**Contract**: przypadki — produkcja przepuszcza arkusz spoza listy; `undefined` (localhost,
`pnpm test`, `pnpm test:e2e`) odmawia; `'preview'` odmawia; poza produkcją arkusz z listy przechodzi,
a jego sąsiad z tej samej listy-nie-listy nie; lista z białymi znakami i pustymi wpisami parsuje się
poprawnie; pusta i nieustawiona lista odmawia wszystkiego poza produkcją. Identyfikatory w teście
są **literałami**, nie budowane ze stałych produkcyjnych — inaczej test dowodziłby tylko, że bramka
zgadza się sama ze sobą (ten sam szczegół pilnuje `schema.test.ts:13-14`).

### Success Criteria

#### Automated Verification

- Spec predykatu przechodzi: `pnpm exec vitest run src/__tests__/lib/google/sheet-write-guard.test.ts`

#### Manual Verification

- brak — faza nie zmienia zachowania aplikacji

---

## Phase 2: Szew — klient zapisowy za bramką, odczyty na `readonly`

### Overview

Fabryka klienta zapisowego przyjmuje `spreadsheetId` i odmawia przed zwróceniem klienta. Odczyty
przenoszą się na `getReadonlySheetsClient()`, żeby bramka nie zamknęła czytania. Jedna faza, bo
rozdzielenie jej na dwie zostawiłoby drzewo w stanie, w którym lokalne odczyty są zepsute.

### Changes Required

#### 1. Fabryka klienta zapisowego

**File**: `src/lib/google/sheets.ts`

**Intent**: `getClient()` staje się bramką — przyjmuje arkusz, sprawdza predykat, rzuca przy odmowie.
Nazwa zmienia się na `getWritableSheetsClient`, żeby przy czytaniu kodu było widać, że to strona
zapisowa; „getClient" nie mówi nic i to on jest powodem, dla którego odczyty się tu przykleiły.

**Contract**: `getWritableSheetsClient(spreadsheetId: string): sheets_v4.Sheets`. Czyta
`serverEnv.VERCEL_ENV` i `serverEnv.GOOGLE_SHEETS_WRITE_ALLOWLIST`, woła `sheetWriteRefusal`,
przy niepustym wyniku rzuca `Error` z tym tekstem. Wołający: `applyTabRowsBatch` (`:189`) i
`setupTab` (`:301`) — oba mają `spreadsheetId` w sygnaturze.

#### 2. Odczyty na kliencie readonly

**File**: `src/lib/google/sheets.ts`

**Intent**: `readGrid` i `tabGid` czytają, więc nie mają powodu trzymać tokenu z prawem zapisu —
po bramce trzymanie go oznaczałoby dodatkowo, że lokalnie przestają działać.

**Contract**: `readGrid` (`:92`) i `ensureTab` (`:638`, przez `tabGid`) biorą klienta z
`getReadonlySheetsClient()`. `setupTab` zostaje w całości na kliencie zapisowym — jego
`spreadsheets.get` (`:303`) czyta metadane tuż przed `values.clear` na tej samej zakładce, więc
rozdzielanie go dawałoby dwa tokeny w jednej operacji bez żadnego zysku.

#### 3. Sonda uprawnień degraduje się do odczytu

**File**: `src/lib/google/sheet-access.ts`

**Intent**: `verifySheetAccess` przestaje budować własnego klienta. Poza produkcją, dla arkusza spoza
listy, sonda zapisu jest pomijana zamiast wywalać podpięcie — inaczej lokalne podpięcie arkusza
zwracałoby `null`, a UI mówiłoby „udostępnij arkusz koncie usługowemu", co jest nieprawdą i wysłałoby
człowieka w złą stronę.

**Contract**: odczyt tytułu idzie przez `getReadonlySheetsClient()`. Sonda zapisu (przepisanie tytułu
na ten sam) wykonuje się tylko wtedy, gdy `sheetWriteRefusal` zwraca `null`; przy odmowie jest
pomijana z logiem `console.warn` nazywającym arkusz i powód. Zwracany kształt
(`{ title } | null`) **bez zmian** — `null` nadal znaczy „konto usługowe nie ma dostępu", i tylko to.

#### 4. Test regresyjny na szwie

**File**: `src/__tests__/lib/google/sheet-write-guard-seam.test.ts` (nowy)

**Intent**: Przypiąć zachowanie, którego zabrakło w incydencie — i to obserwowalne (brak wywołania
Google API), a nie zwracaną wartość predykatu, którą już pokrywa faza 1.

**Contract**: z mockiem `googleapis` w kształcie istniejących speców z `src/__tests__/lib/google/`:
przy `VERCEL_ENV` nieustawionym i pustej liście, `applyTabRowsBatch` na arkuszu klienta **rzuca**
i **żaden** mock (`values.batchUpdate`, `spreadsheets.batchUpdate`, `values.clear`) nie został
wywołany; to samo dla `setupTab`. Przy tym samym środowisku, ale arkuszu wpisanym na listę — zapis
przechodzi. Nieustawiony `VERCEL_ENV` jest tu realnym warunkiem, nie sztucznym: tak wygląda
i localhost, i `pnpm test:e2e`.

#### 5. Dostosowanie istniejących speców

**Files**: `src/__tests__/lib/google/sheets.test.ts`, `sheets-golden.test.ts`, `tab-rows.test.ts`,
`src/__tests__/lib/actions/sheets-sync.test.ts`

**Intent**: Spece przechodzą fikcyjne identyfikatory (`'s'`, `'golden-sheet'`) i działają dziś
dlatego, że bramki nie ma. Po zmianie mają przechodzić **dlatego, że lista dozwolonych działa** —
czyli same są dowodem, że furtka nie jest zepsuta.

**Contract**: w `beforeEach` (albo w istniejącym bloku seedującym env — `sheets-sync.test.ts:106`
robi to już dla `GOOGLE_SERVICE_ACCOUNT_JSON`) ustawić `process.env.GOOGLE_SHEETS_WRITE_ALLOWLIST`
na identyfikatory, których dany spec używa. **Nie** ustawiać `VERCEL_ENV='production'` — to
wyłączyłoby bramkę w testach i przykryło regresję, którą ten plan zakłada.

### Success Criteria

#### Automated Verification

- Test regresyjny szwu przechodzi: `pnpm exec vitest run src/__tests__/lib/google/sheet-write-guard-seam.test.ts`
- Dotychczasowe spece arkuszowe przechodzą przez listę dozwolonych, nie przez brak bramki:
  `pnpm exec vitest run src/__tests__/lib/google src/__tests__/lib/actions/sheets-sync.test.ts src/__tests__/hooks/sync-sheet.test.ts`

#### Manual Verification

- Lokalnie (`VERCEL_ENV` nieustawiony, lista pusta) dodanie wydatku inwestycyjnego na inwestycji
  z podpiętym arkuszem **nie zmienia arkusza**, a w logu serwera jest odmowa z identyfikatorem arkusza
- Lokalnie „Zresetuj wydatki inwestycyjne" kończy się widocznym błędem, nie cichym sukcesem
- Lokalnie z własnym arkuszem testowym na `GOOGLE_SHEETS_WRITE_ALLOWLIST` zapis i reset działają
- Podgląd arkusza, import kosztorysu i porównanie z arkuszem działają lokalnie bez zmian
- Podpięcie arkusza lokalnie kończy się sukcesem z ostrzeżeniem o pominiętej sondzie zapisu, a nie
  komunikatem „udostępnij arkusz koncie usługowemu"

---

## Phase 3: Dokumentacja i odmrożenie bramy QA

### Overview

Zapisanie reguły tam, gdzie następny człowiek jej poszuka, i zdjęcie zamrożenia z sekcji bramy
`staging → main`, które czekały na strażnika.

### Changes Required

#### 1. Reguła w AGENTS.md

**File**: `AGENTS.md`

**Intent**: Sekcja „Databases And Live Data" opisuje już analogiczną regułę dla Vercel Blob. Arkusze
mają tam dziś jedno zdanie („`GOOGLE_SERVICE_ACCOUNT_JSON` … zapisy do Sheets dotykają żywych
danych"), które po tej zmianie jest nieaktualne.

**Contract**: zaktualizować ten punkt: zapisy są odcięte poza produkcją, odczyty otwarte, furtką jest
`GOOGLE_SHEETS_WRITE_ALLOWLIST` z identyfikatorem **własnego** arkusza testowego, a naprawa arkusza
klienta odbywa się z produkcji. Jedno zdanie o tym, że szwem jest `getWritableSheetsClient` i nowa
funkcja pisząca dziedziczy bramkę przez niego, a nie przez konwencję.

#### 2. Odmrożenie sekcji bramy QA

**File**: `context/changes/staging-to-main-gate/ledger.md`

**Intent**: Sześć sekcji jest zamrożonych na czas braku strażnika (`sheet-live-compare`,
`kosztorys-importer`, `import-etapy-z-arkusza`, `sheet-column-mapping`, `EX-686`,
`sheet-measured-qty-from-formula`).

**Contract**: zdjąć adnotację o zamrożeniu, dopisać warunek uruchamiania tych sekcji — własny arkusz
testowy na liście dozwolonych, nigdy arkusz klienta.

### Success Criteria

#### Automated Verification

- brak — faza jest wyłącznie prozą

#### Manual Verification

- Zamrożone sekcje bramy `staging → main` dają się uruchomić na arkuszu testowym

---

## Testing Strategy

### Unit

- `sheetWriteRefusal` — reguła i parsowanie listy (faza 1)
- Szew — `applyTabRowsBatch` / `setupTab` nie wykonują **żadnego** wywołania Google API przy odmowie
  (faza 2). To jest właściwy test regresyjny incydentu: asercja na obserwowalnym efekcie, nie na
  wartości zwracanej przez predykat.

### Integration

Brak nowych. Ścieżka hook → `sheets-sync` → `sheets.ts` jest już pokryta
(`src/__tests__/hooks/sync-sheet.test.ts`, `src/__tests__/lib/actions/sheets-sync.test.ts`) i po
zmianie przechodzi przez listę dozwolonych — czyli te spece stają się dodatkowym dowodem, że furtka
działa.

### E2E

Brak. `pnpm test:e2e` nie ustawia `VERCEL_ENV`, więc po zmianie bramka odmawia, a sync połyka
wyjątek w `catch` — spece nie zmieniają zachowania. To jest właśnie skutek pożądany i on domyka
`research.md` §5 („naprawa literówki w `e2e/helpers.ts:46` natychmiast otwiera kanał na żywy
arkusz").

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## References

- Research: `context/changes/2026-08-26-sheet-write-env-guard/research.md`
- Lista naprawcza arkuszy: `context/changes/2026-08-26-sheet-write-env-guard/cleanup-checklist.md`
- Wzorzec strażnika: `src/lib/env/schema.ts:36-55`, testy `src/__tests__/lib/env/schema.test.ts:104-131`
- Najmocniejsza wersja wzorca (tożsamość baza↔zasób): `src/scripts/backfill-heic-media.ts:153-175`

## Progress

> Konwencja: `- [ ]` do zrobienia, `- [x]` zrobione. Dopisz ` — <commit sha>` po wylądowaniu kroku.

### Phase 1: Predykat odmowy i zmienna środowiskowa

#### Automated

- [x] 1.1 Spec predykatu przechodzi: `pnpm exec vitest run src/__tests__/lib/google/sheet-write-guard.test.ts`

### Phase 2: Szew — klient zapisowy za bramką, odczyty na `readonly`

#### Automated

- [ ] 2.1 Test regresyjny szwu przechodzi: `pnpm exec vitest run src/__tests__/lib/google/sheet-write-guard-seam.test.ts`
- [ ] 2.2 Spece arkuszowe przechodzą przez listę dozwolonych: `pnpm exec vitest run src/__tests__/lib/google src/__tests__/lib/actions/sheets-sync.test.ts src/__tests__/hooks/sync-sheet.test.ts`

### Phase 3: Dokumentacja i odmrożenie bramy QA

#### Automated

- [ ] 3.1 brak checków automatycznych — faza wyłącznie prozą
