---
date: 2026-09-01T15:03:42Z
researcher: Claude (Opus 5)
git_commit: 70c93626ea45e64bd14d8c4d386ee0f38aa49f94
branch: main
repository: wykonczymy
topic: 'Kolumny ceny wykonawcy (oba plany) w widoku Inwestora edytora kosztorysu'
tags: [research, kosztorys, editor, columns, disclosure, datasheet-grid]
status: complete
last_updated: 2026-09-01
last_updated_by: Claude (Opus 5)
---

# Research: kolumny ceny wykonawcy w widoku Inwestora

## Research Question

Jak podłączyć „Źródło ceny wykonawcy" / „Mnożnik" / „Cena j.m. netto" dla obu planów
(z narzędziami, bez narzędzi) w widoku Inwestora edytora kosztorysu — edytowalne, domyślnie ukryte,
dostępne z pickera kolumn, nigdy widoczne w podglądzie inwestora — tak, żeby te kolumny pokazywały
**dokładnie te same dane** co w widokach wykonawcy, bez możliwości rozjazdu?

## Summary

1. **Rozjazdu danych nie ma czego pilnować u źródła — kolumny są już sparametryzowane planem.**
   Trzy fabryki (`subcontractorModeColumn` / `CoeffColumn` / `PriceColumn`) biorą `view: ToolPlaneT`
   argumentem i przekazują go przez `columnData`; żadna z komórek nie czyta `opts.view`. Wywołane
   z gałęzi klienta policzą i **zapiszą** to samo, co dziś. Jedyne, czego nie parametryzuje plan, to
   **id kolumny** — i to jest cała powierzchnia ryzyka.
2. **Największe ryzyko tej zmiany nie leży w danych, tylko w disclosure.** Gwarancja „klient nie widzi
   stawek wykonawcy" nie jest już projekcją payloadu (`toClientView` wycofane — całe drzewo,
   z `wToolsOverrideValue` i `globalCoeffs`, jedzie na stronę klienta). Stoi na **dwóch** połowach:
   przypięciu planu do `'client'` pod `preview` i na allowliście kolumn. Ta zmiana sprawia, że stawki
   wykonawcy renderują się **na planie `'client'`**, czyli pierwsza połowa przestaje cokolwiek
   chronić dla tych sześciu id. Zostaje allowlista — i bramka w assembly musi być na `previewVisible`
   (fladze audytorium), nigdy na `view`.
3. **Klientowskiej kolumny `price` nie wolno przemianować.** `sanitizeClientViewVariant` odrzuca
   z zapisanego ustawienia każdy klucz spoza `PREVIEW_VISIBLE_COLUMNS`, a zapisany zbiór to zbiór
   **ukrytych** kolumn — więc zgubiony klucz nie ukrywa kolumny, tylko ją **odsłania klientowi**.
   Rename `price` = ciche odsłonięcie „Cena j.m. netto" u każdego klienta, który ją miał schowaną.
4. **Rola nie wymaga niczego.** Owner rozstrzygnął (2026-08-18, P10): MANAGER widzi wszystko, ukrywanie
   kolumn dotyczy klienta, nie roli; slice `kosztorys-column-rbac` został wycięty w całości.
5. **Mapy konfiguracji trzymamy na kluczu bazowym.** Trzy testy-inwarianty wymagają, żeby każdy klucz
   `COLUMN_MONEY_AXIS` / `AXIS_EXEMPT_COLUMNS` / `COLUMN_LAYER` / `LAYER_NEUTRAL_COLUMNS` miał wpis
   w `COLUMN_LABELS`. Rozwiązywanie po kluczu bazowym (`price__own_tools` → `price`) utrzymuje te
   inwarianty bez dopisywania sześciu wpisów do każdej mapy — i to jest mechanizm „jedno pojęcie,
   jeden wpis", o który chodzi w wymaganiu „zawsze te same dane".
6. **Nikt tego wcześniej nie zablokował.** Nie ma decyzji przeciw. Precedens idzie w drugą stronę:
   `subcontractor-view-settlement-only` odchudził widoki wykonawcy, zapisując przy tym, że widok
   Inwestora jest tą płaszczyzną, na której wpisuje się wszystko.

## Detailed Findings

### 1. Dlaczego dane nie mogą się rozjechać (i gdzie jednak mogą)

Cały łańcuch komórki wykonawcy bierze plan argumentem:
`cellData(plane)` → `OVERRIDE_FIELDS[plane]` → `viewPrice(row, plane)` / `effectiveCoeff(row, plane)` /
`subcontractorPolicy(plane, …)` / `checkSubcontractorPrice(row, plane)`. Wszystkie cztery pola
override (`wToolsOverrideType|Value`, `ownToolsOverrideType|Value`) siedzą na **każdym** wierszu,
niezależnie od widoku (`src/lib/kosztorys/types.ts:49-53`), a domyślne mnożniki inwestycji są
zdenormalizowane per wiersz (`globalWToolsCoeff` / `globalOwnToolsCoeff`,
`src/lib/kosztorys/v2-rows.ts:42`). Czyli w widoku Inwestora jest komplet danych do policzenia obu
planów — nic nie trzeba dowozić.

Miejsca, w których **id** kolumny bywa proxy dla planu i mogłoby zacząć żyć własnym życiem:

| Konsument                               | Plik                                | Dziś                                                 |
| --------------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| etykieta nagłówka + etykieta w pickerze | `column-config.ts:11-40`, `:52-61`  | exact-match `COLUMN_LABELS[id]`                      |
| tooltip nagłówka                        | `header-tips.ts:19-20`              | exact-match                                          |
| oś netto/brutto                         | `column-config.ts:88-101`, `:143`   | `price: 'net'` + `AXIS_EXEMPT = {'price'}`           |
| warstwa Praca/Postęp                    | `column-config.ts:108-132`          | brak wpisu (nietagowane = `work`)                    |
| allowlista podglądu                     | `column-config.ts:163-198`          | `CLIENT_VIEW_GROUPS` → `PREVIEW_VISIBLE_COLUMNS`     |
| reveal „Problemów"                      | `row-conditions.ts:73`              | `PRICE_COLUMNS = ['price','priceMode','priceCoeff']` |
| sortowanie                              | `sort-value.ts:86,118-121`          | `case` po nazwie, plan brany z `view`                |
| kolejność kolumn                        | `column-order.ts` przez `toggleKey` | raw id                                               |
| szerokości                              | `kosztorys-v2-columns.tsx:186`      | `widths[col.id]`                                     |
| ukrycie                                 | `use-hidden-columns.ts:28-30`       | `hidden[id] ?? DEFAULT_HIDDEN_COLUMNS.has(id)`       |

`column-totals.ts:57-76` nie ma klucza `price` — kolumny cenowe nie mają wiersza „Razem" i nowe też
nie będą miały, tak samo jak dziś w widokach wykonawcy. Nie ma tu nic do zrobienia.

### 2. Zamek disclosure — co ta zmiana zabiera

- `lessons.md:497-513` („Moving a disclosure guarantee from the DATA side to the RENDER side…"):
  payload nie jest okrojony; gwarancja to `use-kosztorys-view-state.ts:54` (`view = preview ? 'client' : persistedView`)
  **plus** allowlista, „two halves of one lock; neither is sufficient alone".
- Po tej zmianie stawki wykonawcy renderują się także na planie `'client'` → przypięcie planu
  przestaje być barierą dla tych id. **Sama allowlista musi je unieść.**
- `lessons.md:468-481` („A price-view flag is not an audience flag") to dokładnie ten sam błąd
  popełniony raz: `priceView === 'client'` wzięte za sprawdzenie audytorium zostawiło ostrzeżenie
  wewnętrzne włączone dla klienta. Żywy wzorzec to `!preview && priceView === 'client'` — dwie flagi.
  Wniosek dla nas: bramka w assembly na `opts.previewVisible`, nie na `view`.
- `lessons.md:1240-1250`: allowlista **fail-closed**, filtr to `allowed.has(key) && !hidden.has(key)`,
  a po pasie reuse allowlista jest **wyprowadzona z grup dialogu** (`column-config.ts:196-198`) — więc
  dopisanie nowych id do `CLIENT_VIEW_GROUPS` automatycznie dałoby im widoczność u klienta. Nie
  dopisywać.
- Baseline regresji do zachowania — `manual-checks.md:2376-2387`: ręcznie odznaczone
  `priceCoeff`/`priceMode` w localStorage pokazują się na widoku ownera, a w podglądzie inwestora
  nadal nie; „blokada jest po stronie `PREVIEW_VISIBLE_COLUMNS`, nie localStorage".
- Istniejące strażniki, które po zmianie stają się **bardziej** nośne, nie mniej:
  `assertDisclosurePair` (`kosztorys-v2-columns.tsx:602-608`),
  `preview-columns.test.ts:150-162`, `stage-column-filter.test.ts:117-120` (reveal problemu nie
  poszerza podglądu).

### 3. Namespace id — co wolno, a czego nie

**Nie wolno ruszyć `price` klienta.** `client-view-settings.ts:78-81` filtruje zapisane
`hiddenColumns` przez `PREVIEW_VISIBLE_COLUMNS`; zapisany zbiór to zbiór **ukrytych**, więc klucz,
który wypadnie z allowlisty, zostaje po cichu skasowany i kolumna **pokazuje się** klientowi.
`price` siedzi w `OFFER_VISIBLE_COLUMNS` (`:31`), w zapisanych wariantach per inwestycja
(`collections/kosztorys-client-view.ts:50-54`) i w globalu domyślnym — rename byłby cichym
odsłonięciem cen u klientów, którzy je schowali.

**Wolno przemianować trzy id widoków wykonawcy** (`price`/`priceCoeff`/`priceMode` w gałęzi
subcontractor) — nie ma ich w allowliście ani w bazie. Koszt jest wyłącznie lokalny i cichy,
nie destrukcyjny:

- `localStorage['table-columns:kosztorys']` — zapisany tick przepada, kolumna wraca do defaultu.
- `localStorage['kosztorys-v2-col-widths']` — przypięta szerokość przepada, sierocy klucz zostaje.
- `localStorage['kosztorys-v2-col-order']` — stary rank zostaje i nic nie porządkuje, nowe id lądują
  na pozycji z assemble.
- `preview-columns.test.ts:159` asercja „`buildV2Columns({view:'w_tools'})` zawiera `priceMode`" do
  aktualizacji.

Precedens namespace'u jest w repo i należy go skopiować, nie wymyślać: `stage-keys.ts` (builder +
odwrotność + `stageGroupOfKey`, z jawnym zakazem `Number('')===0` przy parsowaniu, `:38-45`).

Uwaga do `toggleKey` (`kosztorys-v2-columns.tsx:592-594`): etapy **kolapsują** do grupy, te kolumny
**nie mogą** — sens tej zmiany to porównanie obu planów obok siebie, więc każda z sześciu tyka się
osobno. To odróżnia je od wzorca etapów mimo identycznego kształtu klucza.

### 4. Testy-inwarianty, które wymuszają rozwiązywanie po kluczu bazowym

- `kosztorys-money-axis.test.ts:96-104` — każdy klucz `COLUMN_MONEY_AXIS` musi mieć wpis
  w `COLUMN_LABELS`, a każdy element `AXIS_EXEMPT_COLUMNS` musi być otagowany w `COLUMN_MONEY_AXIS`.
- `kosztorys-layer.test.ts:92-99` — to samo dla `COLUMN_LAYER` i `LAYER_NEUTRAL_COLUMNS`.
- `client-view-groups.test.ts:14-20` — suma kluczy w grupach == `PREVIEW_VISIBLE_COLUMNS.size`
  (brak duplikatów) i każdy klucz ma etykietę.

Wniosek: jeżeli `COLUMN_LABELS` / `HEADER_TIPS` / `COLUMN_MONEY_AXIS` / `AXIS_EXEMPT_COLUMNS` będą
czytane przez `basePriceKey(id)`, wszystkie trzy inwarianty przechodzą **bez** dopisywania sześciu
wpisów, a etykieta z sufiksem planu powstaje z `PLANE_LABELS`. Odwrotnie: sześć wpisów w każdej mapie
to sześć okazji, żeby jedna została nietknięta — dokładnie ten rozjazd, którego zmiana ma nie mieć.

**Wyjątek, który trzeba wykrzyczeć w kodzie:** allowlista (`PREVIEW_VISIBLE_COLUMNS`,
`CLIENT_VIEW_GROUPS`, `sanitizeClientViewVariant`) sprawdza się na **pełnym id**, nigdy po bazie —
rozwiązanie `price__own_tools` → `price` przepuściłoby stawkę wykonawcy do klienta.

Nowa oś: dziś `AXIS_EXEMPT_COLUMNS = {'price'}` ma znaczenie tylko w widoku Inwestora, bo
w widokach wykonawcy `effectiveMoneyAxis` i tak przypina `'net'` (`money-axis.ts:26-29`). Po zmianie
kolumny wykonawcy trafiają na płaszczyznę, gdzie oś **żyje** — czyli tryb „Brutto" zabrałby
edytowalną cenę wykonawcy, gdyby nie objąć jej tym samym zwolnieniem.

### 5. Sortowanie

- `sort-value.ts:118-121` — `case 'priceCoeff' / 'priceMode'` zwracają `null` gdy `view === 'client'`;
  ta gałąź przestaje być prawdziwa i musi czytać plan z id.
- Klasa błędu jest **cicha**: `2026-08-17-sortowanie-kolumn-spojne/change.md:26-30` — id tych kolumn
  nie są polami wiersza (pola są per-plan w `OVERRIDE_FIELDS`), więc gałąź `default` czytałaby
  `undefined` i sortowanie po prostu nic by nie robiło (klasa EX-487). Nie ma wyjątku, który by to
  zgłosił.
- Kształt testu do powtórzenia jest już w repo: `plan-brief.md:77-78` — „czytanie złego planu przeszłoby
  każdy test, który ćwiczy jeden plan", stąd asercja **oba plany sortują odwrotnie**
  (`kosztorys-sort-value.test.ts:227-247`). Asercja `:244-247` („w widoku klienta `null`") jest tą,
  którą ta zmiana wprost unieważnia — do zastąpienia, nie do usunięcia.
- `reconcileSort` (`sort-value.ts:141-146`, użycie `use-kosztorys-editor.ts:488-491`) czyści sort,
  którego kolumna zniknęła — czyli sortowanie po „Mnożnik (bez narzędzi)" samo się skasuje przy
  przełączeniu planu albo przy schowaniu kolumny w pickerze. Nie trzeba nic dopisywać; trzeba
  wiedzieć, że tak będzie (kolumny domyślnie ukryte → to zdarzenie jest częste).

### 6. „Problemy" (reveal) i plan

`PRICE_COLUMNS` (`row-conditions.ts:73`) jest podpięte do 7 warunków (`:266,277,324,335,354,365,383,395`),
a każdy z warunków „stawkowych" **już niesie swój `plane`** (`:323,334,352,363,382,392`). Czyli reveal
per plan jest wyprowadzalny bez nowej konfiguracji. Dziś reveal `priceMode`/`priceCoeff` w widoku
Inwestora był świadomym no-opem (komentarz `row-conditions.ts:60-67`: „the latter two only assemble
in a subcontractor view, so naming them from the client view is a harmless no-op") — ten komentarz
po zmianie staje się nieprawdziwy i jest częścią zmiany, nie sprzątaniem po niej.

`use-kosztorys-editor.ts:428-429` zeruje reveal pod `preview` (`columnsRevealedBy(preview ? [] : …)`),
a `stage-column-filter.test.ts:117-120` to przypina. Zostaje jak jest.

### 7. Payload podglądu inwestora (stan faktyczny)

`buildPreviewKosztorysEditorData` (`src/lib/queries/preview-kosztorys.ts:48-88`) nie projektuje ani
nie usuwa niczego (`:25-30`): wiersze niosą wszystkie cztery pola override
(`src/lib/db/kosztorys-tree.ts:147-151`, typ `src/lib/kosztorys/types.ts:49-53`) oraz `globalCoeffs`
(`src/lib/queries/kosztorys.ts:49-52`). Pomijane są `workers`, `payoutTransactions`, `hasSheet`.
To stan sprzed tej zmiany i decyzja właściciela — notowane jako fakt, bo to on czyni allowlistę
jedyną barierą (p. 2), a nie jako finding do naprawy.

### 8. Rola, kolejność, totals

- Rola: `requireManagementPage()` na stronie edytora + ruling P10
  (`kosztorys-editor-domain-notes.md:1104-1112`): „żadnych — MANAGER widzi wszystko… Ukrywanie kolumn
  dotyczy klienta, nie roli". Nic do zrobienia.
- Picker to płaska lista (`components/ui/column-toggle-menu.tsx`), bez grup — etykieta musi się sama
  tłumaczyć, stąd sufiks planu w nazwie („Mnożnik — bez narzędzi").
- `DEFAULT_HIDDEN_COLUMNS` (`column-config.ts:205-208`) nie ma wpisu cenowego, więc bez dopisania
  nowych id kolumny wystartują **widoczne** u wszystkich.
- Komentarz `src/lib/table/column-order.ts:41-47` opisuje skos indeksów assemble między widokami
  („Inwestor składa jedną kolumnę ceny, widoki wykonawcy trzy") — po zmianie nieaktualny.

### 9. Dwa pickery — w żadnym te kolumny się nie pojawiają

Wymaganie „nie mogą się pojawiać w pikerze kolumn do widoku klienta" dotyczy **dwóch** różnych list
i obie są dziś zamknięte z definicji, o ile nie dopiszemy id do allowlisty:

1. **Picker ownera wewnątrz podglądu** — nie istnieje. `selectV2ToggleItems`
   (`kosztorys-v2-columns.tsx:675-679`) zwraca pustą listę gdy `previewVisible`, bo podgląd montuje
   slim header zamiast toolbara; komentarz w kodzie mówi wprost, że allowlist-owe filtrowanie byłoby
   gorsze, bo opisywałoby siatkę, która i tak przestała słuchać preferencji. Nowe kolumny nie mają
   jak tam trafić.
2. **Dialog „co widzi klient"** (`dialogs/client-view-settings-form.tsx`) — renderuje wyłącznie
   `CLIENT_VIEW_GROUPS` (`column-config.ts:163-193`). To jest ta lista, do której **nie dopisujemy**
   nowych id — a że `PREVIEW_VISIBLE_COLUMNS` jest z niej wyprowadzona (`:196-198`), jeden brak wpisu
   załatwia jednocześnie: brak pozycji w dialogu, brak widoczności w podglądzie i odrzucenie klucza
   przez `sanitizeClientViewVariant`. Jedna decyzja, trzy skutki — i test `client-view-groups.test.ts`
   pilnuje, że te dwie rzeczy się nie rozjadą.

Odwrotność też warto zapisać: gdyby ktoś kiedyś chciał pokazać stawkę wykonawcy klientowi, musiałby
świadomie dopisać ją do `CLIENT_VIEW_GROUPS` — nie da się tego zrobić przez przypadek z poziomu
pickera ownera ani z localStorage.

## Code References

- `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx:237,256,273` — trzy fabryki; id jedyną rzeczą niesparametryzowaną planem
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:277-292` — ternary `view === 'client'`, punkt wejścia zmiany
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:592-594` — `toggleKey`
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:602-608` — `assertDisclosurePair`
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:616-645` — `selectV2Columns`, filtr `keep`
- `src/lib/kosztorys/column-config.ts:11-40,52-61,88-101,143,163-198,205-208`
- `src/lib/kosztorys/client-view-settings.ts:27-43,78-81` — warianty i sanitizacja (fail-open na widoczność)
- `src/lib/kosztorys/sort-value.ts:48-57,86,118-121,141-146`
- `src/lib/kosztorys/row-conditions.ts:60-73,494-500`
- `src/lib/kosztorys/stage-keys.ts:20-66` — wzorzec namespace'u do skopiowania
- `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:54` — przypięcie planu pod preview
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:428-429,440,474-479,488-491`
- `src/lib/queries/preview-kosztorys.ts:23-30,48-88`

## Architecture Insights

- **Jedna oś parametryzacji, jedno źródło.** Plan jest już argumentem wszędzie poza id. Właściwa
  implementacja nie dokłada drugiej osi (np. „czy jesteśmy w widoku klienta"), tylko domyka pierwszą:
  id też staje się funkcją planu, przez jeden builder z odwrotnością.
- **Klucz bazowy dla konfiguracji, pełne id dla disclosure i dla preferencji.** To jedyny podział,
  który jednocześnie utrzymuje inwarianty testowe i nie robi z allowlisty sita.
- **Bramka na audytorium, nie na widoku.** `previewVisible`, nie `view` — reguła kupiona już raz
  regresją (`lessons.md:468`).
- **dsg**: `component` musi zostać referencją modułową (`lessons.md:145-152`), a plan jedzie
  w `columnData` — obecne fabryki już to robią, więc dołożenie drugiego planu nie łamie reguły;
  łamie ją dopiero inline'owy `component:` przy okazji.

## Historical Context (from prior changes)

- `context/reference/kosztorys-editor-domain-notes.md:1104-1112` — P10, owner 2026-08-18: MANAGER widzi
  wszystko; ukrywanie kolumn dotyczy klienta, nie roli. Slice `kosztorys-column-rbac` wycięty.
- `context/archive/2026-07-28-preview-column-disclosure/review-gate.md:3-6` — w podglądzie decyduje
  wyłącznie `PREVIEW_VISIBLE_COLUMNS`; żadna preferencja czytelnika nie kształtuje dokumentu klienta.
- `context/foundation/lessons.md:497-513` — render-side disclosure, dwie połowy zamka.
- `context/foundation/lessons.md:468-481` — flaga widoku ≠ flaga audytorium.
- `context/foundation/lessons.md:1240-1250` — allowlista fail-closed, wyprowadzona z grup dialogu.
- `context/archive/2026-08-17-sortowanie-kolumn-spojne/` — dlaczego te dwie kolumny były niesortowalne
  i kształt testu „oba plany sortują odwrotnie".
- `context/archive/2026-07-25-subcontractor-view-settlement-only/change.md:25-39` — widoki wykonawcy to
  rachunek jednej ekipy; wszystko wpisuje się w widoku Inwestora. Precedens za, nie przeciw.
- `context/foundation/manual-checks.md:2376-2387` — ręczna weryfikacja, że localStorage nie odsłania
  `priceCoeff`/`priceMode` w podglądzie.

## Doc drift, którą ta zmiana wywołuje

- `context/reference/kosztorys-editor-domain-notes.md:872-874` — „a w widoku klienta żadna stawka
  wykonawcy się nie renderuje" staje się nieprawdą (sama decyzja o liczeniu problemów per plan zostaje).
- `src/lib/kosztorys/row-conditions.ts:60-67` — komentarz o „harmless no-op" reveal.
- `src/lib/table/column-order.ts:41-47` — komentarz o skosie indeksów assemble między widokami.

## Rozstrzygnięcia (owner, 2026-09-01)

Wszystkie cztery pytania zamknięte przed planowaniem — plan wchodzi bez otwartych decyzji.

1. **Sufiks planu wchodzi do WSZYSTKICH widoków**, nie tylko do Inwestora. Kolumny wykonawcy
   nazywają się tak samo niezależnie od tego, w którym widoku się złożyły — jeden kształt id, jedna
   gałąź w `columnSortValue` (plan czytany z id, nie z `view`), zero rozgałęzień „gdzie jesteśmy".
   **Wyjątek, który nie jest wyjątkiem od tej reguły, tylko innym pojęciem:** klientowska
   „Cena j.m. netto" zostaje przy dotychczasowym id — to nie jest cena wykonawcy, tylko cena z oferty,
   i jej id siedzi w allowliście podglądu oraz w zapisanych ustawieniach klienta w bazie (p. 3).
   Koszt renamu w widokach wykonawcy: zapisane szerokości/ticki/rank dla dwóch kolumn wracają do
   defaultu, sierocy klucz zostaje w localStorage. Nic destrukcyjnego, nic w bazie.
2. **„Problemy" odsłaniają kolumny również w widoku Inwestora**, per plan problemu — warunek stawkowy
   już niesie swój `plane` (`row-conditions.ts:323,334,352,363,382,392`), więc reveal celuje w kolumnę
   tego planu, którego dotyczy problem, a nie w obie naraz. Komentarz o „harmless no-op"
   (`row-conditions.ts:60-67`) znika razem z tą zmianą.
3. **Kolumny przeżywają tryb „Brutto"** — wchodzą do `AXIS_EXEMPT_COLUMNS` tak jak klientowska cena.
   Stawka wykonawcy jest netto z definicji i nie ma brutto-bliźniaka, więc znikanie jej przy
   przełączeniu osi byłoby utratą danych bez zysku. To pierwszy moment, w którym to zwolnienie
   cokolwiek robi dla kolumn wykonawcy — dotąd oś była przypięta do netto na całym ich planie
   (`money-axis.ts:26-29`).
4. **Kolejność**: domyślnie obok pozostałych cen, tj. w miejscu dzisiejszej gałęzi cenowej
   (`kosztorys-v2-columns.tsx:277-292`). Kolejność jest ustawialna, więc to tylko punkt startowy;
   `columnBaseRanks` liczy się z tej pozycji.

## Open Questions

Brak — patrz „Rozstrzygnięcia" powyżej.
