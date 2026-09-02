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

**Przycięte przy archiwizacji (2026-08-31).** Przed przycięciem: 32 fixed, 9 skipped, 6 dismissed,
11 dropped · 0 open. Findingi „fixed" wycięte — trwałym zapisem naprawy jest commit, który ją wniósł,
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

- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/hooks/use-invoice-removal.ts:82` · kontrakt `pending`/`pendingLabel` jest martwy: `AlertDialogAction` zamyka dialog na klik → `onOpenChange(false)` → `setStaged(null)`, więc „Usuwanie…" nigdy się nie pokaże. Gorsze niż kosmetyka: `pending` zostaje `true` do rozstrzygnięcia akcji, więc drugie usunięcie otwarte w tym oknie ma wyłączone OBA przyciski — wyjście tylko Escape. — **dismissed:** kontrakt NIE jest martwy — `pending`/`pendingLabel` czyta pięć innych wywołań `ConfirmDialog`; podwójna blokada przycisków nie odtwarza się, bo dialog trzyma jedną scenę na raz
      test: no automated test · — · stan UI dialogu; guard = usunięcie martwego kontraktu, nie asercja
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/lib/invoices/submit-with-invoice-pages.ts:42` · `withOrphanCleanup` sprząta po KAŻDYM rzucie po stronie klienta. Bezpieczne po commicie, ale nie w trakcie: `createBulkTransferAction` siedzi w `withPayloadTransaction`, więc timeout klienta w trakcie akcji daje `payload.count` zero referencji → kasujemy media → transakcja commituje `transactions_rels` na martwe id i wywala FK. Mała szansa, ale komentarz w `delete-unreferenced-media.ts` broni tylko przypadku po commicie. — **skipped:** zawężenie sprzątania wymaga wiedzy, po której stronie commitu padł rzut — klient tego nie wie; zmiana zachowania na ścieżce kasującej bajty, warta własnego przeglądu
      test: no automated test · — · wyścig wymagałby sterowania commitem; guard = zawężenie warunku sprzątania

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
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/components/forms/hooks/form-hooks.ts:40` · `listeners?: any` to `any`, który przeżył refaktor pod nowym dachem. Wrappery deklarujące własny kształt listenera robią to _nad_ dziurą i nic z tego nie mają (`payment-method-field.tsx:11`, `cash-register-field.tsx:19` zawężają, po czym oddają do propa `any`). Sonda potwierdza: literówka w kluczu, listener z błędnie zaanotowanym `value`, `onBlur` tam gdzie TanStack oczekuje `onChange` — wszystko przechodzi `tsc`. `plane-amount-field.tsx:81` to żywy przypadek do pilnowania: adnotacja `{ value: string }` jest ASERCJĄ, nie wnioskiem. Udokumentowane w komentarzu, więc „wiedz, co kupiłeś", nie usterka. — **skipped:** `listeners?: any` udokumentowane w komentarzu jako świadomy kompromis; zawężenie to własna zmiana typów w trzech formularzach
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/components/forms/hooks/use-field-value.ts:10-14` · `any` zamieniło się w `unknown` plus dwie asercje — węższa sygnatura, tyle samo dowodu (zero). Efekt drugiego rzędu: `CashRegisterField<TName extends string>` dopuszcza teraz każdy string jako nazwę pola, w tym ścieżkę zagnieżdżoną. Sonda: `name="nested.register"` przechodzi typecheck z zerem błędów, `useFieldValue` indeksuje `values['nested.register']` dosłownie i zwraca `undefined` — combobox renderuje się pusty, choć formularz trzyma wartość. Pułapka jest opisana w komentarzu i żadne wywołanie tak nie robi, więc mina z tabliczką; warta odnotowania tylko dlatego, że generyk jest NOWY. — **dismissed:** pułapka opisana w komentarzu, żadne wywołanie tak nie robi
- [x] dropped · `code-review` · `src/components/forms/deposit-form/deposit-form-api.ts:4,19` · dwie pisownie „konkretnego API formularza" w jednym diffie — to samo, co zgłosił audyt rozsypania (tam otwarte do ujednolicenia). Sprawdzony rozjazd nie gryzie: `DepositFormValuesT` to świadomy podzbiór `transferFormSchema`, a `amountGross` ma `.catch('')` właśnie po to, żeby ten formularz mógł je zadeklarować jako wymagane.
- [x] dismissed · `code-review` · `src/hooks/use-latest-request.ts:7-9` · uzasadnienie w docstringu nie opisuje faktycznego problemu starego kodu („odczyt refa w renderze jest nieczysty" — stary kod nigdy nie MUTOWAŁ w renderze; robił idiom leniwej inicjalizacji). Sama zmiana jest realną poprawą, a wyniesienie do `lib/utils/` jest tym, co umożliwia `latest-request.test.ts` bez renderera hooków. Błędny jest tylko podany POWÓD, i to w komentarzu.

### safety & pattern compliance — 4 WARNING, 8 OBSERVATION

Trzy WARNINGI to duplikaty (nieznane flagi, parowanie środowisk, cichy rzut przy usuwaniu). Unikalne:

- [x] 🔵 OBSERVATION · dismissed · `safety` · `src/lib/actions/delete-orphaned-media.ts:15-22` · `protectedAction()` jest, ale **bez bramki roli**, nad ciągiem id podanym przez klienta. `deleteUnreferencedMedia` przelicza referencje i to jest nośna obrona — działa. Reszta: każdy zalogowany użytkownik dowolnej roli może posłać dowolne liczby, a id mediów są sekwencyjne, więc w oknie między „strona wgrana" a „wiersz utworzony" cudza strona w locie jest faktycznie bez referencji i zostanie skasowana. Wąskie, i to plik po zmianie nazwy (zachowanie sprzed gałęzi). **Do zgłoszenia, nie do cichej naprawy** — zmienia to, co użytkownik MOŻE zrobić. — **dismissed:** bramka roli JEST — `protectedAction` robi `requireAuth(MANAGEMENT_ROLES)` (`run-action.ts:43`), czyli ADMIN/OWNER/MANAGER, dokładnie ten sam zbiór co trasa wgrywania (`api/upload-file/route.ts`). „Każdy zalogowany użytkownik dowolnej roli” to błąd audytu: EMPLOYEE nie przechodzi, a kto może wgrać fakturę, ten i tak może ją skasować — zero eskalacji. Zostaje wyłącznie ryzyko cudzego id w oknie wyścigu, które przechwytuje drugi guard.
- [x] 🔵 OBSERVATION · skipped · `safety` · `src/app/(frontend)/api/upload-file/route.ts:9-31` · trasa sama pisze, że „nie ma sztucznego limitu"; HEIC→JPEG i `MAX_UPLOAD_BYTES` są wyłącznie po stronie klienta. Autoryzacja poprawna (`requireAuth(MANAGEMENT_ROLES)`), a cap ciała Vercela ogranicza rozmiar w praktyce — ale surowy HEIC dalej dojdzie do `media` bezpośrednim POST-em albo panelem admina. Świadome i sprzed gałęzi, warte powiedzenia wprost, skoro slice nazywa się „zamknięcie obejścia HEIC": strumień trzeci to jednorazowe sprzątanie, nie gwarancja, że nowy HEIC się nie pojawi. — **skipped:** serwerowy guard na surowy HEIC to własna zmiana (konwersja po stronie serwera albo walidacja w kolekcji `media`), nie poprawka w bramce; slice świadomie sprząta zastane pliki, a nie uszczelnia wejście
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
