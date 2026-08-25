# Cutover rehearsal — regression log (staging on `cutover_rehearsal`)

Living record of the pre-merge check of `staging` → `main`. **Goal: confirm that what
already worked still works** — new functionality is explicitly not the subject.

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

## Sprzątanie należne po próbie

- [x] wiersze testowe `#4648`–`#4651` skasowane; branch z powrotem na 3754 / max id 4647
- [x] rola `test@test.pl` przywrócona do `MANAGER` (na czas testu marży podniesiona do `OWNER`)
- [ ] `DB_POSTGRES_URL` na Vercel Preview z powrotem na `ep-still-term-agp9aqfa-pooler`
- [ ] branch Neona `cutover_rehearsal` — auto-delete po dobie; do tego czasu staging na nim stoi
- [ ] runbook `context/reference/blob-recovery-runbook.md` §2 — dopisać czwartą sierotę
      (media 1053 / transakcja 3899) i to, że da się ją odzyskać ze store'u preview
