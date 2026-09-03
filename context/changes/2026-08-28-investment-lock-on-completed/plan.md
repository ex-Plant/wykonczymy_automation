# Blokada zakończonej inwestycji — Implementation Plan

## Overview

Status `completed` przestaje być etykietą i staje się zamkiem: na zakończonej inwestycji nic nie
rusza kasy — ani transakcje, ani kosztorys. Blokada obowiązuje **wszystkie** role zarządcze,
a jedynym wyjściem jest jawna zmiana statusu, zawężona do OWNER/ADMIN.

Celem jest odcięcie ruchu na pieniądzach, **nie** zamrożenie kartoteki: dane kontaktowe inwestycji
zostają edytowalne dla każdego i zawsze.

## Current State Analysis

`completed` nie egzekwuje dziś **niczego**. Jedyne odczyty statusu to `opacity-50` na wierszu listy
(`investment-data-table.tsx:53`), filtr statusów (`status-filter.tsx:17`, `use-status-filter.ts:8`)
i plakietka (`investment-status-badge.tsx`). Żaden odczyt nie bramkuje zapisu ani nie wpływa na
figurę finansową — semantyka jest wolna do wzięcia, a nadanie jej nowego znaczenia nie zmienia
żadnego istniejącego wyliczenia.

Skala z kopii produkcyjnej: **69 inwestycji `completed`** przy 41 `active`, i **co najmniej 84
transakcje zaksięgowane już PO zakończeniu** (dominuje `PAYOUT` — 41 sztuk — i
`INVESTMENT_EXPENSE` — 22; najnowsza 2026-08-12). Pełna tabela w `research.md` §B.

Trzy płaszczyzny zapisu i to, czego każda nie łapie:

| płaszczyzna      | dlaczego nie wystarcza sama                                                   |
| ---------------- | ----------------------------------------------------------------------------- |
| Payload `access` | akcje jadą Local API z `overrideAccess: true` — `access.update` ich nie widzi |
| hooki kolekcji   | kosztorys pisze surowym SQL-em w ~12 plikach, omijając hooki                  |
| UI               | nie łapie nikogo                                                              |

Stąd asymetria, którą plan respektuje: `transactions` **nie ma ani jednego zapisu surowym SQL-em**
(wszystko przez Payload, kolekcja ma już `beforeValidate: [validateTransfer]`), więc hook jest tam
kompletną bramką. Kosztorys ma odwrotny profil, więc bramką jest wrapper akcji, a `access` kolekcji
domyka wyłącznie `/admin`.

## Desired End State

Na inwestycji ze statusem `completed`:

- żadna transakcja nie powstaje, nie jest edytowana ani anulowana — poza podpięciem/odpięciem
  faktury, które jest archiwizacją, nie zmianą figury;
- żadna pozycja, sekcja, etap ani ustawienie kosztorysu nie zmienia się — z edytora, z `/admin`
  ani przez API;
- edytor kosztorysu renderuje się **w całości** (pełne kolumny, prognozy, Podsumowanie), tylko bez
  możliwości pisania, z widocznym banerem;
- inwestycja znika z pickera w formularzu wydatku i wpłaty;
- dane kontaktowe inwestycji dalej edytuje każda rola zarządcza;
- wyjście ze statusu `completed` wykonuje wyłącznie OWNER/ADMIN, za potwierdzeniem.

Weryfikacja: testy integracyjne wołające akcje jako każda rola przeciwko zablokowanej inwestycji
(assert **odmowy serwera**, nie widoczności w UI) plus przejście ręczne opisane w fazie 5.

### Key Discoveries

- `ownerOnlyAction` (`src/lib/actions/owner-only-action.ts:16`) jest gotowym wzorcem wrappera,
  z uzasadnieniem spisanym w komentarzu: zawężenie strukturalne sprawia, że nowa akcja nie może
  zapomnieć ręcznie przepisanego `if`. **Uwaga: nie przyjmuje `revalidate`** — nowy wrapper musi je
  przekazywać, bo akcje kosztorysu z niego korzystają.
- Każda tabela kosztorysu (`kosztorys_items`, `kosztorys_sections`, `kosztorys_stages`) niesie
  `investment_id` — `not null`, zaindeksowane, FK `ON DELETE CASCADE`. Trzy lookupy już istnieją
  (`create-item.ts:12` oraz inline w `kosztorys.ts:531` i `:709`) i proszą się o jeden helper.
- `updateInvestmentAction` pisze dokładnie **osiem** kolumn (`investmentSchema`): `name`, `address`,
  `phone`, `email`, `contactPerson`, `notes`, `review`, `status`. Siedem pól finansowych na
  `investments` (`wToolsCoeff`, `ownToolsCoeff`, `vatRate`, `settlementMode`, `materialsNetRate`,
  `globalDiscountType`, `globalDiscountValue`) pisze pięć osobnych akcji kosztorysu — czyli podział
  „kartoteka wolna / finanse zablokowane" biegnie dokładnie po granicy tej samej tabeli.
- `validateTransfer` (`src/hooks/transfers/validate.ts:25`) ma **dwa wczesne `return`** —
  `type === 'CANCELLATION'` (linia ~66) i `operation === 'update' && d.cancelled` (~77). Bramka
  musi stanąć **przed** oboma, inaczej anulowanie przecieka: `cancelTransferAction` zaczyna od
  `payload.update({ data: { cancelled: true } })`, który wychodzi drugim `return`.
- `setTransferInvoices` (`transfers.ts:~330`) woła `payload.update` z `data: { invoice: next }` —
  **jedynym** kluczem. To jest sygnatura, po której hook rozpozna zapis fakturowy.
- `readOnly: preview` / `previewVisible: preview` stoi w `use-kosztorys-editor.ts:499-500`
  (research podawał 469 — kod się przesunął). Warstwa kolumn
  (`grid/kosztorys-v2-column-opts.ts:92-99`) trzyma te dwie opcje osobno i **wprost dokumentuje je
  jako ortogonalne** — „read-only is about interaction, this is about disclosure". Rozdział ginie
  dopiero warstwę wyżej.
- `editorOnly` (`use-kosztorys-editor.ts:361`, 15 wywołań) zdejmuje handlery mutujące, a komentarz
  nad nim już deklaruje właściwą zasadę: „The gate is the render mode, NOT a role".
- `kosztorys_v2/page.tsx:38` czyta już `investment` z `refData.investments`, a `InvestmentRefT`
  niesie `status` (`src/types/reference-data.ts:22`) — wpięcie `locked` nie kosztuje zapytania,
  tak samo jak odfiltrowanie pickera.
- Cztery kolekcje kosztorysu (`kosztorys-items`, `kosztorys-sections`, `kosztorys-stages`,
  `stage-progress`) mają `isAdminOrOwnerOrManager` na **całym** CRUD, a `users.ts:96` wpuszcza
  managera do `/admin` — bez bramki na `access` panel jest obejściem blokady.
- `preventDeleteWithTransactions` (`investments.ts:20`) już dziś czyni nieusuwalną każdą inwestycję
  z transakcjami.

## What We're NOT Doing

- **Nie blokujemy rekordu inwestycji.** Osiem pól kartoteki (`name`, `address`, `phone`, `email`,
  `contactPerson`, `notes`, `review`) zostaje edytowalnych dla każdej roli zarządczej, zawsze.
  `updateInvestmentAction` nie dostaje diffu pól ani reguły „tylko status".
- **Nie dodajemy śladu audytowego zmiany statusu.** Wyjście z `completed` jest zawężone do
  OWNER/ADMIN, więc ślad nie odpowiadałby na pytanie, którego właściciel nie zna. Wraca w chwili,
  w której to wyjście dostanie inna rola.
- **Nie blokujemy kasowania inwestycji** — `preventDeleteWithTransactions` już to robi wszędzie,
  gdzie jest co chronić.
- **Nie ma listy dozwolonych przejść statusu.** OWNER/ADMIN ustawia status dowolnie.
- **Nie migrujemy danych** i nie wprowadzamy drugiego znacznika — blokada działa wstecz na
  wszystkie 69 zakończonych inwestycji od pierwszego wdrożenia.
- **Nie blokujemy odczytów**: `previewKosztorysImport`, `compareWithSheet`, `previewMaterialSync`,
  `listSnapshotsAction`, `listPresetsAction`, `listPresetSectionsAction`.
- **Nie blokujemy linku klienckiego** (`kosztorys-share.ts`) ani ustawień widoku klienta
  (`kosztorys-client-view.ts`) — unieważnienie linku jest operacją bezpieczeństwa.
- **Nie blokujemy `savePresetAction`** — zapisuje szablon globalny, nie inwestycję.
- **Nie blokujemy faktur** (`addTransferInvoicesAction`, `removeTransferInvoiceAction`,
  `removeAllTransferInvoicesAction`).
- Audyt powierzchni nadużyć managera to **EX-749**, osobna praca.

## Implementation Approach

Trzy bramki serwerowe, każda dobrana do profilu zapisu swojej płaszczyzny, plus warstwa UI, która
nie jest bramką tylko uprzejmością:

1. **Kosztorys → wrapper akcji.** `investmentAction` jako bliźniak `ownerOnlyAction`; `access`
   kolekcji domyka `/admin`.
2. **Transakcje → hook kolekcji.** `validateTransfer` widzi każdy zapis, bo transakcje nie mają
   ścieżki surowego SQL-a. Akcje dokładają czytelny komunikat po polsku (hook rzuca surowy `Error`).
3. **Status → hook `beforeChange` na `investments`.** Jedyna reguła na inwestycji, i jedyna, na
   której trzyma się cała reszta.
4. **UI → rozszczepienie `preview`** na interakcję (`readOnly`) i ujawnianie (`previewVisible`),
   przywracając rozdział, który warstwa kolumn już zna.

## Critical Implementation Details

**Kolejność w `validateTransfer` jest load-bearing.** Bramka wchodzi po zdefiniowaniu `resolved()`,
a **przed** obydwoma wczesnymi `return` — inaczej anulowanie przecieka drugim z nich
(`cancelled: true`). Musi też czytać `resolved('investment')`, nie `d.investment`: PATCH jednego pola
nie niesie relacji, a wtedy zapis na zablokowanej inwestycji wyglądałby jak zapis bez inwestycji.

**Wyjątek fakturowy rozpoznajemy po kształcie zapisu, nie po fladze.** Zapis fakturowy to ten,
którego `data` nie zawiera nic poza `invoice` — dokładnie to, co wysyła `setTransferInvoices`.
Sprawdzenie na kluczach `data`, nie na wartościach, bo wartość może być pustą tablicą (usunięcie
wszystkich stron) i musi przejść.

**Hook staje się asynchroniczny.** `validateTransfer` jest dziś w pełni synchroniczny; odczyt statusu
inwestycji to jeden `SELECT` po kluczu głównym. Wykonywać go **wyłącznie** gdy `resolved('investment')`
zwróci wartość — typy bez inwestycji (`OTHER`, `REGISTER_TRANSFER`, wpłaty firmowe) nie płacą nic.

**Wrapper musi przekazywać `revalidate`.** `ownerOnlyAction` tego nie robi, bo jego akcje go nie
potrzebują; akcje kosztorysu potrzebują — pominięcie parametru cicho zabije unieważnianie cache'u
w ~28 miejscach.

## Phase 1: Fundament bramki

### Overview

Jedno miejsce, które odpowiada „czy ta inwestycja jest zablokowana", i wrapper, który zmusza akcję
do zadania tego pytania. Przy okazji konsoliduje trzy istniejące lookupy `investment_id`.

### Changes Required:

#### 1. Odczyt blokady

**File**: `src/lib/db/investment-lock.ts` (nowy)

**Intent**: Jedno źródło prawdy o tym, czy inwestycja jest zablokowana, plus resolver `investment_id`
z identyfikatora pozycji / sekcji / etapu. Trafia do `src/lib/db`, bo to instrukcja SQL plus mapper
wiersza i nic więcej — zgodnie z regułą tego katalogu.

**Contract**: `isInvestmentLocked(investmentId: number): Promise<boolean>` — `SELECT status FROM
investments WHERE id = $1`, `true` wyłącznie dla `'completed'`; brak wiersza → `false` (nieistniejąca
inwestycja to problem innej warstwy, nie blokady). Plus
`investmentIdFor(kind: 'item' | 'section' | 'stage', id: number): Promise<number | null>` —
`SELECT investment_id FROM kosztorys_<tabela> WHERE id = $1`.

#### 2. Wrapper akcji

**File**: `src/lib/actions/investment-action.ts` (nowy)

**Intent**: Bliźniak `ownerOnlyAction` — narzuca sprawdzenie blokady strukturalnie, tak żeby nowa
akcja kosztorysu nie mogła go pominąć. Komentarz nagłówkowy ma powiedzieć, czego wrapper broni
(ruchu na kasie po rozliczeniu) i dlaczego nie jest to `if` w każdej akcji.

**Contract**: dwa wejścia, jedno zawężenie.

```ts
type LockTargetT = { investmentId: number } | { kind: 'item' | 'section' | 'stage'; id: number }

export function investmentAction<TData = undefined>(
  label: string,
  target: LockTargetT,
  handler: (ctx: { payload: Payload; user: SessionUserT }) => Promise<ActionResultT<TData>>,
  revalidate?: (keyof typeof CACHE_TAGS)[],
  opts?: { deferRefresh?: boolean },
): Promise<ActionResultT<TData>>
```

Opakowuje `protectedAction`, przekazując `revalidate` i `opts` **bez zmian**. Wariant z `kind`
rozwiązuje `investmentId` przez `investmentIdFor` i zwraca `{ success: false }` z polskim
komunikatem, gdy wiersz nie istnieje. Komunikat blokady jest jeden, stały, po polsku, mówi co robić:
inwestycja jest zakończona, żeby ją zmienić trzeba najpierw zmienić jej status na „Aktywna".

#### 3. Konsolidacja istniejących lookupów

**Files**: `src/lib/kosztorys/create-item.ts:12`, `src/lib/actions/kosztorys.ts:531`, `:709`

**Intent**: `sectionInvestmentId` i dwa inline `SELECT investment_id …` robią dokładnie to, co
`investmentIdFor` — przepiąć na helper i skasować duplikaty.

**Contract**: `sectionInvestmentId` znika; jego dwa wywołania (`kosztorys.ts:366`, `:504`) przechodzą
na `investmentIdFor('section', …)`. Kasowanie gate'ować typecheckiem, nie grepem.

### Success Criteria:

#### Automated Verification:

- Nowy spec przechodzi: `pnpm exec vitest run src/__tests__/lib/db/investment-lock.test.ts`
- Nowy spec wrappera przechodzi: `pnpm exec vitest run src/__tests__/lib/actions/investment-action.test.ts`

#### Manual Verification:

- brak — faza bez powierzchni UI.

---

## Phase 2: Kosztorys

### Overview

~28 mutujących akcji przechodzi na wrapper, cztery kolekcje kosztorysu dostają bramkę na `access`,
żeby `/admin` nie był obejściem.

### Changes Required:

#### 1. Akcje z `investmentId` w sygnaturze (11)

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Podmiana `protectedAction` na `investmentAction` z `{ investmentId }` — bez zmiany
sygnatury publicznej, więc wywołania z UI zostają nietknięte.

**Contract**: `updateInvestmentCoeffsAction:151`, `updateInvestmentVatAction:170`,
`updateInvestmentSettlementModeAction:186`, `updateInvestmentMaterialsNetRateAction:204`,
`updateInvestmentGlobalDiscountAction:222`, `applyPercentDiscountToAllItemsAction:245`,
`cleanItemDescriptionsAction:273`, `clearKosztorysAction:307`, `addSectionAction:337`,
`renumberKosztorysOrderAction:577`, `addStageAction:636`. Pierwsze pięć to jednocześnie bramka na
siedmiu polach finansowych tabeli `investments`.

#### 2. Akcje wymagające resolvera (12)

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: To samo przez wariant `{ kind, id }` wrappera.

**Contract**: `updateItemFieldAction:123`, `updateSectionFieldAction:137`, `removeSectionAction:356`,
`insertSectionAction:384`, `swapSectionOrderAction:422`, `addItemAction:451`, `insertItemAction:479`,
`removeItemAction:520`, `swapItemOrderAction:541`, `updateStageAction:674`, `removeStageAction:696`,
`setStageProgressAction:726`. `addItemAction` / `insertItemAction` / `insertSectionAction`
identyfikują cel przez sekcję, nie pozycję.

#### 3. Akcje kosztorysu spoza `kosztorys.ts`

**Files**: `src/lib/actions/kosztorys-import.ts`, `kosztorys-snapshots.ts`, `kosztorys-presets.ts`,
`sheets-sync.ts`, `sheets.ts`

**Intent**: Zabramkować to, co pisze; **jawnie zostawić** to, co czyta — decyzja #4 z `change.md`.

**Contract**: blokowane — `applyKosztorysImport:274`, `saveSnapshotAction:28`,
`restoreSnapshotAction:62`, `appendPresetSectionsAction:101`, `reloadFromPresetAction:156`,
`applyMaterialSync:238`, `linkSheetToInvestmentAction:89`, `unlinkSheetFromInvestmentAction:151`,
`saveSheetColumnMappingAction:185`, `clearSheetColumnMappingAction:215`, oraz `linkSheetAction` /
`setupSheetAction` w `lib/actions/investments.ts`.
Nietknięte, z komentarzem mówiącym **dlaczego** — `previewKosztorysImport:114`, `compareWithSheet:181`,
`previewMaterialSync:155`, `listSnapshotsAction:99`, `savePresetAction:34` (szablon globalny, nie
inwestycja), `listPresetsAction`, `listPresetSectionsAction`, całe `kosztorys-share.ts` i
`kosztorys-client-view.ts`. `snapshotAction:17` (auto-snapshot z interwału) blokowana — na
zablokowanym kosztorysie nie ma czego wersjonować.

#### 4. `/admin` — bramka na `access`

**Files**: `src/collections/kosztorys-items.ts`, `kosztorys-sections.ts`, `kosztorys-stages.ts`,
`stage-progress.ts`

**Intent**: `update`/`delete`/`create` na wierszu zablokowanej inwestycji odmawiają także z panelu.
Manager wchodzi do `/admin` (`users.ts:96`), a cała czwórka ma dziś `isAdminOrOwnerOrManager` na
całym CRUD.

**Contract**: `access.update` / `access.delete` zwracają `Where` zawężający do inwestycji o statusie
innym niż `completed`; `access.create` odmawia, gdy `investment` w danych jest zablokowana. `read`
bez zmian — blokada nie ukrywa danych.

### Success Criteria:

#### Automated Verification:

- Testy integracyjne akcji kosztorysu na zablokowanej inwestycji odmawiają dla każdej roli:
  `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-lock.test.ts`
- Akcje czytające na zablokowanej inwestycji dalej zwracają dane (ten sam spec)
- Istniejące specy kosztorysu przechodzą: `pnpm exec vitest run src/__tests__/lib/actions/`

#### Manual Verification:

- Edytor zakończonej inwestycji: próba edycji komórki, dodania sekcji, etapu, zmiany VAT-u
  i rabatu globalnego — każda odmawia z czytelnym komunikatem
- To samo z `/admin` jako MANAGER na `kosztorys-items` — zapis odrzucony
- Import z arkusza: „Porównaj" działa, „Zastosuj" odmawia

---

## Phase 3: Transakcje

### Overview

Bramka w hooku kolekcji (kompletna, bo transakcje nie mają ścieżki surowego SQL-a), z jednym
wyjątkiem na zapis fakturowy. Akcje dokładają polski komunikat, formularze — odfiltrowany picker.

### Changes Required:

#### 1. Bramka w hooku

**File**: `src/hooks/transfers/validate.ts`

**Intent**: Odmówić każdego zapisu transakcji dotykającej zablokowanej inwestycji — tworzenia,
edycji, anulowania i przeniesienia (obie strony: zapis NA zablokowaną i zdjęcie Z zablokowanej).
Przepuścić zapis fakturowy.

**Contract**: hook staje się `async`. Sprawdzenie wchodzi **po** definicji `resolved()`, a **przed**
wczesnym `return` dla `CANCELLATION` i przed `operation === 'update' && d.cancelled`. Kolejność jest
istotna — bez niej `cancelTransferAction` przecieka drugim `return`.

```ts
// Obie strony przenosin: nowa inwestycja z `data`, stara ze `originalDoc`.
const touched = [resolved('investment'), original?.investment].filter(Boolean)
// Zapis fakturowy — jedyny klucz w `data` to `invoice`. Na kluczach, nie na wartościach:
// pusta tablica jest usunięciem wszystkich stron i musi przejść.
const invoiceOnly = Object.keys(d).every((k) => k === 'invoice')
```

Gdy którakolwiek dotknięta inwestycja jest zablokowana i zapis nie jest `invoiceOnly` — `throw` z
polskim komunikatem. `resolved('investment')`, nie `d.investment`: PATCH jednego pola nie niesie
relacji.

#### 2. Czytelny komunikat w akcjach

**File**: `src/lib/actions/transfers.ts`

**Intent**: Hook rzuca surowy `Error`; akcje mają zwracać `{ success: false, error }` z tym samym
zdaniem, co reszta blokady.

**Contract**: `fetchAndAuthorize:146` dokłada sprawdzenie blokady obok istniejących odmów
(`cancelled`, `CANCELLATION`) — pokrywa `cancelTransferAction:177` i `updateTransferAction:226`.
`createTransferAction:34` i `createBulkTransferAction:70` sprawdzają `parsed.data.investment` po
walidacji schematu. `setTransferInvoices` i jej trzy akcje — **bez zmian**.

#### 3. Picker inwestycji

**Files**: `src/components/forms/expense-form/expense-form.tsx:301`,
`src/components/forms/deposit-form/deposit-form.tsx:209`,
`src/components/forms/hooks/use-investment-from-url.ts`

**Intent**: Zakończona inwestycja znika z listy wyboru — `InvestmentRefT` niesie `status`, więc bez
nowego zapytania. `useInvestmentFromUrl` podstawia inwestycję z URL-a **z pominięciem** pickera, więc
musi odfiltrować tak samo, inaczej wejście z podstrony zablokowanej inwestycji wstawi ją do
formularza.

**Contract**: filtr `status !== 'completed'` w obu formularzach i w haku. Filtr jest uprzejmością —
bramką jest hook z punktu 1.

### Success Criteria:

#### Automated Verification:

- Nowy spec bramki transakcyjnej: `pnpm exec vitest run src/__tests__/hooks/transfers/validate-lock.test.ts`
  — pokrywa tworzenie, edycję, anulowanie, obie strony przenosin, i **przejście** zapisu fakturowego
- Specy akcji transakcyjnych: `pnpm exec vitest run src/__tests__/transfer-actions.test.ts`
- Istniejący spec hooka bez regresji: `pnpm exec vitest run src/__tests__/validate-hook.test.ts`

#### Manual Verification:

- Formularz wydatku i wpłaty: zakończona inwestycja nieobecna na liście
- Wejście na „Dodaj wydatek" z podstrony zakończonej inwestycji nie podstawia jej do formularza
- Edycja i anulowanie transakcji na zakończonej inwestycji odmawiają z komunikatem
- Podpięcie i odpięcie skanu faktury na takiej transakcji **działa**
- Przeniesienie istniejącej transakcji na zakończoną inwestycję odmawia

---

## Phase 4: Status jako zamek

### Overview

Jedna reguła, na której trzyma się cała reszta: wyjście z `completed` wykonuje wyłącznie OWNER/ADMIN.
Plus potwierdzenie przed zamknięciem inwestycji.

### Changes Required:

#### 1. Bramka na wyjściu ze statusu

**File**: `src/collections/investments.ts`

**Intent**: Bez tej reguły blokada jest pozorna — `updateInvestmentAction` idzie przez
`MANAGEMENT_ROLES`, więc MANAGER przestawiłby status na „Aktywna", zaksięgował co chce i przestawił
z powrotem. W hooku kolekcji, nie w akcji, bo `/admin` ma `update: isAdminOrOwnerOrManager` na
inwestycjach — panel byłby drugim obejściem.

**Contract**: nowy `beforeChange` w `hooks` kolekcji: gdy `originalDoc.status === 'completed'`
i `data.status` jest inny — `throw` z polskim komunikatem, chyba że `req.user` przechodzi
`isAdminOrOwnerRole`. **Wejście** w `completed` otwarte dla każdej roli zarządczej — zamykanie
rozliczonej roboty to praca managera. Osiem pól kartoteki nietkniętych.

#### 2. Potwierdzenie przy zamknięciu

**Files**: `src/components/dialogs/edit-investment-dialog.tsx:44`,
`src/components/forms/investment-form/investment-form.tsx:100-110`

**Intent**: Zamknięcie inwestycji jest trudne do cofnięcia dla managera, więc dostaje potwierdzenie.
Jeden dialog, niezależny od roli.

**Contract**: `ConfirmDialog` (`src/components/ui/confirm-dialog.tsx`, wariant `alert`) staje przed
submitem formularza i **tylko** gdy status przechodzi na `completed` — dialog edycji zna poprzedni
status z `defaultValues.status`, więc porównanie jest lokalne. Treść mówi, że inwestycja zostanie
zablokowana i będzie tylko do odczytu. Nowość względem
`hooks/use-investor-impact-confirm.ts`: tam confirm stoi przed pojedynczą akcją, tu przed submitem.

### Success Criteria:

#### Automated Verification:

- Nowy spec bramki statusu: `pnpm exec vitest run src/__tests__/collections/investments-status-lock.test.ts`
  — MANAGER nie wychodzi z `completed`, OWNER/ADMIN wychodzi, MANAGER wchodzi w `completed`,
  edycja pól kartoteki na zablokowanej przechodzi dla każdej roli

#### Manual Verification:

- Jako MANAGER: próba przestawienia zakończonej inwestycji na „Aktywna" odmawia — w aplikacji i w `/admin`
- Jako OWNER: to samo przechodzi
- Zmiana statusu na „Zakończona" pokazuje dialog potwierdzenia; anulowanie dialogu nic nie zapisuje
- Edycja notatki / telefonu na zakończonej inwestycji działa dla managera

---

## Phase 5: UI read-only

### Overview

Rozszczepienie `preview` na interakcję i ujawnianie — rozdział, który warstwa kolumn już zna
i dokumentuje, a warstwa wyżej gubi. Blokada wchodzi w to miejsce.

### Changes Required:

#### 1. Wpięcie `locked` do edytora

**Files**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:38`,
`src/lib/kosztorys/types.ts` (`KosztorysEditorDataT`),
`src/components/kosztorys/editor/kosztorys-editor-v2.tsx`

**Intent**: Edytor ma wiedzieć, że inwestycja jest zablokowana. Bez nowego zapytania — `investment`
jest już czytany z `refData.investments`, obok `hasSheet`.

**Contract**: nowa opcjonalna prop `locked?: boolean` w `KosztorysEditorDataT`, przekazywana przez
`kosztorys-editor-v2.tsx` w dół. Wejścia client-share jej nie podają (renderują `preview`).

#### 2. Rozszczepienie `preview`

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: `preview` zostaje wyłącznie pojęciem o **układzie i ujawnianiu** (dokument klienta:
`h-dvh`, `PREVIEW_VISIBLE_COLUMNS`, wygaszone prognozy, brak toolbara). Interakcja przechodzi na
osobne pojęcie, które jest prawdą dla obu przypadków. Zablokowana inwestycja ma widzieć **pełny**
edytor, tylko bez pisania — dlatego `preview` nie nadaje się na „zablokowane".

**Contract**: jedno wyprowadzone `readOnly = preview || locked` na poziomie hooka.
`use-kosztorys-editor.ts:499` → `readOnly`, `:500` `previewVisible: preview` bez zmian.
`editorOnly:361` (15 wywołań) bramkuje się na `readOnly`, nie na `preview`; jego komentarz —
deklarujący „The gate is the render mode, NOT a role" — wymaga dopisania o blokadzie. Miejsca,
których `editorOnly` **nie** obejmuje i które trzeba domknąć osobno: `onSettlementModeChange`
i `onMaterialsNetRateChange` (`kosztorys-editor-body.tsx:388-391`), `openImport` (`:231`),
`onOpenVersions`, oraz VAT / współczynniki / rabat globalny w dialogu ustawień.

#### 3. Baner blokady

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Bez tego zablokowany edytor wygląda na zepsuty — komórki nie reagują i nic tego nie
tłumaczy. Baner mówi, że inwestycja jest zakończona i jak to zmienić.

**Contract**: renderowany gdy `locked && !preview` (klient nie widzi naszej mechaniki). Nie zmienia
layoutu — `preview` zostaje jedynym pojęciem, które podmienia układ.

#### 4. Tabela transakcji

**File**: `src/components/tables/` (wiersz transakcji i jego menu akcji)

**Intent**: Zdjąć „Edytuj" i „Anuluj" z transakcji na zablokowanej inwestycji; „Faktury" zostaje.

**Contract**: gate na statusie inwestycji wiersza. Uprzejmość, nie bramka — serwer odmawia niezależnie.

### Success Criteria:

#### Automated Verification:

- Nowy spec rozszczepienia: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/editor-lock.test.ts`
  — `locked` daje `readOnly` bez zwężenia kolumn; `preview` dalej zwęża

#### Manual Verification:

- Edytor zakończonej inwestycji: **pełny** zestaw kolumn, prognozy, Podsumowanie i zakładka „Marża"
  widoczne, żadna komórka nieedytowalna, brak kolumny akcji
- Baner blokady widoczny, treść mówi jak odblokować
- Widok klienta (share link) zakończonej inwestycji wygląda jak dotąd — bez banera, ze zwężonymi kolumnami
- Toolbar: import, wersje, ustawienia (VAT, współczynniki, rabat globalny) niedostępne
- Tabela transakcji: „Edytuj"/„Anuluj" zdjęte, „Faktury" dostępne
- Po odblokowaniu przez OWNER-a edytor wraca do pełnej edycji bez przeładowania strony

---

## Testing Strategy

Ryzyko zaczepione o **Risk #6** z `context/foundation/test-plan.md` („Kosztorys mutations are not
gated"). Ta sama rodzina — bramka na zapisie do tych samych tabel — ta sama najtańsza warstwa
(„integration — call the action as each role, assert allow/deny") i ta sama pułapka wypisana tam
wprost: **„Testing only the UI visibility; asserting the client guard instead of the server
rejection"**. Różnica: #6 jest rolowe, blokada jest **stanowa** (status wiersza, nie rola aktora) —
`test-plan.md` dostaje wiersz stanowy przez `/10x-test-plan`.

### Unit Tests

- `isInvestmentLocked`: `completed` → `true`, `active`/`planowana` → `false`, brak wiersza → `false`
- `investmentIdFor` dla trzech rodzajów; nieistniejący identyfikator → `null`
- `investmentAction`: przepuszcza na odblokowanej, odmawia na zablokowanej, **przekazuje
  `revalidate`** (regresja na pułapce z `ownerOnlyAction`)
- Rozszczepienie `readOnly` / `previewVisible` w warstwie opcji kolumn

### Integration Tests

- Każda z ~28 akcji kosztorysu wołana jako OWNER na zablokowanej inwestycji → odmowa (tabelarycznie)
- Akcje czytające i `savePresetAction` na zablokowanej → sukces
- `validateTransfer`: create / update / cancel / przeniesienie w obie strony → odmowa; zapis
  `{ invoice: [...] }` i `{ invoice: [] }` → sukces
- Bramka statusu przez każdą rolę, w obie strony
- Edycja pól kartoteki na zablokowanej inwestycji jako MANAGER → sukces

### Manual Testing Steps

Zebrane z faz 2-5 do rejestru `context/foundation/manual-checks.md` przy ostatniej fazie.

### E2E

Blokada jest ryzykiem wielogranicznym (formularz → akcja → hook → baza), więc **należy jej się
spec E2E**: „zakończona inwestycja odmawia zaksięgowania wydatku i edycji kosztorysu". Autorowany
przy bramce review albo odłożony do **backlogu E2E** jako issue z etykietą `e2e-backlog` w projekcie
„Wykonczymy" — `slice-review-gate` blokuje archiwizację, dopóki jedno albo drugie nie nastąpi.

## Performance Considerations

Bramka transakcyjna dokłada jeden `SELECT status FROM investments WHERE id = $1` (klucz główny) do
zapisu transakcji **niosącej inwestycję** — typy bez inwestycji nie płacą nic. `createBulkTransferAction`
tworzy N wierszy w jednej transakcji Payloada, więc zapłaci N razy; jeśli to zaboli, jedna inwestycja
na całą partię pozwala sprawdzić raz przed pętlą — ale bramką i tak zostaje hook, bo tylko on widzi
`/admin`.

Wrapper kosztorysowy dokłada jeden odczyt na akcję, przy wariancie z resolverem dwa. Akcje edytora są
per-gest, nie per-render, więc to nie jest ścieżka gorąca.

Wpięcie `locked` do edytora i odfiltrowanie pickera nie kosztują zapytania — `InvestmentRefT` już
niesie `status`.

## Migration Notes

Bez migracji schematu i bez migracji danych. Blokada działa wstecz na wszystkie 69 inwestycji ze
statusem `completed` od chwili wdrożenia — to jest decyzja #1, nie efekt uboczny. Rollback to revert
kodu; żaden wiersz nie zmienia się nieodwracalnie.

Do przewidzenia w pierwszych tygodniach: prośby o odblokowanie pod spóźnione wypłaty i faktury
materiałowe (§B `research.md` — 41 × `PAYOUT`, 22 × `INVESTMENT_EXPENSE` po zakończeniu). To jest
lista inwestycji zamkniętych przedwcześnie, nie usterka.

## Whole-tree Gate

- Typecheck przechodzi: `pnpm typecheck`
- Lint przechodzi: `pnpm lint`
- Pełny zestaw jednostkowy przechodzi: `pnpm test`
- Build przechodzi: `pnpm build`

## References

- Rekonesans: `context/changes/2026-08-28-investment-lock-on-completed/research.md`
- Rozstrzygnięcia właściciela: `context/changes/2026-08-28-investment-lock-on-completed/change.md`
- Wzorzec wrappera: `src/lib/actions/owner-only-action.ts:16`
- Kolekcja append-only (na wypadek powrotu decyzji #2): `src/collections/amount-edits.ts`
- Rozdział `readOnly` / `previewVisible`: `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts:92-99`
- Wzorzec „potwierdź przed": `src/components/kosztorys/editor/hooks/use-investor-impact-confirm.ts`
- Powiązane: EX-749 (audyt powierzchni nadużyć managera)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fundament bramki

#### Automated

- [x] 1.1 Nowy spec przechodzi: `src/__tests__/lib/db/investment-lock.test.ts` — 2f3bbfdb
- [x] 1.2 Nowy spec wrappera przechodzi: `src/__tests__/lib/actions/investment-action.test.ts` — 2f3bbfdb

### Phase 2: Kosztorys

#### Automated

- [x] 2.1 Testy integracyjne akcji kosztorysu na zablokowanej inwestycji odmawiają dla każdej roli — 39eaea4b
- [x] 2.2 Akcje czytające na zablokowanej inwestycji dalej zwracają dane — 39eaea4b
- [x] 2.3 Istniejące specy kosztorysu przechodzą bez regresji — 39eaea4b

### Phase 3: Transakcje

#### Automated

- [x] 3.1 Nowy spec bramki transakcyjnej (create / update / cancel / przeniesienie / wyjątek fakturowy) — 28fc91f7
- [x] 3.2 Specy akcji transakcyjnych przechodzą — 28fc91f7
- [x] 3.3 Istniejący spec hooka bez regresji — 28fc91f7

### Phase 4: Status jako zamek

#### Automated

- [x] 4.1 Nowy spec bramki statusu (role × kierunek przejścia × pola kartoteki) — 9e8542d8

### Phase 5: UI read-only

#### Automated

- [x] 5.1 Nowy spec rozszczepienia `readOnly` / `previewVisible` — 678e7192
