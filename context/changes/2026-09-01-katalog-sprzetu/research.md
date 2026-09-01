# Research — katalog narzędzi i urządzeń

Data: 2026-09-01. Źródło: przegląd repo (moduł Flota) + rozpoznanie rynkowe.
Status: **materiał wejściowy do przycięcia** — opisuje pełny model, nie zakres, który budujemy.

## 1. Co już jest w repo i przekleja się wprost

Flota to ten sam kształt domenowy: rzecz + terminy + koszty + historia zdarzeń.

| Warstwa       | Flota                                                                              | Co przejmujemy                                                                           |
| ------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Encja         | `src/collections/vehicles.ts`                                                      | status, `note`, `flags` (JSON „do wymiany"), `exemptions`                                |
| Zdarzenia     | `src/collections/vehicle-inspections.ts`                                           | `performedAt` / `nextDueAt` / `cost` / `attachments` / bookkeeping powiadomień           |
| Listing       | `components/fleet/fleet-data-table.tsx`, `components/tables/fleet.tsx`             | `DeadlineCell`, bucket 7/30 dni (`lib/fleet/thresholds.ts`), kolumna kosztów w oknie dat |
| Detal         | `app/(frontend)/flota/[id]`, `vehicle-detail-tabs`, `inspection-history`           | taby + historia per typ                                                                  |
| Dialogi/formy | `dialogs/add-vehicle-dialog`, `forms/vehicle-form/`                                | TanStack + `form-dialog-shell`                                                           |
| Query/cache   | `lib/queries/fleet.ts`, `lib/fleet/dataset.ts`                                     | dataset bez daty w kluczu cache, „dziś" wstrzykiwane per request                         |
| Powiadomienia | `api/cron/fleet-reminders`, `STREAMS.fleet`, `notification-recipients.fleetDigest` | digest mailowy + badge nieprzeczytanych                                                  |

Generyki gotowe do użycia: `ui/data-table`, `ui/form-dialog`, `ui/confirm-dialog`, `ui/combobox`,
`ui/page-wrapper`, `lib/utils/parse-date-range`.

Wniosek: front to w większości konfiguracja istniejących prymitywów. Nowa jest warstwa danych.

**Pułapka nazewnicza.** `wToolsCoeff` / `ownToolsCoeff` na inwestycji to model CENOWY robocizny
(z narzędziami / bez narzędzi), nie inwentarz. Mimo wspólnego słowa „narzędzia" te dwie rzeczy nie
mają ze sobą nic wspólnego.

## 2. Trzy decyzje modelowe

### 2.1 „Gdzie jest" jako pochodna, nie pole

Pole `currentInvestment` na encji nie odpowie za pół roku na pytanie „kto zgubił szlifierkę".
Dojrzałe systemy trzymają niemodyfikowalny log przekazań (chain of custody) i liczą aktualne
miejsce z ostatniego wpisu. To ten sam ruch, co w kosztorysie (pomiar = suma etapów) i we flocie
(termin = ostatni przegląd).

Kształt: `equipment` + `equipment-assignments` (log) + `equipment-services` (log).

### 2.2 Przypisanie jest dwuwymiarowe

Rynek rozdziela „kto odpowiada" (pracownik) od „gdzie fizycznie jest" (inwestycja / magazyn /
pojazd). Wiertarka jest u pracownika, a pracownik jest na inwestycji. Jedno pole „przypisane do"
gubi jedną z tych osi przy każdym wydaniu.

Wpis w logu: `holder` (user, nullable), `investment` (nullable), `location` (magazyn / pojazd).
Payload umie relację polimorficzną (`relationTo: ['investments', 'users']`), ale to są dwie różne
osie — lepiej dwa nullable relationship + walidacja.

### 2.3 Egzemplarz vs model

Osiem identycznych wiertarek to osiem rekordów z numerami seryjnymi, nie jeden z `quantity: 8`.
Wiertła, tarcze, przedłużacze to materiał, nie sprzęt. Najczęstsza przyczyna śmierci takich
rejestrów: wciągnięcie rzeczy zużywalnych. Trzeba ustalić próg (wartość albo „ma numer seryjny").

## 3. Czego właściciel nie wymienił, a rynek to ma

- **Potwierdzenie odbioru** (accept / decline przez pracownika) — sedno ShareMyToolbox. Bez tego
  przy zgubieniu zawsze pada „ja tego nie brałem". Jedno pole `acceptedAt` na wpisie logu.
- **Transfer w terenie, pracownik → pracownik**, bez powrotu do magazynu. W praktyce większość ruchów.
- **Zdjęcie + stan przy wydaniu i zwrocie** — `media` / `attachments` już są, więc to darmowe.
  Rozstrzyga spory o uszkodzenia.
- **Inwentaryzacja / audyt** — przejście po magazynie, odhaczanie, raport braków. W EZO i Asset
  Panda osobny tryb.
- **Pełny cykl życia**: zakup → dostępne → wydane → serwis → zgubione / skradzione / wycofane /
  sprzedane. „Zgubione" to inny stan niż „nieprzypisane" — i to on trafia do raportu.
- **Koszt sprzętu na inwestycję** (godziny pracy maszyny alokowane na projekt — busybusy, EZO).
  Naturalnie zaczepiłoby się o inwestycję, ale to osobny krok.
- **Terminy inne niż gwarancja**: przeglądy elektronarzędzi, pomiary elektryczne, UDT dla
  podnośników i rusztowań. W PL realne obowiązki terminowe, mechanika identyczna z `nextDueAt` —
  jeden typ zdarzenia więcej, zero nowego kodu.
- **QR / kod kreskowy** — nalepka z ID prowadząca na stronę sprzętu. Tanie, a bez tego wydanie
  narzędzia to szukanie po nazwie na liście kilkuset pozycji.

## 4. Szkic pierwszej wersji (do przycięcia)

Trzy kolekcje (`equipment`, `equipment-assignments`, `equipment-services`), listing + detal na wzór
floty, dwa dialogi („Wydaj / przekaż", „Dodaj serwis"), gwarancja i terminy wpięte w istniejący
`DeadlineCell` i w cron-digest jako drugi strumień obok `fleetDigest`. Migracja pisana ręcznie
(reguła repo).

## 5. Otwarte pytania przed planem

1. Czy magazyn to byt w systemie, czy po prostu „brak przypisania"?
2. Czy potwierdzenie odbioru wchodzi od razu? Pociąga za sobą dostęp roli `EMPLOYEE` do modułu,
   którego Flota nie ma (`MANAGEMENT_ROLES`).
3. Gdzie leży próg „to jest sprzęt, a to materiał"?
4. Czy log przekazań jest potrzebny od początku, czy przy tej skali wystarczy pole „gdzie jest"
   plus prosta historia? (Kluczowa decyzja przycinająca — patrz 2.1.)

## Źródła

- https://www.sharemytoolbox.com/construction-tool-tracking/tool-tracking-system/
- https://www.assetpanda.com/solutions/tool-tracking/
- https://ezo.io/ezofficeinventory/industries/construction-asset-tracking-software/
- https://www.gigatrak.com/tool-tracking/tool-check-out-system/
- https://www.panatrack.com/construction-equipment-management-software/
- https://oxmaint.com/blog/post/how-to-build-equipment-asset-register-from-scratch
- https://oxmaint.com/blog/post/track-equipment-warranty-service-contracts-cmms
- https://bulbthings.com/blog/asset-panda-vs-ezofficeinventory
