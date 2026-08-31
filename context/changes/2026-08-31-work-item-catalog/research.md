---
date: 2026-08-31T19:44:08+02:00
researcher: Claude (Opus 5)
git_commit: 64512b538f1a24b692b9e7f81bf325a004837b8f
branch: main
repository: wykonczymy
topic: 'Katalog prac — wstawianie pojedynczej zapisanej pracy z ceną i zamrożonymi stawkami podwykonawców'
tags: [research, codebase, kosztorys, presets, cennik, work-catalogue]
status: complete
last_updated: 2026-08-31
last_updated_by: Claude (Opus 5)
---

# Research: katalog prac (cennik) — wstawianie pojedynczej pracy

**Date**: 2026-08-31T19:44:08+02:00 · **Branch**: main · **Commit**: `64512b53`

## Research Question

Dziś najmniejsza jednostka, jaką da się wziąć z szablonu, to sekcja. Brakuje mechanizmu dodania
POJEDYNCZEJ zapisanej pracy wraz z opisem, j.m., „Cena j.m." i stawkami podwykonawców. Gdzie to
podpiąć, jaki byt założyć, co da się ponownie użyć, i co w kodzie/decyzjach stoi temu na drodze.

## Ustalenia produktowe z rozmowy z właścicielem (2026-08-31)

Te decyzje są wejściem do planu, nie hipotezami:

1. **Osobny byt katalogu** (wariant A), nie rozbijanie istniejących szablonów na prace (wariant B).
2. **Stawka podwykonawcy w katalogu jest zamrożoną kwotą**, nie współczynnikiem — dziedziczenie
   współczynnika inwestycji docelowej po przeniesieniu pracy zmieniałoby stawkę po cichu.
3. **Katalog = cennik aktualny; szablon = migawka.** Wstawienie kopiuje wartość z chwili wstawienia
   i zamraża ją w kosztorysie. Żadnej żywej referencji.
4. **Nie zapisujemy źródła pochodzenia pracy.** Raport porównawczy dopasowuje po nazwie + j.m.
5. **Porównanie z cennikiem jest wyłącznie ręczną akcją** z „Opcji", nigdy automatem, i nic nie
   zapisuje. Trzy kubełki: zgodne / rozjazd ceny / brak w cenniku (z podpowiedzią rozmytą).
6. **„Zapisz do katalogu" pozwala nadpisać** istniejącą pozycję — to główna droga aktualizacji cennika.
7. Powierzchnie: własny **ekran katalogu**, **„Dodaj → Praca z katalogu…"** w edytorze, oraz
   **„Zapisz do katalogu…"** w menu trzech kropek na pracy.

## Summary

- Funkcja była już raz zaprojektowana i **wycięta** (FR-006, autouzupełnianie pozycji) z klauzulą
  „revivable if section-append proves too coarse". Wskrzeszamy ją, ale z **odwróconym modelem
  danych** — poprzedni wybór to był wariant B. Uzasadnienie odwrócenia: patrz „Konflikt z zapisaną
  decyzją" niżej.
- **Normalizatora nie piszemy** — `foldDescription` / `fold` już istnieją i już rozwiązują problem
  literówek poprawianych przez „Popraw opisy". Jedyna zmiana: zdjęcie zawężenia do sekcji.
- **Zamrażanie stawki to jedna gotowa funkcja** (`subcontractorPrice`), a zapis kwoty z powrotem na
  pozycję ma gotowy odpowiednik (`modeChange` / `deriveOverride`).
- **Nie istnieje ścieżka „wstaw N pozycji do ISTNIEJĄCEJ sekcji"** — trzeba ją złożyć; największa
  pułapka to przesuwanie kolejności o N zamiast o 1.
- **Raport ma kompletny wzorzec do skopiowania** — „Porównaj z arkuszem" od menu po dialog, z czystą
  logiką w osobnym module i testem w lustrzanej ścieżce.
- **Byt: kolekcja Payload, nie surowa tabela** — wbrew precedensowi `kosztorys_presets`, bo tamten
  wzorzec dotyczy tabel bez UI i z jednym pisarzem; katalog ma ekran CRUD i trzech pisarzy.

## Konflikt z zapisaną decyzją (przeczytać przed planem)

`context/foundation/roadmap.md:666` zapisuje przeciwny wybór:

> **Chosen model: A (preset-sourced).** There is **no separate catalogue table.** The "master price
> list" _is_ the union of `prace` across presets; autocomplete is a read-only view over that data,
> snapshotting opis + J.m. + price into the new item on select.

`roadmap.md:678` — cała funkcja **CUT (2026-07-28, owner)**, zastąpiona przez „Dodaj sekcję
z szablonu", z furtką: „**Revivable if section-append proves too coarse in practice**". Właściciel
2026-08-31 stwierdził, że jest za gruba → furtka otwarta.

Powód wycięcia (`roadmap.md:672`) był **kosztem UI**: „the highest-UI-risk … custom
`react-datasheet-grid` cell — the repo has no async-search combobox precedent". Ten koszt **odpadł**:
`context/archive/2026-08-31-add-item-section-picker/` dowiózł „Dodaj → Praca ▸ lista sekcji" jako
podmenu, nie jako komórkę siatki. Katalog wiesza się na tym samym menu.

Dwa wcześniejsze werdykty, które projekt musi wytrzymać:

- **Kanoniczna, globalnie unikalna nazwa była odrzucona** — na poziomie sekcji
  (`context/archive/2026-07-16-kosztorys-section-append/change.md`): „forces upsert semantics and
  a three-way conflict dialog on every save-as … »this is bad« (owner)". Różnica: tam konflikt
  wyskakiwał przy zapisie **całego szablonu**, czyli zawsze; tu dotyczy świadomego zapisu **jednej
  pracy**, gdzie „nowa czy aktualizuj" JEST treścią operacji.
- **Płaskie przeszukiwanie prac ponad szablonami zbudowano i wycofano**
  (`context/archive/2026-07-28-scalable-preset-section-picker/`): „nazwy powtarzają się między
  szablonami, więc płaskie wyniki byłyby listą identycznych nazw", z zapisem „Don't rebuild
  a cross-szablon flat results view". To jest argument **za** osobnym bytem: cennik z kluczem
  unikalnym z definicji nie ma duplikatów — czyli (A) usuwa przyczynę, na której (B) się wywrócił.

Napięcie do pilnowania w treści UI (`roadmap.md:420`): „**the same work costs differently
investment-to-investment (different team → different price), so a centralised/live price is wrong**".
Nasz katalog tego nie łamie (cena kopiowana przy wstawieniu, nigdy żywa), ale **raport musi mówić
„różni się od cennika", nigdy „jest błędna"**.

## Detailed Findings

### 1. Klucz tożsamości pracy — już istnieje

- `src/lib/kosztorys/sheet-import/columns.ts:29` — `fold()`: małe litery, polskie diakrytyki po
  jawnej mapie, zbite spacje, trim. Świadomie ostrzejszy niż `normalize` z `lib/google/sheet-configs`.
- `src/lib/kosztorys/sheet-import/item-key.ts:26` — `FOLDED_TYPO_FIXES`: `TYPO_FIXES` przepuszczone
  przez `fold` i odsiane z reguł czysto diakrytycznych; `foldDescription` (`:30`) je stosuje.
  Uzasadnienie z pliku (`:8`): „»Popraw literówki« rewrites LETTERS, and `fold()` … cannot absorb
  that. Without this the cleaner silently costs every praca its identity."
- `src/lib/kosztorys/sheet-import/item-key.ts:38` — `itemKey(section, description, occurrence)` =
  `fold(section)|foldDescription(description)#occurrence`. **Zawężony do sekcji + licznik wystąpień**
  — katalog musi oba zdjąć.
- Ochrona regresji, którą dziedziczymy za darmo:
  `src/__tests__/lib/kosztorys/sheet-import/item-key.test.ts:45` — `it.each(TYPO_FIXES)` sprawdza
  `key(before) === key(cleanDescription(before))`, także w wersji `.toUpperCase()`. Nowa literówka
  w liście nie może rozspójnić klucza bez wywalenia CI.
- `src/lib/kosztorys/clean-description.ts:183` — `cleanDescription`: 48 podmian literówek → zbicie
  spacji → `unshout()` (CAPS LOCK, z listą wyjątków WC/GK/RIGIPS…) → `sentenceCase()` (z listą
  skrótów `itp.`, `szt.`, `m.in.`…). **Idempotentny** — kontrakt zadeklarowany w nagłówku pliku
  (`:1-5`), ale bez własnego testu (jedyne pokrycie to `item-key.test.ts`).
- Wołany z dwóch miejsc: `cleanItemDescriptionsAction` (`src/lib/actions/kosztorys.ts:275`, bierze
  `captureAutoSnapshot` przed masową nadpiską) i `src/scripts/fix-kosztorys-descriptions.ts`.
- **Nic w repo nie robi dopasowania rozmytego** — brak levenshteina, trigramów w kodzie, `slugify`,
  `unaccent`. `pg_trgm` **jest** włączony (`src/migrations/20260412_add_amount_trigram_index.ts:20`),
  ale wyłącznie pod indeks GIN na `transactions.amount::text`. Żadna kolumna tekstowa go nie używa.
- Drugi, niezależny fold do UI: `src/lib/utils/fold-text.ts` (`foldText`, `foldFilter` dla cmdk),
  używany przez `useSearchFilter` w sześciu tabelach. **Dwa foldy istnieją i nie są tą samą
  funkcją** — domenowy (`sheet-import/columns.ts`) i wyszukiwarkowy (`utils/fold-text.ts`).

**Wniosek dla klucza katalogu.** Jedna kolumna `match_key` = `foldDescription(opis)` + separator +
`fold(j.m.)`, `NOT NULL`, z **jednokolumnowym** UNIQUE — dzięki temu Payloadowe `unique: true` zgadza
się z bazą i omijamy pułapkę z lekcji „Payload `unique: true` is single-column only" oraz to, że
Postgres traktuje NULL-e jako różne (nullowa j.m. nigdy by nie kolidowała).

**Napięcie z lekcją do zapisania w planie** (`lessons.md:273`, „Resolve an LLM-supplied name to an
id by EXACT match or blank — never fuzzy"): rozmyte dopasowanie **nigdy nie może dotykać zapisu**.
Klucz dokładny rządzi zapisem i unikalnością; rozmycie żyje wyłącznie jako podpowiedź w raporcie,
który niczego nie zapisuje.

### 2. Stawki — liczenie i zamrażanie

- `src/lib/kosztorys/calc.ts:69` — `subcontractorPrice(row: ViewPricingT, view: ToolPlaneT): number`.
  `'amount'` → `value`; `'coeff'` → `clientPrice * value`; `null` → `clientPrice * effectiveCoeff(row, view)`.
  **Stawka jednostkowa netto, bez zaokrąglenia** (zaokrągla dopiero formatowanie).
- **`'coeff'` mnoży `clientPrice`** (cenę klienta przed rabatem) i nic innego. Czyli
  `coeff → kwota` = `clientPrice * value`.
- `src/lib/kosztorys/subcontractor-price-edit.ts:78` — `modeChange(row, 'amount', view)`: przełącza
  plan na kwotę, zasilając wartość z `subcontractorPrice`. **To dosłownie jest „zamroź efektywną
  stawkę"** — nie przepisywać pól ręcznie.
- `src/lib/kosztorys/sheet-import/derive-override.ts:16` — `deriveOverride(rate, clientPrice, …)`:
  kierunek odwrotny (kwota z cennika → nadpisanie na pozycji). Koduje już regułę, że `rate <= 0` to
  zamrożone `{ type:'amount', value:0 }`, a nie „dziedzicz".
- `src/lib/kosztorys/constants.ts:5` — `OVERRIDE_FIELDS` mapuje plan → para pól. Trzy kolumny siatki
  piszą tę samą parę; używać mapy, nie literałów. `DEFAULT_COEFFS = { wTools: 0.65, ownTools: 0.5525 }`.
- `ViewPricingT` (`src/lib/kosztorys/types.ts:82`) ma **zdenormalizowane** globalne współczynniki —
  budując go ręcznie skopiować `asPlanePricing` (`build-sheet-comparison.ts:112`); ich pominięcie
  daje 0 zł na każdej pozycji bez nadpisania.
- `src/lib/kosztorys/subcontractor-price-guard.ts` — `checkSubcontractorPrice(row, view)`: odrzuca
  ujemne i powyżej `MAX_CLIENT_SHARE = 0.8` ceny klienta, zwraca gotowy polski komunikat.
  **Kwota z cennika wrzucona na pozycję o niższej cenie klienta może to przekroczyć** — ścieżka
  wstawiania musi to obsłużyć, a nie zignorować.

### 3. Wstawianie pozycji do istniejącej sekcji — czego brakuje

- `src/lib/kosztorys/insert-rows.ts:115` — `insertItems(db, investmentId, rows)`: jeden wielowierszowy
  INSERT po `ITEM_INSERT_COLUMNS` (`:21`), zwraca id **w kolejności wejścia**, odtworzonej przez
  złączenie po kluczu naturalnym `(section_id, display_order)`. Przy remisie klucza degraduje do
  kolejności pozycyjnej z logiem `TODO(EX-449) SENTRY-REQUIRED` (`:56`).
- `src/lib/kosztorys/create-item.ts:45` — `createBlankItem` pisze **sztywne pustki**, nie przyjmuje
  wartości pól. Do wstawienia z cennika albo go poszerzyć, albo iść przez `insertItems`.
- `src/lib/kosztorys/create-item.ts:27` — `sectionOwnerAndNextItemOrder(db, sectionId)`: właściciel
  - `COALESCE(MAX(display_order)+1, 0)` jednym zapytaniem. Właściciel **wyprowadzany z sekcji**,
    nigdy z drutu.
- `src/lib/kosztorys/display-order.ts:151` — `resolveInsertSlot(db, scope, anchorId, dir)` pod
  `FOR UPDATE`; `null` = kotwica zniknęła → zamykamy się.
  `display-order.ts:52` — `shiftDisplayOrderFrom` **przesuwa ogon dokładnie o +1**.
- `src/lib/kosztorys/append-preset-sections.ts:27` — najbliższy _kształt_ zwrotki („utworzone wiersze
  gotowe do `treeToRows`"), ale zawsze tworzy nowe sekcje → nie do użycia wprost.

**Nie ma gotowca.** Kompozycja: `withPayloadTransaction` → `getDb(payload, req)` →
`sectionOwnerAndNextItemOrder` (lub `resolveInsertSlot`) → zrobienie miejsca na N →
`insertItems`.

Pułapki (z agenta, potwierdzone w kodzie):

1. **Przesunięcie o N, nie o 1.** Inaczej N wierszy dzieli `display_order` z ogonem i remap id po
   kluczu naturalnym cicho degraduje do kolejności pozycyjnej.
2. Każdy z N wierszy musi dostać **inny `displayOrder`** w obrębie sekcji.
3. `{ skipRevalidation: true }` do `withPayloadTransaction`; unieważnianie robi
   `protectedAction(['kosztorysItems'])` po commicie.
4. Klient wysyła **tylko id** pozycji katalogu; wartości czytamy w akcji z tabeli.
5. **Brak auto-migawki przy wstawianiu** — `captureAutoSnapshot` leci tylko przy usuwaniu
   (`kosztorys.ts:363`, `:522`) i przy zamianie całego drzewa. Tworzenie nie jest też cofalne
   (ani `handleAddItem`, ani `handleInsertItem` nie odkłada komendy undo) — idziemy tym samym torem.

### 4. Klient — wstawienie bez refetchu

`src/components/kosztorys/editor/use-kosztorys-editor.ts`:

- `handleAddItem(sectionId)` (`:711`) — po sukcesie buduje wiersz `makeBlankRow` (`:700`, dokłada
  `tree.vatRate`, `globalDiscountActive`, globalne współczynniki, `stages`), bierze zdenormalizowane
  pola sekcji z dowolnego istniejącego wiersza w `prevById.current`, wpisuje do `prevById`, robi
  `setRows(rs => applyAddItem(rs, row))` i rozwija sekcję.
- `handleAppendedSections(slice)` (`:897`) — `treeToRows(...)` na kawałku drzewa, zasianie
  `prevById`, dopięcie na koniec, `router.refresh()`.
- `src/lib/kosztorys/row-ops.ts:71` — `applyAddItem` ląduje **za ostatnim wierszem tej samej sekcji**,
  nie na końcu tablicy (inaczej powstaje druga banda sekcji i duplikaty kluczy w wirtualizatorze).
  `applyInsertItem` (`:101`) wstawia po indeksie kotwicy.
- **Zwrotka akcji** musi nieść id + `displayOrder` w kolejności żądania **oraz** wartości pól
  (opis / j.m. / cena / dwie stawki) — `buildBlankRow` produkuje tylko pustki. Najprościej oddać
  kształt `AppendedSliceT` i przepuścić przez `treeToRows`, jak robi `handleAppendedSections`.
- **`prevById.current` trzeba zasiać** dla każdego wstawionego wiersza, inaczej autosave i menu
  wiersza go nie widzą.
- **Sortowanie kolumny wyłącza wstawianie „w miejsce"** — `handleInsertItem` ma `if (sort) return`.
- Tryb podglądu klienta: `editorOnly` (`use-kosztorys-editor.ts:356`) opakowuje każdy mutujący
  callback oddany siatce. `handleAddItem` / `handleAppendedSections` **nie są** opakowane — są
  bezpieczne tylko dlatego, że pasek narzędzi nie renderuje się w podglądzie. **Cokolwiek wiszące
  na menu wiersza (czyli „Zapisz do katalogu") musi przejść przez `editorOnly`.**
- **Blokada inwestycji jeszcze nie istnieje** — `status: 'completed'` nie egzekwuje dziś niczego;
  projekt w locie: `context/changes/2026-08-28-investment-lock-on-completed/` (EX-748), punkt
  dławienia w warstwie akcji. Nowa akcja wstawiania będzie musiała dołączyć do tej powierzchni.

### 5. Byt: kolekcja Payload vs surowa tabela

Precedens surowych tabel: `notification_reads`, `kosztorys_snapshots`, `kosztorys_presets`
(migracje `20260708_add_notification_reads.ts`, `20260710_1_…`, `20260711_0_…`; warstwa danych
`src/lib/db/{notifications,snapshots,presets}.ts`). Uzasadnienie zapisane w samej migracji
(`20260711_0_add_kosztorys_presets.ts:8`): „Not a Payload collection — read/written only via raw SQL".

**Żadna z tych trzech nie ma ekranu zarządzania.** Katalog odwraca oba założenia tamtego wzorca:
ma ekran CRUD i trzech pisarzy (dodaj z rozpiski / edytuj na ekranie / usuń), a nie jednego.

Za kolekcją: `/admin` działa od pierwszego dnia jako awaryjny edytor; deklaratywne `access`;
haki unieważniania cache (`makeRevalidateAfterChange`) — czego surowa tabela mieć nie może;
`unique: true` na jednokolumnowym kluczu zgadza się z indeksem w bazie.
Koszt kolekcji: obowiązkowa kolumna w `payload_locked_documents_rels` (brak = wyjątek „column does
not exist" przy każdym zapisie; naprawiane już dwa razy — `20260310_fix_locked_docs_expense_categories.ts`,
`20260709_1_fix_locked_docs_kosztorys_rels`), payloadowe `created_at`/`updated_at` + indeksy,
`generate:importmap` + `generate:types`.

**Rekomendacja: kolekcja Payload**, wzorowana na `src/collections/expense-categories.ts`.

Szablon migracji do skopiowania: `src/migrations/20260818_1_add_fleet.ts` (jedyna świeża tworząca
całą kolekcję poprawnie) minus enumy i tabela `_rels`. Konwencje: nazwa `YYYYMMDD_N_snake_case.ts`
(**porządek leksykalny = porządek wykonania**), nagłówek z „Hand-written (migrate:create's snapshot
baseline is stale…)", wszystko `IF NOT EXISTS`, `down` w odwrotnej kolejności zależności, rejestracja
w `src/migrations/index.ts`. Migracja jest **addytywna** → wg AGENTS.md prod migruje **przed** wyjściem kodu.

### 6. Ekran katalogu

- Trasy globalne to top-level polskie ścieżki w `src/app/(frontend)/`: `/kosztorysy`, `/flota`,
  `/pracownicy`, `/kasy`, `/zgloszenia`, `/raporty`; wpięcie w `MANAGEMENT_LINKS`
  (`src/components/nav/sidebar.tsx:38`), doklejane tylko dla `isManagementRole` (`:58`).
- Szkielet strony: serwerowy komponent → `requireAuth(ROLES)` → `redirect('/')` → `Promise.all` po
  `src/lib/queries/*` → `PageWrapper` → kliencki `*DataTable` → `DataTable` z kolumnami
  z `src/components/tables/*`.
- **Poza edytorem kosztorysu nie ma w repo edycji w komórce** — `react-datasheet-grid` żyje wyłącznie
  pod `components/ui/datasheet-grid/` i `components/kosztorys/editor/`. Wszystkie inne mutacje to
  dialog + formularz + akcja serwerowa.
- Najbliższy precedens (jedyny globalny ekran z pełną trójką dodaj/edytuj/usuń): `/kosztorysy` —
  `src/app/(frontend)/kosztorysy/page.tsx:13`, `src/components/sheets/kosztorys-data-table.tsx:29`,
  `src/components/tables/sheets.tsx`, `src/components/sheets/linked-sheet-actions.tsx:30`
  (`ConfirmDialog` + `useTransition` + `toastMessage` + `router.refresh()`, przycisk destrukcyjny
  chowany po `isAdminOrOwnerRole`).
- Dla połowy „edytuj": `src/components/tables/investments.tsx:287` + `src/components/dialogs/edit-worker-dialog.tsx`,
  formularz na `useManagedForm` (`src/components/forms/hooks/use-managed-form.ts:64`), schemat Zod
  w rodzeństwie `*-schema.ts`, `DecimalField` na cenę i stawki, `persistDraft: false` w wariancie
  edycji (`recipient-list-form.tsx:51` tłumaczy dlaczego).
- Gotowce do kolumny j.m.: `UNIT_SUGGESTIONS` / `DEFAULT_UNIT` (`src/lib/kosztorys/constants.ts:45`)
  i wzorzec tworzącego `Combobox` z `editor/grid/cells/unit-column.tsx:12`.

### 7. Raport „porównaj z cennikiem" — wzorzec 1:1

Ścieżka do skopiowania to **„Porównaj z arkuszem"**, czteroczęściowa:

1. Pozycja menu + jej hook w jednym pliku pod `editor/actions/` —
   `src/components/kosztorys/editor/actions/sheet-compare-action.tsx` (`useSheetCompareAction()`
   zwraca `{ open, setOpen, result, error, loaded, read, requestOpen }` + `SheetCompareMenuItem`).
   Dialog jest **rodzeństwem** menu, nigdy dzieckiem (`DropdownMenuContent` odmontowuje dzieci).
2. Stan mieszka w `KosztorysActionsProvider`
   (`editor/actions/kosztorys-actions-context.tsx`) — jawnie **nie** w `KosztorysEditorProvider`
   (regresja wydajnościowa EX-496).
3. **Pobieranie na klik, nie na otwarcie** — programowo otwarty dialog Radiksa nie odpala
   `onOpenChange`, więc nie potrafi sam się zaciągnąć.
4. Rama: `SheetReportDialog<DataT>` (`dialogs/sheet-report-dialog.tsx`) + `SheetReportBlock`
   (`{title, status:'ok'|'warn', verdict}`) + prymitywy z `sheet-report-parts.tsx`
   (`ComparisonTable`, `ComparisonRow`, `ItemList`, `ReportFold`) + odmiana liczby mnogiej
   w `sheet-report-words.ts`.

Cała logika jest **czysta i wyjęta z dialogu**: `src/lib/kosztorys/sheet-import/build-sheet-comparison.ts:172`
zwraca `{ ok: true; comparison } | { ok: false; problems: string[] }` — i już liczy nasz trójpodział:
`onlyInSheet` / `onlyInApp` oraz `rates.stale`, gdzie porównuje `subcontractorPrice(asPlanePricing(...), plane)`
z ceną z cennika przez `MONEY_TOLERANCE` i **pomija** pozycje o statusie `missing`/`conflict` zamiast
raportować je jako 0 zł (`:248-269`). Zdania werdyktu wyprowadzone do osobnego czystego modułu
(`dialogs/sheet-rates-verdict.ts`).

Dom testów: `src/__tests__/lib/kosztorys/sheet-import/build-sheet-comparison.test.ts` + fikstury
`src/__tests__/fixtures/kosztorys-sheet/`. Same dialogi nie mają testów — wzorzec brzmi: wypchnij
każdą decyzję do czystego modułu i testuj moduł.

### 8. Cennik z arkusza jako późniejsze zasilenie — kształt wiersza

`src/lib/kosztorys/sheet-import/resolve-rates.ts:5` — `RateRowT`: `description`, `wToolsRate`,
`ownToolsRate` + metadane wyprowadzone z formuł (`*Typed`, `*TracksPrice`). Zakładki wykrywane po
prefiksie „zakres pracy" (`read-sheet.ts:5`); **obie zakładki niosą obie kolumny cen**.

Dwa fakty ograniczające ewentualny import do katalogu:

- **W zakładce cennika NIE MA kolumny j.m. ani ceny klienta** — j.m. i „Cena j.m." pochodzą
  z `kosztorys_robocizny` i są doklejane po `fold(description)` + numerze wystąpienia
  (`resolve-rates.ts:290`).
- Przy rozjeździe między zakładkami albo arytmetycznej niemożliwości (`ownToolsRate > wToolsRate`)
  wiersz kończy jako `kind: 'conflict'` — **0 zł i bez zwycięzcy**, do arbitrażu przez właściciela
  (`:150`). Automatycznego rozstrzygania nie ma i było świadomie odrzucone (2026-08-19).

## Architecture Insights

- **Migawka, nie referencja** — to jest zasada przewodnia całego kosztorysu (szablony, wersje,
  import). Katalog musi ją uszanować: cena kopiowana przy wstawieniu, brak klucza obcego wstecz.
- **Czysty moduł + głupi dialog** — każda decyzja logiczna wychodzi do `src/lib/kosztorys/`, bo repo
  nie ma renderera hooków i testuje wyłącznie czyste moduły.
- **Klient wysyła id, serwer rozstrzyga wartości** — konsekwentnie w całej rodzinie akcji szablonów.
- **Klucz naturalny jako arbiter** — `ON CONFLICT` zamiast wcześniejszego SELECT-a (wyścigi),
  i to samo podejście pasuje do „nowa czy aktualizuj" przy zapisie do cennika.

## Open Questions — rozstrzygnięte przez właściciela (2026-08-31)

1. **Wstawianie z katalogu dokleja na KONIEC sekcji** (`MAX(display_order)+1`), nie w wybrane
   miejsce. Usuwa to potrzebę `resolveInsertSlot` i przesuwania ogona o N — czyli najgroźniejszą
   pułapkę z sekcji 3.
2. **Przekroczenie 80% ceny klienta przez zamrożoną stawkę: wstawić i ostrzec**, nie odmawiać.
   `checkSubcontractorPrice` zwraca gotowy komunikat — idzie jako ostrzeżenie po wstawieniu, a nie
   jako blokada.
3. **Ekran katalogu ma pełną trójkę: dodawanie, edycję i usuwanie.** Czyli precedensem jest
   `/kosztorysy` (jedyny globalny ekran z usuwaniem), nie `/flota` ani `/pracownicy`.
4. Próg podobieństwa dla podpowiedzi w raporcie — **decyzja implementacyjna**, dobierana empirycznie
   na prawdziwych opisach z lokalnej bazy. Podpowiedź jest wyłącznie wyświetlana i niczego nie
   zapisuje, więc koszt błędnego progu to sugestia, nie zły zapis.
5. **Jednorazowe zasilenie katalogu z istniejących szablonów wchodzi w TĘ zmianę** — z dedupem po
   kluczu. Zdejmuje to jedyny realny minus wariantu A (pusty start) i daje dokładnie ten zbiór, który
   pokazałby wariant B.
