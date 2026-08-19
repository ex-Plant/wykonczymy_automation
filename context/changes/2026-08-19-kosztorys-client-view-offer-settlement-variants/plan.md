# Warianty „Oferta / Rozliczenie" w ustawieniach podglądu inwestora — Implementation Plan

## Overview

Ustawienia podglądu inwestora przestają być jednym zestawem kolumn na inwestycję. Inwestycja trzyma
**dwa** zestawy naraz — `OFFER` i `SETTLEMENT` — plus informację, który z nich jest aktywny. Aktywny
wariant jest tym, co widzi inwestor pod linkiem. Przełącznik w oknie ustawień wybiera jednocześnie
wariant edytowany i (po zapisie) aktywny, więc jedna decyzja zamiast dwóch. Domyślne firmowe też są
per wariant.

Powód: oferta i rozliczenie pokazują inwestorowi zupełnie inne kolumny (przedmiar + cena vs pomiar,
etapy i % wykonania), a dziś przejście z jednego etapu inwestycji na drugi znaczy ręczne
przeklikanie ~20 checkboxów w obie strony, za każdym razem.

## Current State Analysis

- `src/collections/kosztorys-client-view.ts` — jeden wiersz na inwestycję: `hiddenColumns` (jsonb)
  - `hideEmptyRows` (boolean). `investment` jest `unique`.
- `src/globals/kosztorys-client-view-defaults.ts` — global o tym samym kształcie, firmowy fallback.
- `src/lib/kosztorys/client-view-settings.ts` — `ClientViewSettingsT` + `sanitizeClientViewSettings`
  (przycina do allowlisty `PREVIEW_VISIBLE_COLUMNS` i **jest zarazem domyślną z kodu**, bo wywołana
  na `{}` daje „wszystko widoczne minus puste pozycje") + `sameClientViewSettings`.
- `src/lib/queries/kosztorys-client-view.ts` — `findClientViewRow` + `getClientViewSettings`
  (wiersz ⟶ global ⟶ domyślna z kodu; oba odczyty równolegle, celowo poza cache).
- `src/lib/queries/client-view-settings-endpoint.ts` — `readClientViewSettings`, odczyt na żądanie
  dla okien, z `requireAuth(MANAGEMENT_ROLES)`.
- `src/lib/actions/kosztorys-client-view.ts` — `saveClientViewSettingsAction` (find-then-create
  z obsługą wyścigu) i `saveClientViewDefaultsAction`, obie za `ownerOnlyAction`.
- Konsumenci płaskiego kształtu: `lib/queries/preview-kosztorys.ts` (`PreviewKosztorysDataT`),
  `components/kosztorys/editor/use-kosztorys-editor.ts:404` (`previewHiddenColumns`),
  `hooks/use-kosztorys-view-state.ts:40` (`hideEmptyRows` ⟶ warunek `client-empty`).
- UI: `dialogs/client-view-settings-form.tsx` (wspólne ciało), `kosztorys-client-view-dialog.tsx`
  (zapis + „Zapisz jako domyślne"), `kosztorys-share-dialog.tsx` (ten sam formularz jako krok
  „przejrzyj, zanim wygenerujesz link"). Stan trzyma `editor/actions/investor-actions.tsx`.
- Migracja bazowa: `src/migrations/20260815_0_add_kosztorys_client_view.ts`.
- Spec: `src/__tests__/lib/queries/kosztorys-client-view.test.ts` — DB-owy, `describe.skipIf`
  na brak `DB_POSTGRES_URL`.
- **Brak danych do zachowania** (owner, 2026-08-19): nikt nie odklikał jeszcze żadnego wariantu.

## Desired End State

Okno „Ustawienia podglądu inwestora" ma na górze przełącznik „Oferta | Rozliczenie". Przełączenie
zmienia edytowany zestaw checkboxów; nic nie zapisuje. Jeśli wybrany wariant różni się od zapisanego,
nad stopką pojawia się ostrzeżenie, że zapis zmieni to, co widzi inwestor, a przycisk nazywa skutek
wprost („Zapisz i pokaż rozliczenie"). „Zapisz jako domyślne" nadpisuje domyślne firmowe wybranego
wariantu **i** domyślny tryb. To samo ciało formularza (i ten sam przełącznik + ostrzeżenie) działa
w kroku ustawień okna „Udostępnij".

Weryfikacja: inwestycja w trybie `OFFER` serwuje pod `/k/<token>` kolumny wariantu ofertowego;
po przestawieniu na `SETTLEMENT` ten sam link serwuje kolumny rozliczeniowe, bez dotykania
checkboxów oferty — i po powrocie na `OFFER` zestaw ofertowy jest nietknięty.

### Key Discoveries

- `sanitizeClientViewSettings` pełni **dwie** role naraz (walidacja + domyślna z kodu) — komentarz
  w pliku mówi o tym wprost. Rozbicie na warianty musi tę własność zachować, inaczej pojawi się
  druga, dryfująca odpowiedź na „co widać domyślnie".
- `PREVIEW_VISIBLE_COLUMNS` (`lib/kosztorys/column-config.ts`) zostaje jedynym sufitem — warianty
  wybierają **wewnątrz** niego, żaden nie może go poszerzyć.
- `getClientViewSettings` jest czytane przez wejście po tokenie z `overrideAccess` i **poza**
  `unstable_cache` — utrzymanie jego dzisiejszej sygnatury (płaski `ClientViewSettingsT`) zostawia
  `preview-kosztorys.ts`, edytor i cały tor podglądu nietknięte.
- Domyślne kolumny gridu (`DEFAULT_HIDDEN_COLUMNS`) to osobna sprawa — dotyczą widoku właściciela,
  nie inwestora. Nie mieszać.
- `sameClientViewSettings` jest używane tylko w `kosztorys-share-dialog.tsx` — pilnuje, żeby klik
  „Dalej" bez zmian nie zapisał wiersza i nie odpiął inwestycji od firmowego domyślnego. Ta własność
  musi przeżyć na poziomie całej konfiguracji, nie pojedynczego wariantu.

## What We're NOT Doing

- Żadnego backfillu ani ścieżki zgodności ze starym płaskim kształtem — kolumny lecą i wracają puste.
- Żadnego skrótu do przestawienia trybu poza oknem ustawień (menu „Opcje", pasek podglądu).
- Trzeciego wariantu ani wariantów definiowanych przez użytkownika — dwa, na sztywno w kodzie.
- Zmian w tym, **co wolno** pokazać inwestorowi: allowlista `PREVIEW_VISIBLE_COLUMNS` bez zmian.
- Zmian w podsumowaniu pod rozpiską — ustawienia dalej sięgają tylko kolumn i pozycji gridu.
- Zmian w cache'owaniu i w torze wejścia po tokenie.
- E2E — ryzyko jest zamknięte w resolverze i sanitizerze, oba pokryte niżej testami taniej warstwy.

## Implementation Approach

Rozdzielenie dwóch kształtów, które dziś są jednym typem:

- **`ClientViewConfigT`** — to, co jest **zapisane**: `{ mode, variants: { OFFER, SETTLEMENT } }`.
  Widzą go tylko okna, akcje zapisu i warstwa składowania.
- **`ClientViewSettingsT`** — to, co jest **serwowane**: dzisiejszy płaski `{ hiddenColumns,
hideEmptyRows }`. Widzi go podgląd, edytor i wejście po tokenie — bez zmian.

Mostem między nimi jest jedna czysta funkcja (`clientViewSettingsForMode`), więc cały ciężar
decyzyjny siada w warstwie bez Reacta i bez bazy, testowalnej wprost.

## Critical Implementation Details

**Destrukcyjna kolejność dotyczy preview, nie produkcji.** Migracja usuwa `hidden_columns` /
`hide_empty_rows` z obu tabel. Na **preview/staging** te kolumny istnieją i dzisiejszy kod je czyta,
więc obowiązuje kolejność destrukcyjna: najpierw merge i żywy deploy, dopiero potem
`pnpm db:migrate:preview` — odwrotnie każdy request trafia na `SELECT` po usuniętej kolumnie
(Postgres 42703). Na **produkcji** cała funkcja podglądu inwestora jeszcze nie istnieje (`main` nie
ma ani `20260815_0_add_kosztorys_client_view.ts`, ani `src/collections/kosztorys-client-view.ts`),
więc względem niej to zmiana czysto addytywna — obie migracje pójdą po kolei przy pierwszym wydaniu
tej funkcji na prod, ręcznie przez człowieka (`pnpm db:migrate:prod`). Lokalnie to jedno ciągłe
zadanie — nie blokować faz na wdrożeniu.

**Nazewnictwo.** `ClientViewModeT = 'OFFER' | 'SETTLEMENT'` — prefiks `ClientView` jest obowiązkowy
wszędzie, bo istniejący `SettlementModeT` (`lib/kosztorys/settlement-mode.ts`) to sposób rozliczenia
robocizny, zupełnie inne pojęcie. Bez prefiksu dwa pojęcia zlałyby się w jedno słowo.

---

## Phase 1: Model i sanitizer

### Overview

Cały kształt i wszystkie reguły domyślnych w jednym czystym module, zanim cokolwiek dotknie bazy
czy Reacta.

### Changes Required

#### 1. Typy, domyślne i sanitizer

**File**: `src/lib/kosztorys/client-view-settings.ts`

**Intent**: Wprowadzić kształt konfiguracji z dwoma wariantami i trybem aktywnym, dwa różne domyślne
zestawy z kodu oraz sanitizer, który — tak jak dziś — jest zarazem walidatorem i źródłem domyślnej.
Zachować `ClientViewSettingsT` i `sanitizeClientViewSettings` jako kształt **serwowany**, żeby tor
podglądu nie drgnął.

**Contract**:

- `export type ClientViewModeT = 'OFFER' | 'SETTLEMENT'`
- `export type ClientViewConfigT = { mode: ClientViewModeT; variants: Record<ClientViewModeT, ClientViewSettingsT> }`
- `sanitizeClientViewConfig(source: { mode?: unknown; variants?: unknown }): ClientViewConfigT` —
  nieznany/brakujący `mode` ⟶ `'OFFER'`; brakujący wariant ⟶ domyślna z kodu dla **tego** wariantu;
  każdy wariant przepuszczony przez istniejący `sanitizeClientViewSettings`, więc sufit allowlisty
  obowiązuje bez zmian. Wywołana na `{}` zwraca komplet domyślnych — ta sama własność co dziś.
- `clientViewSettingsForMode(config: ClientViewConfigT): ClientViewSettingsT` — most do kształtu
  serwowanego.
- `sameClientViewConfig(a, b): boolean` — porównanie obu wariantów (przez istniejące
  `sameClientViewSettings`, niewrażliwe na kolejność) **i** trybu.
- Domyślne z kodu wyrażone jako zestawy **widoczne**, odjęte od `PREVIEW_VISIBLE_COLUMNS` przy
  wyliczaniu `hiddenColumns` — lista widocznych jest tym, co da się przeczytać i porównać ze zrzutem
  ekranu; lista ukrytych jest jej dopełnieniem i musi być wyliczana, nie przepisywana ręcznie:
  - `OFFER`: `description`, `plannedQty`, `unit`, `price`, `plannedNet`, `remaining`
  - `SETTLEMENT`: cały zestaw `OFFER` plus `stageQtySum`, `net`, `STAGES_COLUMN_GROUP`,
    `STAGE_VALUE_NET_COLUMN_GROUP`, `donePercent` — rozliczenie dokłada wykonanie do oferty, nie
    zastępuje jej, więc wyrażone jako nadzbiór, nie jako druga niezależna lista (zrzuty właściciela,
    2026-08-19)
  - `hideEmptyRows: true` w obu.

#### 2. Spec sanitizera

**File**: `src/__tests__/lib/kosztorys/client-view-settings.test.ts` (nowy)

**Intent**: Przypiąć reguły, na których stoi cała reszta — bo to jedyne miejsce, gdzie „czego brakuje
w bazie" zamienia się w „co widzi inwestor".

**Contract**: `sanitizeClientViewConfig` na `{}` ⟶ tryb `OFFER` i oba warianty w domyślnych z kodu;
nieznany `mode` ⟶ `OFFER`; obecny tylko jeden wariant ⟶ drugi z domyślnej, pierwszy nietknięty;
klucz spoza `PREVIEW_VISIBLE_COLUMNS` w wariancie ⟶ odrzucony; domyślne oferty i rozliczenia **różnią
się** (regresja na wypadek, gdyby ktoś zredukował je do jednej stałej);
`clientViewSettingsForMode` zwraca wariant wskazany przez `mode`, nie pierwszy z brzegu.

### Success Criteria

#### Automated Verification

- Nowy spec przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/client-view-settings.test.ts`

#### Manual Verification

- (brak — faza bez powierzchni użytkownika)

---

## Phase 2: Schemat

### Overview

Kolumny w bazie i pola w Payloadzie dopasowane do nowego kształtu. Migracja tępa: usuwa stare, dodaje
nowe, zero backfillu.

### Changes Required

#### 1. Migracja

**File**: `src/migrations/20260819_1_client_view_offer_settlement_variants.ts` (nowy)

**Intent**: Zamienić parę `hidden_columns` / `hide_empty_rows` na `mode` + `variants` w tabeli
inwestycji i w tabeli globalu domyślnych.

**Contract**: Ręcznie pisana, wzorowana na `20260815_0_add_kosztorys_client_view.ts`
(`migrate:create` emituje fantomowy drift — AGENTS.md). Na `kosztorys_client_view`
i `kosztorys_client_view_defaults`: `DROP COLUMN IF EXISTS "hidden_columns"`, `"hide_empty_rows"`;
`ADD COLUMN IF NOT EXISTS "mode" varchar NOT NULL DEFAULT 'OFFER'`,
`ADD COLUMN IF NOT EXISTS "variants" jsonb DEFAULT '{}'::jsonb`. `down` odwraca (przywraca starą
parę z jej starymi defaultami, usuwa nowe). Wpis w `src/migrations/index.ts`.

#### 2. Pola kolekcji i globalu

**File**: `src/collections/kosztorys-client-view.ts`, `src/globals/kosztorys-client-view-defaults.ts`

**Intent**: Odwzorować nowe kolumny jako pola Payloada; `investment` (unique, cascade) i cała reszta
konfiguracji kolekcji bez zmian.

**Contract**: `mode` — `select` z opcjami `OFFER` / `SETTLEMENT`, `required`, `defaultValue: 'OFFER'`,
etykiety PL („Oferta" / „Rozliczenie"); `variants` — `json`, `defaultValue: {}`. Usunąć
`hiddenColumns` i `hideEmptyRows`. `admin.defaultColumns` kolekcji zaktualizować (`hideEmptyRows`
przestaje istnieć) na `['investment', 'mode', 'updatedAt']`. Komentarz nagłówkowy kolekcji mówi dziś
„`hiddenColumns` stores what is HIDDEN" — przenieść tę rację do nowego kształtu, nie zostawiać
opisu nieistniejącego pola.

### Success Criteria

#### Automated Verification

- Migracja wchodzi na czystej lokalnej bazie: `pnpm payload migrate`
- Typy Payloada regenerują się bez błędu: `pnpm generate:types`

#### Manual Verification

- W `/admin` wiersz „Ustawienia podglądu inwestora" pokazuje pole trybu z polskimi etykietami.

---

## Phase 3: Odczyt i zapis

### Overview

Warstwa danych mówi dwoma językami: podglądowi dalej podaje płaski zestaw aktywnego wariantu, oknom
— pełną konfigurację.

### Changes Required

#### 1. Resolver

**File**: `src/lib/queries/kosztorys-client-view.ts`

**Intent**: Rozdzielić dzisiejsze `getClientViewSettings` na odczyt konfiguracji (wiersz ⟶ global ⟶
domyślna z kodu, ta sama równoległa para odczytów co dziś) i cienką nakładkę zwracającą płaski
zestaw aktywnego wariantu.

**Contract**: `getClientViewConfig(investmentId: number): Promise<ClientViewConfigT>` — nowa,
przejmuje dzisiejsze ciało z `sanitizeClientViewConfig` w miejscu sanitizera.
`getClientViewSettings(investmentId): Promise<ClientViewSettingsT>` — **sygnatura bez zmian**, teraz
`clientViewSettingsForMode(await getClientViewConfig(...))`. `findClientViewRow` bez zmian.
Zachować dzisiejsze komentarze o `overrideAccess` i o świadomym braku cache'a — obie racje dalej
obowiązują.

#### 2. Endpoint dla okien

**File**: `src/lib/queries/client-view-settings-endpoint.ts`

**Intent**: Okna potrzebują teraz obu wariantów, nie zrezolwowanego zestawu.

**Contract**: `readClientViewSettings` zwraca `ClientViewConfigT` i woła `getClientViewConfig`.
Brama `requireAuth(MANAGEMENT_ROLES)` bez zmian — i komentarz o tym, dlaczego resolver nie jest
publikowany wprost, zostaje.

#### 3. Akcje zapisu

**File**: `src/lib/actions/kosztorys-client-view.ts`

**Intent**: Zapisywać całą konfigurację (oba warianty + tryb) jednym zapisem; domyślne firmowe
nadpisywać **tylko dla wybranego wariantu**, razem z domyślnym trybem.

**Contract**: `saveClientViewSettingsAction(investmentId, config: ClientViewConfigT)` — jak dziś,
z `sanitizeClientViewConfig` i zachowaną obsługą wyścigu find-then-create.
`saveClientViewDefaultsAction(config: ClientViewConfigT, mode: ClientViewModeT)` — czyta obecny
global, podmienia **jeden** wariant na `config.variants[mode]`, ustawia `mode` jako domyślny tryb,
zapisuje całość przez `sanitizeClientViewConfig`. Read-modify-write, nie ślepe nadpisanie: inaczej
zapis domyślnych oferty skasowałby domyślne rozliczenia. Obie dalej za `ownerOnlyAction`
z tym samym komunikatem `FORBIDDEN`.

#### 4. Spec DB-owy

**File**: `src/__tests__/lib/queries/kosztorys-client-view.test.ts`

**Intent**: Przenieść istniejące asercje na nowy kształt i dopisać ryzyko, którego wcześniej nie było:
że tryb decyduje o serwowanym zestawie i że wariant nieaktywny nie przecieka.

**Contract**: Fixture zakłada wiersz z oboma wariantami i `mode: 'SETTLEMENT'`.
`getClientViewSettings` zwraca wariant rozliczeniowy, nie ofertowy. Inwestycja bez wiersza dostaje
firmowy global, a bez globalu — domyślne z kodu w trybie `OFFER`. Klucz spoza allowlisty zapisany
w wariancie jest odrzucany przy odczycie (dzisiejszy przypadek, przeniesiony na nowy kształt).
`afterAll` przywraca global do domyślnej z kodu — dziś robi to płaską parą, więc musi zostać
zaktualizowany, inaczej zostawi w bazie kształt, którego sanitizer nie rozpozna.

### Success Criteria

#### Automated Verification

- Spec DB-owy przechodzi: `pnpm exec vitest run src/__tests__/lib/queries/kosztorys-client-view.test.ts`

#### Manual Verification

- Link `/k/<token>` inwestycji w trybie `OFFER` pokazuje kolumny ofertowe; po przestawieniu na
  `SETTLEMENT` ten sam link pokazuje kolumny rozliczeniowe.

---

## Phase 4: UI

### Overview

Przełącznik, ostrzeżenie i wyraźny zapis we wspólnym formularzu, więc oba okna dostają to samo.

### Changes Required

#### 1. Wspólny formularz

**File**: `src/components/kosztorys/editor/dialogs/client-view-settings-form.tsx`

**Intent**: Formularz przyjmuje całą konfigurację i sam trzyma na górze przełącznik wariantu; poniżej
te same grupy checkboxów, tyle że operujące na wariancie wskazanym przez `value.mode`.

**Contract**: `value: ClientViewConfigT | null`, `onChange: (value: ClientViewConfigT) => void`.
Przełącznik przez istniejący `components/ui/toggle-group.tsx` (opcje „Oferta" / „Rozliczenie"),
zmiana ustawia `mode` w drafcie i nic więcej. Ticki czytają i piszą
`value.variants[value.mode]`. Placeholder „Wczytywanie…" na `null` bez zmian. Doc-komentarz pliku
mówi dziś, że formularz „owns no persistence and no buttons" — to dalej prawda i musi taką zostać:
przełącznik zmienia draft, nie zapisuje.

#### 2. Ostrzeżenie o zmianie widoku

**File**: `src/components/kosztorys/editor/dialogs/client-view-mode-warning.tsx` (nowy)

**Intent**: Powiedzieć wprost, że zapis przestawi to, co widzi inwestor — ale tylko wtedy, gdy
faktycznie przestawi.

**Contract**: Przyjmuje wybrany i zapisany tryb, renderuje `components/ui/warning-banner.tsx` tylko
gdy się różnią; przy równych zwraca `null`. Osobny plik, bo używają go oba okna, a wspólny formularz
nie zna zapisanego stanu — zna go tylko wołający.

#### 3. Okno „Ustawienia podglądu inwestora"

**File**: `src/components/kosztorys/editor/dialogs/kosztorys-client-view-dialog.tsx`

**Intent**: Przejść na `ClientViewConfigT` i nazwać skutek zapisu wprost.

**Contract**: Etykieta przycisku zależy od wybranego trybu — „Zapisz i pokaż ofertę" / „Zapisz
i pokaż rozliczenie". Ostrzeżenie nad stopką. „Zapisz jako domyślne" woła
`saveClientViewDefaultsAction(draft, draft.mode)`. Dotychczasowa kolejność zapisów zostaje
nietknięta: najpierw wiersz inwestycji, `onSaved` publikowane **przed** próbą zapisu domyślnych,
osobny komunikat błędu dla nieudanych domyślnych — komentarze w pliku tłumaczą, dlaczego, i dalej
obowiązują.

#### 4. Okno „Udostępnij"

**File**: `src/components/kosztorys/editor/dialogs/kosztorys-share-dialog.tsx`

**Intent**: Ten sam formularz z przełącznikiem, więc generując link wybierasz i widzisz, co inwestor
dostanie.

**Contract**: Draft na `ClientViewConfigT`; strażnik „Dalej bez zmian nie zapisuje" przechodzi
z `sameClientViewSettings` na `sameClientViewConfig` — jego racja (nie odpinać inwestycji od
firmowego domyślnego przez samo przeklikanie kroku) jest ta sama. Ostrzeżenie o zmianie widoku
renderowane w kroku ustawień, nad stopką.

#### 5. Stan okien

**File**: `src/components/kosztorys/editor/actions/investor-actions.tsx`

**Intent**: Trzymać w stanie konfigurację zamiast płaskiego zestawu.

**Contract**: `clientView: ClientViewConfigT | null` i `setClientView` na tym samym typie; odczyt
przez `readClientViewSettings` bez zmian w kształcie wywołania.

### Success Criteria

#### Automated Verification

- Specy dotkniętych warstw dalej przechodzą: `pnpm exec vitest run src/__tests__/lib/kosztorys/client-view-settings.test.ts src/__tests__/lib/queries/kosztorys-client-view.test.ts`

#### Manual Verification

- Przełączenie „Oferta ⟷ Rozliczenie" w oknie ustawień zmienia zestaw ticków i **nic** nie zapisuje
  do momentu kliknięcia zapisu.
- Ostrzeżenie pojawia się tylko wtedy, gdy wybrany wariant różni się od zapisanego, i znika po zapisie.
- Etykieta przycisku nazywa wariant, który zostanie pokazany inwestorowi.
- „Zapisz jako domyślne" na wariancie ofertowym nie rusza domyślnych rozliczenia (sprawdzalne przez
  drugą inwestycję bez własnego wiersza).
- Kolumny odklikane w ofercie są nietknięte po przełączeniu na rozliczenie i z powrotem.
- Okno „Udostępnij" pokazuje ten sam przełącznik i to samo ostrzeżenie; „Dalej" bez żadnej zmiany nie
  tworzy wiersza dla inwestycji, która go nie miała.

---

## Testing Strategy

### Unit Tests

- `sanitizeClientViewConfig`: pusty wejściowy obiekt, nieznany tryb, brakujący wariant, klucz spoza
  allowlisty, różnica między domyślnymi obu wariantów.
- `clientViewSettingsForMode`: zwraca wariant wskazany przez `mode`.
- `sameClientViewConfig`: różnica w trybie przy identycznych wariantach ⟶ `false` (inaczej krok
  „Dalej" w oknie udostępniania przełknąłby zmianę trybu bez zapisu).

### Integration Tests

- DB-owy spec resolvera (Faza 3): tryb decyduje o serwowanym zestawie; łańcuch wiersz ⟶ global ⟶
  domyślna z kodu; przycięcie do allowlisty na odczycie.

### Manual Testing Steps

Zebrane w blokach `#### Manual Verification:` faz 2–4; `/10x-implement` przenosi je do rejestru
`context/foundation/manual-checks.md` przy ostatniej fazie.

## Performance Considerations

Bez zmian: te same dwa indeksowane odczyty co dziś, dalej poza `unstable_cache`. `variants` to jeden
mały jsonb zamiast jednej tablicy jsonb — różnica nieistotna.

## Migration Notes

Osobna migracja, nie edycja `20260815_0_add_kosztorys_client_view.ts`: tamta jest już zastosowana
lokalnie i na preview, więc zmiana w miejscu nic by w tych bazach nie zrobiła, a rozjechałaby
historię migracji ze stanem faktycznym. Na produkcji obie pójdą po kolei — utworzą starą parę kolumn
i od razu ją usuną, na pustej tabeli.

Kierunek jest różny w zależności od środowiska:

- **preview/staging** — kolumny istnieją i kod je czyta, więc destrukcyjnie: najpierw merge i żywy
  deploy, potem `pnpm db:migrate:preview`.
- **produkcja** — `main` nie ma jeszcze ani migracji bazowej, ani kolekcji, więc addytywnie: migracje
  wchodzą przy pierwszym wydaniu funkcji podglądu inwestora na prod, ręcznie przez człowieka
  (`pnpm db:migrate:prod`).

Danych do przeniesienia nie ma — nikt nie odklikał jeszcze żadnego wariantu.

## Whole-tree Gate

- Typy: `pnpm typecheck`
- Lint: `pnpm lint`
- Pełny zestaw testów: `pnpm test`
- Build: `pnpm build`

## References

- Ustalenia z rozmowy: `context/changes/2026-08-19-kosztorys-client-view-offer-settlement-variants/change.md`
- Migracja bazowa: `src/migrations/20260815_0_add_kosztorys_client_view.ts`
- Poprzednia zmiana w tym obszarze: `context/archive/2026-07-20-kosztorys-client-view-reuse/`
- Allowlista i grupy kolumn: `src/lib/kosztorys/column-config.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Model i sanitizer

#### Automated

- [x] 1.1 Nowy spec sanitizera przechodzi

### Phase 2: Schemat

#### Automated

- [x] 2.1 Migracja wchodzi na czystej lokalnej bazie
- [x] 2.2 Typy Payloada regenerują się bez błędu

### Phase 3: Odczyt i zapis

#### Automated

- [x] 3.1 Spec DB-owy resolvera przechodzi

### Phase 4: UI

#### Automated

- [ ] 4.1 Specy dotkniętych warstw dalej przechodzą
