# Review-gate ledger — sheet-write-env-guard · 2026-08-27

Zakres: `3b8f3bfd` (dwa konta usługi) na tle `d09c59c9`…`60d4a31b` (poprzednia, zastąpiona
bramka na fladze). Pliki kodu: `src/lib/google/{auth,sheets,sheet-access}.ts`,
`src/lib/env/schema.ts`, `scripts/share-sheets-with-reader.mjs`, cztery speki, `AGENTS.md`.
Poza zakresem: `src/components/forms/edit-transfer-form/edit-transfer-form.tsx` (cudza zmiana,
weszła w `548f9693`).

Step 0.5 (przejazd przeglądarkowy) **pominięty** — slice nie rusza ani jednego komponentu ani
ścieżki UI; jest to wyłącznie warstwa poświadczeń. Weryfikacja ręczna pozostaje należna i żyje jako
sekcja `## sheet-write-env-guard` w `context/foundation/manual-checks.md` (6 nieodhaczonych boxów) —
to blokada archiwizacji nr 2, nie coś, co ten przejazd mógłby domknąć.

## Findings

- [x] 🔴 CRITICAL · fixed · `code-review` + `impl-review` · `src/lib/google/sheet-access.ts:11` ·
      `serviceAccountEmail()` czyta `GOOGLE_SERVICE_ACCOUNT_JSON`, czyli konto **czytające**, a siedem
      powierzchni renderuje ten adres pod napisem „udostępnij **jako Edytujący**". Kto wykona polecenie,
      nadaje Edytora czytającemu — czyli oddaje prawo zapisu każdemu laptopowi i każdemu preview dla tego
      arkusza. To dokładnie ta dziura, którą slice zamyka. Dziś nie wybucha (produkcja wciąż niesie konto
      piszące), wybucha przy zaplanowanej podmianie.
      test: test-driven-debugging · unit — adres pokazywany przy „jako Edytujący" musi być kontem piszącym
- [x] 🔴 CRITICAL · fixed · `code-review` · `src/lib/google/sheet-access.ts:38-62` ·
      Po podmianie produkcji podpięcie nowego arkusza staje się niewykonalne: sonda wymaga Edytora dla
      konta **piszącego**, a komunikat błędu podaje adres **czytającego**. Pętla bez wyjścia. Ten sam
      korzeń co wyżej — jedna poprawka zamyka oba.
      test: test-driven-debugging · unit — jak wyżej
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/google/sheets.ts:198-199` ·
      `applyTabRowsBatch` bije klienta piszącego, ale `readGrid` czyta klientem **czytającym** — więc
      ścieżka zapisu wymaga teraz, żeby OBA konta miały dostęp do arkusza. Wcześniej wystarczyło jedno
      udostępnienie. Arkusz udostępniony tylko piszącemu cicho przestaje się synchronizować
      (`sheets-sync` łapie i loguje „non-fatal").
      test: test-driven-debugging · unit — ścieżka zapisu czyta klientem piszącym
- [x] 🟡 WARNING · fixed · `impl-review` + `module-cohesion` + `feature-first` + `code-review` ·
      `src/lib/env/schema.ts:94` · `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON` to gołe `z.string().optional()`,
      podczas gdy bliźniak trzy linie wyżej ma `.refine()` na kształt JSON-a. Zepsute poświadczenie
      Edytora przechodzi bootstrap i pada dopiero w połkniętym `catch` — w jedynym środowisku, które
      naprawdę pisze.
      test: TDD · unit — `src/__tests__/lib/env/schema.test.ts`
- [x] 🟡 WARNING · fixed · `code-review` · `scripts/share-sheets-with-reader.mjs:22` ·
      `process.argv[2]` zjada `--apply` jako nazwę pliku, więc udokumentowane wywołanie kończy się
      `ENOENT: open '--apply'` przed dotknięciem czegokolwiek.
      test: no automated test · — jednorazowe narzędzie operatorskie, nie ścieżka aplikacji
- [x] 🟡 WARNING · fixed · `code-review` · `scripts/share-sheets-with-reader.mjs:60-65` ·
      Częściowo nieudany przebieg wychodzi z kodem 0 — „nadane 52 · błędy 4" czyta się w łańcuchu `&&`
      jako sukces.
      test: no automated test · — j.w.
- [x] 🟡 WARNING · fixed · `code-review` · `scripts/share-sheets-with-reader.mjs:42-47` ·
      Sprawdzenie idempotencji uznaje `role: 'writer'` za „już ma" — czyli jedyne narzędzie zdolne wykryć
      błędną konfigurację z pierwszego findingu drukuje na nią ✓.
      test: no automated test · — j.w.
- [x] 🟡 WARNING · fixed · `structure-scatter` + `impl-review` · `eslint.config.mjs:109-117` ·
      Nowy skrypt nie trafił do listy ignorów dla jednorazowych narzędzi `.mjs`, więc `pnpm lint` wychodzi
      z 9 błędami `no-undef`. (Bramka była czerwona już wcześniej z jednego innego powodu, więc nic nie
      zostało zepsute — ale to jedna linijka.)
      test: no automated test · — bramka lintu jest strażnikiem
- [x] 🟡 WARNING · fixed · `structure-scatter` · `AGENTS.md` ·
      Zdanie „`getWritableSheetsClient` jest jedynym miejscem bijącym token **z poświadczenia Edytora**"
      jest **nieprawdziwe** — `scripts/share-sheets-with-reader.mjs:11-19` bije z niego token o _szerszym_
      zakresie (`drive`, czyli prawo zmiany uprawnień). Prawdziwa jest węższa wersja z komentarza w kodzie
      („jedyne miejsce bijące token **Sheets** w zakresie zapisu"). Argument bezpieczeństwa się broni,
      argument o unikalności — nie, a to jego sprzedaje następnemu czytelnikowi.
      test: no automated test · — zdanie w dokumentacji
- [x] fixed · `module-cohesion` + `feature-first` + `structure-scatter` + `code-review` ·
      `src/lib/google/sheets.ts:51` · `getWritableSheetsClient` mieszka w 655-linijkowym module domenowym,
      podczas gdy jego bliźniak `getReadonlySheetsClient` ma własny 9-linijkowy plik. `sheet-access.ts`
      importuje z obu — dwa importy tego samego rodzaju z dwóch domów. Slice sam to stworzył: przed nim
      była to prywatna funkcja `getClient()`.
- [x] fixed · `module-cohesion` + `structure-scatter` + `impl-review` · `src/lib/google/sheet-access.ts:46` ·
      Warunek „czy jest poświadczenie Edytora" żyje w dwóch plikach; ten drugi zawodzi **cicho** (pomija
      sondę i zwraca zielone `{ title }`). Powinien być jeden właściciel w `auth.ts`.
- [x] fixed · `module-cohesion` · `src/lib/google/auth.ts:16` ·
      `parseWriteServiceAccountCredentials` jest wyeksportowana przy jednym konsumencie — to drugie drzwi
      do surowego klucza prywatnego przy projekcie, którego cała teza brzmi „jedyna droga to mint JWT".
- [x] fixed · `feature-first` + `structure-scatter` · `src/__tests__/lib/google/sheet-write-credential.test.ts` ·
      Nazwa mówi o module `sheet-write-credential.ts`, który nie istnieje — i jest o literę od
      `sheet-write-guard.ts`, który slice właśnie skasował. Konwencja katalogu to `sheets-<concern>.test.ts`.
- [x] fixed · `feature-first` + `module-cohesion` · cztery speki ·
      Ten sam 3-linijkowy fixture poświadczenia wklejony w `sheets.test.ts`, `sheets-golden.test.ts`,
      `sheets-sync.test.ts` i `sheet-write-credential.test.ts`.
- [x] fixed · `comment-noise` · 8 miejsc · To samo uzasadnienie („bramka to poświadczenie, nie kod")
      napisane w pełnej formie w sześciu plikach; 3 komentarze do usunięcia, 8 do przycięcia do wskaźnika.
      Kanoniczne miejsce: `auth.ts`.
- [x] fixed · `impl-review` + `code-review` + `feature-first` · `context/changes/2026-08-26-sheet-write-env-guard/{plan,plan-brief,change}.md` ·
      Cały plan opisuje skasowany projekt (`sheet-write-guard.ts`, `GOOGLE_SHEETS_WRITE_ALLOWLIST`),
      łącznie z sygnaturą `getWritableSheetsClient(spreadsheetId)`, która już nie przyjmuje argumentu.
      Kto tu zajrzy, odtworzy system, który świadomie porzuciliśmy.
- [x] fixed · `code-review` · `src/lib/google/sheet-access.ts:47` · `console.warn` tam, gdzie repo ma
      `logError` (`src/lib/utils/log-error.ts:9`), i odpala się przy każdym podpięciu lokalnie — czyli w
      przypadku normalnym, nie anomalii.
- [x] fixed · `code-review` · brak `src/__tests__/lib/google/sheet-access.test.ts` ·
      `verifySheetAccess` nie ma ani jednego speka — żadna z dwóch gałęzi (sonda wykonana / pominięta)
      nie jest przypięta.
      test: TDD · unit
- [x] fixed · `simplify` · `src/lib/google/sheets.ts:94` · `readGrid` brał parametr `client` i od razu
      robił `const sheets = client` — martwe przemianowanie po tym, jak prawa strona przestała być
      wywołaniem. Parametr nazwany wprost `sheets`.
- [x] fixed · `simplify` · `src/lib/actions/investments.ts:100` · Nowy akapit o koncie Edytora zostawił
      pod sobą starą jednolinijkową wersję tego samego zdania — artefakt niedokończonej edycji.
- [x] fixed · `simplify` · `src/lib/google/sheet-access.ts:47` · `logError(label, undefined, spreadsheetId)`
      niósł `undefined` tylko po to, żeby dosięgnąć slotu `extra`; identyfikator wpisany w label.
- [x] dismissed · `simplify` · `scripts/share-sheets-with-reader.mjs:20-32` · Skrypt sam parsuje
      poświadczenie zamiast wołać `createWriteServiceAccountJWT`. Zamierzone: potrzebuje zakresu
      **Drive**, którego `auth.ts` nie wystawia; wciągnięcie go tam wymagałoby konwersji skryptu na TS
      albo uogólnienia `auth.ts` w generyczną fabrykę JWT.
- [x] 🔵 OBSERVATION · dropped · `code-review` · `scripts/share-sheets-with-reader.mjs:37-41` ·
      `permissions.list` bez paginacji. Osiągalne dopiero przy liście uprawnień dłuższej niż strona —
      te arkusze mają po kilka wpisów. Nie warte kodu.
- [x] 🟡 WARNING · skipped · `impl-review` · `src/lib/env/schema.ts:90-94` ·
      Brak odmowy w drugą stronę (wzorzec `blobTokenRefusal`: odmów, gdy poświadczenie Edytora pojawi się
      poza produkcją). Świadomie **nie** — furtka „własne konto Edytora do własnego arkusza testowego"
      jest jedyną drogą pracy nad zapisem lokalnie i jest udokumentowana w `manual-checks.md`; ta odmowa
      by ją zamknęła. Powód trafia do przepisanego planu, sekcja „czego NIE robimy".
- [x] 🟡 WARNING · skipped · `code-review` · `src/lib/google/sheet-access.ts:46-51` ·
      Pominięta sonda zmienia kontrakt z „konto MOŻE edytować" na „konto może czytać", a wołający dalej
      czyta prawdę jako dowód Edytora → dialog melduje sukces, mimo że `stampAllTabs` padło non-fatal.
      Realne, ale to **zamierzona** degradacja: alternatywą jest zablokowanie podpinania arkusza poza
      produkcją, czyli lokalnego rozwoju. Zaostrzenie tego kontraktu to osobna decyzja produktowa.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `.env.bak-085939`, `.env.bak-before-reader-080955` ·
      Zarzut, że kopie `.env` wciąż niosą klucz prywatny Edytora — **nieprawdziwy**. Linia została
      zredagowana wcześniej tej samej sesji; `grep -c private_key` = 0 w obu. Potwierdził to niezależnie
      `code-review`.
- [x] filed **EX-746** · `module-cohesion` · `src/lib/google/sheets.ts:305-631` ·
      `setupTab` to 327 linii (połowa modułu), z czego ~250 to czyste budowanie `Schema$Request[]`, które
      dałoby się wyjąć do `sheet-tab-layout.ts` i testować bez mocka `googleapis`. Poprzedza slice, wielkość
      własnego review — `EX-746`.

## Simplify pass

Ran /simplify (cztery kąty równolegle) — **3 applied, 0 proposed, 1 dismissed**; każde znalezisko
złożone do `## Findings` z tagiem `simplify`. Kąty **reuse**, **efficiency** i **altitude** wróciły
czyste: diff sam jest dedupem (`createJWT`, `isServiceAccountJson`, wspólny fixture poświadczeń),
przewleczenie klienta do `readGrid` **zmniejsza** liczbę bitych tokenów na cykl zapisu z dwóch do
jednego, a wydzielenie `writable-sheets-client.ts` jest uogólnieniem, nie przypadkiem szczególnym.

Raport: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.eNlaE6A8OM.md`

## Tests & suite

Strażniki regresji dla znalezisk correctness napisane w Step 1, przed `/simplify` (asercje na
zachowaniu obserwowalnym, więc przeżyły przeorganizowanie wnętrza):

- `src/__tests__/lib/google/auth.test.ts` (**nowy**, 3 testy) — adres pod „jako Edytujący" to konto
  piszące, także przy braku poświadczenia. Strażnik obu 🔴.
- `src/__tests__/lib/google/sheet-access.test.ts` (**nowy**, 4 testy) — obie gałęzie sondy + `extractSheetId`.
- `src/__tests__/lib/google/sheets-write-credential.test.ts` — asercja przepisana: ścieżka zapisu bije
  **jeden** token, na tożsamość Edytora, i **nie** bije readonly. Strażnik 🟡 dwukontowego zapisu.
- `src/__tests__/lib/env/schema.test.ts` — +4 testy na `.refine()` poświadczenia Edytora.
- `src/__tests__/helpers/google-credentials.ts` (**nowy**) — wspólny fixture zamiast wklejki w czterech spekach.

Brak długu E2E: slice nie rusza ani jednego komponentu ani ścieżki przeglądarkowej, a `pnpm test:e2e`
z definicji nie niesie poświadczenia Edytora — powód zapisany w `plan.md` → Testing Strategy.

Brama całodrzewowa (`plan.md` → Whole-tree Gate), 2026-08-27:

| leg              | wynik                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck` | ✅ czysto                                                                                                                                                                                                                                                                                                                                   |
| `pnpm test`      | ✅ 213 plików / 2920 testów zielonych (50 plików skipped)                                                                                                                                                                                                                                                                                   |
| `pnpm build`     | ✅ exit 0                                                                                                                                                                                                                                                                                                                                   |
| `pnpm lint`      | ⚠️ 85 warningów + **1 błąd**: `test.js:284 no-undef` — plik-brudnopis w korzeniu repo, **gitignorowany i nieśledzony**, nie należy do slice'a i nie da się go zacommitować. Bramka była czerwona z tego powodu przed slicem i jest po nim; 9 błędów `no-undef` z `share-sheets-with-reader.mjs`, które slice dołożył, zostało naprawionych. |
| `pnpm test:e2e`  | ⏭️ nie uruchamiany — nie jest na liście bramy w planie, a slice nie ma powierzchni przeglądarkowej                                                                                                                                                                                                                                          |
