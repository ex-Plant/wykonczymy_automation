# Zapis do Google Sheets tylko z produkcji — dwa konta usługi

> **Ten plan został przepisany po wdrożeniu.** Pierwsza wersja opisywała bramkę w kodzie
> (`VERCEL_ENV` + lista dozwolonych identyfikatorów, moduł `sheet-write-guard.ts`). Została
> **porzucona w trakcie** i skasowana — powód niżej, w „Porzucona ścieżka". To, co czytasz,
> opisuje stan faktycznie wdrożony.

## Overview

Każdy zapis do Google Sheets przechodził przez klienta z zakresem `spreadsheets` budowanego w dwóch
miejscach, bez żadnego sprawdzenia środowiska. Identyfikator arkusza pochodzi z bazy, a każda baza
nieprodukcyjna to przywrócony zrzut produkcji — więc localhost, preview i `db-test` pisały do żywych
arkuszy (36 obcych wierszy na 8 arkuszach w sierpniu 2026). Granica zapisu przenosi się do
**poświadczenia**: poza produkcją aplikacja niesie konto z prawem wyłącznie do odczytu, więc odmawia
**Google**, a nie nasz kod.

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
- **Testy jednostkowe mockują `googleapis`**, a stub `serverEnv` (`src/__tests__/stubs/env-server.ts`)
  czyta `process.env` **leniwie** — więc spec ustawia poświadczenie w `beforeEach` i trafia ono do
  kodu bez przeładowania modułu. To jest szew, przez który spece ścieżki zapisu wstrzykują fałszywe
  poświadczenie Edytora.

## Desired End State

Dwa konta usługi w jednym projekcie GCP:

| zmienna                             | konto                       | rola                                     | gdzie żyje                                                  |
| ----------------------------------- | --------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON`       | `kosztorys-sheets-reader@…` | Przeglądający na wszystkich 56 arkuszach | `.env`, Vercel Preview, Vercel Development, **i** produkcja |
| `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON` | `kosztorys-sheets@…`        | Edytujący                                | **wyłącznie** Vercel Production                             |

Zapis z maszyny deweloperskiej dostaje `403` od Google. Nie ma zmiennej środowiskowej, ustawienia
`VERCEL_ENV` ani zmiany kodu, która to odblokuje — bo brakuje nie flagi, tylko klucza.

Weryfikacja (wykonana na żywym arkuszu, nie założona): odczyt tytułu przechodzi, `values.update`
kończy się `403 The caller does not have permission`, a ta sama próba z ustawionym
`VERCEL_ENV=production` kończy się tak samo.

### Key Discoveries

- Szew jest jeden i domknięty: `sheets.ts:42-45` + `sheet-access.ts:32-33`. Żaden skrypt nie pisze
  (sprawdzone: `scripts/*.mjs` i `src/scripts/*.ts` mają 0 wywołań `values.update|append|clear|batchUpdate`).
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
- **Nie dodajemy odmowy w drugą stronę** (wzorzec `blobTokenRefusal`: odrzuć poświadczenie Edytora,
  gdy `VERCEL_ENV !== 'production'`). Byłby to tripwire, nie bramka — i zamknąłby jedyną drogę pracy
  nad zapisem lokalnie, czyli własne konto Edytora nadane wyłącznie własnemu arkuszowi testowemu.
  Takie konto z definicji nie sięga do żadnego z 56 produkcyjnych arkuszy, więc furtka jest bezpieczna
  z tego samego powodu, z którego cała zmiana działa: liczy się poświadczenie, nie flaga.
- **Nie rotujemy starego klucza Edytora.** Konto się nie zmieniło i dalej jest legalnym Edytorem na
  produkcji; kopie klucza zdjęto z maszyny, co zamyka realną ekspozycję.
- **Nie robimy wyjątku dla „Zresetuj wydatki inwestycyjne".** Reset to najbardziej destrukcyjna
  operacja w zestawie; po zmianie naprawa arkusza klienta odbywa się z produkcji i nie ma innej drogi.

## Implementation Approach

**Co robi kod.** Nie jest bramką — bramka jest w poświadczeniu. Kod robi trzy rzeczy:

1. `getWritableSheetsClient()` (`src/lib/google/writable-sheets-client.ts`) zostaje jedynym miejscem
   **w aplikacji** bijącym token Sheets w zakresie zapisu, żeby nowa funkcja pisząca dziedziczyła
   układ przez sam fakt potrzebowania klienta, a nie przez pamiętanie konwencji.
2. Brak poświadczenia rzuca czytelne zdanie (`auth.ts`) **przed** pierwszym wywołaniem Google API,
   żeby zamiast gołego `403` z `googleapis` padło wyjaśnienie.
3. Odczyty jadą na `getReadonlySheetsClient()`, więc bramka nigdy nie zamyka czytania — import,
   podgląd i „Porównaj z arkuszem Google" działają lokalnie bez żadnych uprawnień do zapisu.

Ścieżka zapisu czyta i pisze **tym samym** klientem: arkusz udostępniony tylko kontu Edytora ma
synchronizować się w całości, a nie padać cicho na odczycie gridu za `catch`-em `sheets-sync`.

`verifySheetAccess` degraduje się, a nie zawodzi: bez poświadczenia Edytora sonda zapisu jest
**pomijana**, nie oblewana. `null` dalej znaczy „konto nie ma dostępu w ogóle" — zwracanie go przy
braku poświadczenia wysyłałoby właściciela po ponowne udostępnianie arkusza, który nigdy nie był
problemem.

**Adres, który UI każe udostępnić, to konto PISZĄCE.** `writeServiceAccountEmail()` czyta go
z poświadczenia Edytora, a tam gdzie go nie ma (czyli wszędzie poza produkcją) zwraca stałą — adres
konta usługi nie jest sekretem, a instrukcja musi być poprawna również lokalnie. Nadanie Edytora
kontu **czytającemu** oddałoby prawo zapisu każdemu laptopowi i każdemu preview dla tego arkusza,
czyli otworzyłoby dziurę po jednym arkuszu naraz. Powierzchnia zgłaszająca błąd **odczytu**
(`kosztorys-import`) zostaje przy adresie czytającym i prosi o rolę Przeglądającego.

### Porzucona ścieżka: bramka na fladze

Pierwotny plan stawiał predykat `sheetWriteRefusal(VERCEL_ENV, spreadsheetId, allowlist)`
w `src/lib/google/sheet-write-guard.ts`: poza produkcją klient zapisowy powstaje tylko dla arkusza
wpisanego na `GOOGLE_SHEETS_WRITE_ALLOWLIST`. Wdrożone w `d09c59c9`, `4210bc7d`, `408f7db4`,
`60d4a31b` i skasowane w `3b8f3bfd`.

**Dlaczego padło.** Ta maszyna trzyma sekrety produkcji (`DB_POSTGRES_URL_PROD`, JSON konta usługi),
więc **żadne sprawdzenie środowiska nie odróżni produkcji od developera, który ustawił zmienne**.
Bramka na fladze jest tak mocna, jak maszyna, która ją liczy — a ta maszyna jest po drugiej stronie.
Bramka w poświadczeniu jest egzekwowana przez Google, poza maszyną, i nie da się jej przegadać.
Kolejność wdrożenia wynikała z tego samego rachunku: dotychczasowe konto **zostało** piszącym (jest
już Edytorem na wszystkich 56 arkuszach, więc zero ponownego udostępniania i ani chwili, w której
produkcja traci zapis), a nowe, czytające, dostało tylko addytywne nadania Przeglądającego.

---

## Wdrożone zmiany

### 1. Poświadczenia (`src/lib/env/schema.ts`, `src/lib/google/auth.ts`)

- `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON` jako opcjonalna zmienna serwerowa — opcjonalna, bo każde inne
  środowisko **ma jej nie mieć**; jej brak to bramka, nie błąd konfiguracji. Walidowana `.refine()`
  na kształt JSON-a **gdy jest obecna**: zepsute poświadczenie Edytora inaczej przeszłoby bootstrap
  i padło wewnątrz odroczonego zapisu, który `sheets-sync` połyka — w jedynym środowisku, które pisze.
- `auth.ts` jest jedynym właścicielem pytania „czy jest poświadczenie Edytora"
  (`hasWriteServiceAccountCredentials`) i jedyną drogą do klucza (`parseWriteServiceAccountCredentials`
  jest prywatna dla modułu — eksport byłby drugimi drzwiami do klucza prywatnego).

### 2. Szew klienta (`src/lib/google/writable-sheets-client.ts`, `sheets.ts`, `sheet-access.ts`)

Fabryka klienta zapisowego dostaje własny moduł, bliźniaczy wobec `readonly-sheets-client.ts` —
wcześniej siedziała w 655-linijkowym module domenowym, przez co `sheet-access.ts` ciągnął cały graf
`sheets.ts` po jedną czterolinijkową funkcję.

### 3. Konta w interfejsie (`lib/actions/{investments,sheets}.ts`, `sheet-access-block.tsx`)

Powierzchnie „udostępnij **jako Edytujący**" nazywają konto piszące; powierzchnia zgłaszająca brak
**odczytu** nazywa konto czytające i prosi o Przeglądającego.

### 4. Narzędzie operatorskie (`scripts/share-sheets-with-reader.mjs`)

Hurtowe nadanie Przeglądającego kontu czytającemu, uruchamiane **z produkcji** (potrzebuje
poświadczenia Edytora, bo udostępnianie pliku wymaga Edytora na nim). Dry-run domyślnie, idempotentne,
krzyczy gdy konto czytające ma rolę wyższą niż Przeglądający, wychodzi z kodem ≠ 0 przy jakimkolwiek
błędzie. To **jedyny inny** posiadacz poświadczenia Edytora w repo — i bije token `drive`, czyli
uprawnienie szersze niż token Sheets; `AGENTS.md` mówi to wprost, żeby teza o „jedynym miejscu"
nie była nieprawdziwa.

## Testing Strategy

### Unit

- `sheets-write-credential.test.ts` — brak poświadczenia ⇒ rzut **przed** pierwszym wywołaniem Google
  API i zero wywołań mocków; `VERCEL_ENV='production'` niczego nie zmienia; ścieżka zapisu bije
  **jeden** token, w zakresie `spreadsheets`, na tożsamość Edytora, i **nie** bije tokenu readonly
  (to jest dowód, że arkusz udostępniony tylko Edytorowi się synchronizuje); odczyt zostaje otwarty
  przy zerowym poświadczeniu Edytora.
- `auth.test.ts` — adres pokazywany pod „jako Edytujący" to konto **piszące**, nigdy czytające,
  także gdy poświadczenia nie ma. Strażnik regresji dla dziury znalezionej na bramie review.
- `sheet-access.test.ts` — obie gałęzie sondy: z poświadczeniem wykonuje `batchUpdate`, bez —
  zwraca tytuł i **nie pisze nic**; brak odczytu dalej daje `null`.
- `env/schema.test.ts` — nieobecność przechodzi, poprawny JSON przechodzi, urwany JSON i JSON bez
  klucza prywatnego są odrzucane na bootstrapie.

### Integration

Brak nowych. Ścieżka hook → `sheets-sync` → `sheets.ts` jest pokryta
(`src/__tests__/hooks/sync-sheet.test.ts`, `src/__tests__/lib/actions/sheets-sync.test.ts`); te spece
wstrzykują fałszywe poświadczenie Edytora, żeby ścieżki zapisu dało się przejechać. To **nie** jest
obejście bramki — bramką jest rola Przeglądającego na prawdziwym poświadczeniu, a tego żaden test
nie podrobi.

### E2E

Brak. `pnpm test:e2e` nie niesie poświadczenia Edytora, więc zapis odmawia, a sync połyka wyjątek —
i to jest skutek pożądany: domyka `research.md` §5 („naprawa literówki w `e2e/helpers.ts:46`
natychmiast otwiera kanał na żywy arkusz").

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

### Wdrożenie

#### Automated

- [x] Spece poświadczenia, szwu, sondy i schematu env przechodzą: `pnpm exec vitest run src/__tests__/lib/google src/__tests__/lib/env src/__tests__/lib/actions/sheets-sync.test.ts src/__tests__/hooks/sync-sheet.test.ts` — 3b8f3bfd + bramka review
- [x] `pnpm typecheck` — 3b8f3bfd
- [x] `pnpm build` — 3b8f3bfd

#### Infrastruktura (wykonane i zweryfikowane na żywo)

- [x] 56/56 arkuszy udostępnionych kontu czytającemu jako Przeglądający
- [x] `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON` wyłącznie na Vercel Production
- [x] `.env`, Preview i Development na koncie czytającym
- [x] Klucz Edytora zdjęty z maszyny (kopie `.env.bak-*` zredagowane, kopie w `/tmp` wymazane)
- [ ] `GOOGLE_SERVICE_ACCOUNT_JSON` na Production podmienione na konto czytające — **dopiero po
      wdrożeniu kodu**, inaczej deploy w międzyczasie odciąłby produkcji zapis
