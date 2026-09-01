# Źródło ceny wykonawcy tylko z dwiema opcjami — plan wdrożenia

## Overview

Wycinamy trzeci tryb stawki wykonawcy — „własny mnożnik". Zostają dwa: `auto` (stawka z mnożnika
inwestycji) i `kwota stała`. Kolumna „Źródło ceny wykonawcy" zostaje, bo to ona nazywa powrót na
auto; kolumna „Mnożnik" znika, bo po cięciu pokazywałaby jedną powtórzoną stałą.

## Current State Analysis

- Stawka wykonawcy na każdym planie to para pól: typ nadpisania (`w_tools_override_type` /
  `own_tools_override_type`, zwykły `varchar`, NIE typ wyliczeniowy) i wartość
  (`*_override_value`). Typ ma dziś trzy stany: `null` (auto), `'coeff'`, `'amount'`.
- Wycena rozstrzyga je w `src/lib/kosztorys/calc.ts:105` (`subcontractorPrice`) i drugi raz,
  w SQL, w `src/lib/db/kosztorys-subcontractor-due.ts:42`.
- Siatka ma trzy kolumny na plan (`PLANE_PRICE_BASE_KEYS` w `src/lib/kosztorys/plane-price-keys.ts:10`):
  „Źródło", „Mnożnik", „Cena j.m.". Każdy widok składa oba plany, czyli sześć kolumn.
- **Zero wierszy na własnym mnożniku**: 5344 pozycje w lokalnej bazie (kopia produkcji +
  zaimportowane rozpiski) rozkładają się wyłącznie na `amount` i `null`. Jedyny zapisany szablon
  rozpiski też go nie zawiera. Produkcja nie ma ani jednej pozycji kosztorysu.
- Katalog prac już żyje z dwoma stanami — jego tabela trzyma stawkę albo `NULL`.
- `impliedCatalogueRate` (`work-catalogue/catalogue-rate.ts`) pyta tylko „czy jest własne
  nadpisanie", więc jest ślepy na tryb i zmiany nie wymaga.

### Key Discoveries:

- `PLANE_PRICE_BASE_KEYS` to jeden dom całej trójki kolumn — skreślenie `priceCoeff` przenosi się
  samo na ujawnianie kolumn przy diagnostyce wiersza (`row-conditions.ts:74` mapuje po tej stałej),
  na sortowanie i na picker kolumn. Nie ma sześciu miejsc do ręcznej synchronizacji.
- `sanitizeClientViewVariant` (`client-view-settings.ts:78`) filtruje zapisane ukryte kolumny po
  znanym zbiorze, więc stary klucz `priceCoeff__*` w zapisanych ustawieniach klienta wypada sam.
  Kolumn `priceMode`/`priceCoeff` nigdy nie było na liście dopuszczonej dla klienta.
- Kolejność faz jest wymuszona przez typ: dopóki siatka podaje `'coeff'` do polityki edycji, nie da
  się zawęzić unii. Dlatego najpierw znika UI, na końcu typ i wycena.
- Import z arkusza **musi zachować rozpoznawanie formuły** (`tracksClientPrice`). Odróżnia stawkę
  liczoną z „Cena j.m." od wklepanej ręcznie, która przypadkiem wychodzi na ten sam mnożnik. Tylko
  formuła może iść na auto; decydowanie samym ilorazem wysłałoby ręcznie wpisaną stawkę na auto
  i kazałoby jej się ruszać przy każdej zmianie ceny klienta.

## Desired End State

„Źródło ceny wykonawcy" ma w liście dwie pozycje: `auto` i `kwota stała`. Kolumny „Mnożnik" nie ma
w żadnym widoku ani w pickerze kolumn. Cztery kolumny ceny wykonawcy zamiast sześciu. Wartość
nadpisania ma jedno znaczenie — kwotę — więc przełączenie źródła niczego nie przelicza: auto to po
prostu brak wartości. Import z arkusza mapuje stawkę na auto (gdy iloraz równy mnożnikowi cennika)
albo na kwotę stałą wprost z arkusza.

## What We're NOT Doing

- **Żadnej migracji.** Wierszy na własnym mnożniku nie ma w bazie, a dane kosztorysu są jednorazowe
  (AGENTS.md — produkcja trzyma zero pozycji). Świadoma decyzja właściciela: gdyby czyjaś lokalna
  baza takie wiersze miała, po cięciu przeskoczą na mnożnik inwestycji.
- Nie ruszamy kolumny „Cena j.m." wykonawcy ani pułapu 80% — reguła dotyczy ceny i działa tak samo.
- Nie zmieniamy kontrolki na przełącznik — lista zostaje listą, tylko krótszą.
- Nie przepisujemy czterech commitów z sześcioma kolumnami; cięcie idzie na wierzchu tej samej gałęzi.
- Nie dotykamy mnożników inwestycji ani ustawień rozliczenia — mnożnik globalny zostaje bez zmian.

## Implementation Approach

Cięcie od wierzchu w dół, żeby drzewo kompilowało się po każdej fazie: najpierw siatka przestaje
produkować i pokazywać własny mnożnik, potem import, na końcu zawęża się typ, wycena i SQL — kiedy
już nikt tej wartości nie podaje.

---

## Phase 1: Siatka — „Mnożnik" znika, lista ma dwie pozycje, widok inwestora traci źródło

### Overview

Usunięcie kolumny „Mnożnik" ze wszystkich widoków, trzeciej opcji z listy źródła i kolumn źródła
z widoku inwestora. Typ nadal dopuszcza `'coeff'` — po tej fazie po prostu nikt go nie wytwarza.

### Changes Required:

#### 1. Namespace kluczy kolumn

**File**: `src/lib/kosztorys/plane-price-keys.ts`

**Intent**: Rodziny kolumn ceny wykonawcy schodzą z trzech do dwóch, co jest źródłem prawdy dla
składania kolumn, sortowania, pickera i ujawniania kolumn przy diagnostyce wiersza.

**Contract**: `PLANE_PRICE_BASE_KEYS = ['priceMode', 'price']`. Komentarz nad stałą mówi dziś
„trzy rodziny" — do poprawienia razem z wartością.

#### 2. Komórki i kolumny wykonawcy

**File**: `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx`

**Intent**: Kasujemy komórkę mnożnika i jej fabrykę kolumny; lista źródła traci pozycję „własny
mnożnik". Polityka edycji ceny przestaje być parametryzowana trybem — zostaje jeden.

**Contract**: znikają `SubcontractorCoeffCell` i `subcontractorCoeffColumn`; `SUB_MODE_OPTIONS` ma
dwa wpisy (`''` → „auto", `'amount'` → „kwota stała"). Wywołania `subcontractorPolicy(view, 'coeff')`
znikają razem z komórką.

#### 3. Składanie kolumn siatki

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:288`

**Intent**: Zdjęcie kolumny mnożnika z listy składanej per plan **oraz** kolumn „Źródło ceny
wykonawcy" z widoku inwestora. Źródło jest sterownikiem edycji, nie figurą do porównania — w widoku,
w którym czyta się ofertę, nie ma czego nim ustawiać. Zostają tam wyłącznie „Cena j.m. netto"
obu planów plus własna cena klienta.

**Contract**: `subcontractorPriceCols` składa parę kolumn na plan (źródło + cena) w widokach
wykonawcy i samą cenę na plan w widoku `client`. Własna cena klienta (`price`) bez zmian.
Komentarz nad `assembleV2Columns` mówi dziś o „trzech fabrykach" i o tym, że dopuszczalnik podglądu
klienta jest „jedyną pozostałą połową zamka" — po tej zmianie źródło znów nie składa się na planie
klienta, więc dla niego stoją obie połowy; sama cena nadal wisi na dopuszczalniku.

#### 3a. Komentarz o dopuszczalniku podglądu klienta

**File**: `src/lib/kosztorys/column-config.ts:168`

**Intent**: Komentarz twierdzi, że źródło i mnożnik „nigdy nie składają się na planie klienta" —
dziś to nieprawda, po fazie 1 znów prawda dla źródła (mnożnika nie ma wcale). Do przepisania na
stan faktyczny, żeby nie czytało się jak przeoczony wyjątek.

**Contract**: tylko komentarz.

#### 4. Etykiety i podpowiedzi nagłówków

**Files**: `src/lib/kosztorys/column-config.ts:28`, `src/lib/kosztorys/header-tips.ts:19`

**Intent**: Usunięcie wpisu „Mnożnik" z mapy etykiet i jego podpowiedzi. Podpowiedź dla „Źródło"
zostaje, bo nadal wyjaśnia, co znaczy auto.

**Contract**: klucz `priceCoeff` znika z obu map. Komentarz w `column-config.ts:168` wymienia
`priceMode`/`priceCoeff` — do przycięcia do samego `priceMode`.

#### 5. Sortowanie

**File**: `src/lib/kosztorys/sort-value.ts`

**Intent**: Klucz sortowania mnożnika znika razem z kolumną; ranking źródeł schodzi do dwóch stopni.

**Contract**: `viewCoeffSortValue` usunięta wraz z gałęzią `base === 'priceCoeff'`;
`PRICE_MODE_RANK` bez wpisu `coeff`.

#### 6. Ujawnianie kolumn przy diagnostyce wiersza

**File**: `src/lib/kosztorys/row-conditions.ts:66`

**Intent**: Sam kod jedzie po `PLANE_PRICE_BASE_KEYS`, więc działa bez zmian — poprawiamy komentarz,
który obiecuje ujawnienie „Mnożnika" i mówi o „trzech" kolumnach planu.

**Contract**: tylko komentarz; `priceColumnsFor` bez zmian.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/plane-price-columns.test.ts` — asercje na sześć kolumn przepisane na cztery w widokach wykonawcy i dwie w widoku inwestora; picker widoku inwestora nie oferuje wpisów źródła
- `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts` — przypadki mnożnika usunięte, ranking źródeł na dwóch stopniach
- `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts` — ujawnianie odsłania dwie kolumny planu zamiast trzech
- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`

#### Manual Verification:

- Lista „Źródło ceny wykonawcy" ma dokładnie dwie pozycje w obu widokach wykonawcy
- Kolumny „Mnożnik" nie ma ani w siatce, ani na liście kolumn do pokazania/ukrycia
- W widoku inwestora są tylko „Cena j.m. netto — z narzędziami" i „— bez narzędzi"; kolumn „Źródło
  ceny wykonawcy" nie ma tam ani w siatce, ani na liście kolumn
- Wyczyszczenie „Cena j.m." wykonawcy wraca na auto, a cena renderuje się kursywą i wyszarzona
- Diagnostyka „ze stawką wykonawcy wpisaną ręcznie" ujawnia „Źródło" i „Cena j.m.", i nic poza tym

---

## Phase 2: Import z arkusza — auto albo kwota stała

### Overview

Stawka będąca w arkuszu formułą z „Cena j.m." trafia na auto tylko wtedy, gdy jej iloraz równa się
mnożnikowi cennika. Każdy inny iloraz ląduje jako kwota stała wprost z arkusza.

### Changes Required:

#### 1. Wyprowadzanie nadpisania z arkusza

**File**: `src/lib/kosztorys/sheet-import/derive-override.ts`

**Intent**: Gałąź własnego mnożnika zamienia się na kwotę stałą o wartości równej stawce
z arkusza — nie ilorazowi. Rozpoznawanie formuły (`tracksClientPrice`) i wykrywanie mnożnika
cennika (`planeCoeff`) zostają nietknięte: decydują teraz auto-czy-kwota.

**Contract**: przy `tracksClientPrice && clientPrice > 0` iloraz równy `planeCoeff` daje
`{ type: null, value: 0 }`, każdy inny `{ type: 'amount', value: rate }`. Komentarz nad funkcją
opisuje dziś trzy wyjścia — do przepisania na dwa, z zachowaniem uzasadnienia, po co jest
`tracksClientPrice`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/build-import-plan.test.ts` — przypadek „stawka z formuły o innym mnożniku" oczekuje kwoty stałej równej stawce z arkusza
- `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/build-sheet-comparison.test.ts`

#### Manual Verification:

- Import wypełnionego arkusza testowego kończy się bez pozycji na własnym mnożniku, a stawki
  wykonawcy zgadzają się co do grosza z arkuszem

---

## Phase 3: Typ, wycena i SQL — zawężenie unii

### Overview

Kiedy nikt już nie produkuje własnego mnożnika, unia schodzi do jednej wartości plus `null`,
a obie wyceny (TypeScript i SQL) tracą swoją gałąź.

### Changes Required:

#### 1. Typ nadpisania

**File**: `src/lib/kosztorys/types.ts:24`

**Intent**: Unia zawężona do kwoty stałej; komentarz opisuje dwa stany zamiast trzech.

**Contract**: `SubcontractorOverrideTypeT = 'amount'`. Pola pozostają `| null` — `null` nadal
znaczy auto.

#### 2. Wycena

**File**: `src/lib/kosztorys/calc.ts:105`

**Intent**: `subcontractorPrice` traci gałąź mnożnika: kwota stała zwraca wartość, brak nadpisania
liczy z mnożnika inwestycji.

**Contract**: dwie ścieżki zamiast trzech; `effectiveCoeff` i `overrideTypeFor` bez zmian.

#### 3. Wycena po stronie SQL

**File**: `src/lib/db/kosztorys-subcontractor-due.ts:42`

**Intent**: `CASE` w zapytaniu o należność wykonawcy traci gałąź `'coeff'` na obu planach.

**Contract**: `WHEN 'amount'` + `ELSE` liczące z mnożnika; komentarz nad zapytaniem streszcza dziś
trzy gałęzie wyceny — do przepisania.

#### 4. Walidacja akcji i odczyt do katalogu

**Files**: `src/lib/actions/kosztorys.ts:45`, `src/lib/db/work-catalogue.ts:121`

**Intent**: Schemat akcji przyjmuje tylko kwotę stałą; mapper odczytu pozycji do katalogu przepuszcza
tylko tę wartość, każdą inną (w tym zastany `'coeff'`) czyta jako brak nadpisania.

**Contract**: `z.enum(['amount'])`; `value === 'amount' ? value : null`.

#### 5. Polityka edycji i przełączanie źródła

**File**: `src/lib/kosztorys/subcontractor-price-edit.ts`

**Intent**: Polityka przestaje przyjmować tryb — zostaje jeden. Przełączenie na kwotę stałą nadal
zasiewa wartość ceną, którą wiersz pokazuje; auto nadal ją zdejmuje. Znika przeliczanie między
znaczeniami wartości, bo znaczenie jest teraz jedno.

**Contract**: `subcontractorPolicy(view)` bez parametru trybu; `modeChange` z dwiema gałęziami.
Komentarze opisujące pułapkę wspólnego pola wartości („200 zł jako mnożnik 200") do przepisania —
opisują stan, którego już nie ma.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-calc.test.ts src/__tests__/lib/kosztorys/subcontractor-price-edit.test.ts src/__tests__/lib/kosztorys/subcontractor-due-by-plane.test.ts`
- `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/ src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts src/__tests__/lib/kosztorys/append-preset-sections.test.ts` — przypadki oparte na własnym mnożniku przepisane na kwotę stałą albo usunięte, gdy istniały wyłącznie po to
- Specy DB @ 5435: `pnpm exec vitest run src/__tests__/lib/db/kosztorys-subcontractor-due.test.ts` — pokrycie po gałęziach wyceny bez gałęzi mnożnika
- `grep -rn "'coeff'" src --include='*.ts' --include='*.tsx'` zwraca zero trafień

#### Manual Verification:

- Należność wykonawcy w podsumowaniu zgadza się z sumą kolumny „Cena j.m." wykonawcy razy ilości,
  na obu planach (dwie wyceny, TypeScript i SQL, muszą dawać tę samą liczbę)
- Zapis pozycji do katalogu prac: pozycja na auto ląduje jako „auto", pozycja z kwotą jako kwota

---

## Phase 4: Dokumentacja

### Overview

Notatki domenowe opisują trzy tryby stawki wykonawcy — po cięciu byłyby nieprawdą.

### Changes Required:

#### 1. Notatki domenowe kosztorysu

**File**: `context/reference/kosztorys-editor-domain-notes.md`

**Intent**: Opis stawki wykonawcy zredukowany do dwóch źródeł, z jednozdaniowym zapisem, dlaczego
trzeci wypadł (zero wierszy, katalog prac nigdy go nie miał).

**Contract**: sekcja o stawkach wykonawcy; reszta dokumentu bez zmian.

### Success Criteria:

#### Automated Verification:

- Faza czysto prozatorska — brak automatycznej weryfikacji specyficznej dla tej fazy

#### Manual Verification:

- `grep -rin "mnożnik" context/reference/kosztorys-editor-domain-notes.md` nie zostawia zdania
  obiecującego per-pozycyjny mnożnik

---

## Testing Strategy

### Unit Tests:

- Wycena po gałęziach: kwota stała i brak nadpisania, na obu planach (`kosztorys-calc`)
- Przełączanie źródła: auto → kwota zasiewa cenę wiersza, kwota → auto zdejmuje wartość
  (`subcontractor-price-edit`)
- Import: iloraz równy mnożnikowi cennika → auto; inny iloraz → kwota stała **równa stawce
  z arkusza, nie ilorazowi**; stawka wklepana ręcznie nigdy nie idzie na auto (`build-import-plan`)
- Sortowanie po źródle na dwóch stopniach (`kosztorys-sort-value`)
- Cztery kolumny ceny wykonawcy zamiast sześciu (`plane-price-columns`)

### Integration Tests:

- Należność wykonawcy liczona w SQL po obu planach, gałęzie kwoty stałej i braku nadpisania
  (`kosztorys-subcontractor-due`, @ 5435)

### Manual Testing Steps:

1. Otworzyć rozpiskę w widoku „z narzędziami": policzyć kolumny ceny wykonawcy — mają być cztery
2. Wpisać kwotę w „Cena j.m." wykonawcy, sprawdzić że źródło samo pokazuje „kwota stała"
3. Wyczyścić tę komórkę, sprawdzić powrót na auto i cenę z mnożnika inwestycji
4. Zaimportować wypełniony arkusz testowy i porównać stawki wykonawcy z arkuszem
5. Zapisać pozycję do katalogu prac z każdego z dwóch źródeł

## Migration Notes

Świadomie bez migracji (decyzja właściciela, 2026-09-01). Wierszy na własnym mnożniku nie ma
w żadnej bazie, a dane kosztorysu są jednorazowe. Skutek uboczny do zapamiętania: gdyby taki wiersz
gdzieś istniał, po cięciu policzy się z mnożnika inwestycji zamiast z własnego — bez śladu.
Kolumny `*_override_type` zostają w bazie jako `varchar` i nie wymagają zmiany typu.

## Whole-tree Gate

- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm exec vitest run`
- `pnpm build`

## References

- Ustalenia z rozmowy kształtującej: `context/changes/2026-09-01-kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/change.md`
- Praca, na której to leży (sześć kolumn ceny wykonawcy): `context/changes/2026-09-01-kosztorys-contractor-price-columns-in-client-view/`
- Katalog prac z dwoma stanami stawki: `context/changes/2026-08-31-katalog-prac-auto-rates/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Siatka — „Mnożnik" znika, lista ma dwie pozycje, widok inwestora traci źródło, widok inwestora traci źródło

#### Automated

- [x] 1.1 plane-price-columns.test.ts — cztery kolumny w widokach wykonawcy, dwie w widoku inwestora — 87e8b592
- [x] 1.2 kosztorys-sort-value.test.ts — ranking źródeł na dwóch stopniach — 87e8b592
- [x] 1.3 row-conditions.test.ts — ujawnianie dwóch kolumn planu — 87e8b592
- [x] 1.4 preview-columns.test.ts — 87e8b592

### Phase 2: Import z arkusza — auto albo kwota stała

#### Automated

- [x] 2.1 build-import-plan.test.ts — inny iloraz daje kwotę stałą równą stawce z arkusza — f847ae70
- [x] 2.2 build-sheet-comparison.test.ts — f847ae70

### Phase 3: Typ, wycena i SQL — zawężenie unii

#### Automated

- [x] 3.1 kosztorys-calc / subcontractor-price-edit / subcontractor-due-by-plane — 1b4e55e8
- [x] 3.2 work-catalogue / serialize-restore-roundtrip / append-preset-sections — 1b4e55e8
- [x] 3.3 kosztorys-subcontractor-due.test.ts @ 5435 — 1b4e55e8
- [x] 3.4 grep na `'coeff'` w src zwraca zero trafień — 1b4e55e8

### Phase 4: Dokumentacja

#### Automated

- [ ] 4.1 faza prozatorska — brak weryfikacji automatycznej specyficznej dla fazy
