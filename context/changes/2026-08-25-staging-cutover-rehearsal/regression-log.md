# Cutover rehearsal — regression log (staging on `cutover_rehearsal`)

Living record of the pre-merge check of `staging` → `main`, in two phases.
**Phase 1: confirm that what already worked still works.** **Phase 2** (from „Faza 2" below):
the new functionality `main` has nothing to compare against. The verdict for phase 2 sits just
above the cleanup checklist at the end.

## Problemy — jedna lista, ze statusem

_Pełny opis, dowód i SQL każdego z nich jest niżej w tym pliku — przy pozycji stoi nazwa sekcji
(numery linii nie przeżywają prettiera, nazwy tak).
Stan na 25.08.2026, gałąź `heic-upload-gap`. Legenda: `[ ]` otwarte · `[x]` domknięte._

### Kasują dane

- [x] · 🔴 · **naprawione na tej gałęzi** · § „Usuń całą fakturę" zostawia pliki · **Usuwanie faktury wielostronicowej zostawiało pliki
      w magazynie bez rekordu.** Przyczyna znaleziona i odtworzona: sprzątanie kasowało wszystkie
      strony **równolegle**, a baza wdrożeniowa (Neon) przy równoległych zapisach Payloada
      utrzymuje jeden z nich i **melduje sukces dla wszystkich**. Naprawa: kasowanie jedna strona
      po drugiej. Na Neonie równolegle 5 stron → 3 sieroty, sekwencyjnie 12 na 12 czysto.
      ⇒ **nic już nie blokuje scalenia**
- [x] · 🔴 · **naprawione na tej gałęzi** · § „Realny problem: zmiana typu kasuje skan" · **Zmiana typu wydatku kasowała wszystko: kwotę,
      netto, opis, notatkę i podpięty skan faktury.** Czyszczenie zawężone do pól nagłówka (kasa,
      pracownik, inwestycja, „rozliczone") — pozycje, ich pliki i znaczniki skanu zostają. Pola
      obce dla nowego typu i tak odpadają przy zapisie. Sprawdzone na żywo: kwota, opis i plik
      przeżywają zmianę typu, a zapisana transakcja jest poprawna
- [ ] · 🔴 · **cudze, w trakcie naprawy** · § „DEFEKT: Escape nie anuluje edycji komórki" · **Escape w komórce siatki zapisuje zamiast
      anulować** (2× odtworzone: `7` i `8` wylądowały w Przedmiarze). Naprawia to aktywna zmiana
      `context/changes/2026-08-25-kosztorys-decimal-cell-draft/` (`status: implementing`, ta sama
      gałąź) — jej plan wymienia to wprost. **Nie ruszać, kolizja.** Cmd+Z to cofa
- [ ] · 🔴 · **cudze, w trakcie naprawy** · nie moje znalezisko · **„Rabat wart.": 12,5 zapisuje się
      jako 125** — input zatwierdza każdy klawisz. W tę komórkę nie da się wpisać ułamka. Ta sama
      zmiana co wyżej

### Pokazują nieprawdę

- [x] · 🟡 · **naprawione na tej gałęzi** · § „nagłówek sekcji podaje inwestorowi liczbę pozycji sprzed filtra" · **Nagłówek sekcji podawał INWESTOROWI liczbę pozycji sprzed filtra**
      — „WC (52 poz.)" nad czterema wierszami. Ten sam filtr usuwał całą pustą sekcję, ale nie
      korygował licznika w przerzedzonych. Widział to klient, nie tylko właściciel. Naprawa:
      podsumowania sekcji liczą się z **dokumentu, który klient dostaje**, a nie z pełnego zbioru.
      Żadna kwota się nie rusza — ukrywany wiersz jest pusty na obu osiach
- [ ] · 🟡 · otwarte · § „Stawka «bez narzędzi» jest w bazie inna…" · **Stawka „bez narzędzi" 0,55 zamiast 0,5525 w 114 na 117
      inwestycji.** Zastane (leży w bazie od migracji z lipca), dziś nieosiągalne — bo żadna z nich
      nie ma kosztorysu. Odpali przy pierwszej, która dostanie go z szablonu
- [ ] · 🟡 · otwarte · § „«Tryb anulowań» nigdy nic nie pokaże na ekranie kasy" · **„Tryb anulowań" na ekranie kasy nigdy nic nie pokaże.** Wszystkie
      296 anulowań w bazie ma pustą kasę, pracownika i inwestycję, więc zawężenie do kasy wycina je
      co do jednego. Zastane, strukturalne — nie migracyjne
- [ ] · 🟡 · otwarte · § „Findings" (ledger fazy 1), wpis o React #418 · **Niedopasowanie hydracji na kolumnie „Czas dodania"** — serwer
      renderuje UTC, przeglądarka Europe/Warsaw, więc każdy wiersz rozjeżdża się o dwie godziny.
      Zastane: `main` ma ten plik bajt w bajt taki sam
- [ ] · 🟡 · otwarte · § „Zakładki podsumowania" → „Ta sama kwota… różni się o grosz" · **Ta sama kwota różni się o grosz w dwóch miejscach zakładki
      „Podwykonawcy"**

### Blokują albo mylą, ale nic nie psują

- [ ] · 🔵 · otwarte · § „Panel podsumowania przykrywa jedyne wejście…" + „…przykrywa też siatkę" · **Rozwinięty panel podsumowania przechwytuje kliknięcia**
      — przykrywa jedyne wejście do importu na pustym kosztorysie ORAZ dolną część siatki. Panel
      jest rozwinięty domyślnie, więc to pierwszy ekran, jaki właściciel zobaczy. Domknięte dowodem:
      po „Schowaj podsumowanie" ten sam klik na tym samym wierszu udaje się natychmiast
- [ ] · 🔵 · otwarte · § „Bramka «tylko właściciel»" · **Bramka „tylko właściciel" wyłącznie po stronie serwera** —
      manager widzi obie pozycje w menu jako klikalne i idzie przez trzy ekrany, żeby usłyszeć „nie".
      Zapis naprawdę nie przechodzi (sprawdzone w bazie), więc to nie dziura, tylko droga donikąd
- [ ] · 🔵 · otwarte · § „Przycisk «Admin» w stopce prowadzi na PRODUKCJĘ" · **Przycisk „Admin" w stopce na preview prowadzi na PRODUKCJĘ.**
      Użytkownikowi nie szkodzi (na produkcji link jest poprawny), ale przenosi testującego na żywe
      dane jednym kliknięciem
- [x] · 🔵 · dropped · ledger fazy 1 · picker kasy podaje MANAGEROWI kasę główną, której `/kasy` mu
      nie listuje, a `/kasa/5` odmawia. Zastane, sprzed tej gałęzi, nie warte churnu

### Domknięte

- [x] · 🟡 · **naprawione na tej gałęzi** · § „Faktura wielostronicowa" → „Drobiazg z niespójności" · natywne okno przeglądarki przy usuwaniu
      faktury/strony. Commit `e7d31903` (ConfirmDialog) **jest w `heic-upload-gap`, ale NIE ma go
      w `staging`** — czyli naprawa wjedzie tylko razem z tą gałęzią

### Nie usterki, tylko świadome amputacje (decyzja właściciela)

- `/raporty` wygaszone razem z wejściem w menu (zastępuje je „Flota") · § „Czego po przełączeniu nie będzie" → „1. Raporty"
- pobieranie faktur zawężone do trzech ekranów — **znika z pulpitu** · § „Czego po przełączeniu nie będzie" → „3. Pobieranie faktur"

## Setup under test

|              |                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| URL          | `wykonczymy-git-staging-wykonczymys-projects.vercel.app`                                                          |
| deployment   | `dpl_As6aNg9gUxxtT79vu5YMY2GUWz9M` · sha `1e53af17` · fresh build (not a redeploy clone)                          |
| DB           | Neon branch `cutover_rehearsal`, `ep-wild-resonance-agwnbpae-pooler` — zero-copy branch of prod, taken 2026-08-25 |
| migrations   | 76 applied (50 pre-existing + the 26 under test); `index.ts` ↔ DB diff is empty both ways                         |
| account      | `test@test.pl` (Manager/Admin)                                                                                    |
| verified 1:1 | 3754 transactions · 115 investments · 1326 media · newest row `#4647 · 24.08.2026`                                |

The app's own footer badge reads `PREVIEW · neondb@ep-wild-resonance-agwnbpae-pooler`,
so every observation below is against the prod copy, not the old staging branch.

## Findings

_Legend — `[x]` terminal (fixed / dismissed / dropped), `[ ]` still owed._

- [x] · dismissed · `/inwestycje` · footer prints `neondb@ep-wild-resonance-…` — deliberate
      environment badge, and the very indicator that confirms the DB swap. Not a leak.
- [x] · dismissed · `OPTIONS /` → 400 · emitted by the Vercel Live toolbar, not the app.
- [x] · 🟡 WARNING · dismissed (nie regresja cutovera) · `src/lib/utils/format-date.ts:9`
      · React #418 — niedopasowanie hydracji na `/`, `/kasa/*`, `/inwestycje/[id]`; brak go na
      `/inwestycje`. Mechanizm ustalony: `formatPLDateTime` woła `toLocaleString('pl-PL', …)`
      **bez `timeZone`**, więc serwer Vercela renderuje `08:13` (UTC), a przeglądarka `10:13`
      (Europe/Warsaw) — kolumna „Czas dodania" rozjeżdża się w każdym wierszu. Odrzucone dla
      cutoveru na twardym dowodzie: `git show main:src/lib/utils/format-date.ts` jest bajt
      w bajt identyczny, a `main:src/components/tables/transfers.tsx:184` ma tę samą kolumnę —
      produkcja emituje to samo dzisiaj. Realny defekt, ale nie ten merge go wnosi.
      test: test-driven-debugging · unit — `formatPLDateTime` z ustawionym `TZ` da się przypiąć
      bez przeglądarki; guard = ta sama data w dwóch strefach daje ten sam string.
- [x] · 🔵 OBSERVATION · dropped · `src/components/nav/top-nav.tsx:29` · picker kasy
      w „Nowej wpłacie" podaje MANAGEROWI **31** pozycji, w tym `Kasa główna Bartek` (MAIN),
      której `/kasy` mu nie listuje, a `/kasa/5` odmawia. Czyli zobaczyć salda kasy głównej nie
      może, ale wpłacić do niej owszem. Niespójność realna, sprzed tej gałęzi (bramka w
      `kasa/[id]/page.tsx` jest opisana jako „matches prior dashboard behavior"), bez związku
      z 26 migracjami — nie blokuje merge'a.
- [x] · dismissed · `src/components/nav/nav-openrouter-balance.tsx:5` · chip „Saldo $9.59"
  w topbarze — to saldo kredytów OpenRouter, dolary z definicji (`usd()`), nie waluta
  aplikacji. Fałszywy alarm z mojego skanu na `$`.
- [x] · dropped · dialog anulowania · „Brakuje **1 znaków**" — polska liczba mnoga bez
      formy pojedynczej dopełniacza („1 znaku"). Kosmetyka, nie warta churnu.
- [x] · dismissed · dialog „Edytuj transakcję" na `INVESTOR_DEPOSIT` oferuje „Kategorię"
      z listy wydatkowej (paliwo, zus, narzędzia…). Wspólny formularz; pole nie zostało zapisane
      na wpłacie (`expense_category_id` w `#4648` pozostał pusty). Bez skutku.

## Route walk

| route                                                               | stan | uwagi                                                                                                                                   |
| ------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/zaloguj`                                                          | ✅   | logowanie działa, redirect na `/`                                                                                                       |
| `/` (Pulpit)                                                        | ✅   | ostatnie transakcje, `#4647` z 24.08                                                                                                    |
| `/kasy`                                                             | ✅   | salda liczone na odczycie: pomocnicze 34 494,90 · pracownicze 4988,28 · wirtualne −383 550,08; `POST /kasy` → 200 (server actions żyją) |
| `/inwestycje`                                                       | ✅   | 46 aktywnych, kolumny v1/v2 renderują się, „brak danych" na v2 zgodnie z projektem                                                      |
| `/inwestycje/31` (v2)                                               | ✅   | domyślna zakładka to **v2**; Robocizna 0,00 bo kosztorys pusty — zgodne z „brak kosztorysu = 0 zł, nie fallback do transferów"          |
| `/inwestycje/31?widok=v1`                                           | ✅   | **spina się do grosza** — patrz niżej                                                                                                   |
| faktura na `#4543`                                                  | ✅   | `transactions_rels` → media → blob; `GET /api/media/file/…pdf` → **200**                                                                |
| `/kasa/9`                                                           | ✅   | saldo 10 005,56 zł — zgodne co do grosza z listą `/kasy`                                                                                |
| `/kasa/5`                                                           | ✅   | 404 dla MANAGERA (celowa bramka), pełny widok dla OWNERA — saldo 715 347,78 zł odtworzone z SQL                                         |
| `/zgloszenia` `/kosztorysy` `/flota` `/pracownicy` `/pracownicy/39` | ✅   | listy z danymi, liczności zgodne z bazą — patrz tabela niżej                                                                            |
| `/admin`                                                            | ⚠️   | tylko 200; wnętrze świadomie nietknięte — patrz „Czego ta próba nie pokrywa"                                                            |

### Kontrola arytmetyki v1 (11 Listopada 40)

To najmocniejszy pojedynczy sygnał, że płaszczyzna v1 przeżyła migracje — trzy niezależne
źródła (lista, karta, suma składników) dają tę samą liczbę:

```
materiały budowlane      126 332,62
materiały wykończeniowe   70 701,52
pozostałe koszty              68,00
                        -----------
                         197 102,14   = kolumna „Wydatki inwestycyjne" na liście

197 102,14 + robocizna 471 819,00 − wpłaty 303 382,34 = 365 538,80
                                     = „Bilans netto v1" na liście (−365 538,80)
```

### Faktury — czego ten test NIE dowodzi

Wszystkie **1224** transakcje z fakturą mają dokładnie **jedną** (rozkład sprawdzony w SQL:
`1 → 1224`, zero z więcej). Wielostronicowość to nowa zdolność, której żadne istniejące dane
nie używają — więc migracja `invoice_has_many` jest tu przetestowana wyłącznie od strony
regresji („stara, pojedyncza faktura nadal się otwiera"), i tak właśnie ma być. Ścieżka
„dodaj drugą stronę" to nowa funkcjonalność i nie jest przedmiotem tej próby.

- [x] · dismissed · `src/app/(frontend)/kasa/[id]/page.tsx:51` · `/kasa/5` daje 404 dla
      MANAGERA — `if (!isAdminOrOwnerRole(user.role) && register.type === 'MAIN') notFound()`,
      z komentarzem „matches prior dashboard behavior". Zachowanie sprzed tej gałęzi,
      potwierdzone z drugiej strony: po podniesieniu roli do OWNER strona otwiera się normalnie.
- [x] · dropped · `/inwestycje/31` · karta inwestycji linkuje do `/kasa/5` także wtedy, gdy
      zalogowana rola tej kasy nie zobaczy — martwy link dla MANAGERA. Realne, ale sprzed tej
      zmiany i bez związku z cutoverem; nie blokuje merge'a.

## Test zapisu (najmocniejszy dowód)

Odczyt mógłby działać na zmigrowanej tabeli nawet gdyby zapis był zepsuty, więc przeszedłem
pełną pętlę przez normalne UI na transakcji `#4647`:

| krok                     | `transactions_rels` | efekt                                                                                             |
| ------------------------ | ------------------- | ------------------------------------------------------------------------------------------------- |
| stan wyjściowy           | 1224                | —                                                                                                 |
| „Dodaj fakturę" + upload | **1225**            | media `1407` = `cutover-test-faktura-e4243c.png` (180 B), wiersz `parent_id=4647, path='invoice'` |
| podgląd                  | —                   | plik renderuje się z blobu preview                                                                |
| „Usuń" + potwierdzenie   | **1224**            | wiersz powiązania znika, `media.1407` skasowany                                                   |

Branch wrócił do stanu sprzed testu. Ścieżka zapisu do tabeli utworzonej przez
`20260810_0_invoice_has_many` działa przez normalny przepływ aplikacji, nie tylko przez SQL.

## Przemiał masowy — 553 adresy

Werdykt z próbki to nie jest test, więc każdy istniejący rekord dostał własne wejście.
Pobierane w pętli `fetch` wewnątrz zalogowanej sesji, z sprawdzaniem statusu i markerów
błędu w strumieniu RSC:

| zestaw                                                                                    | adresów | OK  | trafienia |
| ----------------------------------------------------------------------------------------- | ------- | --- | --------- |
| 116 inwestycji × {domyślny, `?widok=v1`}                                                  | 232     | 232 | 0         |
| 33 kasy · 49 pracowników · 116 × `/kosztorys` · 116 × `/kosztorys_v2` · wszystkie indeksy | 321     | 320 | 1         |

Jedyne trafienie to `/kasa/5 → notFound`, czyli opisana niżej celowa bramka na kasę MAIN.
Arytmetyka listy kas zamyka się na tej samej bramce: **33 = 30 widocznych + 1 MAIN + 2 nieaktywne**.

## Cykl życia transferu — pełna pętla przez UI

Największa nieprzetestowana funkcja z poprzedniego podejścia. Rola MANAGER **ma** dostęp do
wszystkich trzech dialogów w topbarze (`top-nav.tsx:29-31` nie bramkuje ich wcale) — moja
wcześniejsza teza, że ich nie ma, była błędna i została poniżej sprostowana.

| krok       | co zrobiłem                                                                     | co pokazał SQL                                                                                            |
| ---------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| założenie  | „Nowa wpłata" → inwestycja _Altowa 12_, kasa _Kasa - Jura_, 1234,56 zł, gotówka | `#4648 INVESTOR_DEPOSIT 1234.56 · investment 66 · register 16 · created_by 63`                            |
| odczyt     | wiersz renderuje się na `/kasa/16` z kompletem 16 kolumn                        | —                                                                                                         |
| edycja     | „Edytuj transakcję" → zmiana opisu                                              | `description` zmieniony, `updated_by_id=63`, `updated_at` odświeżony                                      |
| walidacja  | anulowanie bez powodu / z 2 znakami                                             | „Tak, anuluj" **disabled**, licznik brakujących znaków żyje                                               |
| anulowanie | powód wpisany, potwierdzone                                                     | `#4648 cancelled=t` **oraz** `#4649 CANCELLATION 1234.56 → cancelled_transaction_id=4648`, powód w opisie |

Ślad audytowy zgadza się co do joty z opisem w `AGENTS.md`. Wiersz znika z widoku
(tryb „Anulowane ukryte"), a **anulowanie jest arytmetycznie neutralne** — sprawdzone nie
przez odczyt z cache'u, tylko przez surowe sumy:

```
inwestycja 66, wiersze czynne wg SQL         UI (v2)              UI (v1)
INVESTOR_DEPOSIT    207 762,00  (3 anulowane) Wpłaty −207 762,00   Wpłaty 207 762,00
INVESTMENT_EXPENSE   62 469,67                Materiały 62 469,67
  ├ budowlane  (38)  61 850,47                                     61 850,47
  └ wykończeniowe(1)     619,20                                       619,20
LABOR_COST          163 176,00                Robocizna 0,00 ¹     163 176,00
                                              Pozostało            Bilans inwestora
                                              −145 292,33 ²        −17 883,67 ³
```

¹ zgodnie z regułą „brak kosztorysu = 0 zł, nigdy fallback do transferów" (prod ma 0 pozycji
kosztorysu). ² `62 469,67 − 207 762,00`. ³ `62 469,67 + 163 176,00 − 207 762,00`.
Obie płaszczyzny spinają się do grosza z surowym SQL-em **na zmigrowanej bazie**.

### Płaszczyzna VAT — cały prod siedzi na moście legacy

| `vat_plane` | wierszy | z `net_amount` |
| ----------- | ------- | -------------- |
| `NULL`      | 3755    | 0              |
| `NET`       | 1       | 0              |

Ten jeden `NET` to wiersz, który przed chwilą sam założyłem. Czyli **żaden istniejący rekord
nie korzysta z płaszczyzny brutto/netto** — wszystkie 3755 przechodzą mostem legacy
(`net_amount IS NULL`, wyliczane przy VAT), i to właśnie ta ścieżka dała powyższe zgodności
co do grosza. Nowa płaszczyzna to nowa funkcjonalność, uruchamiana dopiero przez wiersze
zakładane po merge'u — poza zakresem tej próby, ale warto wiedzieć, że jej milczenie na
starych danych jest stanem oczekiwanym, a nie objawem nieudanej migracji.

## Transfer między kasami — jedyny typ ruszający dwa salda

| krok                 | Adrian Gotówka | Kasa - Jura | Pomocnicze (7) | Pracownicze (20) |
| -------------------- | -------------- | ----------- | -------------- | ---------------- |
| stan wyjściowy       | 20 863,29      | 472,24      | 34 494,90      | 4988,28          |
| po transferze 100 zł | **20 763,29**  | **572,24**  | **34 394,90**  | **5088,28**      |
| po anulowaniu        | 20 863,29      | 472,24      | 34 494,90      | 4988,28          |

Wiersz: `#4650 REGISTER_TRANSFER 100.00 · source 7 → target 16`. Dialog **przed** zapisem
policzył na żywo „Aktualne saldo 20 863,29 → Saldo po transakcji 20 763,29", czyli serwerowa
funkcja salda czyta zmigrowaną bazę i zgadza się z listą. Suma globalna `−344 066,90` nie
drgnęła w żadnym kroku — prawidłowo, bo transfer wewnętrzny znosi się w sumie.

Dwie rzeczy, które ten test przy okazji udowadnia: **inwalidacja cache po akcji serwerowej
działa** (lista pokazała nowe salda natychmiast, bez czekania na TTL), a **anulowanie jest
neutralne także na ścieżce dwustronnej**.

### Saldo kasy odtworzone niezależnie z surowego SQL

Nie porównanie UI z UI, tylko rekonstrukcja od zera:

```
kasa 16 (Kasa - Jura), wiersze czynne
REGISTER_TRANSFER  wpływy   + 16 500,00
COMPANY_FUNDING             +  2 543,69
INVESTMENT_EXPENSE  wypływy − 18 571,45
                            ------------
                                 472,24   = saldo na /kasy i na /kasa/16
```

## Sterowanie tabelą transferów — każda liczba przeciw SQL

| kontrolka     | co sprawdzone                    | UI                                                                  | SQL                            |
| ------------- | -------------------------------- | ------------------------------------------------------------------- | ------------------------------ |
| filtr typu    | `?type=REGISTER_TRANSFER`        | 10 wyników · 16 500,00 zł                                           | 10 · 16 500,00                 |
| ”             | `?type=INVESTMENT_EXPENSE`       | 89 wyników · 18 571,45 zł                                           | 89 · 18 571,45                 |
| ”             | `?type=COMPANY_FUNDING`          | 1 wynik · 2543,69 zł                                                | 1 · 2543,69                    |
| ”             | `?type=PAYOUT`                   | „Brak danych"                                                       | 0 wierszy                      |
| tryb anulowań | `?showCancelled=1` + transfery   | 11 wyników                                                          | 11 (10 czynnych + 1 anulowany) |
| zakres dat    | `?from=2026-08-01&to=2026-08-31` | 18 · 3346,50 zł                                                     | 18 · 3346,50                   |
| ”             | cały 2026                        | 100 · 37 615,14 zł                                                  | 100 · 37 615,14                |
| sortowanie    | trójstan po „Kwota"              | data desc → kwota desc → kwota asc → powrót; stabilne przy remisach | —                              |
| kolumny       | odznaczenie „Opis"               | znika z `thead` i **przeżywa reload** (nie przez URL)               | —                              |

Filtry siedzą w query stringu, więc widok da się przekleić — a stan kolumn nie, i to jest
spójne: filtr to pytanie o dane, układ kolumn to preferencja przeglądarki.

## Listy pozostałych modułów — liczności przeciw SQL

| trasa         | UI                                                                                  | SQL                                          |
| ------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| `/zgloszenia` | 170 wierszy, „170 nowych"                                                           | 170 leadów, wszystkie `contact_status='new'` |
| `/pracownicy` | 43 wiersze                                                                          | 43 użytkowników `active=true`                |
| ” wypłaty     | Orłowski 145 500,00 · Harasim 38 801,89 · Furmańczyk 25 500,00 · Bazylewicz 6500,00 | identycznie, `sum(PAYOUT)` po `worker_id`    |
| `/kosztorysy` | 116 wierszy: 56 „Powiązane" + 60 „Dodaj kosztorys"                                  | 56 `kosztoryses` / 116 `investments`         |
| `/flota`      | „0 pojazdów w użyciu" + „Brak danych"                                               | 0 `vehicles` — pusty stan, nie wywrotka      |
| `/raporty`    | pełna tabela transferów, `#4647` na czele                                           | —                                            |

## Ścieżka OWNER — bo MANAGER nie renderuje marży wcale

Cały przemiał wyżej szedł na roli MANAGER. Rozgałęzień po roli jest sześć i pięć z nich to
sama widoczność, ale szóste jest inne: `inwestycje/[id]/page.tsx:110`,
`investment-summary-panel.tsx:30` i `kosztorys_v2/page.tsx:78` decydują, czy `financials`
**w ogóle przechodzi** do komponentu klienckiego. Rola MANAGER nie wykonuje tego kodu —
a to znaczyło, że **4 068 933,52 zł robociziny w 88 wierszach nie przeszło przez ani jeden
odczyt**. Stąd druga tura na podniesionej roli.

Jedno sprostowanie do własnego rozumowania: `20260611_1_add_loss_enum` siedzi w **batchu 18**,
czyli był w bazie przed tą paczką (te poszły w batchach 22 i 23). `strata` nie jest nowością
tego merge'a — argumentem jest sam wolumen niesprawdzonych pieniędzy, nie migracja enuma.

### Kasa główna — największe saldo w aplikacji, odtworzone od zera

```
kasa 5 (Kasa główna Bartek), wiersze czynne
INVESTOR_DEPOSIT       + 3 990 909,23
INVESTMENT_EXPENSE     − 1 353 177,85
PAYOUT                 − 1 161 807,73
OTHER                  −    55 198,30
REGISTER_TRANSFER  in  +    54 545,76
REGISTER_TRANSFER out  −   766 168,05
CORRECTION             +     6 244,72   (kwota ujemna, więc odejmowanie dodaje)
                       ---------------
                           715 347,78   = UI
```

Suma na `/kasy` domyka się z nowym kubełkiem: `34 494,90 + 4988,28 − 383 550,08 + 715 347,78
= 371 280,88`. Lista rośnie z 30 do 31 pozycji (dochodzi MAIN), `/kasa/5` przestaje być 404.

### Marża i obie jej rzadkie gałęzie

Lista inwestycji zyskuje kolumny „Marża v1" i „Marża v2". Sprawdzone przeciw surowemu SQL-owi:

| inwestycja            | robocizna  | wypłaty    | wliczone w robociznę | rabat   | strata | marża UI       | wzór |
| --------------------- | ---------- | ---------- | -------------------- | ------- | ------ | -------------- | ---- |
| 31 · 11 Listopada 40  | 471 819,00 | 208 634,00 | 4421,85              | —       | —      | **258 763,15** | ✓    |
| 78 · Bluszczanska 17  | 43 848,00  | 24 800,00  | —                    | 2493,00 | —      | **16 555,00**  | ✓    |
| 47 · Meander 22/25    | 0          | 0          | —                    | —       | 142,65 | **−142,65**    | ✓    |
| 62 · Jezioranskiego   | 0          | 0          | —                    | —       | 362,84 | **−362,84**    | ✓    |
| 98 · Terespolska 2/44 | 0          | 0          | —                    | —       | 39,00  | **−39,00**     | ✓    |

Trzy inwestycje ze stratą mają zera we wszystkich pozostałych składnikach, więc izolują tę
gałąź wzoru idealnie. Na `47` widać przy okazji semantykę z `AGENTS.md` odtworzoną na żywych
danych: dwa wydatki `117,70 + 24,95 = 142,65`, strata `142,65` zjada je dokładnie, **bilans
inwestora 0,00** — klient przestaje być winien to, co firma wzięła na siebie. Na `78`
z rabatem bilans schodzi do `0,33 zł` (`3044,67 + 43 848,00 − 44 400,00 − 2493,00`).

### Rozbieżność, która okazała się moim błędem w liczeniu

Na inwestycji 31 wydatki niesettled dają w SQL `200 847,38`, a UI pokazuje `197 102,14`.
Luka `3745,24` to **9 wierszy `CORRECTION` o sumie −3745,24** — karta składa je do kubełka
„Materiały budowlane" (`130 077,86 − 3745,24 = 126 332,62`). Nie defekt; moje pierwsze
zestawienie po prostu pomijało korekty.

## Wnioski

**To, co działało, działa.** Płaszczyzna v1 (transfery, kasy, salda, bilans inwestora, marża,
faktury) przeżyła 26 migracji bez rozjazdu. Metoda była jedna i konsekwentna: **nie porównywać
UI z UI, tylko odtwarzać każdą liczbę od zera z surowego SQL-a na zmigrowanej bazie.** Żadna
z rekonstrukcji nie rozjechała się ani o grosz — ani saldo kasy pracowniczej, ani największe
saldo w systemie (715 347,78 zł), ani marża z rabatem, ani marża ze stratą, ani sumy filtrów
i zakresów dat.

Zapis też jest udowodniony, nie założony: pełna pętla „załóż → odczytaj → edytuj → anuluj"
przez normalne UI, ze śladem audytowym w bazie i z **arytmetyczną neutralnością anulowania**
potwierdzoną na ścieżce jedno- i dwustronnej. Do tego dowód, że inwalidacja cache po akcji
serwerowej działa — lista pokazała nowe salda natychmiast, nie po TTL.

Baza wróciła do stanu wyjściowego: **3754 wiersze, max id 4647**, rola konta testowego
z powrotem `MANAGER`.

**Czego ta próba nie pokrywa** — uczciwie, żeby nikt tego nie przecenił:

- ~~**Zakładanie transferu** — rola MANAGER nie ma tego przycisku w UI.~~ **Nieprawda,
  sprostowane.** `top-nav.tsx:29-31` renderuje `DepositDialog`, `InternalTransferDialog`
  i `ExpenseDialog` bez żadnego bramkowania rolą. Mój wcześniejszy skan szukał przycisków po
  tekście, a te trzy są ikonowe — nie mają ani etykiety, ani `aria-label`. Pełna pętla
  „załóż → odczytaj → edytuj → anuluj" jest przetestowana wyżej.
- **Kosztorys** — prod ma 0 pozycji, więc `/kosztorysy` sprawdzono tylko jako „nie wywala
  się na pustych danych". Tak samo `/flota`: 0 pojazdów w bazie.
- **Panel Payload `/admin`** — świadomie odłożony (decyzja właściciela: „osobny temat").
  To jedyna powierzchnia czytająca przez ORM Payloada i jego wewnętrzne tabele
  (`payload_migrations`, `payload_preferences`, `payload_locked_documents`), a więc jedyna,
  która potrafiłaby się wywalić na migracji niewidocznej dla reszty aplikacji — reszta figur
  idzie surowym SQL-em. Sprawdzony wyłącznie jako HTTP 200. **To jest znana, nazwana luka
  tej próby**, nie przeoczenie.
- **Wnętrze zgłoszenia** — lista 170 leadów renderuje się i zgadza z bazą, ale szczegółów
  pojedynczego zgłoszenia nie otwierałem.
- **Zakładka marży w `kosztorys_v2`** (`summary-margin-tab.tsx`, też ADMIN/OWNER) — prod ma
  0 pozycji kosztorysu, więc nie ma czego liczyć.
- **Blob** — staging czyta store preview, produkcja swój; ta wersja nie rusza logiki blobów,
  więc to nie jest ryzyko cutoveru, ale też nie jest przez tę próbę potwierdzone.

# Faza 2 — funkcjonalności, których faza 1 nie mogła dotknąć

Faza 1 sprawdzała to, co prod już ma. Zostało 684 otwartych manualczków, z czego **586 (86%)
nie miało na czym się wykonać** — prod ma zero pozycji kosztorysu i zero pojazdów. Zamiast
seedować, odblokowujemy je tak, jak zrobi to właściciel: **normalnym importem z arkusza Google**
przez UI. To przy okazji przeklikuje cały flow importu, a nie tylko jego wynik.

## Import z arkusza Google — inwestycja 31 „11 Listopada 40"

Wybrana świadomie: jej figury v1 znam z fazy 1 co do grosza, więc po imporcie od razu widać,
co robi most kosztorys → robocizna.

### Panel podsumowania przykrywa jedyne wejście na pustym kosztorysie

Na pustym kosztorysie CTA **„Pobierz z arkusza Google…"** renderuje się pod rozwiniętym panelem
podsumowania i nie da się w nie kliknąć. Nie jest to artefakt małego okna — sprawdzone na
1188×732, 1440×900, 1920×1080 i 2560×1400, zakryte na każdym. Panel jest rozwinięty domyślnie:
`use-totals-panel-open.ts` startuje z `'open'`, a stan siedzi w `localStorage`, więc pierwszy
użytkownik trafia dokładnie na tę konfigurację.

**Nie jest to blokada** — ten sam import ma drugie wejście w menu „Opcje", które leży w toolbarze
nad panelem (`kosztorys-actions-menu.tsx:88`, sekcja „Arkusz Google", widoczna przy `hasSheet`).
Tamtędy import poszedł bez problemu. Kosmetyka pustego ekranu, nie defekt cutoveru — sam kod
panelu jest niezmieniony względem prod.

### Preflight — i to jest najmocniejszy dowód w całej próbie

Okno przed importem zapowiedziało: **13 sekcji · 336 prac · 10 etapów**, mnożnik cennika
z narzędziami 0,65 / bez narzędzi 0,5525, 1 praca poza cennikiem (wejdzie za 0 zł),
44 stawki podwykonawców bez rozstrzygnięcia + 2 z jednego cennika. Żadnej pracy z kosztorysu
nie brakuje w arkuszu.

Sekcja „Porównanie sum" orzekła zgodność na obu wierszach stopki. Sprawdziłem to **niezależnie,
surowym SQL-em na bazie po migracji**, nie porównując UI do UI:

| figura                                              | odtworzona z SQL | stopka arkusza | różnica |
| --------------------------------------------------- | ---------------- | -------------- | ------- |
| Pomiar własny arkusza × cena → „wartość netto"      | 514 996,25       | 514 996,25     | 0,00    |
| Σ etapów × cena → „R netto - suma prac wykonannych" | 471 819,25       | 471 819,25     | 0,00    |
| Przedmiar × cena (wiersz stopki tego nie trzyma)    | 442 216,30       | —              | —       |

Dlaczego to waży tyle: obie sumy zależą od **każdej** ceny, ilości i rabatu z osobna. Zgodność
co do grosza na 336 pracach oznacza, że parser trafił w te kolumny, w które miał trafić —
pojedyncza przesunięta kolumna rozjechałaby sumę o tysiące.

Rabatów w tym arkuszu nie ma wcale (`discount_type` NULL na wszystkich 336 pracach), więc obie
sumy to czyste Σ(ilość × cena) — ta gałąź kodu została sprawdzona tylko w wariancie „bez rabatu".

### Rozjazd Pomiar vs Σ etapów — arkusza, nie nasz

W **33 pracach** własny Pomiar arkusza nie równa się sumie etapów; stąd 43 177,00 zł różnicy
między 514 996,25 a 471 819,25. Dokładnie to, przed czym ostrzega `AGENTS.md` przy arkuszu
testowym („niektóre formuły są tu połamane"). Aplikacja trzyma **obie** liczby osobno
(`sheet_measured_qty` obok `stage_progress`), i właśnie dlatego potrafi ten rozjazd pokazać,
zamiast go po cichu uśrednić. 102 prace nie mają Pomiaru w arkuszu w ogóle (`NULL`).

### Po imporcie — stan bazy zgadza się z zapowiedzią co do sztuki

```
sekcje | prace | etapy | wierszy postępu | prace z ceną 0
    13 |   336 |    10 |             134 |              7
```

Import 336 prac zajął ~25 s. Zapowiedziano 13/336/10 — weszło 13/336/10.

## Most kosztorys → robocizna

Panel podsumowania **przed** importem: Robocizna 0,00 · Materiały 197 102,14 · Wpłaty
−303 382,34 · Pozostało −106 280,20. **Po** imporcie:

| pozycja              | UI            | odtworzone z SQL                    |
| -------------------- | ------------- | ----------------------------------- |
| Robocizna            | 471 819,25    | 471 819,25 (Σ etapów × cena)        |
| Materiały            | 197 102,14    | zgodne z fazą 1                     |
| Łącznie              | 668 921,39    | 471 819,25 + 197 102,14             |
| Wpłaty               | −303 382,34   | 3 × `INVESTOR_DEPOSIT` = 303 382,34 |
| Pozostało do zapłaty | 365 539,05    | 668 921,39 − 303 382,34             |
| udziały              | 70,5% / 29,5% | 471 819,25 / 668 921,39 = 70,53%    |

Robocizna zakotwiczyła się na **wykonanym** (Σ etapów), nie na Przedmiarze — czyli tak, jak
stanowi EX-489. Gdyby brała Przedmiar, pokazałaby 442 216,30.

Lista wpłat w panelu (142 383,00 + 77 903,00 + 83 096,34) sumuje się do 303 382,34 i zgadza się
z bazą: 3 nieanulowane `INVESTOR_DEPOSIT`, `net_amount` równe `amount`.

## Lista inwestycji po imporcie — oba plany obok siebie

| kolumna                          | wartość dla inwestycji 31 |
| -------------------------------- | ------------------------- |
| Robocizna v1 (plan transakcyjny) | 471 819,00 zł             |
| Robocizna v2 (kosztorys)         | 471 819,25 zł             |
| Bilans netto v1                  | −365 538,80 zł            |
| Bilans netto v2                  | −365 539,05 zł            |
| Marża v1                         | 258 763,15 zł             |
| Marża v2                         | „ustaw etapy"             |
| Bilans brutto v2                 | „nie dotyczy"             |

**Rozjazd v1 vs v2 wynosi 25 groszy.** Właściciel zaksięgował robociznę jako `LABOR_COST`
najwyraźniej z tego samego wiersza arkusza („R netto - suma prac wykonannych" = 471 819,25),
zaokrąglając do pełnych złotych. To niezależne od parsera potwierdzenie, że import trafił
w ten wiersz, o który chodziło. Rozjazd bilansu netto (0,25 zł) jest tego prostą konsekwencją.

Czyli kolumny v1/v2 z EX-712 działają dokładnie jako lista roboczą przejścia: pokazują
rozjazd zamiast go ukrywać.

### „ustaw etapy" na marży v2 jest poprawne, nie jest defektem

Marża v2 odmawia podania kwoty, bo **22 prace mają realny postęp etapów i pustą stawkę
wykonawcy** (`w_tools_override_type IS NULL` przy `qty_done <> 0`) — policzone na bazie.
Preflight importu zapowiedział to wprost: 44 stawki podwykonawców wchodzą puste, bo arkusz
nie podaje dla nich jednej pewnej kwoty. Zero byłoby tu kłamstwem („ekipa pracuje za darmo"),
więc UI mówi „nieznane" i nazywa czynność, która przywróci liczbę. Zachowanie zgodne
z `investments-header-tips.ts:18`.

## OPTIONS 400 na `/` — nie jest regresją cutoveru

Na każdej stronie konsola pokazuje jeden błąd: `OPTIONS /` → 400. To prefetch Next 16 do
strony transakcji (nawigacja „Transakcje" wskazuje na `/`). Odpowiedź ma `x-vercel-cache: MISS`
i **nie ma** nagłówka `x-vercel-error`, więc 400 przychodzi z samej aplikacji, nie z warstwy
ochrony preview. Żądanie nie niesie `Origin` ani `Access-Control-Request-Method` — to nie jest
preflight CORS.

**Rozstrzygnięte jako zastane:** dwa wdrożenia sprzed 10 dni
(`wykonczymy-qt9gh79ut`, `wykonczymy-8husmf53l`) dają dokładnie ten sam `OPTIONS /` → 400.
Skutków użytkowych brak — nawigacja działa, prefetch po prostu nie trafia i przeglądarka
pobiera stronę normalnie. Do osobnego zgłoszenia, nie do tej próby.

## Panel „Problemy" — siedem liczników, siedem trafień

Po imporcie panel zapalił się listą konkretów. Każdy licznik odtworzyłem niezależnie surowym
SQL-em na bazie po migracji — nie porównując UI do UI:

| problem w UI                                | UI  | z SQL  | predykat                              |
| ------------------------------------------- | --- | ------ | ------------------------------------- |
| Pozycje bez ceny j.m.                       | 7   | **7**  | `client_price = 0`                    |
| Pozycje z pomiarem do rozpisania na etapy   | 33  | **33** | `sheet_measured_qty ≠ Σ etapów`       |
| Pozycje z wykonaną pracą bez przedmiaru     | 41  | **41** | `Σ etapów > 0 ∧ planned_qty = 0`      |
| Bez ceny wykonawcy, widok z narzędziami     | 59  | **59** | `client_price > 0 ∧ stawka = 0`       |
| Bez ceny wykonawcy, widok bez narzędzi      | 59  | **59** | jw. na drugiej płaszczyźnie           |
| Etapy bez wybranego sposobu rozliczenia     | 10  | **10** | `plane IS NULL`                       |
| Etapy bez przypisanego wykonawcy            | 10  | **10** | `worker_id IS NULL`                   |
| Stawki liczone formułą, widok z narzędziami | 22  | **22** | brak `amount` ∧ jakiś etap z postępem |
| Stawki liczone formułą, widok bez narzędzi  | 22  | **22** | jw.                                   |

Dwie rzeczy warte odnotowania poza samą zgodnością:

**Licznik „bez ceny wykonawcy" nie jest tym, czym wygląda.** Surowo pozycji bez typu stawki
jest 66, a UI mówi 59. Nie jest to rozjazd — `row-conditions.ts:337` liczy stawki _jawnie
wpisane jako zero_, a nie brak typu, i bramkuje warunek na `clientPrice > 0`, żeby nie dublować
tego, co już zgłasza „bez ceny j.m.". Predykat z kodu daje dokładnie 59.

**Ostrzeżenie o stawkach liczonych formułą jest międzymodułowe i zapaliło się słusznie.**
`settledAtPercentRate` wymaga, żeby inwestycja miała materiały wliczone w robociznę — lista
inwestycji pokazuje dla 31 kwotę 4421,85 zł w kolumnie „Wydatki wliczone w robociznę”, więc
warunek jest spełniony po stronie transakcji, a liczba 22 wychodzi po stronie kosztorysu.
To jedyny licznik w tym panelu, który czyta dane spoza kosztorysu, i po migracji czyta je
poprawnie.

## Porównaj z arkuszem Google — druga strona tej samej logiki

Zaraz po imporcie okno porównania powinno pokazać zero rozjazdów i pokazuje:

| pozycja                                 | arkusz        | apka          |            |
| --------------------------------------- | ------------- | ------------- | ---------- |
| Wartość prac wykonanych                 | 471 819,25 zł | 471 819,25 zł | zgadza się |
| Rozjazd arkusz ↔ apka                   | 43 177,00 zł  | 43 177,00 zł  | zgadza się |
| stopka: wartość netto                   | 514 996,25 zł | 514 996,25 zł | zgadza się |
| stopka: R netto - suma prac wykonannych | 471 819,25 zł | 471 819,25 zł | zgadza się |
| liczba prac                             | 336           | 336           | te same    |

„Rozjazd" 43 177,00 zł to praca zmierzona w arkuszu, której nie rozpisano na żaden etap.
Odtworzyłem go z bazy: `Σ (pomiar_arkusza − Σ etapów) × cena` = **43 177,00** i siedzi
dokładnie w **33 pracach** — tych samych, które panel „Problemy" liczy jako „z pomiarem
do rozpisania na etapy".

Sekcja „Jak odczytaliśmy arkusz Google" mówi wprost: w **240 z 336 prac** Pomiar z natury
w arkuszu wskazuje na Przedmiar zamiast być sumą etapów. To jest ta połamana formuła, przed
którą ostrzega `AGENTS.md` przy arkuszu testowym — aplikacja jej nie naprawia i nie ukrywa,
tylko nazywa.

## Pętla wersji: zapisz → wyczyść → przywróć

Najostrzejszy test zapisu, jaki tu jest — kasuje wszystko i odtwarza z JSON-a.

1. **Zapis wersji** „proba cutover po imporcie" → `kosztorys_snapshots` #6, `kind=manual`,
   `schema_version=1`, 130 kB, `jsonb_array_length(payload->'items')` = **336**.
   Przy okazji widać, że autozapis przed importem naprawdę się wykonał: snapshot #5
   „Przed importem z arkusza Google" z **0** prac — czyli stan sprzed importu.
2. **Wyczyszczenie** — dialog zapowiedział „13 sekcji · 336 prac" (zgodnie z bazą) i uczciwie
   ostrzegł, że rabat globalny zostanie wyzerowany, a przywrócenie tego nie cofnie.
   Po wykonaniu: `kosztorys_items`, `kosztorys_sections`, `kosztorys_stages` i `stage_progress`
   **wszystkie na zero** — kaskada zadziałała w całości. Panel wrócił do Robocizna 0,00 /
   Pozostało −106 280,20, czyli dokładnie do stanu sprzed importu. Powstał autozapis #7
   „Przed wyczyszczeniem" z 336 pracami.
3. **Przywrócenie** wersji #6 — dialog potwierdzenia nazwał właściwy punkt (11:35) i zapowiedział
   zapisanie obecnego stanu.

Stan po przywróceniu, odtworzony z bazy:

| figura                                   | przed wyczyszczeniem | po przywróceniu         |
| ---------------------------------------- | -------------------- | ----------------------- |
| sekcje / prace / etapy / wiersze postępu | 13 / 336 / 10 / 134  | **13 / 336 / 10 / 134** |
| Σ etapów × cena                          | 471 819,25           | **471 819,25**          |
| pomiar arkusza × cena                    | 514 996,25           | **514 996,25**          |
| przedmiar × cena                         | 442 216,30           | **442 216,30**          |
| pozycje bez ceny j.m.                    | 7                    | **7**                   |
| stawki wykonawcy równe zero              | 59                   | **59**                  |

Round-trip przez snapshot niczego nie zgubił. Warto odnotować, że przeżył też
`sheet_measured_qty` — kolumnę spoza siatki, którą najłatwiej byłoby pominąć w payloadzie,
a bez której „Porównaj z arkuszem" po przywróceniu liczyłoby rozjazd od zera.

Znaczniki czasu wersji renderują się w czasie lokalnym poprawnie: snapshot zapisany
`09:35:43+00` w bazie pokazuje się jako `25.08.2026, 11:35` (Europe/Warsaw).

## Widok inwestora i link bez logowania

### Ustawienia podglądu

Kreator „Udostępnij inwestorowi" ma dwa warianty kolumn (Oferta / Rozliczenie) i zapamiętuje
oba — inwestor widzi wybrany. Zapowiada „Ukryj pozycje bez przedmiaru i bez wykonanej pracy
**(202)**"; z bazy: `NOT(planned_qty > 0) AND NOT(Σ etapów > 0)` = **202**. Trafienie.

### Link

Wygenerowany adres: `https://wykonczymy.vercel.app/k/IjX02qnYaz1tAbAfMcV_iD9diMvhdZ9V`.
W bazie powstał dokładnie jeden wiersz `kosztorys_shares` z tym samym tokenem, przy unikalnych
indeksach na `token` i na `investment_id` (jeden link na inwestycję).

**Domena w linku jest poprawna, choć wygląda podejrzanie.** `NEXT_PUBLIC_FRONTEND_URL` to
`https://wykonczymy.vercel.app` zarówno w Production, jak i w Preview, a projekt ma
zarejestrowaną domenę `wykonczymy.app`. Sprawdziłem: `wykonczymy.app` **nie ma żadnych rekordów
DNS** — jest kupiona, ale nigdzie nie wskazuje, a `wykonczymy.vercel.app` odpowiada. Czyli
zmienna zgadza się z rzeczywistością i nie ma tu nic do naprawiania.

Skutek uboczny wart odnotowania: link wygenerowany na **preview** też wskazuje na produkcję,
więc żeby przetestować go na staging, trzeba ręcznie podmienić host. To nie defekt — jedna
zmienna na projekt — ale przy testowaniu łatwo się na to nadziać.

### Dostęp bez logowania — sprawdzony naprawdę, nie z kodu

Zdjąłem ciasteczko `payload-token` (zostawiając SSO Vercela) i sprawdziłem obie strony bramki:

| adres                   | bez zalogowania                        |
| ----------------------- | -------------------------------------- |
| `/inwestycje`           | przekierowanie na `/zaloguj`           |
| `/k/<prawidłowy token>` | renderuje kosztorys, tytuł „Kosztorys" |

Strona udostępniona **nie zawiera nawigacji aplikacji** (brak Transakcje / Kasy / Pracownicy /
Wyloguj) i nie ma w niej ani słowa o podwykonawcach, widoku z narzędziami / bez narzędzi ani
o marży. Zakładki podsumowania są trzy — Podsumowanie / Materiały / Robocizna — zamiast pięciu,
które widzi właściciel. Kwoty pokazane inwestorowi to te same, co w panelu właściciela
(Robocizna 471 819,25 · Materiały 197 102,14 · Łącznie 668 921,39 · Wpłaty −303 382,34 ·
Pozostało 365 539,05).

### Zmyślony token: treść 404, ale status HTTP 200

`/k/TENTOKENNIEISTNIEJE…`, `/k/aaa` i `/k/xxxxxxxx…` renderują stronę „404 · This page could
not be found." — czyli nic nie wycieka — ale odpowiedź ma **status 200**, nie 404. To zachowanie
strumieniowania Next: `notFound()` wywołane po tym, jak nagłówki już poleciały, nie może już
zmienić statusu.

Skutków dla użytkownika brak; znaczenie ma dla monitoringu i indeksowania (crawler przeczyta
nieistniejący kosztorys jako stronę istniejącą). Zastane w Next, nie w cutoverze —
do osobnego zgłoszenia, nie do tej próby. `/k/` bez tokenu wpada na `/zaloguj`, co jest w porządku.

## Rekoncyliacja na stronie inwestycji

Zakładka **v2 → Marża** mówi to samo, co kolumna „Marża v2" na liście, i tymi samymi słowami:

```
Robocizna                       471 819,25
Suma wykonanej pracy                  0,00
Materiały wliczone w robociznę    -4421,85
Marża                    → „Ustaw rozliczenie etapów”
```

z wyjaśnieniem: „Etapy z wykonaną pracą, ale bez rozliczenia (…) nie wchodzą do kosztu ekipy.
Dopóki ich nie ustawisz, marża wyszłaby zawyżona o nieznaną kwotę." Dwie różne powierzchnie,
jedna odpowiedź — nieznane zamiast zera.

Zakładka **v2 → Podsumowanie** powtarza kwoty z edytora co do grosza (Robocizna 471 819,25 ·
Materiały 197 102,14 · Łącznie 668 921,39 · Wpłaty −303 382,34 · Pozostało 365 539,05).

## Edycja w siatce — ścieżka zapisu i jeden realny defekt

### Zapis działa, w obie strony

| co                                       | z czego na co                          | ślad w bazie                           |
| ---------------------------------------- | -------------------------------------- | -------------------------------------- |
| nazwa sekcji (`kosztorys_sections.name`) | „Prace dodatkowe" → „1.5" → z powrotem | `updated_at` ruszyło przy obu zapisach |
| Przedmiar pozycji 337                    | 1 → 7 → 1                              | `kosztorys_items.planned_qty`          |
| Przedmiar pozycji 338                    | 1 → 8 → 1 (cofnięte przez Cmd+Z)       | `kosztorys_items.planned_qty`          |

**Cofanie (Cmd+Z) dochodzi do bazy**, nie tylko do widoku: po cofnięciu `planned_qty` wróciło
na 1 z nowym `updated_at`. Po całej serii prób trzy sumy kontrolne wróciły na swoje
(471 819,25 / 514 996,25 / 442 216,30) i nazwa sekcji też.

### DEFEKT: Escape nie anuluje edycji komórki — zatwierdza ją

Wciśnięcie klawisza z cyfrą otwiera edytor komórki. Wciśnięcie **Escape** nie porzuca wpisanej
wartości, tylko ją **zapisuje do bazy**.

Odtworzone dwa razy, na dwóch różnych pozycjach:

| pozycja         | było | wpisane | po Escape w bazie |
| --------------- | ---- | ------- | ----------------- |
| 337 (Przedmiar) | 1    | `7`     | **7**             |
| 338 (Przedmiar) | 1    | `8`     | **8**             |

Za drugim razem sprawdziłem przed wciśnięciem Escape, że edytor faktycznie jest otwarty, więc
to nie jest pomyłka pomiaru. Po Escape edytor w dodatku **zostaje otwarty** — klawisz nie robi
nic z tego, czego się po nim spodziewamy.

Dlaczego to boli: Escape to uniwersalne „nie, jednak nie". Ktoś zaczyna pisać w złej komórce
(a jest ich tu 336 wierszy × kilkanaście kolumn), wciska Escape i idzie dalej przekonany, że
nic się nie stało — a przedmiar tej pozycji właśnie się zmienił i pociągnął za sobą kwoty.
Nic nie krzyczy.

Łagodzące: **Cmd+Z to cofa** (sprawdzone, aż do bazy), a stan sprzed można odzyskać z „Wersji".
Więc to nie jest utrata danych bez wyjścia — to cicha zmiana, którą trzeba najpierw zauważyć.

To **nie jest regresja cutoveru w ścisłym sensie** — cały edytor `kosztorys_v2` wchodzi razem
z tym scaleniem, na produkcji nie ma go wcale. Defekt wjeżdża z nową funkcjonalnością,
nie psuje istniejącej.

### Rozwinięty panel podsumowania przykrywa też siatkę

To samo, co przy CTA importu: przy rozwiniętym panelu kliknięcie w komórkę siatki trafia
w panel. Trzeba najpierw „Schowaj podsumowanie". Przy panelu domyślnie rozwiniętym
(`use-totals-panel-open.ts` → `'open'`) pierwszy kontakt z edytorem to ekran, na którym
nie da się nic kliknąć w siatce.

**Domknięte dowodem, nie obserwacją** (25.08): próba otwarcia menu „Akcje wiersza" na wierszu w
dolnej części siatki nie dochodzi w ogóle — panel przechwytuje wskaźnik i klik ponawia się
bezskutecznie aż do wygaśnięcia. Po „Schowaj podsumowanie" **ten sam klik na tym samym wierszu
udaje się natychmiast**. Czyli to nie jest zasłonięty widok, tylko zablokowana obsługa: wiersz
widać i nie da się go dotknąć, bez żadnej wskazówki dlaczego.

## Szablony — przenoszenie między inwestycjami

Zapisałem kosztorys 31 jako szablon „proba cutover szablon" (`kosztorys_presets` #1,
`schema_version=1`, 125 kB, 336 prac / 13 sekcji, `created_by=63`, nazwa pod UNIQUE),
a potem wczytałem go na **inną** inwestycję (32, pusty kosztorys). Dialog policzył poprawnie:
„Zniknie: 0 sekcji · 0 prac / Wejdzie: 13 sekcji · 336 prac".

Po wczytaniu, z bazy:

| pole                        | przeniesione       |
| --------------------------- | ------------------ |
| opisy prac                  | 336                |
| jednostki                   | 334                |
| ceny j.m. (niezerowe)       | 329                |
| stawki wykonawcy (`amount`) | 270                |
| **przedmiar**               | **0 — wyzerowany** |
| **pomiar z arkusza**        | **0 — wyzerowany** |
| **etapy / postęp**          | **0 / 0**          |

Sumy wyszły zerowe i **tak ma być.** `serialize-preset.ts` jawnie zeruje `plannedQty`,
`sheetMeasuredQty`, rabat i notatkę oraz zwraca `stages: []` i `progress: []`, z komentarzem
w kodzie: etapy to struktura wykonawcza jednej roboty, nie wielokrotnego użytku. Szablon niesie
„które prace i po ile", a ilości są sprawą konkretnej inwestycji. Zgodność z bazą pole w pole.

Inwestycja 32 wyczyszczona po teście (dialog zapowiedział „13 sekcji · 336 prac”, w bazie 0/0).

## Filtry i kolumny

Liczniki filtrów, odtworzone z bazy:

| filtr                       | UI  | z SQL   |
| --------------------------- | --- | ------- |
| Pozycje bez przedmiaru      | 243 | **243** |
| Pozycje z przedmiarem       | 93  | **93**  |
| Pozycje bez wykonanej pracy | 239 | **239** |
| Pozycje z wykonaną pracą    | 97  | **97**  |
| Sekcje bez przedmiaru       | 2   | **2**   |
| Sekcje z przedmiarem        | 0   | **0**   |
| Sekcje bez wykonanej pracy  | 2   | **2**   |
| Sekcje z wykonaną pracą     | 0   | **0**   |

Liczniki sekcyjne nie sumują się do 13 i **nie powinny** — znaczą „wszystkie wiersze sekcji
spełniają warunek", więc sekcja mieszana nie wpada do żadnego z pary. Sprawdzone `bool_and`-em
na bazie: 2 / 0 / 2 / 0.

**Filtr ukrywa, a nie zawęża** — chip mówi to wprost: „Ukryto: pozycje z wykonaną pracą (97)".
Numeracja wierszy zostaje oryginalna (widać 10, 18, 19, 20…), więc od razu widać, że coś
wypadło. Wiersz „Razem" sekcji liczy **całą** sekcję, nie widoczny podzbiór — spójne
z zasadą z kreatora udostępniania, że ukrycie jest operacją na widoku, nie na kwotach.

Wiersz „Razem Prace dodatkowe" sprawdzony pozycja po pozycji: przedmiar 120,96 i etapy
18,50 / 38,20 / 85,85 / 21,10 / 0,50 / 61,54 / 2,00 — wszystkie siedem trafione z bazy.
Kwota w nagłówku sekcji (74 823,00 zł) to wartość **wykonana**, nie przedmiar (45 258,80).

## Zakładki podsumowania

### Materiały — czyta transakcje, nie kosztorys

| pozycja                        | UI         | z bazy                                       |
| ------------------------------ | ---------- | -------------------------------------------- |
| Materiały budowlane            | 126 332,62 | 130 077,86 − 3745,24 korekt = **126 332,62** |
| Materiały wykończeniowe        | 70 701,52  | **70 701,52** (`settled=false`)              |
| Pozostałe koszty               | 68,00      | **68,00**                                    |
| Razem                          | 197 102,14 | **197 102,14**                               |
| Materiały wliczone w robociznę | 4421,85    | **4421,85** (`settled=true`)                 |

Dziewięć wierszy `CORRECTION` (−3745,24) wchodzi do „Materiałów budowlanych" — to ta sama
kwota, która w fazie 1 wyglądała na rozjazd, a była moim błędem w liczeniu. Podział
`settled` (feature „rozliczone R+M") działa: jedna faktura 4421,85 siedzi osobno.

### Robocizna — dziesięć etapów i VAT

Kwoty netto po etapach sumują się dokładnie do 471 819,25:
`67 557,95 + 61 980,00 + 61 060,00 + 60 220,00 + 105 115,50 + 110 885,80 + 5000,00`.
Etapy 8–10 zerowe. Brutto 509 564,79 = netto × 1,08 (VAT 8%).

„Postęp prac 106,7%" = wykonane / przedmiar = 471 819,25 / 442 216,30. Przekroczenie 100%
jest prawdziwe, nie błędne — wykonano więcej, niż zaoferowano w przedmiarze.

Udziały sekcji (przełącznik na „Przedmiar") trafione co do dziesiątej procenta i co do grosza:
Prace dodatkowe 10,2% / 45 258,80 · Wyburzenia 5,2% / 23 092,95 · Podłogi 15,0% / 66 291,35 ·
Ściany i sufity 50,3% / 222 339,60 · Łazienka 1 1,3% / 5777,00.

### Podwykonawcy — i dlaczego wszędzie „nadpłacone"

| pracownik         | wykonane | zaliczki       | pozostało       |
| ----------------- | -------- | -------------- | --------------- |
| Mykhalio          | 0,00     | 165 000,00     | −165 000,00     |
| Jacek Mikrocement | 0,00     | 23 190,00      | −23 190,00      |
| Daniel Mixokret   | 0,00     | 15 824,00      | −15 824,00      |
| Kamil Kamiński    | 0,00     | 4620,00        | −4620,00        |
| **Razem**         | **0,00** | **208 634,00** | **−208 634,00** |

Wszystkie cztery kwoty zgadzają się z `PAYOUT`-ami w bazie co do grosza, a suma 208 634,00
z kolumną „Wypłaty" na liście inwestycji. Każdy ma dopisek „Brak przypisanych etapów" —
bo wszystkie 10 etapów ma `worker_id IS NULL`, dokładnie jak zgłasza panel „Problemy".
Stąd wykonane 0,00 i stąd „nadpłacone": pieniądze wyszły, praca nie jest jeszcze przypisana.
To ten sam brak, który blokuje marżę v2 — jedna przyczyna, trzy spójne komunikaty.

„Opcje rozliczenia": robocizna Netto, materiały Brutto, VAT do wyboru, rabat globalny
„Wyłączony" — zgodne z etykietami na zakładkach.

## Flota — moduł założony od zera

Flota nie ma importera, więc jedyna droga to ręczne wprowadzenie. Prod ma tu 0 pojazdów,
więc te 57 manualczków było dotąd nieuruchamialnych.

**Pusty stan** renderuje się poprawnie: „0 pojazdów w użyciu", „Brak danych", pełny zestaw
kolumn (Przegląd techniczny / OC / Wymiana oleju / Przegląd gwarancyjny / Wymiana opon).

**Walidacja formularza** działa — pusty submit zwrócił trzy komunikaty („Numer rejestracyjny
jest wymagany", „Marka jest wymagana", „Model jest wymagany") plus zbiorcze „Formularz zawiera
błędy". Rocznik i VIN są opcjonalne i przeszły puste.

**Założenie pojazdu** (dane zmyślone: `WX 90210` Renault Master 2021, VIN `VF1MA000000000001`)
— wiersz `vehicles` zapisany z `status=ACTIVE`, lista odświeżyła się natychmiast na
„1 pojazd w użyciu".

**Przegląd** — formularz podpowiada sensowne domyślne: data wykonania = dziś, następny termin
= dziś + rok. Zapisany `vehicle_inspections` z `type=TECHNICAL`, `odometer=120000`, `cost=450`.
Na liście zapaliło się „450,00 zł" i „25.08.2027 · za 365 dni" — 365, bo 2027 nie jest
przestępny. Pozostałe cztery rodzaje nadal „brak danych".

**Karta pojazdu** (`/flota/1`) renderuje komplet: status, VIN, licznik „od wymiany oleju do
ostatniego odczytu", sekcja per rodzaj z „Brak wpisów" tam, gdzie pusto, i wpis przeglądu
z datą, notatką, przebiegiem 120 000 km i kosztem.

**Usuwania pojazdu w UI nie ma** — okno edycji oferuje tylko zmianę statusu na „Wycofany".
Sprawdziłem tę ścieżkę: po zapisie nagłówek spadł na „0 pojazdów w użyciu", a wiersz został
na liście ze statusem „Wycofany". Zachowanie jak przy anulowaniu transferu — historia zostaje.

Wiersze testowe skasowane bezpośrednio w bazie; flota z powrotem na 0 pojazdów / 0 przeglądów.

## Przycisk „Admin" w stopce prowadzi na PRODUKCJĘ

`src/components/nav/app-footer.tsx:34` buduje link jako `${FRONTEND_URL}/admin`
z `target="_blank"`. `NEXT_PUBLIC_FRONTEND_URL` jest jedną wartością na cały projekt
(`https://wykonczymy.vercel.app`), więc **na stagingu ten przycisk otwiera produkcyjny panel
Payloada** — a panel po tamtej stronie pisze do prawdziwej bazy.

Na produkcji link jest poprawny, więc to nie psuje niczego użytkownikowi. Psuje testowanie:
dokładnie w takiej próbie jak ta można kliknąć „Admin" przekonanym, że jest się na kopii,
i zmieniać dane produkcyjne. Prefiks nic tu zresztą nie wnosi — `/admin` leży na tym samym
origin, więc względny link działałby wszędzie i sam z siebie nie mógłby wyjść poza środowisko.

Stopka ma `lg:hidden`, więc pułapka dotyczy widoku poniżej 1280 px. Boczna nawigacja ma
zwykły, względny `/admin`.

Nie jest to regresja cutoveru — ale jest to jedyne miejsce w aplikacji, które potrafi
przenieść testującego z preview na produkcję jednym kliknięciem.

### Zgłoszenia — lista, wnętrze i status kontaktu

Faza 1 zostawiła tu wyraźną lukę: „lista 170 leadów renderuje się i zgadza z bazą, ale
szczegółów pojedynczego zgłoszenia nie otwierałem". Otwarte.

**Lista.** 170 wierszy, nagłówek „170 nowych" — to nie jest liczba wierszy, tylko licznik
`contact_status='new'`, i w bazie faktycznie wszystkie 170 mają ten status. Podział na źródła
zgadza się z kolumną „Źródło": 133 Facebook + 37 Strona WWW = 170. Zgłoszenia ze strony WWW mają
wypełnioną kolumnę „Formularz" (`/kontakt`), facebookowe pokazują `—`, bo `form_name` jest puste.
Email i telefon są linkami `mailto:` / `tel:`.

**Wnętrze („Szczegóły").** Okno na pierwszym zgłoszeniu (id 170, Grzegorz) pokazuje pięć par
pytanie/odpowiedź:

| w oknie                                             | w bazie (`raw_data`)                       |
| --------------------------------------------------- | ------------------------------------------ |
| z jakiej dzielnicy warszawy jesteś? → Mokotow       | `z_jakiej_dzielnicy_warszawy_jesteś?`      |
| jakie pomieszczenie chcesz wyremontować? → Łazienka | `jakie_pomieszczenie_chcesz_wyremontować?` |
| full name → Grzegorz                                | `full name`                                |
| phone number → 513078208                            | `phone_number`                             |
| adres e mail → grzegorzmariuszciesla@gmail.com      | `adres_e-mail`                             |

Wszystkie pięć, w tej samej kolejności, z podkreśleniami zamienionymi na spacje. Ważne: to
zgłoszenie ma `form_questions = NULL`, więc renderuje się ze **ścieżki zapasowej** po `raw_data` —
czyli sprawdzona została ta gorsza z dwóch dróg. Okno jest wyłącznie do odczytu (jedyna kontrolka
to „Zamknij").

**Status kontaktu — jedyny zapis na tym ekranie.** Kliknięcie „Oczekuje" na zgłoszeniu 170:
podpis zmienił się na „Skontaktowano", a w bazie `contact_status` przeszło `new → contacted`
(`updated_at` 25.08 10:28). Kliknięcie z powrotem wróciło do `new` — sprawdzone w bazie, nie na
ekranie. **Stan przywrócony.**

**Czego świadomie nie kliknąłem: „Pobierz z Facebooka".** Ten przycisk odpytuje żywe API
Facebooka. Klienta nie zawiadamia (`autoReply: 'skip'`), ale powiadomienie do sprzedaży idzie
zawsze — więc kliknięcie z próbnego środowiska wysłałoby prawdziwego maila do zespołu, a każde
nowe zgłoszenie wylądowałoby w gałęzi próbnej zamiast na produkcji. Ta sama zasada, dla której nie
ruszałem synchronizacji z arkuszem. Sam mechanizm i tak jest starszy niż to scalenie i chodzi na
produkcji codziennym cronem.

### Kosztorysy v1 i Pracownicy — liczby

Obie listy to zastane ekrany, ale po migracji trzeba było potwierdzić, że nadal czytają całość:

- **Kosztorysy v1** — 116 wierszy, po jednym na inwestycję, z czego **56 ma status „Powiązane"** —
  tyle samo, ile wierszy w `kosztoryses`. (Sprostowanie do mojego wcześniejszego zapisu z tej
  sesji, gdzie podałem 56 jako liczbę wierszy — 56 to liczba powiązanych, nie długość listy.
  Faza 1 miała tu rację.) Akcje w wierszu (Arkusz / Odłącz / Usuń) renderują się; **nie odpinałem
  ani nie usuwałem** żadnego — to nieodwracalne zerwanie powiązania z żywym arkuszem, a nie zysk
  z testu.
- **Pracownicy** — zakładka „Aktywni" pokazuje 43 wiersze. W bazie `users`: 43 z `active = true`,
  6 z `active = false`, razem 49. Zakładka nie gubi ani nie dokłada nikogo.
- Sumy wypłat sprawdzone dla sześciu pierwszych pracowników, każda odtworzona z `transactions`
  niezależnie od ekranu — wszystkie co do grosza: Adam Bazylewicz 6 500,00 · Adam Harasim
  38 801,89 · Adam Orłowski 145 500,00 · Adrian Furmańczyk 25 500,00 · Andriej Hrychorovich
  341 346,50 · Arek Zwierski 32 752,50.

### Kasy — salda i wnętrze kasy

Salda kas nie są nigdzie zapisane, tylko liczone przy każdym odczycie — więc po migracji trzeba
było je odtworzyć od zera, nie porównać z niczym. Policzyłem je własnym zapytaniem według tej samej
reguły co aplikacja (trzy typy wpłat dodają, cała reszta odejmuje, przelew między kasami dopisuje
się po stronie docelowej) i zestawiłem z nagłówkiem listy:

| typ kasy         | ekran             | odtworzone z bazy |
| ---------------- | ----------------- | ----------------- |
| Główne (1)       | 715 347,78 zł     | 715 347,78        |
| Pomocnicze (7)   | 34 494,90 zł      | 34 494,90         |
| Wirtualne (3)    | −383 550,08 zł    | −383 550,08       |
| Pracownicze (20) | 4 988,28 zł       | 4 988,28          |
| **Saldo**        | **371 280,88 zł** | **371 280,88**    |

Jeden pozorny rozjazd okazał się poprawnym działaniem filtra: w bazie jest **dziewięć** kas
pomocniczych na 34 782,37 zł, a nie siedem. Dwie brakujące są wycofane (`active = false`) i mają
razem 287,47 zł — dokładnie tyle wynosi różnica. Domyślny filtr „Aktywne" słusznie je pomija, a
saldo zbiorcze liczy się z tego samego, zawężonego zbioru.

**Wnętrze kasy (`/kasa/7`, „Adrian Gotówka").** Saldo 20 863,29 zł — zgodne z listą i z
przeliczeniem. Lista transferów: „**329 wyników**", a w bazie na tej kasie jest 395 transakcji, z
czego 66 anulowanych — 395 − 66 = 329, co do jednej. Pierwsze sześć wierszy zgadza się z bazą co do
kolejności i kwoty (#4640, #4638, #4629, #4628, #4615, #4590), a przelew #4640 poprawnie pokazuje
obie strony: „Kasa główna Bartek" → „Adrian Gotówka".

W stopce ekranu widnieje plakietka `PREVIEW · neondb@ep-wild-resonance-agwnbpae-pooler`, czyli
ekran naprawdę czyta gałąź próbną, a nie podstawioną kopię.

#### Usterka (zastana, nie z tego scalenia): „Tryb anulowań" nigdy nic nie pokaże na ekranie kasy

Przycisk „Tryb anulowań" na `/kasa/7` daje „**Brak danych**", choć ta kasa ma 66 anulowanych
transakcji. Przyczyna jest strukturalna, nie migracyjna: tryb startuje od wierszy typu
„anulowanie" i dopiero do nich dokleja oryginały. A **wszystkie 296 anulowań w bazie ma pustą kasę,
pustego pracownika i pustą inwestycję** — więc każde zawężenie do konkretnej kasy wycina je co do
jednego, zanim tryb zdąży dokleić oryginały.

Sam mechanizm jest sprawny — na widoku bez zawężenia (`/?cancelledTransactionAudit=1`) pokazuje
**296 wyników**, każdy poprawnie sparowany z oryginałem (#4560 z doklejonym #4573, które się do
niego odwołuje). Martwy jest wyłącznie na trzech ekranach zawężonych, a przycisk jest oferowany
właśnie na nich: kasa, pracownik i inwestycja.

Do zapisania jako osobna sprawa — **to nie jest regresja tego scalenia** i nie blokuje przełączenia.

### Edytor kosztorysu — dodawanie, usuwanie, wyszukiwarka, literówki

**Menu „Dodaj"** ma pięć wejść: Praca · Etap — z narzędziami · Etap — bez narzędzi · Sekcja ·
Sekcja z szablonu…. Sprawdzone trzy pierwsze ścieżki zapisu, każda potwierdzona w bazie:

- **Sekcja** — powstała sekcja 40 „Nowa sekcja" z kolejnością 13, **razem z jedną pustą pracą**
  (pozycja 1009, ta sama milisekunda co sekcja). To nie jest usterka, tylko celowe zachowanie —
  sekcja nigdy nie zostaje pusta.
- **Praca** — dołożyła drugą pozycję (1010) do tej samej sekcji, kolejność 1.
- **Etap — z narzędziami** — powstał etap o kolejności 11 z płaszczyzną `w_tools`, przy dziesięciu
  zastanych, które mają płaszczyznę pustą. Nowa kolumna od razu pojawiła się i w siatce, i w
  podsumowaniu robocizny („Etap 11 netto"), więc etap wchodzi w cały obieg, nie tylko w rozpiskę.

**Wyszukiwarka** („Szukaj…") zawęziła widok do dwóch pozycji „Nowa praca" wraz z nagłówkiem ich
sekcji i jej wierszem „Razem". Co ważne, **globalny wiersz „Razem" nadal liczy cały kosztorys** —
pokazał 5451,91 przedmiaru, czyli sumę wszystkich 338 pozycji z bazy. Filtr zawęża widok, nie
podsumowanie.

**Usuwanie przez menu wiersza.** „Usuń sekcję" najpierw ostrzega treścią, która sama się liczy:
„Usunie też **2 pozycji** wraz z wpisanymi w nich ilościami etapów" — dokładnie tyle sekcja
zawierała. Po potwierdzeniu: 336 pozycji, 13 sekcji, **zero osieroconych wierszy** wskazujących na
usuniętą sekcję. „Usuń etap" ostrzega analogicznie i zdjął etap 11.

**Stan przywrócony w całości** — 336 pozycji, 13 sekcji, 10 etapów, wartość przedmiaru
442 216,30 zł, czyli co do grosza tyle, ile przed tymi testami.

**„Popraw literówki w opisie prac".** Zrzuciłem wszystkie 336 opisów przed uruchomieniem.
Poprawiło **218 z nich**, trzema rodzajami zmian:

- wielkość liter — „TRANSPORT I WNIESIENIE MATERIAŁÓW WYKOŃCZENIOWYCH" → „Transport i wniesienie
  materiałów wykończeniowych"; „wynoszenie gruzu…" → „Wynoszenie gruzu…"
- zdublowane spacje — „- 10-20%" → „- 10-20%"
- literówki ze słownika — „w zalezności" → „w zależności"

Czego **nie** poprawia: „zamurowanei otworu drzwiowego" zostało nietknięte. Czyli to słownik
konkretnych podmian, nie sprawdzanie pisowni — i dobrze, bo nie zgaduje przy nazwach fachowych.

Przed zmianą sama zrobiła automatyczną migawkę (7 → 8). Wczytałem ją z „Wersje" i **wszystkie 336
opisów wróciło co do znaku** (zero różnic wobec zrzutu sprzed), razem z pełną strukturą. To drugie,
niezależne potwierdzenie pętli wersji — tym razem na zmianie masowej, a nie na wyczyszczeniu.

### Widok inwestora — ustawienia i to, co klient naprawdę widzi

„Ustawienia podglądu…" oferują dwa warianty (Oferta / Rozliczenie), pełną listę kolumn w czterech
grupach i przełącznik „Ukryj pozycje bez przedmiaru i bez wykonanej pracy (**202**)" — ta liczba
zgadza się z bazą co do pozycji. Zapis („Zapisz i pokaż ofertę") utrwalił się poprawnie: powstał
wiersz z trybem `OFFER`, piętnastoma ukrytymi kolumnami i włączonym ukrywaniem pustych wierszy.

Podgląd otwiera się w nowej karcie (`/podglad-inwestora/31`) i **respektuje ustawienia dokładnie**:
zostało sześć kolumn (Opis prac, Przedmiar, Jednostka miary, Cena j.m. netto, Wartość przedmiaru
netto, Pozostało netto), zniknęły nazwy sekcji jako kolumna, wszystkie kolumny etapowe, wszystkie
brutto i cały rabat. Ceny podwykonawców nie pojawiają się nigdy — okno mówi to wprost.

Ukrywanie pustych wierszy działa co do jednego: **134 wiersze danych**, a w bazie dokładnie 134
pozycje mają wpisany przedmiar albo jakąkolwiek wykonaną pracę (336 − 134 = 202, czyli liczba z
okna). Sekcja „Wiatrołap", której wszystkie 4 pozycje są puste, **znika w całości** — i słusznie.

#### Usterka: nagłówek sekcji podaje inwestorowi liczbę pozycji sprzed filtra

Przy włączonym ukrywaniu pustych wierszy każdy nagłówek sekcji nadal ogłasza **pełną** liczbę
pozycji, choć pod nim widać ich znacznie mniej. Najostrzejszy przypadek: „**WC (52 poz.)**" nad
**czterema** wierszami. Podobnie „Łazienka 2 (54 poz.)" nad czternastoma i „Ściany i sufity bez
łazienek (42 poz.)" nad dwudziestoma jeden.

Sprzeczność jest wewnętrzna: ten sam filtr **usuwa całą sekcję**, gdy nie zostanie w niej ani jeden
wiersz („Wiatrołap"), ale nie koryguje licznika w sekcjach, które tylko przerzedził. Czyli lista
sekcji jest filtrowana, a licznik na nagłówku liczony z niefiltrowanego zbioru.

Sprawdzone **nie tylko w podglądzie, ale i na prawdziwym linku dla klienta** (`/k/<token>`, bez
logowania) — te same 134 wiersze i te same zawyżone liczniki. To więc widzi klient, a nie tylko
właściciel w podglądzie. Nie blokuje przełączenia — ale jest to jedyna znaleziona usterka, która
pokazuje się **na zewnątrz firmy**.

##### Przyczyna i naprawa

Nagłówek sekcji bierze i licznik, i kwotę z jednego zestawu podsumowań, a ten liczył się z **pełnego**
zbioru pozycji — celowo, żeby wyszukiwarka i sortowanie właściciela nie ruszały tego, co sekcja mówi,
że zawiera. Dla właściciela to jest poprawne: filtr jest jego gestem na ekranie, a nie zmianą
dokumentu. Dla klienta nie — jego dokument **to jest oferta**, nic za nim nie stoi. Numeracja pozycji
rozpoznawała tę różnicę już wcześniej (pod podglądem numeruje 1…N po przerzedzeniu), podsumowania nie.

Naprawa: jeden zbiór „wierszy dokumentu" — u właściciela pełny, pod podglądem przerzedzony jego własną
decyzją o ukrywaniu — i numeracja **oraz** podsumowania liczą się z niego. Kwoty stoją w miejscu, bo
jedyne wiersze, które ten filtr usuwa, są puste na **obu** osiach (bez przedmiaru i bez wykonanej
pracy) i wnoszą zero do każdej liczby. Sekcja złożona wyłącznie z takich pozycji znika w całości,
zamiast dostać nagłówek „(0 poz.)".

Zabezpieczenie: `src/__tests__/lib/kosztorys/client-document-subtotals.test.ts` — licznik zgadza się z
tym, co klient widzi, a wartość netto, przedmiar, rabat, udział i postęp są identyczne jak u
właściciela.

### Czego po przełączeniu **nie będzie**, choć dziś na produkcji działa

To jest klasa rzeczy, której cała dotychczasowa metoda tej próby nie mogła złapać: porównywanie
ekranu z bazą potwierdza, że to co jest — liczy się dobrze. Nie powie, że **coś zniknęło**. Poniższe
znalazłem przez porównanie `main` (to, co stoi dziś na produkcji) ze `staging` i sprawdzenie każdej
pozycji na żywo. Wszystkie trzy są **celowe, z decyzją właściciela i numerem** — ale w dniu
przełączenia znikną z ekranu, więc muszą być na liście.

**1. Raporty — cała strona wygaszona (EX-598).**
Dziś na produkcji `/raporty` renderuje pełny raport: kafle finansowe plus tabelę transakcji. Po
przełączeniu ten sam adres pokazuje „W budowie" z wyjaśnieniem, że marża i bilans nie uwzględniały
obniżek za rozliczanie wydatków po kwocie netto, więc nie zgadzały się z kartami inwestycji.
Wejście „Raporty" **znika też z menu**, a jego miejsce zajmuje „Flota" — więc nikt na to nie
wejdzie przypadkiem, tylko z zakładki albo z linku. Sprawdzone: commit `52b1f3d8` jest na
`staging` i nie ma go na `main`.

_(Przy okazji prostuję fazę 1: w tabeli „Listy pozostałych modułów" wpisałem przy `/raporty`
„pełna tabela transferów, #4647 na czele". To nie mógł być ten ekran — na tej gałęzi jest tam
„W budowie". Ten opis pasuje do pulpitu.)_

**2. Wydruk i eksport CSV — usunięte z każdej tabeli transferów (EX-672).**
Dziś każda tabela transferów ma trzy przyciski: drukuj, CSV, faktury. Po przełączeniu zostaje
tylko trzeci. Sprawdzone na żywo — na pulpicie i na `/kasa/7` nie ma ani wydruku, ani CSV.

Warto wiedzieć, co dokładnie odchodzi, bo to nie były ozdobniki:

- **CSV** brał przefiltrowany zbiór (nie tylko widoczną stronę), tylko widoczne kolumny, w
  kolejności z sortowania, i zapisywał z BOM-em, czyli otwierał się w Excelu bez kombinowania.
- **Wydruk** budował osobny dokument z nagłówkiem finansowym — łącznie z bilansem liczonym
  **po swojemu**. Uzasadnienie usunięcia mówi to wprost: „druk nie był zrzutem ekranu, tylko
  drugim niezależnym czytelnikiem tych samych figur". To był powód, żeby go usunąć, a nie żeby
  zostawić — ale jednocześnie znaczy, że właściciel traci wydruk zestawienia.

Decyzja jest właściciela („both features are gone by owner ruling"), więc to nie jest niespodzianka
do naprawienia — tylko pozycja do odhaczenia w dniu przełączenia.

**3. Pobieranie faktur zawężone do trzech ekranów.**
Zostało, ale nie wszędzie: przycisk „Faktury" jest teraz warunkowy i włączony tylko na karcie
inwestycji, kasy i pracownika. **Na pulpicie go nie ma**, a dziś jest. Sprawdzone na żywo.

Sama ścieżka działa i to na prawdziwych bajtach — nie tylko na komunikacie. Na `/kasa/35`:
komunikat „Pobrano **3 z 3** — 1 pozycja bez faktury", a w bazie ta kasa ma 4 niezanulowane
transakcje, z czego 3 z fakturą. Pobrany `faktury-2026-08-25.zip` zawiera **3 pliki o niezerowym
rozmiarze** (112 KB, 186 KB, 116 KB), przemianowane z nazw technicznych na `data_opis.jpg`, z
przyrostkiem `_1` przy powtórce. Na `/kasa/7`, gdzie żadna transakcja nie ma faktury, mówi „Brak
faktur do pobrania" — i to prawda, sprawdzone w bazie.

**Czego przy okazji NIE straciliśmy, wbrew pozorom.** Znika `lib/google/drive.ts`, czyli zakładanie
nowego arkusza kosztorysu przez skopiowanie szablonu. Wygląda jak ubytek, ale ta ścieżka i tak nie
działała — konto usługi nie ma miejsca na Dysku i kopia nigdy się nie tworzyła. Zastąpiło ją okno
„Nowy kosztorys", które prosi o **podpięcie istniejącego arkusza** i podaje po kolei: zrób kopię
„Kosztorys Wzór" ręcznie, udostępnij ją koncie usługi jako Edytujący, wklej link. To jest opis
tego, co i tak trzeba było robić — tylko teraz aplikacja tego nie udaje.

### Karta pracownika i „Poczta"

`/pracownicy/33` (Andriej Hrychorovich): rola, email i status zgodne z bazą, „Wypłaty:
**341 346,50 zł**" i „**30 wyników**" — a w bazie ten pracownik ma dokładnie 30 niezanulowanych
transakcji, wszystkie typu wypłata, sumujące się do tej samej kwoty. Karta ma też własny przycisk
„Faktury", zgodnie z zawężeniem opisanym wyżej.

„Poczta" w pasku górnym to zwykły odnośnik na zewnątrz — webmail firmowy z podstawionym adresem
zalogowanego użytkownika (tu `test@test.pl`). Wychodzi z aplikacji, więc nie ma tu czego sprawdzać.

### Faktura wielostronicowa — zapis, czyli druga połowa migracji `invoice_has_many`

Faza 1 sprawdziła tę migrację **tylko od strony odczytu** („stara, pojedyncza faktura nadal się
otwiera") i wprost odłożyła resztę: „ścieżka «dodaj drugą stronę» to nowa funkcjonalność i nie jest
przedmiotem tej próby". W fazie 2 jest przedmiotem — bo to jedyne miejsce, gdzie migracja
`invoice_has_many` naprawdę robi coś nowego. Wszystkie **1224** istniejące faktury mają po jednej
stronie, więc bez tego testu tabela relacji byłaby sprawdzona wyłącznie na danych, które równie
dobrze mogłaby obsłużyć stara kolumna.

**Gdzie to jest.** Nie w wierszu tabeli — wiersz z fakturą pokazuje tylko podgląd. „Dodaj stronę"
siedzi **wewnątrz okna podglądu**. Wiersz bez faktury ma osobny przycisk „Dodaj fakturę". Warto o
tym wiedzieć, bo to nieoczywiste.

**Co sprawdziłem** — na transakcji `#2563` (kasa 35), wgrywając wygenerowany obrazek 600×400,
nie żaden prawdziwy dokument:

- zapis dołożył wiersze w `transactions_rels` z **kolejnością 2 i 3**, obok zastanej strony na
  pozycji 1 — czyli kolejność stron jest trzymana jawnie, a nie wynika z kolejności wstawiania
- okno **przełącza się w tryb wielostronicowy**: podpis „(1/3)", licznik „1 / 3", strzałki
  poprzednia/następna, i — co ważne — **„Usuń stronę" osobno od „Usuń całą fakturę"** oraz
  „Pobierz wszystkie" zamiast „Pobierz"
- obie dołożone strony **renderują się z dokładnie tymi wymiarami, które wygenerowałem**
  (600×400) — czyli bajty przeszły całą pętlę: przeglądarka → trasa wgrywania → magazyn blobów
  preview → rekord `media` → z powrotem na ekran. To nie jest test komunikatu, tylko treści.
- „Usuń stronę" zdjęła **tylko** wskazaną stronę: zostały wiersz relacji z kolejnością 1 i
  oryginalna faktura (810×1080), a okno wróciło do postaci jednostronicowej. Rekordy `media`
  dołożonych stron **też zniknęły** — nie zostawia sierot w bazie, co przy historii sierot blobów
  z tego repo jest istotne.

**Uwaga metodyczna do mojego własnego wyniku.** Plik trafił na serwer **dwa razy** (stąd trzy
strony, nie dwie). To mój artefakt — zdążyłem wywołać wybór pliku raz sam, a raz narzędziem, i oba
przeszły. **Aplikacja nie duplikuje wgrywania**; nie zapisuję tego jako usterki.

**Drobiazg z niespójności.** Potwierdzenie usunięcia strony to **natywne okno przeglądarki**
(`Czy na pewno chcesz usunąć tę stronę?`), a nie okno aplikacji — wszystkie inne potwierdzenia w
tej próbie (usuń sekcję, usuń etap, przywróć wersję) są własne i opisują skutek. Nie blokuje
niczego, ale wygląda jak niedokończone miejsce.

**Weryfikacja tego ustalenia w kodzie** (bo brzmiało jak pomyłka obserwatora — reszta aplikacji
własnych okien używa wszędzie). Potwierdzone: w `staging` `src/hooks/use-invoice-removal.ts` woła
gołe `confirm(...)` w obu miejscach — przy stronie i przy całej fakturze. **Poprawka już istnieje,
ale nie w tej gałęzi**: commit `e7d31903` („usuwanie faktury/strony pyta przez ConfirmDialog")
siedzi wyłącznie na niescalonej gałęzi `heic-upload-gap`. Czyli przejście `staging` → `main`
**przeniesie natywne okno na produkcję**, dopóki tamta gałąź nie wejdzie. To jedyne w tej próbie
ustalenie, które ma gotowe lekarstwo leżące obok.

## Płaszczyzna netto/brutto — jedyna zdolność, której faza 1 nie mogła dotknąć

Faza 1 odłożyła ją wprost: „nowa funkcjonalność, uruchamiana dopiero przez wiersze zakładane po
merge'u". I miała rację — **w całej bazie po migracji nie ma ani jednego wiersza z `vat_plane`**.
Wszystkie 297 wpłat to stary tor: `net_amount IS NULL`, wartość netto doliczana przez most przy
odczycie na osi netto. Czyli migracja niczego tu nie zepsuła, bo nie było czego. Ale to znaczy też,
że po przełączeniu **pierwsza wpłata brutto, którą ktoś wprowadzi, będzie pierwszą w historii tej
bazy**. Nikt tego nie przejechał. Przejechałem.

### Metoda płatności JEST płaszczyzną

Formularz nie pyta „netto czy brutto?". Pyta o metodę, a płaszczyzna jest jej konsekwencją:
gotówka → tor bez VAT, przelew → tor fakturowany. Wybrałem „Przelew" i formularz sam zamienił pole
kwoty na parę: **kwota brutto wpisywana ręcznie, netto liczone obok**. Wpisałem 10 800 → pokazało
10 000 (VAT 8% tej inwestycji). Zgadza się co do grosza.

Warto to zapamiętać, bo jest kontrintuicyjne: **na formularzu wpłaty „brutto" to nie jest opcja
rozliczenia, tylko opis tego, w jakiej formie pieniądz przyszedł.**

### Co naprawdę wylądowało w bazie

```
id 4652 | INVESTOR_DEPOSIT | amount 10800 | net_amount 10000 | vat_plane GROSS
```

Trzy rzeczy naraz i wszystkie trzy są istotne: `amount` to zawsze pieniądz, który się ruszył (więc
kasa się spina), `net_amount` to liczba **przepisana z faktury, nie wyliczona** przy odczycie, a
`vat_plane` mówi, po której stronie ta wpłata spłaca rachunek. Stary wiersz ma dwa ostatnie puste i
dlatego most musi mu netto doliczyć — nowy nie musi zgadywać.

### Trzy tryby rozliczenia, ta sama wpłata

Przełączałem „Sposób rozliczenia robocizny" na inwestycji 31 i czytałem tę samą wpłatę:

| tryb     | jak czyta wpłatę 4652 | robocizna      | trzy wpłaty gotówkowe (303 382,34) |
| -------- | --------------------- | -------------- | ---------------------------------- |
| Netto    | **10 000**            | 471 819,25     | wliczone                           |
| Mieszane | **10 000**            | 471 819,25     | wliczone                           |
| Brutto   | **10 800**            | **509 564,79** | **wypadają całkowicie**            |

Robocizna w trybie brutto to dokładnie 471 819,25 × 1,08 — przeliczone ręcznie, zgadza się.

Najmocniejsza obserwacja jest w ostatniej kolumnie. **W trybie brutto trzy wpłaty gotówkowe za
303 382,34 zł przestają cokolwiek spłacać** — i aplikacja mówi to wprost ostrzeżeniem
„303 382,34 zł nie spłaca nic". To nie jest usterka, to jest sens całego mechanizmu: gotówka nie
weszła na fakturę, więc na rachunku brutto nie ma jej czym pokryć. Ale to znaczy, że **przełączenie
trybu na inwestycji z mieszanymi wpłatami zmienia bilans o setki tysięcy** i musi być świadomą
decyzją, nie kliknięciem z ciekawości.

Aplikacja to wie: każda zmiana trybu jest zablokowana potwierdzeniem
„**Uwaga — zmiana widoczna dla inwestora!** Sposób rozliczenia robocizny zmienia kwoty, które
inwestor widzi w podglądzie." Ostrzeżenia off-plane działają w obie strony — w trybie netto krzyczy
na wpłatę brutto, w brutto na gotówkę, a tryb „Mieszane" wycisza to pierwsze, bo od tego jest.

### Anulowanie wiersza brutto

Sprzątałem wiersz testowy przez „Usuń" i to jest — jak w fazie 1 — **anulowanie ze śladem
audytowym**, z wymaganym powodem. Para wyszła prawidłowo:

```
4652 INVESTOR_DEPOSIT 10800 net 10000 GROSS  cancelled=t
4653 CANCELLATION     10800 net —     —      → 4652
```

Wiersz anulujący **nie dziedziczy płaszczyzny ani netto** — i sprawdziłem, że to nie szkodzi:
`CANCELLATION` jest wykluczone ze wszystkich sum (`not_in: ['CANCELLATION']`), więc nigdzie nie jest
czytane na osi pieniądza. Jest wyłącznie wierszem dziennika. Potwierdza to arytmetyka: wpłaty na
inwestycji 31 wróciły do **3 wierszy / 303 382,34** co do grosza, tryb wrócił na „Netto". W trybie
anulowań licznik wzrósł 296 → **297**, a para stoi na czele listy poprawnie spięta.

W kolumnie „Forma wpłaty" oryginał pokazuje „Przelew", anulowanie „—". Kolumna „Kwota" **nie**
dopisuje „netto 10 000" pod wpłatą brutto — dopisuje ją tylko przy wydatku netto, czyli przy typie,
który naprawdę _rozlicza się_ na netto. Sprawdzone w kodzie, celowe: netto wpłaty nazywa kolumna
„Forma wpłaty", a dwa różne znaczenia słowa „netto" na jednym ekranie były już raz zgłoszone przez
właściciela.

### Wniosek

Płaszczyzna netto/brutto przechodzi w całości: zapis, trzy odczyty, oba ostrzeżenia, bramka
potwierdzenia i anulowanie. **Nie znalazłem tu defektu.** Jedyne, co zostawiam jako rzecz do
powiedzenia właścicielowi na głos, to skutek przełączenia trybu na inwestycji z mieszanymi
wpłatami — bo liczba na ekranie inwestora zmienia się wtedy o więcej, niż sugeruje słowo „tryb".

## Wydatek netto i skan faktury — druga zdolność bez ani jednego wiersza w bazie

To samo, co przy płaszczyźnie brutto, tylko po stronie kosztów: **w całej zmigrowanej bazie nie ma
ani jednego wydatku typu „Wydatek inwestycyjny netto"**. Zero wierszy. Typ istnieje, kolumna
`net_amount` istnieje, cała arytmetyka wokół niego istnieje — i nikt jej nigdy nie uruchomił na
danych. Do tego skan paragonu, który na produkcji jest akcją serwerową, na staging jest osobnym
endpointem i **od 10 sierpnia czyta z faktury także kwotę netto**. Przejechałem obie rzeczy razem,
bo w praktyce chodzą razem.

Testowałem na dwóch **sfabrykowanych** fakturach (żadnych prawdziwych danych kontrahenta).

### Co skan wyciąga z faktury

Faktura jednostawkowa, 3 pozycje, razem netto 2 276,00 / brutto 2 799,48:

| pole           | co wpisał skan                                                  |
| -------------- | --------------------------------------------------------------- |
| Kwota (brutto) | 2 799,48                                                        |
| Netto          | 2 276,00                                                        |
| Opis           | „Budmat-Polnoc 20.08.2026"                                      |
| Notatka        | numer FV + wszystkie trzy pozycje z faktury                     |
| nazwa pliku    | `faktura-test-cutover.png` → **`budmat-polnoc-20-08-2026.png`** |

Kategoria zostaje pusta celowo — trafność modelu przy kategoriach była za słaba i zostawiono ten
wybór człowiekowi. Nazwa pliku jest przepisywana z opisu, więc faktura ląduje w archiwum pod nazwą,
po której da się ją znaleźć, a nie jako `IMG_4471.jpg`.

### Czy netto jest czytane, czy doliczane? — test rozstrzygający

Pierwsza faktura tego nie rozstrzyga: 2 799,48 ÷ 1,23 = 2 276,00, czyli wynik jest ten sam
niezależnie od tego, czy program przeczytał liczbę, czy ją wyliczył. Zrobiłem więc drugą fakturę
**z dwiema stawkami** — 1 000 netto na 8% i 1 000 netto na 23%, razem netto 2 000, brutto 2 310:

```
2 310 ÷ 1,23 = 1 878,05        2 310 ÷ 1,08 = 2 138,89        prawdziwe netto = 2 000
```

Skan wpisał **2 000,00**. Czyli liczba jest przepisana z faktury, a nie policzona — i to jest
jedyne poprawne zachowanie, bo **faktury z dwiema stawkami żadna pojedyncza stawka nie odtworzy**.
To dokładnie ten przypadek, dla którego ta funkcja powstała.

Przy okazji potwierdziło się, że skan **nie nadpisuje wypełnionej pozycji**: pierwszy wiersz był
już uzupełniony i drugie uruchomienie go nie ruszyło, a suma podbiła się o samą drugą fakturę.

### Realny problem: zmiana typu kasuje skan

**Zeskanowałem fakturę, potem zmieniłem typ wydatku na „netto" — i cała pozycja zniknęła.** Kwota,
netto, opis, notatka i **podpięty plik faktury** — wszystko wyczyszczone, bez ostrzeżenia i bez
możliwości cofnięcia. Kosztem jest jedno płatne odpytanie modelu i ponowne wpięcie pliku.

To nie jest przypadek — formularz robi to świadomie przy **każdej** zmianie typu, żeby plik
zakolejkowany przed zmianą nie przykleił się do nieistniejącej pozycji przy zapisie. Problem jest
w tym, że **kolejność „najpierw skan, potem typ" jest tą, którą kod skanu wprost zakłada** — komentarz
przy zapisie netto tłumaczy, że kwotę netto wpisuje się niezależnie od typu właśnie dlatego, że
„użytkownik często wybiera typ PO skanie". Formularz tej kolejności nie przeżywa. Jedna z dwóch
stron musi ustąpić.

Obejście na dziś: **typ wybierać przed wpięciem pliku.** W tej kolejności wszystko działa i pole
Netto uzupełnia się od razu.

**Naprawione.** Zmiana typu czyści już tylko pola nagłówka, których nowy typ nie ma — kasę,
pracownika, inwestycję i znacznik „rozliczone". Pozycje zostają nietknięte razem z zakolejkowanymi
plikami. Obawa, przed którą bronił się poprzedni kształt, jest bezpodstawna: pliki są trzymane pod
identyfikatorem pozycji, więc plik osierocony zmianą typu i tak nie miałby się do czego przykleić,
a pola obce dla nowego typu (np. netto na typie brutto) odpadają przy budowaniu zapisu. Oba
zachowania są pokryte testami. Przycisk „Wyczyść formularz" nadal czyści wszystko — i o to w nim
chodzi.

Sprawdzone na żywo: kwota 1234,56, opis i wpięty plik przeżywają zmianę typu na „netto", a zapisana
transakcja niesie poprawne brutto/netto z podpiętym skanem.

### Wydatek netto od końca do końca

Zapisałem obie pozycje jako „Wydatek inwestycyjny netto" (brutto 2 799,48 + 2 310 = 5 109,48,
netto 2 276 + 2 000 = 4 276) i sprawdziłem każdą liczbę osobno:

- **W bazie:** `amount` = brutto, `net_amount` = netto, `vat_plane` **pusty** (i słusznie — płaszczyznę
  nosi tylko wpłata od inwestora), `settled = false` (ten typ z definicji nie jest rozliczalny).
  Oba pliki poszły na serwer pod nazwami z opisu i są spięte z transakcjami.
- **Kasa traci brutto.** Saldo „Adrian Gotówka" po zapisie: **15 753,81 zł**. Odtworzyłem je
  niezależnie z SQL — wpłaty plus transfery przychodzące minus reszta — i wyszło co do grosza tyle
  samo. Z kasy zeszło 5 109,48, nie 4 276.
- **Inwestora obciąża netto.** Materiały 197 102,14 → **201 378,14**, czyli **+4 276,00**.
  „Pozostało do zapłaty" wzrosło o dokładnie tyle samo.
- **Netto ma własny wiersz w rozbiciu:** obok „Materiały budowlane 126 332,62" pojawia się osobne
  **„Materiały budowlane netto 4 276,00"**, a suma się spina. Nie wpada do tego samego worka co
  materiał brutto — i dobrze, bo to dwie różne podstawy.
- **W tabeli transferów** pod kwotą brutto renderuje się podpis „netto 2 000,00 zł". Tylko przy tym
  typie, bo tylko on **rozlicza się** na netto (wpłata brutto swoje netto pokazuje w kolumnie
  „Forma wpłaty").

Różnica 833,48 zł między brutto a netto nie jest nigdzie doliczana ani odliczana — po prostu nikt
jej nie obciąża. Firma zapłaciła 5 109,48, klient płaci 4 276, VAT zostaje po stronie firmy. Tak to
ma działać i tak działa.

### Sprzątanie

Oba wiersze anulowane przez „Usuń". Wiersze anulujące znów niosą samo brutto bez `net_amount` —
ten sam kształt co przy wpłacie brutto, i tak samo nieszkodliwy. Po anulowaniu: netto bilowane na
inwestycji 31 = **0**, saldo kasy 7 = **20 863,29** = 15 753,81 + 5 109,48. Wszystko wróciło.

### Wniosek

Ekstrakcja netto i typ „wydatek netto" przechodzą — łącznie z jedynym testem, który naprawdę coś
rozstrzyga (faktura dwustawkowa). **Jedna rzecz do naprawienia przed albo zaraz po scaleniu:
zmiana typu wydatku kasuje zeskanowaną pozycję razem z plikiem.**

## Marża v2 — figura, która po imporcie z arkusza w ogóle się nie liczy

Po zaimportowaniu kosztorysu z arkusza inwestycja 31 **nie pokazywała marży**. W miejscu kwoty stało
wezwanie „Ustaw rozliczenie etapów" z wyjaśnieniem, że bez tego marża wyszłaby zawyżona o nieznaną
kwotę. Sprawdziłem, czy to stan przejściowy czy reguła — to reguła, i to zamierzona.

Przyczyna jest w danych: **import przynosi z arkusza ilości na etapach, ale nie przynosi tego, w
jakiej stawce te etapy są rozliczane.** Wszystkie 10 etapów miało puste rozliczenie, a 7 z nich
trzymało wykonaną pracę. Skoro etap bez stawki nie ma ceny, nie nalicza nikomu nic — więc koszt
ekipy byłby zaniżony o nieznaną kwotę, a marża o tyle samo zawyżona. Program woli **nie podać
liczby, niż podać złą**, i to jest właściwy wybór przy figurze, na którą się patrzy przy wypłatach.

Warto to wiedzieć przed przełączeniem, bo pierwsze wrażenie po imporcie jest takie, że „marża nie
działa". Działa — czeka na decyzję, której arkusz nie niesie.

### Domknięcie: ustawiłem etapy i wszystko wskoczyło

Ustawiłem 6 etapów „z narzędziami" i jeden „bez narzędzi" — **celowo mieszanie**, bo to trudniejszy
przypadek i ten, przed którym ostrzega komentarz w kodzie (przeliczanie całej wykonanej pracy jedną
stawką podwaja rachunek na inwestycji mieszanej).

Policzyłem należność ręcznie z SQL, po tej samej regule co program: dla każdego etapu ilość × cena
tego etapu, gdzie cena to nadpisanie kwotowe pozycji, jeśli jest (a jest przy 270 pozycjach!), a
w przeciwnym razie cena klienta × mnożnik planu. Wynik:

| figura               | mój rachunek                      | aplikacja      |
| -------------------- | --------------------------------- | -------------- |
| Z narzędziami        | 75 949,275                        | **75 949,27**  |
| Bez narzędzi         | 1 190,00                          | **1 190,00**   |
| Suma wykonanej pracy | 77 139,275                        | **77 139,27**  |
| Marża                | 471 819,25 − 77 139,27 − 4 421,85 | **390 258,13** |

Zgadza się. Grosz różnicy przy pierwszej pozycji to **dokładna połówka grosza** (75 949,275) — remis,
który Postgres zaokrągla w górę, a przeglądarka w dół. Nie jest to błąd programu.

Ważne przy okazji: **naiwny rachunek „cena × 0,65" dałby 306 682,51 zamiast 77 349** — czterokrotnie
za dużo. Ceny podwykonawców na tej inwestycji są w większości nadpisane kwotowo i to one rządzą. Kto
będzie kiedykolwiek weryfikował tę figurę ręcznie, musi zacząć od nadpisań, nie od mnożnika.

Blok „Rozliczenie z ekipą", ukryty dopóki etapy były nieustawione, pojawił się razem z marżą i
pokazał „Nadpłata 131 494,72" z wyjaśnieniem, że ekipa dostała więcej, niż warta jest wykonana
praca. Też prawidłowo — wypłat jest 208 634, a wykonanej pracy 77 139.

### Dwie rzeczy do poprawienia

**1. Ta sama kwota w dwóch miejscach ekranu różni się o grosz.** Na zakładce „Podwykonawcy", obok
siebie: tabela pracowników w wierszu „Razem" pokazuje **−131 494,73**, a blok „Podsumowanie
podwykonawców" w wierszu „Pozostało do wypłaty" **−131 494,72**. Mechanizm jest prosty: jedna
strona zaokrągla kwoty per pracownik i dopiero sumuje, druga odejmuje na pełnej precyzji i
zaokrągla raz. Kwota drobna, ale to jedna liczba w dwóch wersjach na jednym ekranie — a ekran służy
do rozliczania się z ludźmi.

**2. Rozliczenia etapu nie da się cofnąć do „nieustawione".** Pozycje „Z narzędziami" / „Bez
narzędzi" są w menu **polami wyboru** (zaznaczone / niezaznaczone), więc obiecują przełączanie.
Przełączanie **między** planami działa — sprawdziłem, etap 1 przeszedł na „bez narzędzi" i z
powrotem. Ale **kliknięcie w zaznaczoną pozycję nie robi nic**: plan zostaje, żaden komunikat się
nie pojawia. Raz ustawionego etapu nie da się już wyzerować z interfejsu. Albo to ma być decyzja
nieodwracalna — i wtedy kontrolka nie powinna wyglądać jak pole wyboru — albo odznaczenie powinno
działać.

Przy okazji rzecz zrobiona dobrze: pozycja „Pracownik / ekipa" jest w tym menu **zablokowana**,
dopóki nie wybierze się rozliczenia, z wyjaśnieniem „bez niego etap nie ma ceny, więc nikomu nic nie
nalicza". Kolejność wymuszona tam, gdzie odwrotna dawałaby ciszę zamiast liczby.

### Uwaga do zakładki „Podwykonawcy" przed ustawieniem etapów

Zanim ustawiłem plany, zakładka pokazywała czterech pracowników z sumą wykonanej pracy 0,00 i
wypłatami 208 634 — czyli **cztery razy czerwone „nadpłacone"** i „Pozostało do wypłaty −208 634,00".
Zakładka „Marża" w tym samym stanie **odmawiała** pokazania tego bloku, wprost dlatego, że nazwałby
nadpłatę, której nie ma. Dwa różne rozstrzygnięcia tego samego pytania na dwóch zakładkach jednego
panelu.

Nie zgłaszam tego jako usterki, bo zakładka „Podwykonawcy" jest miejscem, w którym się ten stan
**naprawia**, więc musi go pokazać — i pokazuje powód: pod każdym nazwiskiem stoi czerwone „Brak
przypisanych etapów", a przy „Sumie wykonanej pracy" ostrzegawczy trójkąt. Zapisuję jako rzecz do
świadomej decyzji: słowo „nadpłacone" przy czterech ludziach jest mocniejsze niż powód napisany pod
spodem drobnym drukiem.

## Rozliczenie materiałów po netto — dźwignia, która zmienia rachunek inwestora o 36 tysięcy

Ostatnia nietknięta dźwignia w „Opcjach rozliczenia": **sposób rozliczenia materiałów**. Domyślnie
stoi na „Brutto" — inwestor płaci to, co jest na paragonie. Przełączenie na „Netto" wraz ze stawką
VAT sprawia, że obciąża się go ceną netto, a VAT zostaje po stronie firmy.

Na inwestycji 31 ustawiłem 23% i policzyłem ręcznie, czego się spodziewam: 197 102,14 ÷ 1,23.

| pozycja                 | oczekiwane netto               | aplikacja      |
| ----------------------- | ------------------------------ | -------------- |
| Materiały budowlane     | 126 332,62 ÷ 1,23 = 102 709,45 | **102 709,45** |
| Materiały wykończeniowe | 70 701,52 ÷ 1,23 = 57 480,91   | **57 480,91**  |
| Pozostałe koszty        | 68,00 ÷ 1,23 = 55,28           | **55,28**      |
| Razem                   | 197 102,14 ÷ 1,23 = 160 245,64 | **160 245,64** |
| Obniżka                 | 36 856,50                      | **−36 856,50** |

Wszystko co do grosza — i, co ważniejsze, **wiersze sumują się do sumy**: 102 709,45 + 57 480,91 +
55,28 = 160 245,64. To nie jest oczywistość. Gdyby program liczył obniżkę jako „× (1 − 0,23)"
zamiast „÷ 1,23", dostałby 151 768,65 zamiast 160 245,64 — i rozbicie rozjechałoby się z sumą o
8,5 tysiąca. Komentarz w kodzie mówi wprost, że ta zmiana powstała po to, żeby zamknąć dokładnie ten
rozjazd. Zamyka.

Bilans inwestora poszedł za tym: **„Pozostało do zapłaty" 365 539,05 → 328 682,55**, czyli mniej o
dokładnie 36 856,50. Klient płaci mniej, firma zjada VAT — i tak to jest opisane.

Ta sama liczba pokazuje się identycznie w edytorze kosztorysu i na stronie inwestycji, choć to dwa
różne ekrany. Dobrze, bo obie idą przez jeden rachunek.

### Rzecz, którą trzeba wiedzieć: tryb brutto wyłącza tę obniżkę

Przy okazji pomyłki natrafiłem na coś, co warto powiedzieć wprost. **Kiedy rozliczenie robocizny
stoi na „Brutto", obniżka materiałów przestaje działać** — przełącznik materiałów sam pokazuje
wtedy „Brutto", mimo że stawka 23% siedzi zapisana w bazie. Po powrocie na tryb netto obniżka wraca
sama, bez ponownego ustawiania.

To jest zamierzone (na płaszczyźnie brutto pytanie „kto płaci VAT" ma inną odpowiedź), ale skutek
jest taki, że **jedno przełączenie potrafi po cichu zmienić rachunek o 36 856,50 zł w drugą stronę**.
Przełącznik nie kłamie — pokazuje stan faktyczny — po prostu nikt nie mówi, że to się właśnie stało.

### Bramka potwierdzenia

Zmiana sposobu rozliczenia materiałów jest zablokowana tym samym potwierdzeniem co zmiana trybu
robocizny: „**Uwaga — zmiana widoczna dla inwestora!** Sposób rozliczenia materiałów zmienia kwoty,
które inwestor widzi w podglądzie." Spójnie — obie dźwignie, które ruszają rachunek klienta, mają tę
samą bramkę.

Po teście przywróciłem stan wyjściowy: materiały z powrotem „Brutto", stawka wyczyszczona, tryb
robocizny „Netto", VAT 8%.

## Rabat globalny — trafia w obie figury naraz

Trzecia dźwignia w tym samym panelu. Ustawiłem rabat kwotowy 10 000 zł i sprawdziłem oba miejsca,
w które powinien uderzyć:

| figura               | przed      | po             | zmiana  |
| -------------------- | ---------- | -------------- | ------- |
| Pozostało do zapłaty | 365 539,05 | **355 539,05** | −10 000 |
| Marża                | 390 258,13 | **380 258,13** | −10 000 |

Dokładnie tak, jak rabat ma działać: klient płaci mniej **i** firma zarabia mniej — jedna kwota,
dwa skutki. Co ważne, **robocizna została nietknięta na 471 819,25**, a rabat stanął obok jako
własny wiersz „Rabat −10 000,00". Nie jest wtopiony w ceny pozycji, więc widać, ile ustąpiono i od
czego. Suma się spina: 471 819,25 − 10 000 + 197 102,14 = 658 921,39.

**Jedna niespójność:** zmiana rodzaju rabatu **nie ma bramki potwierdzenia**, a mają ją obie
pozostałe dźwignie w tym samym panelu („Uwaga — zmiana widoczna dla inwestora!"). Rabat zmienia
kwotę, którą inwestor widzi, tak samo jak tamte dwie — i to o 10 tysięcy jednym zapisem. Albo
wszystkie trzy powinny pytać, albo żadna.

### Przy okazji: „Lista wpłat" pokazuje stan zmigrowanych danych wprost

W bloku wpłat pod podsumowaniem wszystkie trzy wpłaty inwestycji 31 mają formę **„Nie określono"**,
a pod tabelą stoi zdanie: „Wpłaty bez oznaczonej formy są traktowane jako gotówka." To jest most
starych danych powiedziany na głos — **każda wpłata z produkcji jest po migracji „nieokreślona"**,
bo forma wpłaty to pole, które dopiero powstało. Traktowanie ich jak gotówki jest bezpiecznym
domysłem (gotówka = tor bez VAT, czyli bez skutków na płaszczyźnie brutto), ale to nadal domysł, i
dobrze, że jest napisany, a nie ukryty.

## „Usuń całą fakturę" zostawia pliki, których już nikt nie widzi

To najcięższe ustalenie fazy 2 i **jedyne, które trwale niszczy dane** — a nie tylko myli
na ekranie. Wyszło przypadkiem, przy sprzątaniu po innym teście, i dlatego dostało osobne
odtworzenie od zera, trzy razy.

**Co się dzieje.** Faktura wielostronicowa (`N` zdjęć jednego dokumentu) usuwana przyciskiem
**„Usuń całą fakturę"** znika z ekranu poprawnie — wszystkie powiązania z wydatkiem przepadają.
Ale **z bazy kasowany jest tylko JEDEN z N plików**. Pozostałe `N − 1` zostają: rekord pliku
istnieje, bajty leżą w magazynie, a **nie wskazuje na nie już nic** — żaden wydatek, żaden
przegląd pojazdu, nic. Są nieusuwalne z poziomu aplikacji, bo nie ma ekranu, na którym
by się pokazały.

**Odtworzenie — trzy przebiegi na tym samym wydatku `#4522`, za każdym razem od czystego stanu:**

| przebieg | stron | co zostało skasowane   | co zostało jako sierota |
| -------- | ----- | ---------------------- | ----------------------- |
| 1        | 2     | 1 plik (pozycja 2)     | 1                       |
| 2        | 3     | 1 plik (pozycja 2)     | 2                       |
| 3        | 3     | 1 plik (pozycja **3**) | 2                       |

Czyli: **zawsze ginie dokładnie jeden plik, a to który — jest losowe.** Przebieg 2 i 3 to ten sam
komplet trzech zdjęć wgranych tak samo, a skasował się inny. To wyklucza „kasuje pierwszy" albo
„kasuje ostatni" — to wyścig, nie reguła.

**Usuwanie pojedynczej strony („Usuń stronę") jest czyste** — sprawdzone wcześniej i potwierdzone
tutaj: jedna strona, jeden skasowany rekord, zero sierot. Usterka siedzi wyłącznie w ścieżce
zbiorczej, i to jest spójne z tym, że tylko ona kasuje więcej niż jeden plik naraz.

**Aplikacja o niczym nie informuje.** Sprawdziłem dziennik funkcji na serwerze dla dokładnie tego
żądania — **ani jednego błędu**. Sprzątanie po prostu uznaje, że pliku nie wolno ruszyć, i cicho go
zostawia. Z punktu widzenia użytkownika operacja wygląda na w pełni udaną, bo ekranowo jest udana.

**Dlaczego to jest ciężkie, a nie kosmetyczne.** Zdjęcia faktur to dokumenty księgowe trzymane na
potrzeby podatkowe. Magazyn plików tego projektu **nie ma wersjonowania ani kosza** — co tam wpadnie
bez wskazującego rekordu, zostaje na zawsze i nikt tego nie policzy. Repozytorium **ma już
udokumentowaną historię takich sierot** (`context/reference/blob-recovery-runbook.md`, §2 — cztery
znane przypadki, do dziś bez wyjaśnienia skąd). **To jest bardzo prawdopodobnie ten mechanizm.**
Sprzątanie po nieudanym zapisie formularza, na które do tej pory padało podejrzenie, jest
świadomie zaprojektowane i strzelało tylko przy błędzie zapisu — a to strzela przy zwykłym,
udanym usunięciu.

**To nie jest usterka przeniesienia.** Ścieżka wielostronicowa jest nowa (to ona przyszła razem
z całą resztą tej gałęzi), więc na obecnej produkcji tego przycisku po prostu nie ma. Przejście
`staging` → `main` **wprowadza tę usterkę na produkcję**, a nie ją odsłania. Dlatego zapisuję ją
tu jako rzecz do naprawy przed scaleniem, nie po.

**Zakres skażenia w tej próbie.** Sześć osieroconych rekordów na gałęzi próbnej bazy
(`1412`, `1414`, `1417`, `1418`, `1419`, `1421`) — baza i tak zniknie. **Ale bajty poszły do
magazynu plików środowiska przedprodukcyjnego, który jest wspólny i zostaje.** Nazwy plików
dopisane do listy sprzątania na końcu tego dokumentu.

### Przyczyna i naprawa

**Nie da się tego odtworzyć lokalnie — i to była cała trudność.** Na lokalnej bazie w dockerze
ta sama ścieżka jest czysta za każdym razem: osiem stron, osiem skasowanych rekordów, przez
prawdziwe okno przeglądarki i prawdziwy przycisk. Dopiero puszczona przeciw **bazie takiej,
jaka stoi pod wdrożeniem** (Neon, gałąź próbna) usterka wyskakuje natychmiast.

**Co się naprawdę dzieje.** Sprzątanie po usunięciu brało wszystkie strony **naraz**, równolegle.
Baza wdrożeniowa przy równoległych zapisach Payloada **utrzymuje jeden z nich, a resztę cicho
gubi — i melduje sukces dla wszystkich**. Dlatego w dzienniku nie było ani jednego błędu: kod
dostał osiem potwierdzeń, że skasował osiem rekordów, a w bazie zniknął jeden. To też tłumaczy
losowość ofiary: wygrywa ten, który zdąży pierwszy.

Pomiar, trzy przebiegi po pięć stron przeciw tej samej bazie:

| sposób        | stron | skasowanych | sierot |
| ------------- | ----- | ----------- | ------ |
| równolegle    | 4     | 1           | 3      |
| równolegle    | 6     | 2           | 4      |
| po kolei      | 6     | 6           | 0      |
| po kolei (×2) | 12    | 12          | 0      |

**Naprawa: jedna strona po drugiej.** Żadnej równoległości w tej ścieżce — ani przy kasowaniu,
ani przy sprawdzaniu, czy plik nie wisi jeszcze gdzie indziej (zły odczyt to też zostawiony plik).
Test-strażnik pilnuje dokładnie tego: dwa kasowania nigdy nie mogą lecieć naraz. Sprawdzony
w obie strony — na starym kodzie czerwony, na nowym zielony.

**To samo groziło gdzie indziej — poprawione przy okazji.** Znaczniki „powiadomiono" w
przypomnieniach flotowych stawiały się tak samo równolegle, więc przebieg meldował, że oznaczył
wszystkie terminy, a w bazie lądował jeden. Skutek łagodniejszy (nieoznaczony przegląd przypomina
się nazajutrz, i tak w kółko), ale mechanizm ten sam. Idą teraz po kolei, z własnym
test-strażnikiem.

## Wpłaty bez inwestycji i zabezpieczenie transferu do samego siebie

Transfer kasa→kasa przeszedł już pełny test w fazie 1 (wyżej), więc tu tylko to, czego tamten
nie dotknął: dwa typy wpłat spoza inwestycji oraz zabezpieczenie, o które fazy 1 nie zahaczyła.
Wszystko zaksięgowane naprawdę i potem anulowane; salda odtworzone z bazy przed i po.

**Zabezpieczenie przed transferem do samego siebie działa — ale dopiero na zapisie.** Lista kas
docelowych **nadal proponuje kasę już wybraną jako źródłową**; wybór przechodzi, a dopiero
„Dodaj" odbija się o „Kasa docelowa musi być inna niż kasa źródłowa" i „Formularz zawiera błędy".
W bazie nie powstał żaden wiersz — sprawdzone. Pieniądze są bezpieczne; kosmetyka jest taka,
że okno pozwala wybrać opcję, która nigdy nie może być poprawna. Do tego podgląd salda liczy
przy takim wyborze zwykły odpływ („3 629,54 zł"), co dla transferu do samego siebie jest
nieprawdą — ale nigdy się nie materializuje, bo zapis nie przechodzi.

Przy okazji, na powtórzonym transferze 1 234,56 zł (kasa 5 → kasa 10): **jeden wiersz obsługuje
obie strony**, nie dwa. Kwota siedzi raz, z kasą źródłową i docelową w jednym rekordzie, a saldo
kasy docelowej powstaje z osobnego zapytania po kolumnie docelowej. To wyjaśnia, dlaczego
anulowanie działa czysto: znika jeden wiersz, obie strony wracają razem — i **wiersz anulujący
nie ma żadnej kasy**, więc z definicji nie może już ruszyć pieniędzy. Kwota z przecinkiem
(„1234,56") jest przyjmowana i normalizowana.

**Obie wpłaty firmowe zachowują się jak wpłaty, nie jak wydatki.** „Zasilenie z konta firmowego"
500,00 zł i „Inna wpłata" 777,77 zł na tę samą pustą kasę: saldo 0 → **1 277,77 zł**, czyli obie
dodały. Po anulowaniu z powrotem 0,00.

**Żadna z nich nie ma pola inwestycji — i to jest poprawne, wbrew temu, co sugeruje `AGENTS.md`.**
Plik projektu opisuje „Inną wpłatę" tak, że można to przeczytać jako „EX-557 przywrócił jej
inwestycję". Kod mówi coś przeciwnego i mówi to wprost: **EX-557 wyrzucił oba typy** ze zbioru
typów pokazujących inwestycję, bo to gotówka firmy, nigdy klienta, a inwestycja na nich po cichu
ruszałaby bilans tej inwestycji. Okno w środowisku przedprodukcyjnym zachowuje się zgodnie
z kodem: przy obu typach pole inwestycji **znika**.

To zamyka pytanie, które chciałem zadać osobnym testem: **czy wpłata bez oznaczonej płaszczyzny
może wejść w bilans inwestycji i przy rozliczeniu brutto zostać potraktowana inaczej niż wpłata
inwestora.** Nie może — jedynym typem wpłaty, który w ogóle wchodzi na inwestycję, jest „Wpłata
od inwestora", i to jedyny typ noszący płaszczyznę. Luki nie ma z konstrukcji, nie z przypadku.

## „Zapisz kolejność" — jedyna rzecz w edytorze, która zmienia arkusz nieodwracalnie

Sortowanie w edytorze jest **tylko widokiem** — dopóki nie kliknie się „Zapisz kolejność"
w menu nagłówka kolumny. Wtedy ten widok staje się **zapisaną kolejnością całego arkusza**,
we wszystkich sekcjach naraz, i przeżywa wyczyszczenie sortowania. Warto to rozumieć zanim
się kliknie: to nie jest ustawienie ekranu, to przepisanie kosztorysu.

**Test na inwestycji 31 — 340 pozycji, 14 sekcji.** Sortowanie „malejąco zachowując sekcje"
po kolumnie „Przedmiar", potem „Zapisz kolejność", potem sprawdzenie zapisanej kolejności
własnym zapytaniem, niezależnie od tego, co pokazuje ekran:

- **Wszystkie 340 pozycji trafiły dokładnie tam, gdzie powinny** — w każdej z 14 sekcji
  kolejność jest malejąca po przedmiarze, numeracja ciągła od zera, **zero rozbieżności**.
  Nie „w pierwszej sekcji się zgadza"; policzone dla całości jednym zapytaniem.
- **Kolejność sekcji została nietknięta** — „zachowując sekcje" znaczy dokładnie to, co mówi.
- **Remisy zachowują wcześniejszą kolejność.** Pięć pozycji z przedmiarem 1 stało wcześniej
  w kolejności 1., 2., 7., 9., 13. — po zapisie stoją 8., 9., 10., 11., 12., czyli względnie
  tak samo. Sortowanie jest stabilne, nie tasuje remisów losowo.
- **Numery wierszy przeliczają się dopiero po zapisie, nie przy samym sortowaniu.** Podczas
  sortowania wiersze pokazują swoje stare numery (11, 12, 3, 10…) — czyli widać, że to widok.
  Po „Zapisz kolejność" i wyczyszczeniu sortowania numery to 1, 2, 3, 4… Dobre rozdzielenie:
  numer wiersza mówi prawdę o zapisanym stanie, a nie o chwilowym ekranie.

**242 z 340 pozycji faktycznie się przesunęło**, więc test nie był pusty. Przywróciłem
pierwotną kolejność zapytaniem na gałęzi próbnej (pozycje w każdej sekcji mają ciągłe,
rosnące identyfikatory, więc pierwotna kolejność odtwarza się jednoznacznie).

## Pracownicy — założenie, edycja, dezaktywacja

Ostatnia lista w aplikacji, której faza 1 nie dotykała.

- **Lista zgadza się z bazą co do sztuki i co do grosza** — 43 aktywnych, a kolumna wypłat dla
  czterech sprawdzonych osób (6 500,00 / 38 801,89 / 145 500,00 / 25 500,00 zł) odtworzona
  niezależnie z sumy wypłat i zgodna.
- **Założenie pracownika** (dane zmyślone): wiersz powstał z rolą „Pracownik", aktywny,
  z domyślną kasą, wypłaty 0,00 zł. Licznik aktywnych 43 → 44.
- **Edycja** zmieniła naraz trzy rzeczy: nazwę, rolę na „Manager" i status na nieaktywny —
  wszystkie trzy wylądowały w bazie. Formularz edycji wchodzi **z poprawnie wypełnionymi
  polami**, łącznie z kasą i przełącznikiem statusu.
- **Filtr działa w obie strony**: nieaktywny znika z listy (44 → 43), a przełączenie na
  „Wszyscy" pokazuje 50 wierszy — dokładnie tyle, ile jest w bazie łącznie.

**Uwaga, której nie zdołałem sprawdzić empirycznie — i tak ją zapisuję.** Założenie pracownika
tworzy **konto z hasłem**: aplikacja generuje losowe hasło, którego nikt nie zna, więc zalogować
się nie da bez resetu. To jest sensowne. Natomiast **nie znalazłem w kodzie miejsca, w którym
status „nieaktywny" blokowałby logowanie** — wygląda na filtr listy, nie na bramkę dostępu.
Nie potwierdziłem tego próbą, bo jedynym sposobem byłoby wylogowanie się z konta, którego hasła
też nie mam, a to zakończyłoby próbę. **To jest odczyt z kodu, nie pomiar** — i dotyczy stanu
sprzed tej gałęzi, więc przejście `staging` → `main` niczego tu nie zmienia. Zapisuję jako rzecz
do sprawdzenia osobno, nie jako ustalenie tej próby.

## Stawka „bez narzędzi" jest w bazie inna niż ta, którą dostaje każda nowa inwestycja

Najcichsze ustalenie tej próby. Nic nie miga, nic nie krzyczy, a różnica siedzi w każdej
przyszłej wycenie podwykonawcy.

**Fakt zmierzony w bazie:** **114 ze 117 inwestycji** ma stawkę „bez narzędzi" **0,55**.
Trzy pozostałe mają **0,5525** — inwestycja 31 (ta jedyna z kosztorysem) i dwie założone dzisiaj.
Czyli **0,5525 to dzisiejsza wartość domyślna dla nowej inwestycji**, a 0,55 to wartość, którą
migracja wstawiła kiedyś wszystkim istniejącym i która tam została.

**Skąd 0,5525.** W arkuszu właściciela „bez narzędzi" nie jest osobną stawką — to stawka
„z narzędziami" pomniejszona o 15%: `0,65 × 0,85 = 0,5525`. Czyli 0,55 nie jest inną decyzją
biznesową, tylko **zaokrągleniem, które przestało być prawdą**.

**Sprawdzone naprawdę, nie z kodu.** Na zastanej inwestycji 6 („Apenińska 2/37") założyłem jedną
pozycję z ceną 1 000,00 zł, bez żadnego nadpisania stawki, i jeden etap „bez narzędzi"
z ilością 1. Podsumowanie pokazało **„Suma wykonanej pracy: 550,00 zł"** — czyli `1000 × 0,55`.
Ta sama pozycja na inwestycji 31 dałaby 552,50 zł. **Pół procenta różnicy na każdej pozycji
bez nadpisania.** Sekcję i etap po pomiarze skasowałem; inwestycja 6 znów ma pusty kosztorys.

**Dziś to nic nie psuje — i dlatego łatwo przegapić.** Kosztorys istnieje tylko na inwestycji 31,
która ma poprawne 0,5525. Zaczyna psuć dopiero wtedy, gdy kosztorys wejdzie na którąkolwiek
z tych 114 — a to jest dokładnie to, co ma się zacząć dziać po scaleniu.

**Import z arkusza sam się przed tym broni, ale tylko import.** Ścieżka pobierania z arkusza
czyta stawkę z formuł cennika i nadpisuje nią ustawienia inwestycji — kod nazywa to wprost
i podaje tę samą liczbę: 0,55 zamiast 0,5525 to 151 stawek zaniżonych o pół procenta, każda
wyglądająca na w pełni zamierzoną. Natomiast **szablon celowo NIE przenosi ustawień** (szablon
zbudowany dla jednej roboty nie ma prawa narzucać swojej konfiguracji drugiej). Czyli kosztorys
złożony **z szablonu albo ręcznie** na zastanej inwestycji wyceni podwykonawcę po 0,55
i nikt się o tym nie dowie.

**To nie jest usterka przeniesienia** — 0,55 leży w bazie od migracji z lipca. Zapisuję to tu,
bo próba generalna jest ostatnim momentem, w którym widać to jeszcze jako liczbę w tabeli,
a nie jako rozjazd w wycenie. Nie ma kosztorysów do naprawiania, więc lekarstwo jest dziś
jednym zapytaniem.

**Przy okazji, potwierdzenie zamierzonego zachowania.** Inwestycja 6 ma prawdziwe wypłaty
(71 400,00 zł) i pusty kosztorys — panel od razu pokazał „Nadpłata 70 850,00 zł" i wprost
napisał, że ekipa dostała więcej, niż jest warta wykonana praca. Dokładnie to, co projekt
zakłada: pusty kosztorys przy zaksięgowanych wypłatach ma krzyczeć rozjazdem, dopóki praca
nie zostanie wprowadzona. Nie jest to usterka, tylko lista rzeczy do zrobienia.

## Nowa inwestycja z szablonu — całe zakładanie i edycja

Ostatnia ścieżka zapisu, której faza 1 nie mogła dotknąć, bo szablonów wtedy nie było.

**Założenie.** Nowa inwestycja („PROBA CUTOVER inwestycja testowa", id 135) z kosztorysem
z szablonu zapisanego wcześniej z inwestycji 31. Sprawdzone w bazie, nie na ekranie:

- **13 sekcji i 336 pozycji**, wszystkie z ceną. Nadpisania stawek przyjechały razem z pozycjami:
  270 nadpisań „z narzędziami" i 271 „bez narzędzi" — czyli szablon niesie **wycenę**, nie tylko
  nazwy prac.
- **Zero etapów i zero odhaczonej pracy.** Szablon to rozpiska do wyceny, nie kopia stanu robót —
  i tak właśnie się zachował.
- **Suma przedmiaru = 0.** Ilości nie przyjeżdżają. Zgodne z tym, co widziałem przy „Sekcji
  z szablonu": kopiuje się co i po ile, nie ile.
- **Szablon jest migawką z chwili zapisu, nie żywym łączem.** Źródło ma dziś 14 sekcji i 340
  pozycji — o jedną sekcję („Wiatrołap", 4 pozycje) więcej, bo dołożyłem ją już po zapisaniu
  szablonu. Kopia stanęła na 13 / 336. Dokładnie ta różnica, więc nic się nie zgubiło po drodze.
- **Stawki i VAT nowej inwestycji NIE przyjechały z szablonu** — dostała wartości domyślne
  aplikacji (0,65 / 0,5525, VAT 8%). To jest zamierzone: konfiguracja cenowa jest per robota,
  a szablon zbudowany dla jednej nie ma prawa narzucać jej drugiej. Tu akurat wyszło na to samo,
  bo źródło też ma 0,5525 — ale jest to zbieg okoliczności, nie przeniesienie (patrz ustalenie
  o stawce „bez narzędzi" wyżej).

**Edycja.** Zmiana nazwy, notatki i statusu na „zakończona" — wszystkie trzy w bazie.
Po zmianie statusu inwestycja **znika z listy aktywnych**, a liczba aktywnych zgadza się
z bazą co do sztuki.

## Strata i rabat jako transakcje — dwa typy, dwa zupełnie różne skutki

Oba typy nie mają kasy źródłowej i oba wymagają inwestycji, więc łatwo je wziąć za
odmiany tego samego. Nie są. Sprawdziłem je na inwestycji 31, która ma i kosztorys,
i pełną historię przelewów, więc widać naraz obie płaszczyzny.

**Punkt wyjścia** (odtworzony z SQL, nie odczytany z drugiego ekranu): Robocizna
471 819,25 · Materiały 197 102,14 · Łącznie 668 921,39 · Wpłaty −303 382,34 ·
Pozostało do zapłaty 365 539,05 · Marża 390 258,13.

**Strata 1000 zł** (`#4664`) ruszyła dokładnie te dwie figury, o które chodzi w opisie
typu, i w zadeklarowanych kierunkach:

| figura               | przed      | po         | zmiana   |
| -------------------- | ---------- | ---------- | -------- |
| Pozostało do zapłaty | 365 539,05 | 364 539,05 | −1000,00 |
| Marża                | 390 258,13 | 389 258,13 | −1000,00 |

Klient przestaje być winien to, co firma wzięła na siebie, a marża spada o tę samą
kwotę. Nic innego się nie ruszyło — robocizna, materiały i wpłaty zostały co do grosza.
W podsumowaniu pojawił się osobny wiersz „Strata −1000,00", więc figura jest widoczna,
a nie schowana w saldzie.

**Rabat 1000 zł** (`#4667`) nie ruszył w v2 **niczego**. Marża 389 258,13 bez zmian,
Pozostało do zapłaty 364 539,05 bez zmian. Na v1 ten sam przelew widać normalnie:
`Rabat netto: 1000,00`, Bilans −363 538,80, Marża 256 763,15.

To nie jest defekt, tylko dokładnie to, co reguła mówi: rabat należy do kosztorysu, a
przelew typu RABAT jest zapisem ze starej płaszczyzny. Gdyby v2 go doliczał, ta sama
zniżka byłaby policzona dwa razy.

**Ale v2 nie przechodzi nad tym do porządku dziennego.** W podsumowaniu pojawia się
wiersz „Rabat 0,00", którego przy zerowym rabacie normalnie nie ma — i to nie jest gołe
zero. Przy etykiecie siedzi czerwony trójkąt („Niezgodność z transakcjami"), a pod nim
pełne rozliczenie różnicy:

> Kosztorys (netto, ceny dla inwestora): 0,00
> Transakcje rabatu (netto): 1000,00
> Różnica: 1000,00
> Zweryfikuj przed oznaczeniem inwestycji jako rozliczonej.

Wiersz znika, gdy przelew zostaje anulowany. Czyli mechanizm działa tak, jak był
pomyślany: rozjazd między planami jest **pokazany**, a nie po cichu wyzerowany.

**Przy okazji wyszedł prawdziwy rozjazd na tej inwestycji**, niezależny od moich
testów. Trójkąt wisi także przy „Robocizna":

> Kosztorys (netto, ceny dla inwestora): 471 819,25
> Transakcje robocizny (netto): 471 819,00
> Różnica: −0,25

SQL potwierdza: jedyny `LABOR_COST` na tej inwestycji to 471 819,00, a kosztorys liczy
471 819,25. Ćwierć złotego, więc to zaokrąglenie przy przepisywaniu, nie błąd rachunku —
ale rekoncyliacja je złapała i nie pozwoli oznaczyć inwestycji jako rozliczonej bez
spojrzenia. Zostawiam jak jest: to realne dane właściciela, nie mój wiersz.

Obie transakcje testowe (`#4664`, `#4667`) anulowane po pomiarze; inwestycja 31 wróciła
do wartości wyjściowych.

## „Ustaw kolejność kolumn" — jedyne ustawienie edytora, które nie idzie do bazy

Wszystko inne w edytorze zapisuje się na inwestycji. To nie: okno mówi wprost
„Ustawienie zapamiętuje ta przeglądarka i działa we wszystkich kosztorysach", i tak
faktycznie jest. Sprawdziłem, bo to zdanie ma dwa skutki, których nie widać na ekranie.

Przeciągnąłem „Komentarz" z ostatniej pozycji na trzecią. Kolejność w tabeli zmieniła się
od razu, przeżyła przeładowanie strony i — co ważniejsze — **przeniosła się na inwestycję
31**, której w ogóle nie dotykałem. Czyli to ustawienie użytkownika, nie ustawienie
kosztorysu. Kto pracuje na dwóch inwestycjach naraz, dostanie jedno ułożenie w obu, a
kolega przy sąsiednim biurku zobaczy swoje własne.

W bazie nie przybyło ani jednego wiersza. Całość siedzi w `localStorage` pod
`kosztorys-v2-col-order`, i to w postaci, którą warto odnotować:

```
{"note":1.5}
```

Zapisana jest **wyłącznie przesunięta kolumna**, i to jako ułamkowa pozycja między
sąsiadami — a nie cała lista kolejności. To jest dobry wybór, bo gdy w aplikacji przybędzie
nowa kolumna, wskoczy na swoje domyślne miejsce zamiast wylądować na końcu za czyimś
zamrożonym ułożeniem sprzed pół roku. Pełna lista miałaby ten drugi skutek i nikt by go nie
zauważył aż do pierwszej skargi.

„Przywróć domyślną kolejność" czyści wpis do `{}` i tabela wraca do układu wyjściowego —
sprawdzone na obu inwestycjach.

**Czego to znaczy dla przełączenia:** nic nie trzeba migrować, bo nie ma czego. Ale też
nikt tego ustawienia nie odzyska po wyczyszczeniu przeglądarki ani nie zobaczy na drugim
komputerze — i to jest zamierzone, nie do zgłoszenia.

## „Wyczyść kosztorys" — jedyna operacja, która kasuje wszystko, i jej siatka bezpieczeństwa

Zostawiłem ją na koniec, bo to najbardziej nieodwracalna rzecz w edytorze: jedno kliknięcie
zdejmuje całą rozpiskę. Puściłem ją na inwestycji próbnej 135 (13 sekcji · 336 prac), żeby
sprawdzić nie tylko czy kasuje, ale czy **dotrzymuje wszystkich obietnic**, które składa w
oknie potwierdzenia. Bo składa ich cztery, i każda jest sprawdzalna:

> Cała rozpiska zniknie — razem z etapami i wpisanym wykonaniem. Stawka VAT i współczynniki
> zostają, rabat globalny zostanie wyzerowany (przywrócenie stanu go nie cofa). Stan sprzed
> wyczyszczenia zapisze się automatycznie — wrócisz do niego przez „Wczytaj".
>
> Do usunięcia: **13 sekcji · 336 prac**

Liczby w ostatnim wierszu zgadzają się z bazą co do jednej. To nie jest kosmetyka: to jedyne
miejsce, gdzie ktoś ma szansę zauważyć, że kliknął na złej inwestycji.

Żeby czwarta obietnica („rabat globalny zostanie wyzerowany") w ogóle miała co sprawdzać,
**najpierw ustawiłem rabat kwotowy 7777 zł** — inwestycja go nie miała.

**Po wyczyszczeniu**, prosto z bazy:

| co                     | przed         | po            |
| ---------------------- | ------------- | ------------- |
| sekcje / prace / etapy | 13 / 336 / 0  | 0 / 0 / 0     |
| rabat globalny         | `amount` 7777 | pusty, 0      |
| VAT                    | 0,08          | 0,08          |
| współczynniki          | 0,65 / 0,5525 | 0,65 / 0,5525 |
| tryb rozliczenia       | `NET`         | `NET`         |

Cztery obietnice na cztery. Rozpiska znika, ustawienia zostają, rabat pada — dokładnie w tej
kombinacji, którą okno zapowiada.

**Siatka bezpieczeństwa naprawdę łapie.** Migawka „Przed wyczyszczeniem" zapisała się jako
**nazwana** (nie automatyczna), więc siedzi na wierzchu listy „Wczytaj", a nie w zwijanym
ogonie. W środku ma 13 sekcji i 336 prac.

**Przywrócenie sprawdziłem porównaniem zawartości, nie liczników.** Zestawiłem dziewięć pól
każdej pracy (opis, jednostka, przedmiar, cena, kolejność, rodzaj i wartość rabatu,
nadpisanie stawki) między migawką a bazą po przywróceniu, w obie strony:

```
w migawce 336 · w bazie 336 · tylko w migawce 0 · tylko w bazie 0
```

To samo dla sekcji (nazwa, kolor, kolejność): zero różnic w obie strony. Czyli przywrócenie
odtwarza **treść**, mimo że identyfikatory wierszy są nowe — kasowanie i odtwarzanie, nie
cofnięcie transakcji.

Rabat 7777 zł **nie wrócił** — zgodnie z ostrzeżeniem w nawiasie. Warto o tym pamiętać: to
jedyna rzecz, której „Wczytaj" nie przywraca, i jedyna, o której okno uprzedza właśnie
dlatego.

Samo przywrócenie zrobiło przy okazji własną migawkę **automatyczną** stanu pustego („Obecny
stan zostanie zapisany jako punkt przywracania") — z zerem prac, czyli poprawnie. Kto
przywróci przez pomyłkę, ma drogę powrotną.

## Blokada wielkiego pliku i konwersja HEIC — dwie rzeczy, które dzieją się przed wysłaniem

Nowa ścieżka wgrywania faktur ma bramkę, której nie da się sprawdzić patrząc na bazę:
oba przypadki kończą się **przed** dotarciem czegokolwiek na serwer. Trzeba je wywołać
plikiem.

**Za duży plik.** Limit to 4 MB, celowo poniżej twardego 4,5 MB Vercela — bo przekroczenie
tamtego daje błąd 413, którego aplikacja już nie przechwyci i użytkownik zobaczy gołą
stronę błędu. Zrobiłem **PDF o rozmiarze 5,0 MB** (obrazek by się nie nadał: obrazki są
najpierw kompresowane i praktycznie nigdy nie dobijają do limitu — bramkę wywołują tylko
PDF-y) i wgrałem go na transakcję `#2204`.

Komunikat nazywa plik i limit, zamiast mówić „coś poszło nie tak":

> Plik „proba-cutover-duzy.pdf" przekracza 4 MB — zmniejsz go i spróbuj ponownie.

I co ważniejsze — **nic nie poszło na serwer**: zero nowych wierszy w `media`, zero relacji
przy transakcji `#2204`. To jest różnica między bramką a komunikatem po fakcie.

**HEIC.** W kodzie tej ścieżki siedzi komentarz o „przepuszczaniu surowego HEIC-a", więc
sprawdziłem, czy `staging` faktycznie ma tę dziurę. **Nie ma.** Wgrany `proba-cutover.heic`
(prawdziwy HEIF/HEVC z `sips`, 182 KB) wylądował w bazie jako:

```
proba-cutover-ab8c3a.jpg · image/jpeg · 112 730 B · 800 × 600
```

Czyli konwersja poszła w przeglądarce i to na prawdziwych bajtach — wymiary zgadzają się z
oryginałem co do piksela, a typ i rozszerzenie są już jpegowe. Telefon właściciela robi
zdjęcia w HEIC, więc to jest ta ścieżka, którą pójdzie większość faktur z budowy.

Sprzątanie: fakturę zdjąłem przyciskiem „Usuń" na fakturze jednostronicowej — rekord `media`
zniknął razem z relacją, **bez sieroty**. To potwierdza rozgraniczenie z usterki opisanej
wyżej: cieknie „Usuń całą fakturę" na fakturze wielostronicowej, a nie usuwanie jako takie.

## Bramka „tylko właściciel" — jedyne miejsce, gdzie rola faktycznie coś odbiera

Cała próba szła na roli `OWNER`, więc dwie akcje sterujące tym, **co widzi klient**, były
przez cały czas nietknięte. Sprawdziłem je na końcu, przestawiając konto próbne
`test@test.pl` na `MANAGER` w bazie gałęzi próbnej i logując się na nowo (rola siedzi
w tokenie, więc sama zmiana w bazie nic nie robi, dopóki nie ma nowego logowania).

Chodzi o link dla inwestora i ustawienia jego podglądu. Powód, dla którego akurat te dwie
rzeczy stoją wyżej niż reszta zarządu, jest prosty: **kto nie może linku odebrać, nie może go
też rozdać** — inaczej manager wypuszcza klientowi widok, którego potem sam nie cofnie.

Wynik, po kolei:

| akcja jako `MANAGER`                            | co się stało                                                                                   | baza                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| „Udostępnij" → „Wygeneruj link"                 | „Tylko właściciel może udostępniać kosztorys inwestorowi"                                      | token `kosztorys_shares` bez zmian                               |
| „Ustawienia podglądu…" → „Zapisz jako domyślne" | „Tylko właściciel może zmieniać ustawienia podglądu inwestora"                                 | `kosztorys_client_view` bez zmian, globalne domyślne nadal puste |
| to samo po przełączeniu Oferta → Rozliczenie    | najpierw ostrzeżenie „Uwaga — zmiana widoczna dla inwestora!", po potwierdzeniu ta sama odmowa | bez zmian                                                        |

**Bramka jest wyłącznie po stronie serwera i to jest widać.** W menu „Opcje" obie pozycje
są dla managera **normalnie widoczne i klikalne** — nic nie jest wyszarzone ani ukryte.
Manager dowiaduje się o braku uprawnień dopiero po przejściu całego okna aż do przycisku
zapisu. Nie jest to dziura (zapis naprawdę nie przechodzi, sprawdzone w bazie), ale jest to
droga na skróty przez trzy ekrany po to, żeby usłyszeć „nie". Do rozważenia, nie do
naprawiania w dniu przełączenia.

Przy okazji potwierdziło się, że **ostrzeżenie o zmianie widocznej dla klienta pojawia się
przed odmową, nie zamiast niej** — czyli kolejność jest właściwa: najpierw pytanie o skutek
dla klienta, dopiero potem sprawdzenie roli.

**Bramka jest wąska i nie zabiera nic ponad to.** Ten sam manager na tej samej sesji zapisał
nazwaną wersję kosztorysu („Zapisano wersję", migawka 18 w bazie, `taken_by = 63`), a menu
edycji, szablonów i arkusza Google zostało w komplecie. Odbierane są dwie akcje, nie rola.

# Werdykt fazy 2

Faza 1 pytała „czy to, co działa, nadal działa". Faza 2 pytała „czy to, co przychodzi nowe,
robi to, co obiecuje" — i to jest jedyna część próby, w której `main` nie ma się z czym
porównać, bo tych ekranów na produkcji po prostu nie ma.

Metoda była ta sama przez cały czas i to ona decyduje o wadze wyników: **żadna figura nie
została uznana za poprawną dlatego, że dwa ekrany pokazują to samo.** Każda była odtwarzana
od zera surowym SQL-em na bazie po migracjach, a dopiero potem zestawiana z tym, co pokazuje
aplikacja. Tam, gdzie liczyły się bajty, a nie liczby (faktury, konwersja HEIC, ZIP), sprawdzany
był plik, nie komunikat.

## Co blokuje scalenie

**Nic — naprawione.** Blokadą było jedno: „Usuń całą fakturę" na fakturze wielostronicowej
zostawiało pliki w magazynie bez wskazującego rekordu. Przyczyna leżała w równoległym kasowaniu
stron, którego baza wdrożeniowa nie znosi (utrzymuje jeden zapis, resztę gubi, a melduje sukces
dla wszystkich). Kasowanie idzie teraz po kolei; szczegóły i pomiary przy opisie usterki wyżej.

## Co warto naprawić, ale nie wstrzymuje

- **Natywne okno przeglądarki** przy usuwaniu faktury/strony — jedyne takie miejsce w całej
  aplikacji. Lekarstwo już istnieje (commit `e7d31903`), tylko leży na niescalonej gałęzi.
- **Panel podsumowania przykrywa „Pobierz z arkusza Google…"** na pustym kosztorysie —
  na każdej sprawdzonej szerokości. To jedyne wejście do importu, więc pierwszy kontakt
  właściciela z v2 jest zasłonięty.
- **Bramka „tylko właściciel" jest wyłącznie po stronie serwera** — manager przechodzi trzy
  ekrany, żeby usłyszeć „nie". Zapis nie przechodzi, więc to nie jest dziura, tylko droga
  donikąd.
- **Stawka „bez narzędzi" 0,55 zamiast 0,5525** w 114 na 117 inwestycji — dziś nieosiągalna,
  bo żadna z nich nie ma kosztorysu, ale czeka na pierwszą, która go dostanie z szablonu.

## Co jest w porządku, wbrew pozorom

- **Rabat jako przelew nie rusza v2** — i tak ma być, bo rabat należy do kosztorysu. Co
  ważniejsze, v2 tego nie zamiata: pokazuje wiersz „Rabat 0,00" z czerwonym trójkątem i pełnym
  rozliczeniem różnicy. Rozjazd między planami jest **głośny**, a nie wyzerowany.
- **Rekoncyliacja łapie realne rzeczy** — przy okazji wyszła różnica 0,25 zł między kosztorysem
  a przelewem robocizny na inwestycji 31, której nikt nie szukał.
- **Bramka 4 MB nie przepuszcza bajtów na serwer**, a HEIC z telefonu jest konwertowany
  w przeglądarce — obie rzeczy sprawdzone plikiem, nie komunikatem.
- **„Wyczyść kosztorys" dotrzymuje wszystkich czterech obietnic** ze swojego okna, a
  przywrócenie odtwarza treść co do pola, w 336 pracach i 13 sekcjach.

## Czego ta próba NIE dowodzi

- **Wnętrze `/admin`** (panel Payloada) — świadomie poza zakresem, osobny temat.
- **Synchronizacja z arkuszem Google w drugą stronę** — przycisku „synchronizacja" nie
  dotknąłem ani razu, bo pisze do żywego arkusza właściciela.
- **Zachowanie pod obciążeniem i przy współbieżności** — cała próba to jeden użytkownik.
  Blokada inwestycji (`lock-investment`) nie została wywołana ani razu.
- **Prawdziwe faktury** — wszystkie pliki użyte w próbie były sfabrykowane.

# Sprzątanie należne po próbie

- [x] wiersze testowe `#4648`–`#4651` skasowane; branch z powrotem na 3754 / max id 4647
- [x] rola `test@test.pl` przestawiona z powrotem na `MANAGER` **na gałęzi próbnej** —
      zrobione na koniec, przy okazji testu bramki „tylko właściciel" (opisanego wyżej).
      **Uwaga: to nie załatwia sprawy na produkcji.** Gałąź `cutover_rehearsal` jest odbitką
      produkcji sprzed próby, więc jeśli `users.id=63` ma tam `role='OWNER'`, nadal ma —
      i tylko człowiek może to zmienić. To pozycja dla właściciela, nie dla mnie
- [x] hasło `test@test.pl` na gałęzi próbnej ustawione na własne, żeby dało się przelogować
      na `MANAGER` (rola jest w tokenie, sama zmiana w bazie nic nie robi bez nowego
      logowania). Zmiana **istnieje wyłącznie na gałęzi próbnej** i zniknie razem z nią;
      produkcyjnego hasła nie tknąłem
- [ ] `DB_POSTGRES_URL` na Vercel Preview z powrotem na `ep-still-term-agp9aqfa-pooler`
- [ ] branch Neona `cutover_rehearsal` — auto-delete po dobie; do tego czasu staging na nim stoi
- [x] runbook `context/reference/blob-recovery-runbook.md` §2 — dopisana czwarta sierota
      (media 1053 / transakcja 3899). Odnotowana **osobno** od trzech znanych, bo tamte nie mają
      ani jednego wskazania, a ta ma jedno: to żywa faktura z martwym plikiem, nie śmieć.
      Bajty są w store'ie preview, więc odzysk to celowy pobór stamtąd, a nie odtwarzanie z FTP
- [ ] artefakty testowe na gałęzi próbnej (**wszystkie znikną razem z nią**, więc nic nie trzeba
      kasować ręcznie — spis jest po to, by nie wziąć ich potem za dane właściciela):
      migawki inwestycji 31 (3 nazwane + automatyczne z tej sesji), szablon `kosztorys_presets` #1,
      link dla inwestora `kosztorys_shares` #1 oraz ustawienia podglądu `kosztorys_client_view`
      dla inwestycji 31 (tryb `OFFER`) — żadne z tego nie istniało przed próbą
- [x] wiersze testowe fazy 2 anulowane: `#4652` (wpłata brutto) oraz `#4654`/`#4655`
      (wydatki netto) — wpłaty na inwestycji 31 z powrotem 3 / 303 382,34, netto bilowane 0,
      saldo kasy 7 = 20 863,29, tryb rozliczenia z powrotem `NET`
- [x] inwestycja 6 („Apenińska 2/37") — sekcja, pozycja i etap założone do pomiaru stawki
      „bez narzędzi" skasowane; kosztorys znów pusty
- [x] kolejność pozycji na inwestycji 31 przywrócona zapytaniem po teście „Zapisz kolejność"
      (242 z 340 pozycji było przestawionych)
- [x] wiersze testowe wgrywania faktur sprzątnięte: PDF 5 MB **nigdy nie doszedł na serwer**
      (bramka 4 MB), a przekonwertowany HEIC (`media` 1422) zdjęty z transakcji `#2204`
      razem z rekordem — bez sieroty; pliki lokalne skasowane
- [x] kosztorys inwestycji 135 wyczyszczony i przywrócony z migawki (13 sekcji / 336 prac,
      zero różnic); rabat globalny 7777 zł ustawiony tylko po to, by sprawdzić ostrzeżenie
      okna — po wyczyszczeniu wyzerowany i **celowo nieprzywrócony**
- [x] kolejność kolumn w edytorze przywrócona do domyślnej (`kosztorys-v2-col-order` = `{}`)
      — ustawienie i tak siedzi wyłącznie w tej przeglądarce, nie w bazie
- [ ] inwestycja testowa `investments.id=135` („PROBA CUTOVER…", 13 sekcji / 336 pozycji,
      zero transakcji, status „zakończona") — zostaje, zniknie z gałęzią próbną
- [ ] pracownik testowy `users.id=64` („Testowy Pracownik Próbny (edytowany)",
      `proba.cutover@example.invalid`, MANAGER, nieaktywny) — zostaje, zniknie z gałęzią próbną;
      interfejs nie ma usuwania pracownika
- [x] wiersze testowe strat/rabatów anulowane: `#4664` (strata), `#4665` i `#4667` (rabaty) —
      inwestycja 31 z powrotem: Robocizna 471 819,25 / Materiały 197 102,14 / Łącznie 668 921,39 /
      Wpłaty −303 382,34 / Pozostało 365 539,05 / Marża 390 258,13
- [x] wiersze testowe kas anulowane: `#4658` (transfer kasa→kasa), `#4660` (zasilenie firmowe),
      `#4661` (inna wpłata) — salda z powrotem: kasa 5 = 715 347,78, kasa 10 = 2 494,98,
      kasa 30 = 0,00
- [ ] sfabrykowane PNG-i faktur wylądowały w **preview'owym** store'u Blob — nie w produkcyjnym.
      Store preview i tak jest zeszytem do wyrzucenia, ale warto je skasować, żeby nie mylić ich
      z fakturą właściciela: `budmat-polnoc-20-08-2026-bd05be.png`,
      `remont-serwis-kowalczyk-22-08-2026-32f452.png`, `paragon-dopiecie-a03850.png`,
      `paragon-dopiecie-39a395.png`, `paragon-dopiecie-e350d0.png`,
      `orphan-test-a-1bfd5a.png`, `orphan-test-b-807b17.png`, `orphan-test-c-39252a.png`,
      `orphan-test-a-dd3fc3.png`, `orphan-test-b-b71b23.png`, `orphan-test-c-2f51c0.png`.
      **Ostatnich pięciu nie da się skasować z poziomu aplikacji** — to sieroty z usterki
      „Usuń całą fakturę" opisanej wyżej; idą tylko narzędziem do blobów
- [ ] bajty z odtwarzania przyczyny tej usterki: 28 plików `repro-orphan-*.png` (rekordy `1423`–`1469`
      na gałęzi próbnej) — rekordy znikną z gałęzią, bajty zostają w magazynie preview
- [x] rozliczenia etapów na inwestycji 31 (6 × „z narzędziami", 1 × „bez narzędzi") **zostają
      ustawione** — interfejs nie pozwala cofnąć etapu do stanu „nieustawiony" (opisane wyżej).
      Znikną razem z gałęzią próbną; na produkcji te etapy nadal mają puste rozliczenie
- [x] dźwignie „Opcji rozliczenia" na inwestycji 31 przywrócone do stanu sprzed testu:
      materiały „Brutto" (stawka wyczyszczona), tryb robocizny `NET`, VAT 8%, rabat „Wyłączony"
      (`global_discount_type` puste, wartość 0)
