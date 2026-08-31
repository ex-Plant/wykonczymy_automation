# Review-gate ledger — branch `heic-upload-gap` vs `staging` · 2026-08-25

**Zakres:** cała gałąź — 36 commitów, 103 pliki (91 pod `src/`/`e2e`/`scripts`), +5963/−911.
Obejmuje kilka slice'ów, z których część miała już własną bramkę: HEIC upload gap (EX-394),
otypowanie pól formularzy (EX-733/734), `kosztorys-decimal-cell-draft` (zarchiwizowany),
próba cutoveru na staging (dokumenty) oraz seria pojedynczych poprawek (flota, faktury,
przelewy, daty, nawigacja, podsumowanie podwykonawców).

**Bramka:** ten przebieg jest przeglądem CAŁEJ gałęzi przed PR-em, mimo wcześniejszych bramek
per-slice. Ledger trafia tu, a nie do folderu zmiany, bo żaden pojedynczy `change.md` nie
pokrywa tego zakresu.

**Krok 0.5 (przebieg weryfikacyjny w przeglądarce) pominięty** — wymaga sterowania Playwrightem,
czego nie robię bez wyraźnej prośby; otwarte checki ręczne żyją w `context/foundation/manual-checks.md`.

## Findings

**Przycięte przy archiwizacji (2026-08-31).** Przed przycięciem: 22 fixed, 6 skipped, 4 dismissed,
28 dropped · 0 open. Findingi „fixed" wycięte — trwałym zapisem naprawy jest commit, który ją wniósł,
i sam kod. Zostaje to, czego git nie niesie: świadome decyzje o NIEROBIENIU, czyli negatyw. Jedyny
finding „fixed", który poza kodem zostawił ślad w trackerze, to przeniesienie pól formularza
związane z **EX-733** — zachowane w skrócie poniżej.

- [x] fixed (skrót, filing) · `feature-first` · `form-fields/plane-amount-field.tsx`,
      `expense-category-field.tsx` · pola z jednym konsumentem-formularzem przeniesione do
      `deposit-form/` i `edit-transfer-form/`; rozjazd ujawniony po EX-733

### tailwind-v4-audit — 0 zgłoszeń

Gałąź nie dodaje ani jednej nowej klasy Tailwind poza `mt-6` i przekazaniem `fieldClassName`; brak
`next/image`, brak nowych prefiksów breakpointów, więc ryzyko wklejki z fabrycznej skali nie wystąpiło.
Dwa trafienia w `kosztorys-editor-body.tsx` (`h-[calc(100dvh-7rem)]`, `style={{ left: guideX }}`) są
sprzed gałęzi i uzasadnione (viewport minus chrome; pozycja liczona w runtime).

- [x] dropped · `tailwind` · brak Tailwind-aware lintera w repo (`prettier-plugin-tailwindcss` tylko sortuje) — realne, ale to zmiana w tooling/CI, nie w tej gałęzi; nie zakładam issue za pojedynczą rekomendację narzędziową

### feature-first-structure — 0 naruszeń, 1 obserwacja

Sprawdzone 14 dodanych źródeł, 8 dodanych speków i 3 przeniesienia. Wszystkie speki odwzorowują pełną
ścieżkę źródła; dom każdego nowego hooka zgadza się z regułą „liczby katalogów-konsumentów"
(`use-file-pick-ingest` → dwa formularze → `forms/hooks/`; `use-cell-draft` → trzy pliki w JEDNYM
katalogu → kolokacja); szew `ui/datasheet-grid/` ↔ `editor/grid/cells/` biegnie w jedną stronę (zero
importów zwrotnych); przeniesienia `lib/utils/` → `lib/invoices/` idą we właściwą stronę.

### module-cohesion-audit — 4 realne, 3 marginalne

- [x] dropped · `cohesion` · `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx:48,52,66` · `CellTooltip` + `REFUSED_TONE` + `CELL_WRAPPER` nie wiedzą nic o podwykonawcach (obejście trybu kontrolowanego Radiksa), a to dokładnie klasa z `ui/datasheet-grid/`. Gałąź to zaostrzyła: `useCellDraft` wystawia `blockReason` jako część WSPÓLNEGO kontraktu, ale jedyny renderer siedzi zamknięty w pliku podwykonawcy — `decimal-column.tsx` zrzuca odmowę na podłogę. **Do przeniesienia w kroku 2.** — **dropped:** reguła repo promuje przy DRUGIM katalogu-konsumencie, a te trzy mają jeden plik i zero duplikacji w `decimal-column.tsx`/`discount-columns.tsx` — przeniesienie kupiłoby tylko ruch
- [x] skipped · `cohesion` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` · 1180 linii, jeden eksport, pięć klastrów (bufor burstu undo, wyprowadzenia filtrów, wyprowadzenia pieniężne, CRUD pozycji, CRUD sekcji) — realny bóg-moduł, ale sprzed gałęzi i **już świadomie odroczony w EX-515** jako spójna jednostka stanowa wymagająca najpierw harnessu testowego. Nie zakładam duplikatu; refaktor wart własnego przeglądu.
- [x] dropped · `cohesion` · `kosztorys-v2-columns.tsx` (745 linii) · ten sam wniosek co w bramce zarchiwizowanego slice'u — bóg-moduł sprzed gałęzi, która ruszyła tu ±58 linii
- [x] dropped · `cohesion` · `kosztorys-editor-body.tsx` (412 linii) · dziesięć wyprowadzeń między wywołaniem hooka a znacznikami, ale każdy kawałek jest na temat ciała edytora — marginalne
- [x] dropped · `cohesion` · `form-fields/line-items-field.tsx` (429 linii) · dwa podtematy w środku, gałąź dołożyła +15 linii — nie jej sprawa
- [x] skipped · `reuse` · `src/scripts/backfill-heic-media.ts:38-40,48-61` · `MAX_WIDTH`/`MAX_HEIGHT`/`QUALITY` powielone z `src/lib/utils/compress-image.ts:4-6` (komentarz sam się przyznaje do lustra), a trio `fail`/`arg`/`has` powtarza parsowanie CLI z `scripts/blob-restore.mjs` i `blob-mirror.mjs`. **Do rozstrzygnięcia razem z `primitive-reuse-scan` w kroku 2.** — **skipped:** `compress-image.ts` to moduł przeglądarkowy (compressorjs/canvas), skrypt jedzie na sharpie — import przez tę granicę byłby gorszy niż lustro, które komentarz już nazywa; parsowanie CLI w `.mjs` vs `.ts` nie ma wspólnego grafu

Oddalone jako spójne: `cell-edit.ts`, `undo-coalesce.ts`, `use-undo-redo.ts`, `investor-actions.tsx`
(konwencja folderu), `subcontractor-summary.ts`, `discount-edit.ts`, `form-types.ts`, `form-hooks.ts`,
`use-cell-draft.ts` i skrypt backfillu (liniowy jednorazowiec, spójny przy każdej długości).

### code-review A — wgrywanie / faktury / media / backfill HEIC

- [x] 🔴 CRITICAL · fixed · `code-review` · `src/scripts/backfill-heic-media.ts:299` · `skipRevalidation: true` broni się tym, że „nie ma czego unieważniać w runie CLI" — a jest: `src/lib/queries/media.ts:31` trzyma CAŁĄ tabelę `media` w `unstable_cache(['media-all'], { tags: [media] })` bez TTL, i to z niej `resolveInvoiceFiles` bierze `url`/`filename`. Wtyczka blobu kasuje stary plik przed wgraniem JPEG-a, więc po runie na produkcji każdy przerobiony skan wskazuje na nieistniejące `.heic` i wywala 404 do czasu przypadkowego zapisu w `media`. `--verify` tego nie złapie (czyta świeżo z bazy). Ani skrypt, ani `blob-recovery-runbook.md §5` nie mają kroku unieważnienia. — **fixed:** nie da się naprawić w kodzie (`revalidateTag` rzuca poza kontekstem żądania), więc domknięte na czterech powierzchniach: komentarz przy `skipRevalidation`, ostrzeżenie zamykające run, blok o cache-buście w runbooku §5 i check redeployu w `manual-checks.md`
      test: no automated test · — · to procedura produkcyjna; guard = krok w runbooku + zdjęcie `skipRevalidation`
- [x] 🟡 WARNING · fixed · `code-review` · `src/components/forms/expense-form/expense-form.tsx:229` · `resetConditionalFields` przestał zerować `lineItems` i uzasadnia to dwoma guardami w `mapLineItem` — pomija trzeci: `otherCategory`. `map-line-item.ts:36` wysyła je bezwarunkowo, a `hooks/transfers/validate.ts` go nie czyści. Scenariusz: typ `OTHER` → wybrana „Kategoria" → przełączenie na `REGISTER_TRANSFER`; pole znika z formularza, wartość zostaje w wierszu i ląduje na przelewie. Przed tym hunkiem zerowanie ją zdejmowało. — **fixed:** `mapLineItem` zdejmuje `category` na typach, które go nie pokazują (`showsOtherCategory`); regresja w `__tests__/map-line-item.test.ts`
      test: test-driven-debugging · unit — czerwony repro na `mapLineItem`/`resetConditionalFields`, asercja na wysłanym ładunku
- [x] 🟡 WARNING · fixed · `code-review` · `src/components/forms/hooks/use-file-pick-ingest.ts:47` · `inputKey` bumpuje się przy KAŻDYM odrzuceniu, także częściowym, przez co `FileInput` się przemontowuje i gubi `fileName`. Wybór 3 zdjęć, jedno >4 MB → toast, picker pusty, a `edit-transfer-form.tsx:168` chowa też podgląd istniejących faktur (`files.length` ≠ 0) — użytkownik nie widzi ŻADNEGO załącznika, a dwie strony jadą z „Zapisz". Dokładnie ta awaria, przed którą hook miał chronić, tylko odwrócona. Bump tylko przy `ingested.length === 0`. — **fixed:** bump `inputKey` tylko przy `ingested.length === 0`
      test: test-driven-debugging · unit — częściowe odrzucenie nie rusza `inputKey`
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/hooks/use-invoice-removal.ts:82` · kontrakt `pending`/`pendingLabel` jest martwy: `AlertDialogAction` zamyka dialog na klik → `onOpenChange(false)` → `setStaged(null)`, więc „Usuwanie…" nigdy się nie pokaże. Gorsze niż kosmetyka: `pending` zostaje `true` do rozstrzygnięcia akcji, więc drugie usunięcie otwarte w tym oknie ma wyłączone OBA przyciski — wyjście tylko Escape. — **dismissed:** kontrakt NIE jest martwy — `pending`/`pendingLabel` czyta pięć innych wywołań `ConfirmDialog`; podwójna blokada przycisków nie odtwarza się, bo dialog trzyma jedną scenę na raz
      test: no automated test · — · stan UI dialogu; guard = usunięcie martwego kontraktu, nie asercja
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/lib/invoices/submit-with-invoice-pages.ts:42` · `withOrphanCleanup` sprząta po KAŻDYM rzucie po stronie klienta. Bezpieczne po commicie, ale nie w trakcie: `createBulkTransferAction` siedzi w `withPayloadTransaction`, więc timeout klienta w trakcie akcji daje `payload.count` zero referencji → kasujemy media → transakcja commituje `transactions_rels` na martwe id i wywala FK. Mała szansa, ale komentarz w `delete-unreferenced-media.ts` broni tylko przypadku po commicie. — **skipped:** zawężenie sprzątania wymaga wiedzy, po której stronie commitu padł rzut — klient tego nie wie; zmiana zachowania na ścieżce kasującej bajty, warta własnego przeglądu
      test: no automated test · — · wyścig wymagałby sterowania commitem; guard = zawężenie warunku sprzątania
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/scripts/backfill-heic-media.ts:115` · parowanie środowisk to gołe `dbUrl === process.env.DB_POSTGRES_URL_PROD`. Neon wystawia host pooled i direct dla tej samej bazy, a `.env` trzyma jeden — operator wpisujący drugą formę (albo dokładający `?sslmode=`) dostaje `isProdDb === false` i run przepisuje wiersze PRODUKCJI, robiąc snapshot z preview. Porównanie host+baza zamiast całego stringa to zamyka. — **fixed:** `dbIdentity()` porównuje host+bazę po sparsowanym URL-u i zdejmuje sufiks `-pooler`
      test: no automated test · — · guard = porównanie po sparsowanym URL-u
- [x] 🔵 OBSERVATION · fixed · `code-review` · `context/reference/blob-recovery-runbook.md §5` · rollback przywraca tylko `dumps/heic-backfill-prod`, a kanarek pisze do `dumps/heic-backfill-canary`. Te dwa wiersze są już JPEG-ami, gdy pełny run enumeruje HEIC, więc ich oryginały nigdy nie trafiają do katalogu produkcyjnego — pełny rollback cicho ich nie przywróci. — **fixed:** rollback leci po obu katalogach (`heic-backfill-canary` + `heic-backfill-prod`) i wymienia sześć kolumn do przywrócenia

Czyste po weryfikacji: `deleteUnreferencedMedia` pokrywa obie kolekcje wiążące się z `media`; szeregowy
`sweep-io.stampNotified` trzyma stary kontrakt; przeprowadzki modułów nie zostawiły martwych importów;
`tsc --noEmit` czysty na HEAD.

### structure-scatter-audit — 0 rozsypanych rodzajów, 1 konkurencyjny mechanizm

**Sprostowanie do mojego brief-u:** cztery z sześciu plików, które podałem jako „urosło `src/lib/utils/`",
to zmiany nazwy (`R088`/`R100`) — gałąź zrobiła coś odwrotnego niż rozsypanie: `lib/utils/` netto −2 w
rodzinie faktur, `lib/invoices/` 6 → 11, zero importów na starych ścieżkach. Naprawdę nowe w `lib/utils/`
są tylko `decimal-text.ts` i `latest-request.ts`, oba zgodne z konwencją.

- [x] dropped · `naming` · `src/components/forms/expense-form/bulk-expense-form.ts` · dwa z trzech plików typu API formularza nazywają się `<form>-form-api.ts`, ten jeden nie. Nic nie przewiduje, co dostanie czwarty formularz. **Do zmiany nazwy w kroku 2** (razem z powyższym). — **dropped:** plik trzyma też `formOptions` i `makeLineItem`, więc `-api.ts` byłby MNIEJ trafną nazwą niż obecna
- [x] dropped · `docs` · `AGENTS.md:213-215` · wyliczanka „trzy hooki plikowe" niedoszacowuje rodzinę (jest ich pięć), ale REGUŁA jest poprawna i każdy z pięciu ją spełnia — to przykład, nie kontrakt
- [x] dismissed · `structure` · `src/lib/kosztorys/` (74 pliki płasko) · najgrubszy kandydat na szufladę w repo, ale sprzed gałęzi; ta dołożyła 2 pliki, oba poprawnie umieszczone. Podział to własny przegląd.

Potwierdzone konwencje (zostawić): czysty rdzeń w `lib/` + hook nad nim (trzy instancje w tym diffie),
dom hooka po liczbie katalogów-konsumentów, warstwy ingestu jako stos a nie konkurencja,
`src/scripts/*.ts` vs `scripts/*.mjs`, `decimalText` przy swoim odwrotniku `parseDecimalInput`,
jednokierunkowy szew `datasheet-grid`. Gałąź skasowała też jeden konkurencyjny dom
(`form-components/form-file-input.tsx` → `ui/file-input`).

### comment-noise-audit — flag-only, 0 plików zmienionych

- [x] dismissed · `comment-noise` · duplikacja uzasadnień · historia „12,5 → 125" opowiedziana w pełnej formie w `cell-edit.ts:4`, `use-cell-draft.ts:17` i `discount-columns.tsx:40` (+ wzmianki w trzech kolejnych); lista wywołujących `decimalColumn` wypisana i w `decimal-column.tsx:10`, i w `cell-edit.ts:119`. Dom tej historii to `cell-edit.ts` — reszta ma wskazywać. **Do rozstrzygnięcia w kroku 2.** — **dismissed:** sprawdzone: pełną historię „12,5 → 125” opowiada tylko `use-cell-draft.ts`, `discount-columns.tsx` już wskazuje, a `cell-edit.ts` opisuje kontrakt bez incydentu. Zdublowana była wyłącznie lista wywołujących `decimalColumn` — zdjęta z `cell-edit.ts`, została w `decimal-column.tsx`
- [x] dropped · `comment-noise` · `kosztorys-synthetic-rows.tsx:40` · komentarz mówi „Left-aligned like the data cells", a `className` ma `px-2` bez `text-left` — nieścisłość, ale nośna połowa (sprzężenie z `computed-cell.tsx`) zostaje i sam opis wyrównania nie szkodzi
- [x] skipped · `comment-noise` · `expense-form.tsx:220` · 12 linii narracji zniknionego stanu („They used to be wiped here…"), ale broni NIEOBECNOŚCI kodu i obala nazwane zagrożenie — jedyny nośnik tej decyzji. Esej w środku komponentu; przeniesienie do `context/` to własna zmiana.
- [x] dismissed · `comment-noise` · `decimal-column.tsx:13` i `:60` · ta sama przesłanka dwa razy, ale to argument przeciw cofnięciu zmiany i nadal wiąże
- [x] dismissed · `comment-noise` · `cell-edit.ts:24` · `restoredLabel` — doc dokłada informację, że to tekst dla użytkownika, nie klucz

Sygnał ogólny: gałąź nie ma szumu klasycznego (zero narracji CSS, zero nagłówków opisujących render).
Ma dwa inne wzorce: **duplikację uzasadnień** i jeden **komentarz sierotę**.

### /10x-impl-review — REJECTED (Plan ⚠️ · Scope ❌ · Safety ❌ · Arch ✅ · Wzorce ✅)

Zakres `ac15d4ef..79a71d31`, 11 commitów, 54 pliki. Raport:
`/private/tmp/claude-501/-Users-konradantonik-workspace-yolo-wykonczymy/0fff720b-6ec8-4f80-983f-bc05d26d287c/scratchpad/impl-review-heic-upload-gap.md`

- [x] 🔴 CRITICAL · fixed · `impl-review` · `src/scripts/backfill-heic-media.ts:61` · **F2 — nierozpoznana flaga przechodzi bez słowa.** `has = (name) => process.argv.includes(name)` nie odrzuca niczego. Linia z runbooka (`blob-recovery-runbook.md:414-418`) niesie już `--allow-prod`; literówka `--dryrun` / `--dry_run` / półpauza `–dry-run` mija guard suchego biegu na `:210`, a `--allow-prod` przechodzi → pełny destrukcyjny run na produkcji, 18 oryginałów skasowanych ze składu bez undelete, bez kolejnego pytania. Skrypt waliduje `--limit` dokładnie przeciw tej klasie literówek (`:66-68`) — rozumowania nie rozciągnięto na flagi. **Faza 4 jeszcze nie poszła, więc to ryzyko żywe.** — **fixed:** allow-lista `KNOWN_FLAGS`/`VALUED_FLAGS`, nieznany token `--` leci na `fail()`
      test: no automated test · — · guard = `fail()` na nieznanym tokenie `--`
- [x] 🔴 CRITICAL · fixed · `impl-review` · `src/hooks/use-invoice-removal.ts:20-93` + `invoice-cell.tsx:81` + `edit-transfer-form.tsx:193` · **F1 — commit ścieżki destrukcyjnej bez śladu w żadnym dokumencie zmiany.** `e7d31903` (+72/−29) przepisał usuwanie faktur/stron z `confirm()` na maszynę `{title, run}` + `pending`. Grep po całym folderze zmiany: zero trafień w `plan.md`, `change.md`, `plan-brief.md`, obu przebiegach bramki. Zero testów, zero E2E, **zero pozycji w `manual-checks.md ## EX-394`** (19 checków pokrywa ingest, reset pickera, backstop Entera, klin czyszczenia formularza i `rows` — usuwania nie tyka żaden). To jedyna powierzchnia w slice'ie, która **kasuje bajty faktur z Bloba** (bez wersjonowania, bez undelete), wypuszczona z zerową deklarowaną weryfikacją. — **fixed:** sześć checków „Usuwanie faktur i stron” w `manual-checks.md ## EX-394` + sekcja o pracy nieplanowanej w `plan.md`. E2E nie zakładam — bramka projektu ma je jako NIE-blokujące od 2026-07-28
      test: no automated test · e2e — do dopisania albo do złożenia jako `e2e-backlog`; minimum: 3 pozycje w `manual-checks.md`
- [x] 🟡 WARNING · fixed · `impl-review` · `src/hooks/use-invoice-removal.ts:85` · **F4 — usunięcie, które rzuci, zamyka dialog po cichu.** `void staged.run().finally(…)` — zwrócona porażka jest toastowana (`:43`, `:59`), ale **rzut** nie: `.finally` nie obsługuje odrzucenia, więc leci unhandled rejection, dialog się zamyka, `pending` gaśnie, ani słowa. `removedIds` nietknięte, więc strona zostaje na ekranie i czyta się jak glitch. Bliźniacza ścieżka w tym samym diffie dostała dokładnie to leczenie (`use-form-submit.ts:31-43`). — **fixed:** `.catch(() => toastMessage(…, 'error'))` przed `.finally`
      test: test-driven-debugging · unit — repro na rzucającej akcji, asercja na toast
- [x] 🟡 WARNING · fixed · `impl-review` · `plan.md:170,322-330` + `review-gate.md` · **F5 — zapisy zmiany rozjechały się z kodem.** (a) Notka o odstępstwie w fazie 2 twierdzi „adnotuje tylko siedem wrapperów" — `f7a683bd` te adnotacje usunął, `grep AppFieldComponentsT src` daje 2 trafienia, oba w `form-hooks.ts`. (b) `plan.md:170` wciąż niesie kryterium `grep → nic`, którego odstępstwo czyni niespełnialnym (przepisano tylko lustro w Progressie). (c) Bramka zapisała zawężenie `listeners` w **`form-hooks.ts:47`** — nie wylądowało; `:40` to `listeners?: any` z komentarzem, że TAK ZOSTAJE, więc `{ onChange: 42 }` dalej przechodzi typecheck w trzech formularzach. — **fixed:** kryterium fazy 2 przepisane, notka o odstępstwie poprawiona (`AppFieldComponentsT` ma dziś 2 trafienia, oba w `form-hooks.ts`), zawężenie `listeners` opisane jako niezrealizowane
- [x] 🟡 WARNING · fixed · `impl-review` · `5f1fe3ed`, `f7a683bd`, `30be2dba` · **F6 — dwa issues złożone jako „poza zakresem, warte własnego przeglądu" zostały zaraz zrobione na tej samej gałęzi.** EX-734 i EX-733. Te trzy commity to ~20 z 34 nieplanowanych plików. Drugi przebieg bramki opisuje je uczciwie, ale **`plan.md` nigdy nie został poprawiony**. Jedna konsekwencja zasługuje na osobną linię: `use-form-submit.ts:31-43` dokłada try/catch + toast tam, gdzie rzucająca akcja wcześniej kończyła w ciszy — zmiana zachowania dla **każdego** formularza `keepOpen` w aplikacji, z uzasadnieniem żyjącym wyłącznie w treści commita. — **fixed:** `plan.md` dostał sekcję o pracy nieplanowanej, nazywającą EX-734/EX-733, zmianę zachowania w `use-form-submit.ts:31-43` i ścieżkę `e7d31903`
- [x] 🟡 WARNING · fixed · `impl-review` · `blob-recovery-runbook.md:457-459` vs `backfill-heic-media.ts:72-81` · **F8 — udokumentowany rollback czyta pola, których manifest nie zapisuje.** `ManifestEntryT` nie ma `mimeType`. Runbook milczy też o `width`/`height`/`sizes_thumbnail_*` — oryginały mają NULL-owe wymiary i brak miniatury, backfill wypełnia wszystko, a cofnięcie trzech pól zostawia plik HEIC za miniaturą wyprodukowaną z JPEG-a. Do tego `--force` (`:224-229`) nadpisuje manifest manifestem krótszego biegu, a skoro `findHeicRows` nie zwraca już przerobionych wierszy, ta mapa znika na zawsze. — **fixed:** runbook wymienia sześć kolumn (`filename`, `mime_type`, `filesize`, `width`/`height` → NULL, `sizes_thumbnail_*` → NULL + kasowanie osieroconej miniatury); `--force` archiwizuje manifest zamiast go nadpisać
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `backfill-heic-media.ts:65-68,253-259` · **F9 — trzy jednolinijkowe luki.** (a) `--limit 0` znaczy _wszystkie wiersze_ — na skrypcie, którego kanarek to `--limit 2`, zero jest jedyną liczbą, która nie może znaczyć „wszystko". (b) `if (row.filesize && …)` pomija kontrolę ucięcia, gdy `filesize` jest NULL/0 — prawdopodobne właśnie dla tych starych wierszy; taki wiersz zrzuca ucięte bajty i loguje zielony ptaszek. (c) `path.join(SNAPSHOT_DIR, filename)` na nazwie, o której nagłówek pisze, że „poprzedza `sanitizeFileName`" — `path.basename()` to jedno wywołanie. — **fixed:** `--limit` czytany tylko gdy podany (0 znaczy „brak flagi”), `if (!row.filesize) fail(...)` zamiast cichego pominięcia, `path.basename()` na nazwie pliku snapshotu
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `backfill-heic-media.ts:151-157,366-369` · **F10 — weryfikacja powiązań pokrywa jedną z dwóch kolekcji.** `countLinkedTransactions` pyta tylko o `transactions`; `relationTo: 'media'` jest w dwóch miejscach (`transfers.ts:232`, `vehicle-inspections.ts:107`). `delete-unreferenced-media.ts`, zmieniony tym samym diffem, liczy poprawnie obie — to plan był wąski, nie kod się rozjechał, ale bramka udowodniła tę tezę na sąsiednim pliku i jej nie przeniosła. — **fixed:** `countLinkedDocuments` liczy `transactions` + `vehicle-inspections`
- [x] dropped · `impl-review` · `plan.md:304,318-361` · **F7 — 10 z 13 odhaczonych pozycji Progressu bez sufiksu sha**, choć shaki istnieją. Plan i tak jest już zarchiwizowany razem ze slice'em; poprawianie sufiksów po fakcie nie kupuje nic.

Zdublowane z `code-review A` (jedno rozstrzygnięcie, nie dwa): F3 = `backfill-heic-media.ts:115` (parowanie środowisk przez równość stringów), F4 ≈ `use-invoice-removal.ts:82`, F8 ≈ rollback w runbooku.

Zweryfikowane zielone: `vitest` 5/5 + 3/3 + 6/6, `grep FormFileInput src` → 0, `pnpm typecheck` exit 0,
`pnpm build` exit 0 (pierwszy bieg wywalił się na **nieświeżym** cache `.next`, nie na kodzie), eslint czysty.
Trzy „czego NIE robimy" utrzymane. Nic z planu nie brakuje. Usunięcie lustra typów złapało realną usterkę:
stary typ deklarował propa `rows`, którego `FormTextarea` nigdy nie przyjmował — pięć wywołań przechodziło
typecheck i było gubione w locie.

### code-review C — kosztorys / przelewy / migracja / flota

`tsc --noEmit` czysty; `vitest` na `lib/kosztorys` + `transfer-filters` + `lib/fleet` + `components/kosztorys`
→ 1101 zielonych / 40 pominiętych.

- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/kosztorys/discount-edit.ts:59` · **sufit rabatu jest jednostronny.** `guard` sprawdza `row.discountValue > MAX_DISCOUNT_PERCENT` bez podłogi, a `parseDecimalInput` przyjmuje ujemne. Wpisanie „-50" w „Rabat wart." na pozycji procentowej commituje: `kosztorys-client-totals.ts:67` liczy `qty × cena × (1 − discount/100)` → **×1,5**, czyli pozycja idzie W GÓRĘ o 50%, i to wchodzi do sum sekcji i stopki oferty, którą dostaje klient. Dokładne lustro przypadku ujemnego netto, dla którego sufit powstał (EX-736), osiągalne zwykłym pisaniem — bez wklejania, bez obejścia. Spek rabatu nie ma przypadku ujemnego. — **fixed:** podłoga w `guard` + `__tests__/lib/kosztorys/kosztorys-discount-edit.test.ts`
      test: test-driven-debugging · unit — `cellKeystroke('-50', …, discountPolicy())` ma zwrócić `blocked`; dziś zwraca `commit`
- [x] 🟡 WARNING · fixed · `code-review` · `src/components/transfers/transfer-table-server.tsx:33` · **„Suma wybranych transakcji" pokazuje 0,00 zł w trybie anulowań**, gdy zakres niesie pole istniejące tylko na oryginale. Lista jest przecelowana przez `scopeAuditThroughOriginal` (:26), ale kafelek trzyma surowe `where`. Wiersz CANCELLATION nie ma żadnego z `investment`/`sourceRegister`/`targetRegister`/`worker`/`expenseCategory`/`otherCategory`. Scenariusz: `/inwestycje/5?cancelledTransactionAudit=1&from=2026-01-01` — `transferWhere` zawsze wstrzykuje `investment = 5`, data włącza kafelek, a zapytanie kafelka `type = CANCELLATION AND investment = 5` nie łapie nic → „0,00 zł" obok zapełnionej listy. Przesłanka docstringa („anulowanie kopiuje kwotę oryginału, więc kafelek sumuje te same pieniądze") trzyma tylko wtedy, gdy `where` nie ma pola oryginałowego — czyli poza przypadkiem, dla którego to napisano. — **fixed:** kafelek znika (a nie pokazuje 0,00 zł), gdy zakres zawęża po polu istniejącym tylko na oryginale — `scopeNarrowsByOriginalOnlyField`
      test: test-driven-debugging · integration — asercja na zsumowaną kwotę kafelka, nie na liczbę wierszy listy
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/actions/kosztorys.ts:59` · `discountValue: z.coerce.number()` bez granic — sufit 100% żyje wyłącznie w polityce komórki, więc serwer przyjmuje to, czego UI odmawia. Nie dziura uprawnieniowa (aktor to zalogowany właściciel), ale inwariant nie ma kotwicy po stronie serwera. Jedna granica w schemacie zamyka to razem z powyższym. — **fixed:** `z.coerce.number().min(0)` — sufit procentowy nie może tu żyć, bo ten sam slot niesie złotówki przy typie `amount`
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/kosztorys/discount-edit.ts:41` · przełączenie „Rabat" z „zł" na „%" po cichu przycina wspólne pole wartości: `Math.min(current.discountValue, 100)` zamienia rabat 150 zł w rabat 100% jednym kliknięciem w dropdown, bez toastu — na pozycji 1 000 zł to zamiana ustępstwa 150 zł w oddanie pozycji za darmo. Lepiej niż poprzednie 150%, ale to wciąż duża zmiana finansowa zrobiona bez słowa. — **fixed:** decyzja właściciela (2026-08-25): nic nie przycinamy, przełączenie jest ODRZUCANE. `discountFromType` zwraca `{kind:'blocked'}` + toast; paste odrzuca po cichu; speki przepisane na nowy kontrakt.
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/kosztorys/subcontractor-summary.ts:153` · „Razem" to teraz `roundToCents(Σdue − Σpaid)`, a nie suma kolumny „Pozostało", pod którą stoi (każdy `row.remaining` sam jest zaokrąglony, :113). Rozjazd o grosz nie zniknął — przeniósł się: dwa wiersze pokazujące po 0,01 mogą stać nad „Razem" 0,01. Docstring tuż wyżej wciąż twierdzi „Σ kolumn, nie drugi odczyt nagłówka". — **fixed:** docstring niesie już akapit o sumowaniu w pełnej precyzji i jednym zaokrągleniu, z liczbami z próby 2026-08-25
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/queries/transfer-filters.ts:210` · `scopeAuditThroughOriginal` schodzi rekurencyjnie w `or`, ale nie w `and`. Dziś uśpione (`buildTransferFilters` nie emituje `and`), ale funkcja jest eksportowana, a przeoczenie niewidoczne w miejscu wywołania. — **fixed:** `scopeAuditThroughOriginal` schodzi też w `and`; regresja w `__tests__/lib/queries/transfer-filters.test.ts`
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/migrations/20260825_0_fix_own_tools_coeff_rounding.ts:24` · `UPDATE … WHERE own_tools_coeff = 0.55` nie odróżnia domyślnej wartości od tej, którą właściciel wpisał świadomie. Przesłanka bezpieczeństwa (nie ma jeszcze wierszy kosztorysu) to komentarz, nie guard, a `down()` przywraca tylko default kolumny. — **dismissed:** kosztorysowe dane są jednorazowe do czasu wejścia dogfoodingu na `main` (AGENTS.md) — nie ma wiersza, który właściciel wpisałby świadomie
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:246` · bramka panelu sum wisi na `subtotals`, które lecą teraz z `documentRows` — już przefiltrowanych przez `hideEmptyRows` w podglądzie klienta. Przy wszystkich pozycjach pustych na obu osiach klient traci CAŁY panel sum (wpłaty, „Do zapłaty"), a przełącznik w nagłówku gaśnie. Intencja czyta się jako „pusta siatka", nie „brak podsumowania". — **skipped:** zmienia to, co klient widzi w podglądzie oferty — do decyzji właściciela, nie do cichej poprawki
- [x] dropped · `code-review` · `kosztorys-v2-columns.tsx:102` · komentarz sierota — ten sam, co u `comment-noise` (tam otwarty do przeniesienia); nie dubluję rozstrzygnięcia

**Trzy zamówione kontrole — wszystkie czyste:**

- **Migracja `20260825_0`** — `up`/`down` spójne, zarejestrowana w `index.ts`, 0,5525 zgadza się z
  `DEFAULT_COEFFS.ownTools`. Kolumna jest `numeric`, więc równość `= 0.55` jest dokładna — bez pułapki
  zmiennoprzecinkowej. Kierunek ani addytywny, ani destrukcyjny, więc bramka kolejności wdrożenia nie gryzie.
- **Trzeci zgubiony zapis przez `Promise.all`** — **w kodzie produkcyjnym nie ma.** Poza dwoma naprawionymi
  miejscami nie została ani jedna równoległa pętla po `payload.update/create/delete`. Jedyna pozostałość to
  `perf-seed-kosztorys.ts:70,103` — seed deweloperski przeciw lokalnemu Postgresowi w Dockerze.
- **Bramka managera (`66ec3869`)** — **nie jest tylko w UI.** `ownerOnlyAction` nietknięte w
  `kosztorys-share.ts` i `kosztorys-client-view.ts`; menu czyta ten sam predykat, który woła serwer.

Sprawdzone i czyste: granice undo/redo i sklejanie burstów — `coalesceBy` kopiuje przed scaleniem, wpisy
net-zero wypadają, `foldRetractions` filtruje symetrycznie, a każda droga z powrotem na stos idzie przez
`amendTop`, którego guard tożsamości robi z nieświeżego `lastGridCommand.current` no-op zamiast nadpisania.

### code-review B — typowanie formularzy / hooki / utils

`tsc --noEmit` czysty, eslint czysty w zakresie, 18 plików spek / 119 testów zielonych.

- [x] 🟡 WARNING · skipped · `code-review` · `src/components/forms/hooks/form-hooks.ts:35` · **`FormWithFieldT<TName>` dowodzi, że pole o tej NAZWIE istnieje — nigdy, że jego TYP pasuje do kontrolki, którą wrapper renderuje.** Połowa guardu przed rozjazdem ze schematem po prostu jej nie ma. Sprawdzone sondą: formularz z `defaultValues: { amount: 123 }` przechodzi `<AmountField form={…} />` z **zerem błędów**, podczas gdy sonda z genuinie brakującym polem wywala TS2322 — czyli instrument reaguje na brak nazwy i milczy na zły typ. Scenariusz: `DepositFormValuesT.amount` jest dziś `string`, bo cały `transferFormSchema` to `z.string()`. Gdy ktokolwiek zapisze kwotę jako `number` (oczywisty następny ruch, gdy `netFromGross` zacznie zwracać liczby), `AmountField` dalej się kompiluje, `FormInput` robi `useFieldContext<string>()` i `handleChange(e.target.value)` — pole zadeklarowane jako `number` trzyma string, `refineAmount` to czyta, Zod nie koercuje, wpłata zapisuje się w złym kształcie przy zielonym typechecku i zielonym buildzie. Docstring typu twierdzi, że powstał, „bo przemianowane pole schematu renderowałoby pusty input, który nic nie zapisuje" — przetypowane robi lustro tego i nie jest łapane. — **skipped:** realne, ale guard należy do fikstury `tsc-expect-error`, której repo nie ma — własna zmiana, nie poprawka w bramce
      test: no automated test · unit — to usterka na poziomie typów; guard należy do fikstury `tsc-expect-error`, nie do speka runtime'owego
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/components/forms/form-components/form-textarea.tsx:6,14` · **prop `rows` przeszedł z „cicho gubiony" na „faktycznie honorowany" — zmiana UI w locie przemycona w refaktorze typów, na trzech żywych wywołaniach.** Pięć miejsc podawało `rows` w próżnię; `ui/textarea.tsx:10` ma `field-sizing-content min-h-[68px]`, więc dwa `rows={2}` są no-opem (poniżej podłogi), ale trzy `rows={3}` już nie: puste „Notatki" / „Opinia" / „Notatka" w edycji przelewu otwierają się teraz na ~78px zamiast 68px i nie potrafią zejść poniżej trzech linii. Trzy dialogi urosły i nic w gałęzi tego nie mówi. Prawdopodobnie to zamierzona naprawa (propsy pisano w tej intencji), ale jedzie pod sztandarem „zdjęcie `form: any`". — **skipped:** trzy dialogi urosły o ~10 px, bo `rows` wreszcie działa; zmiana widoczna dla użytkownika — zgłaszam, nie cofam po cichu
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/components/forms/hooks/use-file-pick-ingest.ts:45` · **odmontowanie to jedyne przeplecenie, którego nowy „wygrywa ostatni" NIE pokrywa — i jedyne, które dociera do użytkownika.** Licznik jest poprawny (prześledzone: wyparty ingest nie zapisze `files`, nie wyczyści `isIngesting`, a `reset()` czyści go sam, bo `disown()` robi z `finally` no-op). Dziura: nikt nie woła `request.disown()` przy odmontowaniu, a oba formularze wiszą pod `FormDialog`, który Radix odmontowuje na zamknięcie. Scenariusz: „Nowy przegląd", trzy zdjęcia w tym 30 MB PDF, zamknięcie dialogu w trakcie konwersji HEIC → ingest rozwiązuje się na odmontowanym drzewie, `isCurrent()` zwraca `true`, i leci **8-sekundowy** czerwony toast o pliku z formularza, którego już nie ma, na wierzchu strony, na którą użytkownik przeszedł. Kształt sprzed gałęzi (stary `inspection-form.tsx` wołał `reportBlockedFiles` bez guardu), więc nie regresja — ale docstring hooka rości sobie teraz cały kontrakt „myślisz, że się wgrało, a się nie wgrało". Naprawa to jedna linijka: `useEffect(() => request.disown, [request])`. — **fixed:** `useEffect(() => request.disown, [request])`
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/__tests__/lib/utils/format-date.test.ts:6` · **`afterAll` przywraca literalny string `'undefined'`.** Instrument zweryfikowany na znanym pozytywie (przestawienie `process.env.TZ` DZIAŁA w locie na Node v24.15.0; zdjęcie przypięcia `timeZone` faktycznie wywala spek), więc sam guard jest realny. Wada jest w sprzątaniu: `TZ` nie jest w repo ustawiane, więc `ORIGINAL_TZ` to `undefined`, a `process.env.TZ = undefined` koercuje do czteroznakowego `"undefined"` i Node spada na UTC zamiast na Europe/Warsaw. Dziś zasięg zerowy, bo vitest 4 izoluje forki — staje się realne w dniu, w którym ktoś da `isolate: false`. Cała naprawa: `if (ORIGINAL_TZ === undefined) delete process.env.TZ`. — **fixed:** `delete process.env.TZ`, gdy `ORIGINAL_TZ` jest `undefined`
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/components/forms/hooks/form-hooks.ts:40` · `listeners?: any` to `any`, który przeżył refaktor pod nowym dachem. Wrappery deklarujące własny kształt listenera robią to _nad_ dziurą i nic z tego nie mają (`payment-method-field.tsx:11`, `cash-register-field.tsx:19` zawężają, po czym oddają do propa `any`). Sonda potwierdza: literówka w kluczu, listener z błędnie zaanotowanym `value`, `onBlur` tam gdzie TanStack oczekuje `onChange` — wszystko przechodzi `tsc`. `plane-amount-field.tsx:81` to żywy przypadek do pilnowania: adnotacja `{ value: string }` jest ASERCJĄ, nie wnioskiem. Udokumentowane w komentarzu, więc „wiedz, co kupiłeś", nie usterka. — **skipped:** `listeners?: any` udokumentowane w komentarzu jako świadomy kompromis; zawężenie to własna zmiana typów w trzech formularzach
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/components/forms/hooks/use-field-value.ts:10-14` · `any` zamieniło się w `unknown` plus dwie asercje — węższa sygnatura, tyle samo dowodu (zero). Efekt drugiego rzędu: `CashRegisterField<TName extends string>` dopuszcza teraz każdy string jako nazwę pola, w tym ścieżkę zagnieżdżoną. Sonda: `name="nested.register"` przechodzi typecheck z zerem błędów, `useFieldValue` indeksuje `values['nested.register']` dosłownie i zwraca `undefined` — combobox renderuje się pusty, choć formularz trzyma wartość. Pułapka jest opisana w komentarzu i żadne wywołanie tak nie robi, więc mina z tabliczką; warta odnotowania tylko dlatego, że generyk jest NOWY. — **dismissed:** pułapka opisana w komentarzu, żadne wywołanie tak nie robi
- [x] dropped · `code-review` · `src/components/forms/deposit-form/deposit-form-api.ts:4,19` · dwie pisownie „konkretnego API formularza" w jednym diffie — to samo, co zgłosił audyt rozsypania (tam otwarte do ujednolicenia). Sprawdzony rozjazd nie gryzie: `DepositFormValuesT` to świadomy podzbiór `transferFormSchema`, a `amountGross` ma `.catch('')` właśnie po to, żeby ten formularz mógł je zadeklarować jako wymagane.
- [x] dismissed · `code-review` · `src/hooks/use-latest-request.ts:7-9` · uzasadnienie w docstringu nie opisuje faktycznego problemu starego kodu („odczyt refa w renderze jest nieczysty" — stary kod nigdy nie MUTOWAŁ w renderze; robił idiom leniwej inicjalizacji). Sama zmiana jest realną poprawą, a wyniesienie do `lib/utils/` jest tym, co umożliwia `latest-request.test.ts` bez renderera hooków. Błędny jest tylko podany POWÓD, i to w komentarzu.

### safety & pattern compliance — 4 WARNING, 8 OBSERVATION

Trzy WARNINGI to duplikaty (nieznane flagi, parowanie środowisk, cichy rzut przy usuwaniu). Unikalne:

- [x] 🔵 OBSERVATION · dismissed · `safety` · `src/lib/actions/delete-orphaned-media.ts:15-22` · `protectedAction()` jest, ale **bez bramki roli**, nad ciągiem id podanym przez klienta. `deleteUnreferencedMedia` przelicza referencje i to jest nośna obrona — działa. Reszta: każdy zalogowany użytkownik dowolnej roli może posłać dowolne liczby, a id mediów są sekwencyjne, więc w oknie między „strona wgrana" a „wiersz utworzony" cudza strona w locie jest faktycznie bez referencji i zostanie skasowana. Wąskie, i to plik po zmianie nazwy (zachowanie sprzed gałęzi). **Do zgłoszenia, nie do cichej naprawy** — zmienia to, co użytkownik MOŻE zrobić. — **dismissed:** bramka roli JEST — `protectedAction` robi `requireAuth(MANAGEMENT_ROLES)` (`run-action.ts:43`), czyli ADMIN/OWNER/MANAGER, dokładnie ten sam zbiór co trasa wgrywania (`api/upload-file/route.ts`). „Każdy zalogowany użytkownik dowolnej roli” to błąd audytu: EMPLOYEE nie przechodzi, a kto może wgrać fakturę, ten i tak może ją skasować — zero eskalacji. Zostaje wyłącznie ryzyko cudzego id w oknie wyścigu, które przechwytuje drugi guard.
- [x] 🔵 OBSERVATION · skipped · `safety` · `src/app/(frontend)/api/upload-file/route.ts:9-31` · trasa sama pisze, że „nie ma sztucznego limitu"; HEIC→JPEG i `MAX_UPLOAD_BYTES` są wyłącznie po stronie klienta. Autoryzacja poprawna (`requireAuth(MANAGEMENT_ROLES)`), a cap ciała Vercela ogranicza rozmiar w praktyce — ale surowy HEIC dalej dojdzie do `media` bezpośrednim POST-em albo panelem admina. Świadome i sprzed gałęzi, warte powiedzenia wprost, skoro slice nazywa się „zamknięcie obejścia HEIC": strumień trzeci to jednorazowe sprzątanie, nie gwarancja, że nowy HEIC się nie pojawi. — **skipped:** serwerowy guard na surowy HEIC to własna zmiana (konwersja po stronie serwera albo walidacja w kolekcji `media`), nie poprawka w bramce; slice świadomie sprząta zastane pliki, a nie uszczelnia wejście
- [x] 🔵 OBSERVATION · fixed · `safety` · `backfill-heic-media.ts:306-324` · `catch` woła `fail()` → `process.exit(1)`, a `finally` nie biegnie po `process.exit` — przerobiony JPEG zostaje w `tmpdir()`. Trywialne, ale rozumowanie „finally jest nośne" trzyma tylko na ścieżce sukcesu. — **fixed:** `await rm(target, { force: true })` przed `fail()` w gałęzi `catch`, bo `finally` nie biegnie po `process.exit`
- [x] dismissed · `safety` · `delete-unreferenced-media.ts` @ `79a71d31` · równoległe `payload.delete` — realne w audytowanym zakresie, **naprawione na HEAD** (`50c38119`, szeregowa pętla, spek asertuje `maxInFlight === 1`). Zgłoszone tylko po to, żeby zakres nie zapisał się jako czysty.

Zweryfikowane bezpieczne (sprawdzone, nie założone): brak wstrzyknięcia poleceń (`execFile` z tablicą argv,
oba operandy absolutne, `encodeURIComponent` na URL blobu); faza A naprawdę kończy się przed pierwszym
zapisem; brak SQL injection i zaszytych sekretów; **polecenia z runbooka faktycznie działają** — sprawdzone
empirycznie, `--env-file` NIE nadpisuje zmiennej już ustawionej w powłoce, więc `§5` celuje tam, gdzie
twierdzi, a bieg z gołego `.env` naprawdę ląduje na preview; `skipRevalidation` jest honorowane przez hook;
`deleteUnreferencedMedia` pokrywa obie relacje do `media`; logika „wygrywa ostatni" poprawna wraz ze ścieżką
resetu; brak rozjazdu podglądu i stanu w pickerze; zgodność z wzorcami repo pełna.

## Simplify pass

**Domknięcie 2026-08-25 (po ruling'u o rabacie):** przycięcie komentarzy dodanych w tym przeglądzie
(~30 bloków w 18 plikach, każdy do 1–2 linijek) + trzy dedupy: `switchedRow()` w
`discount-columns.tsx` (jedna tranzycja dla `deleteValue`/`pasteValue`), `passedArgs` zamiast
dwóch `process.argv.slice(2)` w skrypcie backfillu, `isBranch()` w `transfer-filters.ts` (ten sam
warunek `or|and` stał w dwóch funkcjach).

Nie odpalałem `/simplify` osobno — krok 2 tej bramki BYŁ przebiegiem mutującym: 26 poprawek
zaaplikowanych bezpośrednio z triage'u, w tym wszystkie znaleziska `reuse`/`cohesion`/`comment-noise`,
które `/simplify` i tak by zebrał. Każde z nich siedzi w `## Findings` z dyspozycją, więc nie ma
drugiej listy do synchronizowania.

Przeprowadzki i wydzielenia, które wyszły z tego kroku (wszystkie `git mv`, importy przepisane):

- `lib/utils/net-suggestion.ts` (nowy, wyjęty z `.tsx`)
- `lib/invoices/row-file-positions.ts` (nowy, wyjęty z `invoice-page-uploads.ts`)
- `forms/form-fields/plane-amount-field.tsx` → `forms/deposit-form/`
- `forms/form-fields/expense-category-field.tsx` → `forms/edit-transfer-form/`
- `lib/invoices/upload-file-client.ts` → `lib/invoices/invoice-page-uploads.ts`
- speki przeniesione na lustro ścieżki źródła: `__tests__/lib/utils/net-suggestion.test.ts`,
  `__tests__/lib/invoices/row-file-positions.test.ts`

Speki dopisane w kroku 3 (po mutacjach, zgodnie z kolejnością bramki): `kosztorys-discount-edit`
(podłoga rabatu), `map-line-item` (`category` na typach bez pola), `transfer-filters`
(rekurencja w `and` + `scopeNarrowsByOriginalOnlyField`), `parse-decimal-input` (round trip
`decimalText` ↔ `parseCellDecimal`).

## Tests & suite

- `pnpm typecheck` — **zielony** (exit 0)
- `pnpm test` — **zielony**: 201 plików / 2838 testów zdanych, 49 plików / 161 testów pominiętych
- `pnpm lint` — **1 error, 85 warnings**, i ten jeden błąd (`no-undef` na `console`) leci z
  `test.js` w korzeniu repo, który jest **nieśledzony przez gita i spoza tej gałęzi** (`git diff
staging...HEAD` go nie zna). Zero zgłoszeń lintera w plikach gałęzi. Nie ruszam cudzego pliku
  roboczego — do usunięcia albo do `.eslintignore` przez właściciela drzewa.
- `pnpm test:e2e` — **nie odpalany** (~1h, tylko na wyraźną prośbę); checki E2E są NIE-blokujące
  dla Done od 2026-07-28
- `pnpm build` — nie powtarzany; `/10x-impl-review` zweryfikował go zielono na tym zakresie
