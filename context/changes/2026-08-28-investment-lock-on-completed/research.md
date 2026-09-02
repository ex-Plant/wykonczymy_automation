---
date: 2026-08-28T10:21:33Z
researcher: Claude (Opus 5)
git_commit: c271ae3dcb615be19be77948ca908d0d55bcb498
branch: main
repository: wykonczymy
topic: 'Blokada zakończonej inwestycji — read-only dla wszystkich ról'
tags: [research, codebase, investments, kosztorys, transfers, access-control]
status: complete
last_updated: 2026-08-28
last_updated_by: Claude (Opus 5)
linear: EX-748
---

# Research: Blokada zakończonej inwestycji

**Date**: 2026-08-28T10:21:33Z
**Researcher**: Claude (Opus 5)
**Git Commit**: `c271ae3`
**Branch**: `main`
**Repository**: wykonczymy

## Research Question

Status `completed` ma zamienić inwestycję, jej transakcje i kosztorys w byt tylko do odczytu dla
wszystkich ról (ADMIN/OWNER włącznie). Przejście na `completed` — za confirmation dialogiem. Jedyne
wyjście — jawna zmiana statusu z powrotem na „Aktywna", wyłącznie OWNER/ADMIN, też za confirmation
dialogiem. Co trzeba w tym celu zamknąć, gdzie leży punkt kontrolny, i czego ta zmiana dotknie.

Zakres: **wyłącznie mechanika blokady**. Audyt powierzchni nadużyć managera to EX-749, osobna praca.

## Summary

Sześć ustaleń, które kształtują plan:

1. **`completed` nie egzekwuje dziś niczego.** Cały efekt to `opacity-50` na wierszu listy i pozycja
   w filtrze. Semantyka jest wolna do wzięcia — nic jej nie używa do decyzji.
2. **Blast radius jest duży i realny.** W kopii produkcyjnej **69 inwestycji ma status `completed`**
   (przy 41 `active`), a **co najmniej 84 transakcje zaksięgowano już PO zakończeniu inwestycji** —
   najnowsza 2026-08-12. Dominuje `PAYOUT` (41 sztuk) i `INVESTMENT_EXPENSE` (22). Dziś „zakończona"
   nie znaczy „nic się już nie dzieje". To nie podważa decyzji — to jest dokładnie to, co blokada ma
   ukrócić — ale wymusza świadomą decyzję o dniu wdrożenia (§ Open Questions).
3. **Punktów kontrolnych musi być trzy, nie jeden.** Payload `access` nie łapie akcji serwerowych
   (`overrideAccess: true`), hooki kolekcji nie łapią surowego SQL-a, a UI nie łapie nikogo. Za to
   `transactions` i kosztorys wymagają **różnych** punktów, bo mają różny profil zapisu.
4. **Resolver to nie problem.** `kosztorys_items`, `kosztorys_sections` i `kosztorys_stages` **każde
   niosą `investment_id`** (not null, zaindeksowane). Trzy takie lookupy już istnieją w kodzie, dwa
   jako inline SQL — jest z czego zrobić jeden helper.
5. **Powierzchnia zmiany statusu jest wąska**: dokładnie jeden call site w aplikacji
   (`edit-investment-dialog.tsx`) plus panel `/admin`. Do bramkowania „tylko OWNER/ADMIN cofa" nie
   trzeba przeczesywać repo.
6. **Rozdział `preview` / `locked` jest już zrobiony jedną warstwę niżej.** Warstwa kolumn ma
   `readOnly` (interakcja) i `previewVisible` (ujawnianie) rozdzielone i **udokumentowane jako
   ortogonalne** — a `use-kosztorys-editor.ts:469` zwija je z powrotem w `readOnly: preview`. Blokada
   wchodzi w to miejsce jednym `preview || locked`.

## Detailed Findings

### A. Czym jest dziś `completed`

Wszystkie odczyty statusu, jakie istnieją:

- `src/components/investments/investment-data-table.tsx:53` — `opacity-50` na wierszu
- `src/components/investments/status-filter.tsx:17`, `src/hooks/use-status-filter.ts:8` — filtr listy
- `src/components/investments/investment-status-badge.tsx` — etykieta i kolor plakietki
- `src/collections/investments.ts:11-15` — `STATUS_OPTIONS`, `defaultValue: 'active'`

Żaden odczyt nie bramkuje zapisu, nie wpływa na figurę finansową, na dashboard ani na raport.
Nadanie `completed` nowego znaczenia nie zmienia więc żadnego istniejącego wyliczenia — jedyne
skutki uboczne to te, które sami dopiszemy.

### B. Blast radius — dane z kopii produkcyjnej (`wykonczymy-db`, 5433)

```
 status    | count
-----------+-------
 completed |    69
 active    |    41
```

Transakcje niezanulowane na inwestycjach dziś zakończonych: **1389** łącznie, **510** z ostatnich 90
dni, **36** z ostatnich 30.

To samo w węższym, rygorystycznym ujęciu — tylko wiersze, dla których `investments.updated_at <
transactions.created_at`, czyli inwestycja **nie była** ruszana po zaksięgowaniu transakcji, więc jej
status był już wtedy `completed`:

| typ                  | szt. | najstarsza | najnowsza  |
| -------------------- | ---- | ---------- | ---------- |
| `PAYOUT`             | 41   | 2026-04-12 | 2026-08-12 |
| `INVESTMENT_EXPENSE` | 22   | 2026-04-12 | 2026-08-10 |
| `INVESTOR_DEPOSIT`   | 9    | 2026-04-12 | 2026-06-18 |
| `RABAT`              | 6    | 2026-06-18 | 2026-08-12 |
| `LABOR_COST`         | 3    | 2026-04-12 | 2026-04-19 |
| `CORRECTION`         | 2    | 2026-06-19 | 2026-08-10 |
| `LOSS`               | 1    | 2026-08-12 | 2026-08-12 |

**84 to dolna granica, nie liczba.** Każda późniejsza edycja inwestycji chowa wcześniejsze
przypadki, więc prawdziwa liczba jest wyższa. Wniosek dla planu: blokada zatrzyma realnie używaną
ścieżkę — spóźnione wypłaty dla pracowników i spóźnione faktury materiałowe. Przy 69 zablokowanych od
pierwszego dnia trzeba wiedzieć, czy tego chcemy od razu, czy stopniowo (§ Open Questions #1).

### C. Trzy punkty kontrolne — i dlaczego jeden nie wystarczy

**Payload `access` nie bramkuje akcji.** Wszystkie mutacje idą przez Local API
(`payload.update` / `payload.create` w `protectedAction`), gdzie `overrideAccess` domyślnie jest
`true`. `access.update` na kolekcji nie zobaczy ich w ogóle.

**Hooki kolekcji nie bramkują kosztorysu.** Zapisy surowym SQL-em, które omijają hooki:

| plik                                                | co pisze                                     |
| --------------------------------------------------- | -------------------------------------------- |
| `src/lib/actions/kosztorys.ts:262`                  | `UPDATE kosztorys_items` (rabat procentowy)  |
| `src/lib/actions/kosztorys.ts:740`                  | `INSERT … stage_progress … DO UPDATE`        |
| `src/lib/db/kosztorys-descriptions.ts:32`           | `UPDATE kosztorys_items`                     |
| `src/lib/db/kosztorys-sheet-measured-qty.ts:22`     | `UPDATE kosztorys_items`                     |
| `src/lib/kosztorys/insert-rows.ts:99,126`           | `INSERT … kosztorys_sections / _items`       |
| `src/lib/kosztorys/insert-kosztorys-tree.ts:96,120` | `INSERT … kosztorys_stages / stage_progress` |
| `src/lib/kosztorys/restore-kosztorys.ts:35-36`      | `DELETE FROM kosztorys_sections / _stages`   |
| `src/lib/kosztorys/display-order.ts:60,185,241`     | `UPDATE … display_order`                     |
| `src/lib/db/snapshots.ts:44,57,110`                 | `INSERT`/`DELETE … kosztorys_snapshots`      |
| `src/lib/db/presets.ts:43,63`                       | `INSERT … kosztorys_presets`                 |

**Za to `transactions` nie ma ani jednego zapisu surowym SQL-em** — wszystko idzie przez Payload,
a kolekcja ma już hook wejściowy `beforeValidate: [validateTransfer]`
(`src/collections/transfers.ts:76`, `src/hooks/transfers/validate.ts:25`). Ten hook widzi `data`,
`originalDoc` i `operation`, i już dziś rozwiązuje pola przez `resolved()` z fallbackiem na wiersz —
czyli dokładnie to, czego potrzeba, żeby złapać **obie** strony przenosin: zapis na zablokowaną
inwestycję i zdjęcie wiersza z zablokowanej.

Stąd asymetria, którą plan musi uszanować:

| plan                      | transakcje                            | kosztorys                         | inwestycja                                   |
| ------------------------- | ------------------------------------- | --------------------------------- | -------------------------------------------- |
| akcje serwerowe           | (pokryte hookiem)                     | **wrapper akcji — konieczny**     | wrapper akcji                                |
| `/admin` (REST, `access`) | hook `validateTransfer` pokrywa       | **`access` kolekcji — konieczny** | `access` + wyjątek na `status`               |
| UI                        | ukryć akcje wiersza + wyjąć z pickera | `readOnly` gridu + chrom mutujący | ukryć „Edytuj", pokazać akcję zmiany statusu |

**Kto dociera do `/admin`:** `src/collections/users.ts:96` — `admin: isAdminOrOwnerOrManagerBoolean`.
Panel jest więc realną drugą płaszczyzną zapisu, także dla managera. Dla `transactions` to mniej
istotne (`access: isAdminOrOwner`, `src/collections/transfers.ts:69-74`), ale kolekcje kosztorysu
mają `isAdminOrOwnerOrManager` na całym CRUD (`kosztorys-items.ts:27-31` i analogicznie
`kosztorys-sections`, `kosztorys-stages`, `stage-progress`). Bez bramki na `access` `/admin` jest
obejściem blokady.

### D. Wrapper akcji: kształt i resolver

Wzorzec do skopiowania stoi obok: `ownerOnlyAction`
(`src/lib/actions/owner-only-action.ts:16`) opakowuje `protectedAction` i zawęża strukturalnie, żeby
„nowa akcja nie mogła zapomnieć ręcznie przepisanego `if`". Blokada potrzebuje bliźniaka —
`investmentAction(label, investmentId, handler)`.

**11 z 23 mutujących akcji kosztorysu bierze `investmentId` wprost** i wchodzi do wrappera bez
niczego więcej:

`updateInvestmentCoeffsAction:153`, `updateInvestmentVatAction:172`,
`updateInvestmentSettlementModeAction:188`, `updateInvestmentMaterialsNetRateAction:206`,
`updateInvestmentGlobalDiscountAction:224`, `applyPercentDiscountToAllItemsAction:247`,
`cleanItemDescriptionsAction:275`, `clearKosztorysAction:309`, `addSectionAction:339`,
`renumberKosztorysOrderAction:579`, `addStageAction:638`.

**12 wymaga resolvera** — biorą `itemId` / `sectionId` / `stageId`:

`updateItemFieldAction:125`, `updateSectionFieldAction:139`, `removeSectionAction:358`,
`insertSectionAction:386`, `swapSectionOrderAction:424`, `addItemAction:453`, `insertItemAction:481`,
`removeItemAction:522`, `swapItemOrderAction:543`, `updateStageAction:676`, `removeStageAction:698`,
`setStageProgressAction:728`.

Resolver jest trywialny, bo **każda tabela kosztorysu niesie `investment_id`** — `not null`, z
indeksem i FK `ON DELETE CASCADE`. Trzy lookupy już są w kodzie i proszą się o jeden helper:

- `sectionInvestmentId` — `src/lib/kosztorys/create-item.ts:12` (używany w `kosztorys.ts:366,504`)
- inline `SELECT investment_id FROM kosztorys_items WHERE id = …` — `kosztorys.ts:531`
- inline `SELECT investment_id FROM kosztorys_stages WHERE id = …` — `kosztorys.ts:709`

Pozostałe akcje z `investmentId` w sygnaturze, spoza `kosztorys.ts`, które też przechodzą przez
wrapper: `previewKosztorysImport` / `compareWithSheet` (`kosztorys-import.ts:114,181` — czytające,
patrz Open Questions #4), `snapshotAction` / `saveSnapshotAction` / `restoreSnapshotAction`
(`kosztorys-snapshots.ts:17,28,62`), `appendPresetSectionsAction` (`kosztorys-presets.ts:101`),
`applyMaterialSync` (`sheets-sync.ts:238`), `linkSheetToInvestmentAction` /
`unlinkSheetFromInvestmentAction` (`sheets.ts:89,151`), `linkSheetAction` / `setupSheetAction`
(`investments.ts:115,24`).

### E. Transakcje: gdzie wchodzi bramka

Poza hookiem kolekcji istnieje gotowy punkt autoryzacji per-transakcja: `fetchAndAuthorize`
(`src/lib/actions/transfers.ts:~148-175`), przez który idą `cancelTransferAction:177` i
`updateTransferAction:226`. Odrzuca już anulowane i `CANCELLATION`, po czym pyta `canMutateTransfer`.
To naturalne miejsce na czytelny polski komunikat blokady (hook rzuca surowy `Error`).

Dwa wyjątki, o których plan musi wiedzieć:

- **Tworzenie** (`createTransferAction:34`, `createBulkTransferAction:70`) nie przechodzi przez
  `fetchAndAuthorize` — bramka na `parsed.data.investment`, albo poleganie na hooku.
- **Faktury** (`setTransferInvoices:~330`, wołane przez `addTransferInvoicesAction:344`,
  `removeTransferInvoiceAction:368`, `removeAllTransferInvoicesAction:380`) **celowo omija**
  `fetchAndAuthorize` — decyzja właściciela z 2026-08-10, spisana w komentarzu: podpinanie i
  odpinanie stron faktury jest otwarte dla każdej sesji zarządczej niezależnie od autorstwa. Blokada
  musi tę decyzję świadomie przykryć albo świadomie zostawić (Open Questions #3).

Formularze tworzące transakcje z pickerem inwestycji: `expense-form`, `deposit-form`
(`internal-transfer-form` nie niesie inwestycji, więc jest poza zakresem). Oba czytają
`referenceData.investments`, a `InvestmentRefT` **już niesie `status`**
(`src/types/reference-data.ts:22`) — odfiltrowanie zablokowanych z pickera nie kosztuje zapytania.
Uwaga na `useInvestmentFromUrl` (`forms/hooks/use-investment-from-url.ts`), które podstawia
inwestycję z URL-a z pominięciem wyboru w pickerze.

### F. Edytor kosztorysu: `preview` to nie jest „zablokowane"

`preview` znaczy **dokument klienta**, nie „bez edycji". Steruje jednocześnie: układem
(`h-dvh` vs `h-[calc(100dvh-7rem)]`, `kosztorys-editor-body.tsx:238`), filtrowaniem kolumn do
`PREVIEW_VISIBLE_COLUMNS`, wygaszeniem prognoz, liczników filtrów i diagnostyk
(`use-kosztorys-editor.ts:377,393,404,415,423`), oraz toolbarem, importem i dialogami
(`kosztorys-editor-body.tsx:231,301,350,409,412`). Właściciel patrzący na zablokowaną inwestycję ma
widzieć **pełny** edytor — tylko bez możliwości pisania.

Rozdział, którego potrzebujemy, jest **już zrobiony warstwę niżej**.
`src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts:92-99` trzyma dwie osobne opcje i
mówi to wprost:

> `readOnly` — „Lock the whole grid: every data cell becomes `disabled` and the row-actions column is
> dropped. Omitting the mutation callbacks is NOT enough — a cell with no callback still takes focus
> and enters edit mode."
> `previewVisible` — „**Orthogonal to `readOnly`: read-only is about interaction, this is about
> disclosure.**"

Ten rozdział ginie o jedną warstwę wyżej, w `use-kosztorys-editor.ts:469`: `readOnly: preview`.
Tam wchodzi blokada — `readOnly: preview || locked`, `previewVisible: preview`.

Drugi seam to `editorOnly` (`use-kosztorys-editor.ts:361`):

```ts
const editorOnly = <T>(handler: T): T | undefined => (preview ? undefined : handler)
```

Zdejmuje 15 handlerów mutujących (etapy, pozycje, sekcje, sortowanie — linie 439-464), a komentarz
nad nim już deklaruje właściwą zasadę: „**The gate is the render mode, NOT a role** — OWNER/MANAGER/
ADMIN all edit". Blokada to kolejny fakt o trybie renderowania, nie o roli, więc wpina się tu
zgodnie z intencją — komentarz wymaga dopisania o blokadzie.

Czego `editorOnly` **nie** obejmuje i co trzeba zamknąć osobno: ustawienia panelu
(`onSettlementModeChange`, `onMaterialsNetRateChange` — przekazywane wprost,
`kosztorys-editor-body.tsx:388-391`), `openImport` (bramkowany osobno, linia 231), wersje/snapshoty
(`onOpenVersions`), oraz VAT / współczynniki / rabat globalny w dialogu ustawień.

Rekomendacja architektoniczna: wyprowadzić jedno `readOnly = preview || locked` na poziomie
`use-kosztorys-editor.ts`, zostawić `preview` wyłącznie dla układu i ujawniania, i przepiąć na
`readOnly` te miejsca, które dotyczą interakcji. To rozszczepienie jednego pojęcia na dwa, nie nowa
flaga obok starej.

**Wpięcie `locked` do edytora nie kosztuje zapytania**: `kosztorys_v2/page.tsx:38` czyta już
`investment` z `refData.investments`, więc `locked={investment.status === 'completed'}` to jedna
linia obok `hasSheet`.

### G. Zmiana statusu — powierzchnia i pułapka

`updateInvestmentAction` (`src/lib/actions/investments.ts:193`) ma **dokładnie jeden call site**:
`src/components/dialogs/edit-investment-dialog.tsx:44`. Status jest tam zwykłym polem formularza
(`investment-form.tsx:100-110`), zapisywanym razem z resztą.

Stąd pułapka, którą plan musi obsłużyć wprost: **bramka na inwestycji nie może blokować pola
`status`, bo inaczej nic nigdy nie da się odblokować.** Reguła jest polowa, nie całościowa —
zablokowana inwestycja odrzuca każdą zmianę pola **poza** `status`, a i tę tylko gdy aktor jest
OWNER/ADMIN i celem jest status niezablokowany. To dotyczy obu płaszczyzn: wrappera akcji i `access`
kolekcji `investments`.

Dziś nie istnieje żaden ślad audytowy zmiany statusu (por. `amount-edits`, które taki ślad trzyma dla
kwot: `src/collections/amount-edits.ts`, tworzone w `transfers.ts:280`).

### H. Confirmation dialog — co jest gotowe

`ConfirmDialog` (`src/components/ui/confirm-dialog.tsx`) to kontrolowany zamiennik `window.confirm`:
`open` / `title` / `description` / `confirmLabel` / `pending` / `pendingLabel` / `variant` /
`onConfirm` / `onCancel`. Wariant `alert` (czerwony) jest domyślny i komentarz mówi dlaczego: „a
confirm step exists because the action is hard to take back".

Wzorzec „potwierdź przed zapisem" jest już zamknięty w haku:
`src/components/kosztorys/editor/hooks/use-investor-impact-confirm.ts` (używany przez
`use-kosztorys-settings.ts:66` i `dialogs/use-client-view-mode-confirm.ts:16`) wystawia
`stageInvestorImpact(...)` + gotowe propsy dialogu. Ten sam kształt obsłuży oba potwierdzenia
blokady. Jedyna nowość: dziś confirm stoi przed pojedynczą akcją, a tu ma stanąć przed **submitem
formularza**, i tylko gdy status faktycznie przechodzi na `completed` — dialog edycji zna poprzedni
status (`defaultValues.status`), więc porównanie jest lokalne.

### I. Testy

Najbliższy zaczep w `context/foundation/test-plan.md` to **Risk #6** — „Kosztorys mutations are not
gated — an EMPLOYEE writes, or a role bypasses the MANAGEMENT_ROLES check on the new tables". Ta sama
rodzina (bramka na zapisie do tych samych tabel), ta sama najtańsza warstwa („integration — call the
action as each role, assert allow/deny") i ta sama pułapka, wypisana tam wprost: „**Testing only the
UI visibility; asserting the client guard instead of the server rejection**".

Różnica: #6 jest **rolowe**, blokada jest **stanowa** (status wiersza, nie rola aktora). Plan powinien
zdecydować, czy rozszerzyć mapę ryzyk o wiersz stanowy przez `/10x-test-plan`, czy zaczepić się o #6.

Istniejące domy testowe do wykorzystania: `src/__tests__/access-control.test.ts`, `roles.test.ts`,
`validate-hook.test.ts`, `transfer-actions.test.ts`. E2E: `e2e/transfer-create.spec.ts`,
`e2e/transfer-cancel.spec.ts`. Zgodnie z AGENTS.md specyfikacje mirrorują ścieżkę źródła w całości.

## Code References

- `src/collections/investments.ts:11-15` — `STATUS_OPTIONS`, jedyne miejsce definicji statusów
- `src/collections/investments.ts:46-51` — `access` inwestycji (`isAdminOrOwnerOrManager` na update)
- `src/collections/transfers.ts:69-77` — `access` + `hooks.beforeValidate: [validateTransfer]`
- `src/collections/users.ts:96` — `admin: isAdminOrOwnerOrManagerBoolean` (kto wchodzi do `/admin`)
- `src/hooks/transfers/validate.ts:25` — hook wejściowy wszystkich zapisów transakcji
- `src/lib/actions/run-action.ts:34` — `protectedAction`, bramka `MANAGEMENT_ROLES`
- `src/lib/actions/owner-only-action.ts:16` — wzorzec wrappera do skopiowania
- `src/lib/actions/transfers.ts:148` — `fetchAndAuthorize`, punkt autoryzacji edycji/anulowania
- `src/lib/actions/transfers.ts:330` — `setTransferInvoices`, świadomie poza `fetchAndAuthorize`
- `src/lib/actions/investments.ts:193` — `updateInvestmentAction`, jedyna ścieżka zmiany statusu
- `src/lib/kosztorys/create-item.ts:12` — `sectionInvestmentId`, zalążek wspólnego resolvera
- `src/lib/db/lock-investment.ts:16` — `lockInvestmentForReplace`, istniejąca blokada wiersza
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:361` — `editorOnly`
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:469` — `readOnly: preview` (miejsce wpięcia)
- `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts:92-99` — `readOnly` vs `previewVisible`
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:580` — realizacja `readOnly`
- `src/components/ui/confirm-dialog.tsx` — kontrolowany confirm
- `src/components/kosztorys/editor/hooks/use-investor-impact-confirm.ts` — wzorzec „potwierdź przed"
- `src/types/reference-data.ts:22` — `InvestmentRefT.status`, dostępny wszędzie bez nowego zapytania

## Architecture Insights

- **Kolekcja niesie hook, akcja niesie regułę.** Podział przebiega po profilu zapisu, nie po
  upodobaniu: `transactions` pisze wyłącznie przez Payload, więc hook jest tam kompletną bramką;
  kosztorys pisze surowym SQL-em, więc bramką jest wrapper akcji, a `access` kolekcji domyka tylko
  `/admin`. Każda próba postawienia jednej bramki dla obu światów zostawi dziurę po jednej ze stron.
- **Wrapper zamiast `if`-a to już przyjęta konwencja w tym repo**, z uzasadnieniem spisanym w
  `owner-only-action.ts`: narzucenie zawężenia strukturalnie sprawia, że nowa akcja nie może
  zapomnieć warunku. Blokada dokłada drugi wymiar do tego samego wzorca.
- **Nowa flaga vs rozszczepienie pojęcia.** Kuszące jest dołożenie `locked` obok `preview` w każdym
  z ~15 miejsc. Właściwe jest rozszczepienie `preview` na „interakcja" (`readOnly`) i „ujawnianie"
  (`previewVisible`) — bo warstwa kolumn już tak to widzi i to opisuje, a warstwa wyżej ten podział
  gubi. Blokada jest okazją, żeby go przywrócić, a nie powodem, żeby dołożyć trzecie pojęcie.
- **Ślepy zaułek, w który nie należy wchodzić:** wyłączenie zapisu przez `access.update: () => false`
  na kolekcji inwestycji. Zablokowałoby również pole `status`, czyli jedyne wyjście z blokady —
  reguła musi być polowa.

## Historical Context (from prior changes)

- `AGENTS.md` → **Transfer Business Logic**: `LABOR_COST` i `RABAT` są chwilowo znów księgowalne
  (EX-649, odwraca EX-555; zamyka EX-712) właśnie dlatego, że kosztorys części inwestycji jeszcze nie
  ma w aplikacji. Zablokowanie zakończonej inwestycji zabiera tę furtkę dla 69 inwestycji naraz — 6
  `RABAT`-ów i 3 `LABOR_COST`-y z tabeli w §B pochodzą dokładnie z tej ścieżki.
- `src/lib/actions/transfers.ts:~318` — decyzja właściciela z 2026-08-10 o otwartym podpinaniu faktur
  jest spisana w kodzie; blokada styka się z nią wprost (Open Questions #3).
- `src/lib/kosztorys/replace-tree-with-snapshot.ts:118-127` — EX-718 (`repeatable read` +
  `lockInvestmentForReplace`) pokazuje, że wholesale-podmiany kosztorysu są już serializowane na
  wierszu inwestycji. Odczyt statusu wewnątrz tej samej transakcji nie wymaga nowej blokady.

## Open Questions

Sześć rozstrzygnięć, których plan nie może zgadnąć. #1 jest decyzją biznesową, reszta to reguły
brzegowe — dla każdej podana rekomendacja.

1. **Dzień wdrożenia: 69 inwestycji naraz?** Blokada zadziała wstecz na wszystko, co dziś jest
   `completed`, a §B pokazuje, że na tych inwestycjach nadal się księguje (41 × `PAYOUT`). Trzy
   drogi: (a) zablokować wszystkie od razu i przyjąć falę próśb o odblokowanie — ta fala JEST
   informacją, pokazuje które inwestycje zamknięto przedwcześnie; (b) blokować tylko inwestycje
   zakończone po wdrożeniu, co wymaga osobnego znacznika i łamie „status jest flagą"; (c) jednorazowo
   cofnąć na `active` te zakończone, na których ostatnio coś się działo. **Rekomendacja: (a)** — jest
   spójna z decyzją „blokada totalna", nie wprowadza drugiego pojęcia i nie wymaga migracji danych.
   Koszt do zaakceptowania świadomie: przez pierwsze tygodnie właściciel będzie odblokowywał
   inwestycje pod spóźnione wypłaty.
2. **Ślad audytowy odblokowania.** Dziś zmiana statusu nie zostawia śladu. Precedens istnieje
   (`amount-edits`). Teraz to kilkanaście linii, później — migracja. **Rekomendacja: zapisywać kto i
   kiedy cofnął blokadę**, choćby minimalnie; przy EX-749 na horyzoncie to ta sama potrzeba.
   Formalnie poza tym, o co prosiłeś — do potwierdzenia.
3. **Faktury na zablokowanej inwestycji.** Podpięcie skanu do już zaksięgowanej transakcji to zapis,
   ale bardziej archiwizacja niż edycja — a ścieżka jest świadomie otwarta od 2026-08-10.
   **Rekomendacja: blokować** — blokada jest totalna, a fakturę można podpiąć przed zakończeniem;
   jeden wyjątek psuje regułę, którą trzeba potem tłumaczyć.
4. **Co wolno na zablokowanej: odczyt, ale gdzie kończy się odczyt.** Trzy przypadki graniczne:
   `previewKosztorysImport` / `compareWithSheet` czytają arkusz i nic nie zapisują → **zostawić**;
   `applyMaterialSync` zapisuje do arkusza właściciela → **zablokować**; `savePresetAction` czyta
   kosztorys i zapisuje **globalny szablon**, nie inwestycję → **zostawić** (zakończona inwestycja
   jest dobrym źródłem szablonu). Wymaga świadomej decyzji, bo wszystkie trzy wyglądają podobnie.
5. **Link kliencki na zablokowanej inwestycji.** Wygenerowanie i **unieważnienie** linku to zapisy,
   ale nie ruszają żadnej figury, a unieważnienie jest operacją bezpieczeństwa, której nie wolno
   zablokować. **Rekomendacja: link i ustawienia widoku klienta zostają dostępne** (już zawężone do
   OWNER/ADMIN przez `ownerOnlyAction`).
6. **Cel odblokowania.** Ustaliłeś „na aktywną". Czy `completed → planowana` ma być w ogóle możliwe?
   **Rekomendacja: nie** — jedno wyjście, jedna reguła do wytłumaczenia.
