# „Problemy": ta sama praca wyceniona różnie — plan wdrożenia

## Overview

Kosztorys potrafi wyceniać tę samą pracę różnie w różnych sekcjach („Dwukrotne gruntowanie…" po
10 zł w Łazience 1 i po 7 zł w Łazience 2), a edytor nie mówi o tym ani słowa. Dokładamy jedną
diagnostykę do „Problemy", która takie pozycje zapala i zawęża do nich grid. Wyłącznie widoczność —
nic nie blokujemy, niczego nie poprawiamy za właściciela.

## Current State Analysis

Rejestr `ROW_CONDITIONS` (`src/lib/kosztorys/row-conditions.ts`) sądzi **jeden wiersz**:
`matches(row, ctx)`. Fakt spoza wiersza wchodzi przez `RowConditionCtxT` — dziś ma dwa pola,
`stages` i `hasSettledMaterial`, przy czym to drugie jest dokładnym precedensem: fakt o inwestycji,
liczony piętro wyżej, **wymagany** w typie właśnie po to, żeby host nie mógł go po cichu pominąć
i uśpić diagnostyki.

Klucz grupujący jest już napisany i przetestowany: `catalogueKey(description, unit)`
(`src/lib/kosztorys/work-catalogue/catalogue-key.ts`) zdejmuje sekcję i numer wystąpienia, a przez
`foldUnit` składa `m²` do `m2` — czyli para z przykładu właściciela wpada do jednej grupy.

Ctx budowany jest w sześciu miejscach: cztery razy w `use-kosztorys-editor.ts` (liczniki problemów,
`documentRows` pod podglądem klienta, `foldableSectionIds`, `buildViewRows`) i raz w `row-view.ts`;
`kosztorys-editor-body.tsx` podaje tylko `hasSettledMaterial` do huka. Testy budują ctx literalnie
w siedmiu miejscach w pięciu plikach.

### Key Discoveries:

- `RowConditionCtxT` — `src/lib/kosztorys/row-conditions.ts:9`; komentarz przy `hasSettledMaterial`
  uzasadnia, dlaczego pole ma być wymagane, a nie opcjonalne.
- `countMatching` (`row-conditions.ts:560`) liczy **pozycje**, jednym przejściem na regułę, po całym
  zbiorze — nigdy po tym, co przetrwało filtr.
- `problem-conditions.ts:19` składa listę „Problemy" automatycznie z `kind === 'diagnostic'`; wpis
  z `problemLabel` ląduje na końcu listy, wpis bez niego zostaje w zwięzłym bloku na górze.
- Etykiety w rejestrze to bez wyjątku frazy przyimkowe („bez przedmiaru", „ze zbyt wysoką stawką…"),
  bo ta sama etykieta czytana jest po „Pozycje " i po „Brak pozycji ".
- `catalogueKey` przyjmuje `description: string`, a `KosztorysV2RowT.description` jest `string | null`
  (`types.ts:35`).
- `rowConditionCounts` (`use-kosztorys-editor.ts:397`) przemiata cały zbiór raz na regułę przy każdej
  zmianie `rows`, a kosztorys bywa 1000+ pozycji.

## Rozstrzygnięcia podjęte bez pytania

Trzy rzeczy wynikają z reguł już zapisanych w tym kodzie, więc rozstrzygam je tu, a nie pytaniem:

1. **Pozycja bez ceny j.m. nie wchodzi do porównania.** Nie dlatego, że rejestr trzyma
   rozłączność liczników — nie trzyma jej i nigdy nie trzymał (np. „bez ceny j.m. z wykonaną pracą"
   i „z wykonaną pracą bez przedmiaru" potrafią zapalić się na tej samej pozycji). Powód jest
   węższy: sam szew „Cena j.m." ma już dwie własne diagnostyki na brak ceny, więc trzecia
   zgłaszałaby tę samą pozycję za to samo. Do grupy wchodzą wyłącznie ceny dodatnie.
2. **Pozycja z pustym opisem nigdy nie grupuje.** Dwie puste pozycje to nie „ta sama praca";
   `foldDescription('')` zwraca `''` i skleiłoby je w jedną grupę.
3. **Grupujemy po całym kosztorysie, nie w obrębie sekcji.** `catalogueKey` z założenia zdejmuje
   sekcję, a przykład właściciela to rozjazd Łazienka 1 ↔ Kuchnia — grupowanie sekcjami nie
   zobaczyłoby go w ogóle.

## Desired End State

W „Problemy" pojawia się wiersz „Pozycje z inną ceną j.m. niż ta sama praca gdzie indziej (9)",
znika przy zerze, a kliknięty zawęża grid do tych pozycji i odsłania kolumnę „Cena j.m.", nawet
jeśli picker kolumn ją odklikał. Ton „do przejrzenia", nie „zepsute". Pod podglądem klienta licznik
jest zerowy jak każda inna diagnostyka.

## What We're NOT Doing

- Nie dotykamy rabatu — ta diagnostyka sądzi „Cena j.m.". (EX-761 zostawia to jako osobne pytanie.)
- Nie sądzimy stawek wykonawcy; one wywodzą się z ceny j.m. i mają własne diagnostyki.
- Nie liczymy grup — licznik to pozycje.
- Nie poprawiamy niczego za właściciela: żadnego „wyrównaj ceny", żadnego wpisu do katalogu.
- Nie zmieniamy wsadu katalogu ani jego cichej reguły „wygrywa wartość najczęstsza".
- Bez migracji, bez nowej kolumny w gridzie, bez zmian w bazie.

## Implementation Approach

Czysta funkcja liczy grupy raz i zwraca `Set<number>` id pozycji w rozjeździe; `matches` zostaje
jednowierszowe i O(1). Funkcja mieszka w `src/lib/kosztorys/`, czyli warstwę dalej niż huk — jest
React-free, więc testuje się bez renderera, zgodnie z podziałem opisanym w AGENTS.md.

---

## Phase 1: Funkcja grupująca

### Overview

Sama reguła „ta sama praca, różne ceny" jako czysta funkcja, z testem napisanym przed nią.

### Changes Required:

#### 1. Nowy moduł

**File**: `src/lib/kosztorys/price-divergence.ts`

**Intent**: Jedno przejście po pozycjach grupuje je po `catalogueKey`, zbiera dodatnie ceny j.m.
w grupie i zwraca id tych pozycji, których grupa ma więcej niż jedną odrębną cenę. Pozycje bez
dodatniej ceny i bez opisu nie wchodzą do żadnej grupy.

**Contract**: `export function divergentPriceRowIds(rows: KosztorysV2RowT[]): Set<number>`.
Zwracany zbiór jest pusty, gdy nic się nie rozjeżdża — huk wstawia go do ctx bez dalszej obróbki.

#### 2. Spec

**File**: `src/__tests__/lib/kosztorys/price-divergence.test.ts`

**Intent**: Przypadki: rozjazd między sekcjami zwraca **wszystkie** pozycje grupy (nie tylko
odstające); zgodna grupa zwraca pusto; `m2` i `m²` to jedna grupa (przypadek z EX-761); ta sama
nazwa przy różnej j.m. to dwie grupy i żadnego rozjazdu; pozycja z ceną 0 nie tworzy rozjazdu
z pozycją po 10 zł; dwie pozycje z pustym opisem i różnymi cenami nie tworzą grupy; pojedyncza
pozycja nigdy.

**Contract**: fixture w kształcie `KosztorysV2RowT` jak w istniejących specach kosztorysowych.

### Success Criteria:

#### Automated Verification:

- Spec grupowania przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/price-divergence.test.ts`

#### Manual Verification:

- (brak — faza czysto obliczeniowa, weryfikowana w fazie 2)

---

## Phase 2: Wpięcie do „Problemy"

### Overview

Fakt wchodzi do kontekstu reguł, rejestr dostaje jeden wpis, hosty przekazują policzony zbiór.

### Changes Required:

#### 1. Kontekst i rejestr

**File**: `src/lib/kosztorys/row-conditions.ts`

**Intent**: `RowConditionCtxT` dostaje drugie pole spoza wiersza — zbiór id pozycji w rozjeździe —
wymagane z tego samego powodu co `hasSettledMaterial`: diagnostyka, która cicho nie zapala się przez
przeoczenie hosta, jest gorsza niż jej brak. Do rejestru dochodzi jeden `kind: 'diagnostic'`.

**Contract**: pole `divergentPriceRowIds: ReadonlySet<number>`; wpis `id: 'divergent-client-price'`,
`label: 'z inną ceną j.m. niż ta sama praca gdzie indziej'` (fraza przyimkowa, bo czyta się i po
„Pozycje ", i po „Brak pozycji "), `tone: 'worklist'`, `sectionLabel: null` (zwinięcie sekcji po
rozjeździe cen chowałoby wycenę — ten sam błąd, który „Zwiń puste sekcje" miało z sekcjami bez ceny),
`revealsColumns: ['price']`, `matches: (row, ctx) => ctx.divergentPriceRowIds.has(row.id)`.
Bez `problemLabel` — fraza czyta się jako zwykły wiersz listy i zostaje w zwięzłym bloku.

#### 2. Hosty kontekstu

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Zbiór liczony raz, w `useMemo` po `rows`, i podawany do wszystkich czterech miejsc
budujących ctx. Liczony **poza** `matches`, inaczej każdy licznik przemiatałby grupy od nowa.

**Contract**: nowy memo obok `rowConditionCounts`; `divergentPriceRowIds` dochodzi do czterech
literałów ctx i do ich tablic zależności.

**File**: `src/lib/kosztorys/row-view.ts`

**Intent**: `buildViewRows` przyjmuje ten sam fakt i podaje go dalej do `applyRowConditions`.

**Contract**: pole w typie `input` i w literale ctx.

#### 3. Istniejące testy

**File**: `src/__tests__/lib/kosztorys/{row-conditions,row-view,client-document-subtotals,kosztorys-empty-sections,measure-discrepancy}.test.ts`

**Intent**: Dopisanie nowego pola do siedmiu literałów ctx — bez decyzji, `tsc` wskaże listę.

**Contract**: `divergentPriceRowIds: new Set()` tam, gdzie spec nie bada tej reguły.

#### 4. Case'y reguły

**File**: `src/__tests__/lib/kosztorys/row-conditions.test.ts`

**Intent**: Że reguła zapala się dokładnie na pozycjach ze zbioru, że `countMatching` liczy pozycje,
i że przy pustym zbiorze nie zapala się na niczym.

**Contract**: doklejone do istniejącej struktury `describe` w tym specu.

### Success Criteria:

#### Automated Verification:

- Spec rejestru przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts`
- Spec widoku przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-view.test.ts`

#### Manual Verification:

- Na wzorze (inwestycja 90) „Problemy" pokazuje wiersz „Pozycje z inną ceną j.m. niż ta sama praca gdzie indziej" z licznikiem, a kliknięcie zawęża grid do pozycji „Dwukrotne gruntowanie…" ze wszystkich sekcji naraz
- Kolumna „Cena j.m." pokazuje się po kliknięciu problemu nawet przy odklikanej w pickerze kolumn, i wraca do stanu użytkownika po odkliknięciu problemu
- Na kosztorysie bez rozjazdów wiersz w ogóle się nie renderuje
- Pod podglądem klienta wiersz nie występuje

---

## Testing Strategy

### Unit Tests:

- Grupowanie: rozjazd, zgodność, warianty j.m., cena 0, pusty opis, singleton.
- Rejestr: `matches` i `countMatching` na przygotowanym zbiorze.

### Manual Testing Steps:

1. Otwórz kosztorys inwestycji 90, rozwiń „Problemy", sprawdź licznik.
2. Kliknij problem — grid ma pokazać „Dwukrotne gruntowanie…" z Łazienki 1, 2, 3, WC i Kuchni.
3. Odklik „Cena j.m." w pickerze kolumn przed kliknięciem problemu — kolumna ma się i tak pokazać.
4. Przełącz na podgląd klienta — problem ma zniknąć.

## Performance Considerations

Jedno dodatkowe przejście po pozycjach na zmianę `rows`, memoizowane — taniej niż którykolwiek
z ~16 przebiegów, które `rowConditionCounts` i tak robi. Warunek: grupowanie **nie może** trafić
do `matches`, bo licznik wywołuje `matches` raz na pozycję i koszt zrobiłby się kwadratowy.

## Migration Notes

Brak — reguła czyta pola, które już są w gridzie.

## Whole-tree Gate

- Typy: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy: `pnpm test`

## References

- EX-761 — https://linear.app/ex-plant/issue/EX-761
- Precedens faktu spoza wiersza: `src/lib/kosztorys/row-conditions.ts:9`
- Klucz grupujący: `src/lib/kosztorys/work-catalogue/catalogue-key.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Funkcja grupująca

#### Automated

- [x] 1.1 Spec grupowania przechodzi — 5f08a608

### Phase 2: Wpięcie do „Problemy"

#### Automated

- [x] 2.1 Spec rejestru przechodzi — 844e2ccc
- [x] 2.2 Spec widoku przechodzi — 844e2ccc
