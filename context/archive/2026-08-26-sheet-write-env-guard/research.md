---
date: 2026-08-26T15:33:21Z
researcher: Claude (Opus 5)
git_commit: 193c0d194422cee5fa3a274da276f7bf0bf8887f
branch: staging
repository: wykonczymy
topic: 'Co jeszcze przedostało się z nieprodukcyjnych środowisk do żywych usług zewnętrznych'
tags: [research, codebase, google-sheets, email, blob, openrouter, meta, env-isolation, incident]
status: complete
last_updated: 2026-08-26
last_updated_by: Claude (Opus 5)
---

# Research: co jeszcze przedostało się poza produkcję

**Data**: 2026-08-26T15:33:21Z
**Commit**: `193c0d19` · **Gałąź**: `staging` · **Repo**: wykonczymy

## Pytanie badawcze

Zanim postawimy strażnika na zapisie do Google Sheets — czy tym samym mechanizmem nie przedostało
się coś jeszcze? Audyt wszystkich efektów wychodzących na zewnątrz pod kątem bramek środowiskowych,
plus ustalenie realnego zasięgu tego, co już wyszło.

## Streszczenie

**Wyciek jest potwierdzony, ale innymi wierszami, niż zakładała premisa.** W ośmiu produkcyjnych
arkuszach klientów leży **36 obcych wierszy**, których produkcyjna baza nigdy nie wyprodukowała. Trzy z nich są przypisane do dzisiejszego stanu baz nieprodukcyjnych; pozostałe 32
pochodzą z epizodów lipcowych (2026-07-08…07-26), których baza źródłowa już nie istnieje.
**Destrukcji nie było** — dopisano śmieci, nic klientowi nie zniknęło.

**Dolną granicą jest liczba EPIZODÓW, nie liczba wierszy do posprzątania.** Lista 36 jest kompletna
jako lista naprawcza — przeczesano wszystkie 56 arkuszy, więc nie ma ogona poza nią. Ale
„Zresetuj wydatki inwestycyjne" czyści zakładkę i odbudowuje ją od zera, więc nieobecność wiersza
**nie dowodzi, że nigdy nie wyszedł** — dowodzi, że nie ma go dziś. Ilu epizodów wycieku było
naprawdę, nie da się odtworzyć z bieżącego stanu arkuszy; jedynym źródłem jest historia wersji
Google (pytanie otwarte #5).

**Korekta premisy.** Transakcje 4536/4537 istnieją lokalnie dokładnie jak opisano i **nie ma ich
dziś na arkuszu inwestycji 42** — ale nie dlatego, że nie doszły. Zakładka `wydatki` tego arkusza
niesie id 4604 (wydatek 139,80 zł, 2026-08-20 14:55 UTC), którego **nie ma ani lokalnie (max 4537),
ani na preview (max 4602)** — czyli została odbudowana ze stanu produkcyjnego, a lokalne wiersze
wypadły przy okazji resetu.

**Problem jest szerszy niż arkusze.** Strażnik środowiskowy istnieje w tym repo dokładnie w jednym
miejscu — przy Vercel Blob. Poza nim żaden efekt wychodzący go nie ma: ani poczta, ani Google
Sheets, ani OpenRouter, ani Meta Graph, ani crony. Wszystkie środowiska dzielą jedno konto SMTP,
jeden portfel OpenRouter, jedno konto usługowe Google, jedną produkcyjną stronę FB i jeden
`CRON_SECRET`.

**Najgroźniejsze pojedyncze ustalenie nie dotyczy arkuszy:** listy odbiorców powiadomień
przeprowadzały się z `.env` do globala Payloada `notification-recipients`, czyli **do bazy** —
a każda baza nieprodukcyjna to przywrócony zrzut produkcji. Adresy pracowników są więc dziś
w każdym środowisku, a autoresponder leadowy pisze wprost na adres klienta.

## Ustalenia szczegółowe

### 1. Google Sheets — 7 zapisów, dwie fabryki klienta, zero strażników

Cały ruch pisany przechodzi przez **7 wywołań API w 2 plikach**. Nie ma Drive API (brak scope'a
`auth/drive`), nie ma `spreadsheets.create`, `copyTo`, `values.append` ani `permissions.create`.

| #   | wywołanie · funkcja                                                       | plik:linia                          | środowiska | strażnik |
| --- | ------------------------------------------------------------------------- | ----------------------------------- | ---------- | -------- |
| 1   | `values.batchUpdate` (upsert) · `applyTabRowsBatch`                       | `src/lib/google/sheets.ts:232`      | a b c d    | BRAK     |
| 2   | `spreadsheets.batchUpdate` → `deleteRange` · `applyTabRowsBatch`          | `src/lib/google/sheets.ts:246`      | a b c d    | BRAK     |
| 3   | `spreadsheets.batchUpdate` → `addSheet` · `setupTab`                      | `src/lib/google/sheets.ts:326`      | a b c d    | BRAK     |
| 4   | `values.clear` (**czyści całą zakładkę**) · `setupTab`                    | `src/lib/google/sheets.ts:343`      | a b c d    | BRAK     |
| 5   | `values.batchUpdate` (banner/nagłówek) · `setupTab`                       | `src/lib/google/sheets.ts:359`      | a b c d    | BRAK     |
| 6   | `spreadsheets.batchUpdate` (formaty, `deleteProtectedRange`) · `setupTab` | `src/lib/google/sheets.ts:621`      | a b c d    | BRAK     |
| 7   | `spreadsheets.batchUpdate` → tytuł · `verifySheetAccess`                  | `src/lib/google/sheet-access.ts:37` | a b c d    | BRAK     |

`a` = localhost/5433, `b` = Vercel Preview/staging, `c` = db-test 5435 pod `pnpm test:e2e`,
`d` = produkcja.

**Gałąź transakcyjna odpala się sama**, bez kliknięcia w cokolwiek „arkuszowego":

```
sheets.ts:232/246  applyTabRowsBatch / removeTabRow(:273)
  ← src/lib/actions/sheets-sync.ts:259,298,339,367,376,429
     ← src/hooks/transfers/sync-sheet.ts:43 (afterChange), :54 (afterDelete)
        ← src/collections/transfers.ts:77-78   ← KAŻDA mutacja `transactions`
```

Punkty wejścia do mutacji `transactions`: `src/lib/actions/transfers.ts:33,69,176,226,334,358,370`,
panel `/admin`, oraz REST/GraphQL przez `src/app/(payload)/api/[...slug]/route.ts`. Hook siedzi na
warstwie kolekcji — to była świadoma decyzja (`sync-sheet.ts:10-13`, „review T2.2"), żeby żadna
ścieżka mutacji nie mogła go ominąć. Ta sama własność, która zapewnia pokrycie, zapewnia też, że
wyciek nie ma luki.

**Dwa zapisy zaskakują.** `verifySheetAccess` (`sheet-access.ts:37`) przepisuje tytuł dokumentu na
ten sam jako **celową sondę uprawnień** („no-op write", komentarz `:26-30`) — czyli samo wklejenie
linku do arkusza modyfikuje cudzy dokument, zanim cokolwiek trafi do bazy. A `setupTab` robi
`values.clear` na całym zakresie zakładki plus `deleteTable`/`deleteProtectedRange`, i wisi na
`ensureTab` (`sheets.ts:630`), więc potrafi wystartować ze **zwykłego syncu**, jeśli zakładki brak.

**Klucz upsertu to `transaction.id`.** `sheets.ts:190-197` buduje `idToRow` z kolumny „id",
traktując dowolną liczbę w niej jako id transakcji; `updates` idą **w istniejący wiersz, w miejscu**,
`removeTabRow` (`sheets.ts:273`) wycina wiersz przez `deleteRange` z `shiftDimension: 'ROWS'`.
Zabezpieczenie `buildSyncPlan` (`sheets-sync.ts:214-229`, „review T1.1") sprawdza, czy osierocone id
należy do transakcji tej inwestycji i tego typu — ale sprawdza to **w bazie lokalnej, która jest
kopią produkcji**, więc odpowiada „tak" i przepuszcza. Chroni przed ręcznym numerem wpisanym przez
właściciela, nie przed kolizją środowisk.

**Źródła `spreadsheetId`**: (1) `kosztoryses.google_sheet_id` z bazy — jedyne źródło na ścieżce
synchronizacji, przez `sheet-lookup.ts:18,47`; to jest wektor incydentu; (2) URL wklejony przez
użytkownika — `sheet-access.ts:14`; (3) `KOSZTORYS_TEMPLATE_SHEET_ID` — wymagany w
`env/schema.ts:88`, **w runtime aplikacji nieczytany nigdzie**, martwy na ścieżce zapisu.

**Istniejące „strażniki" na tej ścieżce to nieporozumienia.** `context.skipSheetSync`
(`sync-sheet.ts:23`) jest ustawiany w jednym miejscu (`transfers.ts:127`) i jest **optymalizacją
wydajnościową, nie ochroną** — `syncSheetAfterDelete` w ogóle go nie sprawdza. Realna izolacja
istnieje tylko przy imporcie kosztorysu: `readonly-sheets-client.ts:7` bierze scope
`spreadsheets.readonly`.

**Cztery odczyty idą przez klienta zapisowego** (`sheets.ts:94,161,303`, `sheet-access.ts:35`), bo
dzielą fabrykę z zapisami. To ma znaczenie dla wyboru szwu.

### 2. Poczta — jedno produkcyjne konto SMTP, listy odbiorców w bazie

Jeden adapter na wszystko: `nodemailerAdapter` z kontem firmowym, `src/payload.config.ts:65-77`.
Nie ma Resenda, SendGrida, SMS-a ani webhooka do Slacka.

| ścieżka                                       | plik:linia                                                         | odbiorca                      | wyjdzie z localhosta?                                                  |
| --------------------------------------------- | ------------------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------- |
| `sendAutoReply` — „Dziękujemy za kontakt"     | `src/lib/leads/notify.ts:171,185-190`                              | **klient** (`lead.email`)     | TAK                                                                    |
| `notifyNewLead` (treść = PII leada)           | `src/lib/leads/notify.ts:23,52`                                    | pracownicy `newLead`          | TAK                                                                    |
| `notifyShapeAlert` (surowy payload w `<pre>`) | `src/lib/leads/notify.ts:61,69,72`                                 | pracownicy `opsAlerts`        | TAK                                                                    |
| `notifyReconcileRecovery` / `Failure`         | `src/lib/leads/notify.ts:91,129,142,158`                           | pracownicy `opsAlerts`        | TAK                                                                    |
| `notifyFleetDigest`                           | `src/lib/fleet/notify.ts:72,81`                                    | pracownicy `fleetDigest`      | TAK — **już się zdarzyło**, `context/foundation/manual-checks.md:3519` |
| reset hasła                                   | `src/collections/users.ts:58-70` ← `src/lib/actions/auth.ts:48-55` | **pracownik** (`users.email`) | TAK                                                                    |
| `/api/test-email?to=`                         | `src/app/(frontend)/api/test-email/route.ts:13,59`                 | dowolny adres                 | TAK                                                                    |

**Odbiorcy przeprowadzili się z env do bazy.** `LEADS_NOTIFY_EMAIL`, `LEADS_ALERT_EMAIL`,
`FLEET_NOTIFICATION_EMAIL` nadal siedzą w `.env`, ale są **martwe** — nie ma ich w `serverSchema`
ani w żadnym pliku `src/`. Listy żyją teraz w globalu Payloada `notification-recipients`
(`src/globals/notification-recipients.ts:27-39`), czytanym przez `src/lib/email/recipients.ts:22-28`.
Konsekwencja: na localhoście, preview i w bazie E2E `fleetDigest` / `newLead` / `opsAlerts`
zawierają **prawdziwe adresy prawdziwych pracowników**. Wcześniej adres też był prawdziwy, ale był
jeden i podmienialny jedną linijką w `.env`.

`requireRecipients` rzuca na pustej liście (`recipients.ts:38-39`) — to jedyny mechanizm w całym
repo zdolny zatrzymać wysyłkę poza produkcją, i jest nieaktywny po każdym restore z dumpu.

**Reset hasła to najłatwiejsza do przypadkowego odpalenia ścieżka z całej listy.**
`forgotPasswordAction` (`auth.ts:48-55`) nie ma auth, nie ma rate-limitu, połyka błędy zwracając
`success: true`, a strona `/zaloguj/zapomniane-haslo` stoi na **każdym** preview deploymencie nad
bazą pełną prawdziwych adresów pracowników.

**Sekrety**: `EMAIL_HOST`/`EMAIL_USER`/`EMAIL_PASS`/`LEADS_REPLY_FROM` wymagane bezwarunkowo
(`env/schema.ts:62-64,75`), bez wariantu `_PROD` (w przeciwieństwie do `BLOB_READ_WRITE_TOKEN_PROD`).
Jedno wspólne produkcyjne konto firmowe, poprawny SPF/DKIM — mail z localhosta trafia do skrzynki
odbiorczej, nie do spamu.

**Bookkeeping.** Produkcji to nie ucisza: Payload łączy się z `process.env.DB_POSTGRES_URL`
(`payload.config.ts:60`), a `DB_POSTGRES_URL_PROD` nie jest czytany przez żaden kod aplikacji.
Zatrucie idzie w drugą stronę i jest ciche — lokalny przebieg stempluje lokalną kopię, następny
`db:import` stempel kasuje, i **ten sam mail idzie ponownie do tych samych ludzi**. Po stronie
leadów duplikat jest gwarantowany: idempotencja opiera się na `(source, external_id)` w bazie
lokalnej (`store-lead.ts:19-30`), więc lead, który wpadł na produkcję po ostatnim dumpie,
w kopii nie istnieje → `created = true` → `notifyNewLead` leci drugi raz.

### 3. Pozostałe integracje

| integracja                  | operacja                | plik:linia                                                                      | źródło id                   | strażnik                     |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------- | --------------------------- | ---------------------------- |
| Blob `put`                  | zapis                   | `src/payload.config.ts:100-107` ← `src/lib/utils/upload-file.ts:32-41`          | env (token)                 | **TAK**                      |
| Blob `del`                  | **zapis destrukcyjny**  | plugin `handleDelete` ← `src/lib/invoices/delete-unreferenced-media.ts:39`      | **BAZA** (`media.filename`) | **TAK**                      |
| Meta Graph (4 wywołania)    | wyłącznie odczyt        | `fetch-lead.ts:14`, `fetch-recent-leads.ts:29,58`, `fetch-form-questions.ts:19` | env (prod Page)             | brak                         |
| OpenRouter `generateObject` | **zapis kosztowy**      | `src/lib/ai/openrouter.ts:57-66,117`                                            | env (jeden portfel)         | **brak**                     |
| OpenRouter `/credits`       | odczyt                  | `src/lib/ai/openrouter-balance.ts:16` ← `top-nav.tsx:25`                        | env                         | brak                         |
| Google Drive                | —                       | **nie istnieje**; `KOSZTORYS_DRIVE_FOLDER_ID` zadeklarowany i nieczytany        | —                           | —                            |
| Sentry                      | —                       | **niepodłączone**, ~30 markerów `TODO(EX-449)`                                  | —                           | —                            |
| crony (3×)                  | zapis                   | `vercel.json:3-14`                                                              | —                           | tylko `CRON_SECRET`          |
| GH Actions backup           | odczyt prod + zapis FTP | `.github/workflows/*.yml`                                                       | sekrety repo                | **TAK** (dispatch → `test/`) |

**OpenRouter to jedyna pozostała dziura z realnym kosztem.** `POST /api/extract-receipt`
(`route.ts:29-31`) jest osiągalne dla każdego zalogowanego MANAGER/OWNER w każdym środowisku,
a lokalna baza to zrzut produkcji, więc te konta istnieją. Budżet jednego wywołania: do 8 stron ×
dwie próby (`openrouter.ts:20-43`), `maxDuration = 300`. Nie ma drugiego klucza — nie ma
odpowiednika „preview store", więc bramka musiałaby albo odmawiać poza produkcją, albo wymagać
osobnego klucza dev.

**Meta: po stronie Facebooka szkody nie ma** — nigdzie w repo nie ma zapisu do Graph API, tylko
GET-y. Szkoda jest po naszej stronie: sweep wciąga prawdziwe leady klientów do bazy dev i wysyła
alert do sprzedaży.

**Crony nie mają bramki środowiskowej.** `isAuthorizedCronRequest`
(`src/lib/cron/verify-cron-request.ts:13-17`) porównuje nagłówek z `CRON_SECRET`, a to jedna wartość
w `.env` współdzielona przez wszystkie środowiska. `vercel.json` uruchamia harmonogram tylko na
produkcji, ale ręczny `curl` na localhost albo preview przechodzi.

### 4. Wzorzec strażnika Blob — precedens do powielenia

`blobTokenRefusal(vercelEnv, token)` w `src/lib/env/schema.ts:36-55`. Czysta funkcja, zero
side-effectów, zwraca tekst odmowy albo `null`. Opiera się na tym, że token Vercel Blob **nosi
w sobie id store'a** (`vercel_blob_rw_<STORE_ID>_…`), a id store'a jest jednocześnie publicznym
hostem CDN, więc stałe `PROD_BLOB_STORE_ID` / `PREVIEW_BLOB_STORE_ID` (`:15-16`) nie są sekretami.

Cztery decyzje projektowe, które są istotą wzorca:

- **Klucz to `VERCEL_ENV`, nigdy `NODE_ENV`** (`:22-23`). Lokalny `next build` ustawia
  `NODE_ENV=production` i wyłączyłby strażnika dokładnie na maszynie, którą ma chronić.
- **Odmowa w obie strony** (`:42-54`). Produkcyjny token poza produkcją niszczy faktury przez
  `del()`; token preview **na produkcji** też niszczy, bo store preview jest cyklicznie czyszczony.
- **Świadomie NIE allow-lista** (`:28-29`). Nierozpoznany store przechodzi — rotacja store'a nie
  może wywalić bootu produkcji przez zdezaktualizowaną stałą.
- **Fail-open na braku tokenu.** Brak zmiennej raportuje `z.string().min(1)`, nie strażnik.

**Stoi w dwóch miejscach, bo to dwa rozłączne grafy modułów**: `serverSchema.superRefine`
(`schema.ts:99-101`) łapie wszystko czytające walidowaną warstwę env, a `payload.config.ts:43-44`
sprawdza osobno, bo **graf Payloada nie parsuje żadnego schematu** i nie może zaimportować
`env/server.ts` (`server-only` rzuca pod `payload generate:types`). Stąd predykat wydzielony do
`schema.ts` — plik bez `server-only` i bez side-effectów, importowalny z obu grafów.

**Testowany dwoma blokami** (`src/__tests__/lib/env/schema.test.ts`): przez `safeParse` (`:42-100`)
i sam predykat (`:104-131`), bo to on stoi w `payload.config.ts`. Kluczowy szczegół: tokeny testowe
(`:13-14`) są **literałami, nie zbudowanymi ze stałych** — token złożony z testowanych stałych
dowodziłby tylko, że strażnik zgadza się sam ze sobą.

**Trzecia instancja ma odwróconą polarykę.** `scripts/blob-restore.mjs:46-61` to **allow-lista**,
bo narzędzie CLI ma failować zamknięcie — deny-lista odczytałaby `undefined` z nieparsowalnego
tokenu i przepuściła masowy upload. Nad tym `scripts/blob-refresh-preview.sh:37-49` odmawia
**przekazania** `--allow-prod` dalej.

**Najmocniejsza wersja wzorca w repo** jest w `src/scripts/backfill-heic-media.ts:153-175`:
sprawdza nie „czy środowisko pasuje do zasobu", tylko **czy baza i zasób są z tego samego
środowiska** — bo ten skrypt czyta `media.filename` z bazy i kasuje odpowiadające blob-y. To jest
dokładnie kształt bramki, której brakuje przy arkuszach: identyfikator zasobu przychodzi z bazy,
więc strażnik musi wiązać _płaszczyznę bazy_ z _płaszczyzną zasobu_, a nie samo `VERCEL_ENV`.

### 5. Realny zasięg — co faktycznie wyszło

**36 obcych wierszy na 8 arkuszach**, wszystkie trzy zakładki zarządzane przez aplikację.
Przeczesano wszystkie 56 arkuszy, więc jako **lista naprawcza jest kompletna**; dolną granicą jest
liczba historycznych epizodów, nie liczba wierszy — patrz „Reset kasuje dowody" niżej.
Potwierdzone przez odczyt wszystkich 56 arkuszy przez `scripts/inspect-sheet.mjs` i porównanie
z produkcyjnym zrzutem (`dumps/dump-latest.sql`, produkcja do id 4672, 2026-08-26 15:51).

| inw. | nazwa                                         | `google_sheet_id`                              | zakładka       | obcych | id                                     |
| ---- | --------------------------------------------- | ---------------------------------------------- | -------------- | ------ | -------------------------------------- |
| 31   | 11 Listopada 40 (plik: 11 listopada Gabinety) | `1s5HKoWbXtY8Kw183ggTsacMq6dgJiuqA566wOjopwsA` | wydatki        | 8      | 3745, 3808, 3915–3919, **4507**        |
| 31   | —                                             | —                                              | transfery      | 6      | 3735, 3807, 3809, 3914, 3930, **4586** |
| 31   | —                                             | —                                              | rozliczone R+M | 2      | 3918, **4507**                         |
| 6    | Apeninska - Adam Orlowski                     | `152HYswm1ESgQxbk8rMt9JSeX1R-ppj49rbcZZtyCNBs` | wydatki        | 12     | 3773–3781, 3908, 3909, 4136            |
| 6    | —                                             | —                                              | transfery      | 1      | 3809                                   |
| 49   | Dominika Misztal - Iławska 4/113              | `1G_1SPjvO8YEB4z3fvlmVqk_QWZuA5wsgg15_qbNzG1w` | transfery      | 2      | 3014, 3027                             |
| 19   | Sławomir Jagiełło Siennicka 50/152            | `16FQccu4nNGeRLe9GkEvOnyvy1BusebPso5qVxtWaosg` | transfery      | 1      | 3013                                   |
| 46   | Patryk Pudlowski Dąbrowskiego                 | `1gNIGqPljbHQtcUjel0hsLso_xfuu1O8Ca8T2W7H0Sfw` | transfery      | 1      | 3007                                   |
| 72   | Lasku Brzozowego 4 - Roman                    | `1uRQBQRJeFL62LhF1bGNVw5EAwIQB-_9KvN7LdJu2Cqk` | transfery      | 1      | 3002                                   |
| 77   | Al. Polski Walczącej 28/43                    | `1bSrOLY-WXMIW4Ek6WuFOV8e7qsPWXuP7Cfpttp69B6U` | wydatki        | 1      | 3784                                   |
| 119  | Kulisiewicza 16 Marcin Główka                 | `1RT8dwNz0kh4YB68hYPgyHEYCLJg8LdXFUuuxggevyYM` | transfery      | 1      | **4598**                               |

Pogrubione = przypisane do dzisiejszego stanu baz. Reszta to epizody z 2026-07-08…07-26, z opisami
nie do pomylenia: „test", „1 000 000,00 zł", `EX519-QA-deposit-marker`, `Test netto EX-567`.

**Co realnie dociera do klienta — jedna liczba, nie wszystkie.** Zweryfikowane na arkuszu 31:
`Podsumowanie` sięga wyłącznie po `kosztorys_robocizny`, a jedyne odwołanie z kosztorysu do zakładek
aplikacji to `kosztorys_robocizny!S380 = 'wydatki inwestycyjne'!K3`, gdzie
`K3 = SUMIF(C:C; "Materiały wykończeniowe"; E:E)` → `Podsumowanie!B7` → `B8 = B6+B7`.

Wynika z tego hierarchia wagi obcych wierszy:

- na `wydatki inwestycyjne` **typu „Materiały wykończeniowe"** — przechodzą do podsumowania klienta;
- na `wydatki inwestycyjne` innych typów — psują tylko `RAZEM` i kolumny tej zakładki;
- na `transfery` — kosmetyka. Kolumny I–N to `SUMIF` po tej samej zakładce i nikt ich nie czyta,
  więc nawet kolizja id 981 (471 819 zł → 235 911 zł) zmienia dwie komórki, które nigdzie nie wpływają.

**Reconcile ich nie posprząta.** `buildSyncPlan` usuwa z zakładki wyłącznie te id, które
w działającej bazie należą **do tej inwestycji** — a żaden z 36 obcych wierszy do swojej inwestycji
na produkcji nie należy (4507 to na produkcji inw. 131, 3773 to inw. 97). Reconcile potraktuje je
jako ręczne wiersze właściciela i zostawi. Czyści je wyłącznie pełne **„Zresetuj wydatki
inwestycyjne" + sync uruchomione z produkcji**, osobno dla każdej z 8 inwestycji (6, 19, 31, 46, 49,
72, 77, 119). **Zastrzeżenie dla właściciela:** reset stawia zakładkę od zera, więc cokolwiek
wpisał ręcznie w kolumnach `notatka`/`komentarz` tych trzech zakładek — przepadnie. Numery faktur
w kolumnie G wrócą, bo trzyma je aplikacja.

**Kolejność: najpierw bramka, potem sprzątanie.** Dopóki bramki nie ma, zegar rusza od nowa
przy pierwszym wydatku dodanym na localhoście na inwestycji z kosztorysem — posprzątane trzeba
będzie sprzątać drugi raz.

**NIE usuwać** (sprawdzone, to nie wyciek): pięć wierszy `CORRECTION` na zakładce `transfery` —
inw. 40 (`1jJRaDBrcyAJ_DImhFQoGj2sZow81BXbdE4CeiV3_KUU`, id 2232, 2828, 2829, 2830) i inw. 67
(`111MhEHVB-OLVxLZQ0KjqbckE3zrk5ciiY6wW-3sIiFw`, id 3277). Każdy ma odpowiednik produkcyjny przy tej
samej inwestycji i kwocie; legalna pozostałość po przeniesieniu korekt (`CORRECTION_MOVED_LABEL`).

#### Per baza

**localhost:5433** (max id 4537, punkt odtworzenia ~4479 z 2026-08-12/13 — nie 4534, jak zakładała
premisa):

| id                   | typ                          | kwota             | inw.     | status                                                                                                  |
| -------------------- | ---------------------------- | ----------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| 4507                 | INVESTMENT_EXPENSE (settled) | 100 000           | 31       | **NA PEWNO WYSZEDŁ** — `wydatki` r182 + `rozliczone R+M` r05                                            |
| 4508                 | INVESTMENT_EXPENSE_NET       | 10 000            | 31       | mógł wyjść; anulowany 2026-08-20; dziś w arkuszu nieobecny                                              |
| 4480, 4482           | LOSS                         | 1 000 / 1 000 000 | 31       | mogły wyjść; anulowane; dziś w arkuszu nieobecne                                                        |
| 4536, 4537           | INVESTMENT_EXPENSE           | 12 311            | 42       | spełniają warunki; **zakładka odbudowana z produkcji 2026-08-20, więc nieobecność niczego nie dowodzi** |
| 4510–4534 (18), 4236 | —                            | —                 | 205, 105 | **brak kosztorysu → zapis niemożliwy**                                                                  |

**preview Neon** (max id 4602, punkt odtworzenia ~4583):

| id                         | typ              | kwota | inw.     | status                                 |
| -------------------------- | ---------------- | ----- | -------- | -------------------------------------- |
| 4586                       | INVESTOR_DEPOSIT | 1 000 | 31       | **NA PEWNO WYSZEDŁ** — `transfery` r32 |
| 4598                       | INVESTOR_DEPOSIT | 1 000 | 119      | **NA PEWNO WYSZEDŁ** — `transfery` r06 |
| 4584, 4587–4597, 4599–4602 | —                | —     | 133, 135 | **brak kosztorysu**                    |

Sesja QA (batche B2a–B19) operowała niemal wyłącznie na inwestycjach **bez kosztorysu**, więc
z ~19 utworzonych wierszy tylko dwa miały dokąd polecieć — i oba poleciały.

**db-test:5435**: **56/56 kosztorysów niesie produkcyjne `google_sheet_id`** — mechanizm w pełni
uzbrojony. Wierszy spoza produkcji brak poza fixture'ami 900001–900006 wstawionymi surowym SQL-em
(`seed-deposit-planes.ts`), które hooków nie odpalają. `grep 'E2E-'` po wszystkich 56 arkuszach nie
zwraca nic — ale **wyłącznie dlatego, że spece E2E są zepsute**: `e2e/helpers.ts:46` szuka
inwestycji `'Plac Hellera 3'`, a istnieje „Plac **Ha**llera 6" (id 108), więc `pickComboOption`
(`exact: true`) rzuca po 5 próbach i `createInvestmentExpense` nigdy nie tworzy transakcji. Naprawa
literówki natychmiast otwiera kanał na arkusz `1EJu2jGPWD6Qg5qMzgsYCkBU7bdznhvr5Zch3uBAXhpc`,
z tworzeniem **i usuwaniem** wierszy.

#### Reset kasuje dowody — liczba epizodów jest nie do odtworzenia

„Zresetuj wydatki inwestycyjne" (`src/components/sheets/sync-button.tsx:86`) woła `setupSheetAction`,
a zaraz po nim `applyMaterialSync`; komentarz w kodzie mówi to wprost: „Reset wipes the tab —
immediately re-sync so the rows come back". `stampAllTabs(…, 'setup')`
(`src/lib/google/app-managed-tabs.ts:29`) to więc **destrukcyjna przebudowa**: zakładka wraca
wypełniona z tej bazy, która kliknęła.

Arkusz inwestycji 42 przeszedł taki reset **z produkcji**: jego zakładka `wydatki` niesie id 4604
(139,80 zł, 2026-08-20 14:55 UTC), którego nie ma ani lokalnie (max 4537), ani na preview (max 4602).
To zamyka pytanie „dlaczego 4536/4537 nie widać" — i **unieważnia „w arkuszu nieobecny" jako dowód**
dla lokalnych 4480, 4482, 4508, 4536, 4537 i dla każdego wcześniejszego epizodu na dowolnym z 56
arkuszy. Bieżący stan arkuszy pokazuje, co przetrwało ostatni reset, nie co kiedykolwiek wyszło.

#### Destrukcja: nie wystąpiła, ale wektor jest cięższy niż upsert

W obu bazach nieprodukcyjnych istnieje dokładnie **jedna** kolizja id-na-tym-samym-arkuszu — id 981
(`LABOR_COST`, inw. 31): nieprodukcyjnie 235 911 zł, produkcyjnie 471 819 zł. **Arkusz do dziś
pokazuje wartość produkcyjną**, więc nie nadpisano. Żaden produkcyjny wiersz nie zniknął z powodu
usunięcia.

Właściwą skalą zagrożenia nie jest jednak kolizja id przy pojedynczym zapisie, tylko **reset+sync
uruchomiony z bazy nieprodukcyjnej: wyciera całą zakładkę produkcyjnego arkusza klienta
i odbudowuje ją ze stanu tamtej bazy**, czyli kasuje każdy produkcyjny wiersz nowszy od zrzutu.
Ta sama własność w łagodniejszej formie dotyczy samego reconcile (`applyMaterialSync`), który kasuje
z zakładki wszystko, co do tej inwestycji należy, a czego działająca baza nie zna.

Dowodów, że to się zdarzyło, nie ma: arkusz 31 trzyma komplet produkcyjnych wierszy obok 16 śmieci,
więc nigdy nie był resetowany z żadnej strony, a żadnego produkcyjnego wiersza z lipca/sierpnia nie
brakuje poza pięcioma nieudanymi syncami.

Pięciu produkcyjnych wierszy brakuje w arkuszach (4277 na inw. 127; 4562–4565 na inw. 86) —
wszystkie nadal istnieją w bazach nieprodukcyjnych, więc nie zostały skasowane. To **nieudany sync**
(błąd połknięty przez `catch`), osobna sprawa od wycieku.

#### Metoda i dowody

Lista naprawcza w formie roboczej (numery wierszy, gid-y zakładek, checkboxy):
**`cleanup-checklist.md`** w tym katalogu.

Liczby z §5 powstały tak — bez ani jednego zapytania do produkcyjnej bazy i bez ani jednego zapisu
do Google:

1. `dumps/dump-latest.sql` (produkcja do id 4672, 2026-08-26 15:51) przywrócony do **bazy roboczej
   `leak_audit`** na lokalnym dockerze (5433). Zrzut to plik lokalny, więc migawka produkcji powstaje
   bez łączenia się z Neonem.
2. Do tej samej bazy wgrane tabele porównawcze: `local_tx` i `prev_tx` (transakcje z localhosta
   i preview) oraz `prev_koszt` (kosztorysy z preview).
3. Wszystkie **56 arkuszy** odczytane read-only przez `scripts/inspect-sheet.mjs` (pacing ~8 s/arkusz
   — przy 0,7 s API zwraca 429, limit to 60 odczytów/min/użytkownika). 1522 wiersze z trzech zakładek
   zarządzanych przez aplikację wyekstrahowane do tabeli `sheet_rows` (`inv, title, tab, rownum,
tx_id, cells`).
4. Obcy wiersz = złączenie `sheet_rows` z produkcyjnymi `transactions` po `tx_id` i predykat:
   id nie istnieje na produkcji **lub** należy do innej inwestycji **lub** jest anulowany **lub** typ
   nie pasuje do zakładki, na której leży. Z wyniku odjęte wiersze `CORRECTION` przy własnej
   inwestycji (legalna pozostałość, §5 „NIE usuwać").

**Baza `leak_audit` nadal stoi** na localhost:5433 i jest jedynym trwałym nośnikiem dowodów — zrzuty
arkuszy leżały w katalogu roboczym sesji, który bywa czyszczony. Nie kasować, dopóki sprzątanie nie
zostanie odhaczone i zweryfikowane.

Czego **nie** dotknięto w trakcie audytu: produkcyjnej bazy (ani jednego `SELECT`), żadnego zapisu do
Google, uruchomienia aplikacji (`pnpm dev` / `build` / `test:e2e` — każde mogłoby samo wywołać zapis),
plików źródłowych repo.

### 6. Skrypty bez bramki

Mają bramkę: `blob-restore.mjs` (allow-lista + `--allow-prod`), `blob-refresh-preview.sh`,
`backfill-heic-media.ts` (tożsamość baza↔store), `seed-e2e-user.ts:16-30` (host musi być
`localhost`), `seed-deposit-planes.ts:72-79` (`current_database()` = `wykonczymy-test`).

Bez żadnej bramki:

- `src/scripts/seed-kosztorys-reconciliation.ts` — tworzy inwestycje **i transakcje** przez Payload
  Local API → `syncSheetAfterChange` → **zapis do arkusza**
- `src/scripts/seed-kosztorys-bands.ts` — jak wyżej
- `src/scripts/seed-kosztorys.ts:13` / `perf-seed-kosztorys.ts:12` — kasują kosztorys inwestycji
  `INV` w tym, co wskazuje `DB_POSTGRES_URL`
- `src/scripts/recolor-kosztorys-sections.ts` — `DRY=1` jest opt-in, nie domyślne
- `src/scripts/fix-kosztorys-descriptions.ts` — `INV=all APPLY=1` przepisuje opisy we wszystkich
  inwestycjach i szablonach
- `src/scripts/trigger-test-lead.ts` — prawdziwy mail z produkcyjnego SMTP

Autor `seed-deposit-planes.ts:24-29` **rozpoznał ten problem** i świadomie obszedł Payloada surowym
SQL-em („a fixture seed has no business touching a live sheet") — precedens istnieje w repo, tylko
nie objął rodzeństwa.

### 7. Poświadczenia współdzielone z produkcją

Bez rozróżnienia środowiska: `GOOGLE_SERVICE_ACCOUNT_JSON` (**poświadczenie z incydentu**, scope
`spreadsheets`), `OPENROUTER_API_KEY`, `META_*` (6 zmiennych, produkcyjna aplikacja i strona FB),
`EMAIL_*` + `LEADS_REPLY_FROM`, `CRON_SECRET`, `WPFORMS_WEBHOOK_SECRET`, `FTP*`, `DB_POSTGRES_URL_PROD`.

`PAYLOAD_SECRET` — **do sprawdzenia poza kodem**: jeśli ta sama wartość co na produkcji, ciasteczka
JWT są wzajemnie ważne między środowiskami. Z kodu nie da się rozstrzygnąć.

Rozróżnione poprawnie: `BLOB_READ_WRITE_TOKEN` (preview lokalnie, prod na produkcji — pilnowane
przez strażnika) i `DB_POSTGRES_URL*`. `BLOB_READ_WRITE_TOKEN_PROD` jest **wzorcem do powielenia**:
zaparkowany, nieczytany przez żaden skrypt, wymaga jawnego eksportu w miejscu wywołania.

## Wnioski architektoniczne

**Bramka musi wiązać płaszczyznę bazy z płaszczyzną zasobu, nie samo `VERCEL_ENV`.** Wektorem
incydentu jest to, że `spreadsheetId` przychodzi **z bazy**, a każda baza nieprodukcyjna jest
zrzutem produkcji. Ta sama własność dotyczy Blob `del()` (`media.filename` z bazy) — i tam
najmocniejszy strażnik w repo (`backfill-heic-media.ts:153-175`) sprawdza właśnie tożsamość
baza↔zasób. Sam `VERCEL_ENV` wystarczy dla „nie pisz spoza produkcji", ale nie wykryje
produkcyjnego `DB_POSTGRES_URL` podstawionego na preview.

**Szew dla arkuszy to fabryka klienta zapisowego, nie warstwa wyżej.** Tokeny ze scope'em
`https://www.googleapis.com/auth/spreadsheets` powstają dziś w **dwóch** miejscach:
`getClient()` (`sheets.ts:42-45`) i inline w `verifySheetAccess` (`sheet-access.ts:32-33`).
Wszystkie 7 zapisów jest poniżej nich. Jedna funkcja `getWritableSheetsClient()`, odmawiająca przed
zwróceniem klienta, jest **nie do ominięcia**, bo w repo nie istnieje inny sposób zdobycia tokenu
z prawem zapisu.

- **Nie warstwę wyżej** (hooki / server actions): punktów wejścia jest kilkanaście i część jest
  nieenumerowalna — `/admin` i `api/[...slug]/route.ts` mutują `transactions` bez przechodzenia
  przez żadną akcję. Ta warstwa już raz próbowała: `skipSheetSync` pokrywa jedną ścieżkę z ~ośmiu.
  Każdy nowy typ dopisany do `SHEET_TRANSFER_TAB_TYPES` (`constants/transfers.ts:309`) automatycznie
  ominąłby strażnika postawionego wyżej.
- **Nie warstwę niżej** (`createServiceAccountJWT`, `google/auth.ts:17`): bije również token
  `readonly` dla importu kosztorysu i dla skryptów — strażnik tam zamknąłby odczyty.
- **Nie trzy asercje** w `applyTabRowsBatch` + `setupTab` + `verifySheetAccess`: trzy miejsca to nie
  szew, tylko konwencja; nowa funkcja pisząca w `sheets.ts` jej nie odziedziczy.

Przy okazji cztery odczyty (`sheets.ts:94,161,303`, `sheet-access.ts:35`) przechodzą na
`getReadonlySheetsClient()`, przez co czytanie zostaje otwarte wszędzie, a `verifySheetAccess`
degraduje się lokalnie do sondy odczytu.

**Bramka per-integracja nie skaluje się — problem jest systemowy.** Pięć niezależnych klas efektów
wychodzących (arkusze, poczta, OpenRouter, Meta, crony) dzieli jedną przyczynę: produkcyjne
poświadczenie w `.env` bez rozróżnienia środowiska. Blob rozwiązał to dwiema zmiennymi (`_PROD`
zaparkowany, wymaga jawnego eksportu). Ten sam kształt aplikuje się jeden do jednego do `EMAIL_*`
i `OPENROUTER_API_KEY`.

**Dla poczty naturalny szew to transport, nie warunek przy wywołaniu.** Osiem wywołań
`payload.sendEmail()` — dziewiąte się nie doda. Bramka w adapterze, która poza produkcją albo loguje
zamiast wysyłać, albo przekierowuje całe `to` na jeden adres deweloperski.

## Kontekst historyczny

- `context/foundation/lessons.md:179-183` — **ten sam klasa incydentu już wystąpiła**: 2026-07-09
  `callback_url` webhooka Meta został nadpisany tunelem **ngrok** dewelopera, więc Meta dostarczała
  żywe leady na laptop, a page-level `subscribed_apps` to maskował. Lekcja kończy się wprost:
  „treat dev tooling (ngrok) as able to clobber prod webhook config". Granica środowisk w tym repo
  przecinała się już wcześniej — i wtedy też ujawniła się dopiero przez ręczne oglądanie danych.
- `context/foundation/lessons.md:266` — restore niesie metadane faktur, ale nie bajty; ta sama
  własność (baza nieprodukcyjna niesie produkcyjne identyfikatory zasobów zewnętrznych) jest
  przyczyną obecnego incydentu, tylko wtedy przejawiła się jako brak, nie jako zapis.
- `context/foundation/manual-checks.md:3519` — digest floty **już wyszedł** do prawdziwych ludzi
  z nieprodukcyjnego przebiegu.
- `context/changes/staging-to-main-gate/ledger.md:173` — brama QA zdiagnozowała ryzyko cronu
  leadowego i wyłączyła te checki ręcznie; w kodzie nic tego nie blokuje.

## Pytania otwarte

1. ~~Dlaczego lokalne 4536/4537 nie dotarły na arkusz 42?~~ **ZAMKNIĘTE** — dotarły albo nie,
   ale nie da się tego stwierdzić z arkusza: zakładka `wydatki` została zresetowana z produkcji
   2026-08-20 (id 4604 nie istnieje w żadnej bazie nieprodukcyjnej). Patrz „Reset kasuje dowody".
2. **`PAYLOAD_SECRET`** — porównać z wartością na Vercelu. Jeśli identyczna, ciasteczka JWT są
   wzajemnie ważne między środowiskami.
3. **Czy ktoś kiedykolwiek kliknął „Synchronizuj materiały" na preview albo lokalnie?** To jedyna
   ścieżka kasująca hurtowo. Dowodów brak, ale dowód jest pośredni (stan arkuszy dziś).
4. **Pięć produkcyjnych wierszy bez odbicia w arkuszach** (4277, 4562–4565) — nieudany sync, nie
   kasowanie. Do zdiagnozowania po logach produkcyjnych, osobno od wycieku.
5. **Historia wersji arkuszy** (Plik → Historia wersji) — awansowała z „przydatna" na **jedyne
   źródło prawdziwego zasięgu**. Bieżący stan arkuszy pokazuje tylko to, co przetrwało ostatni
   reset, więc licznik 36 jest dolną granicą. Historia wersji poda datę i konto serwisowe przy
   każdym wpisie, także tym już wyczyszczonym.
6. **Czy zerować `google_sheet_id` w bazach nieprodukcyjnych po restore?** Test i preview trzymają
   komplet 56 produkcyjnych identyfikatorów; dopóki tak jest, każdy `db:import:test` ładuje pistolet
   z powrotem. Decyzja produktowa, nie ustalenie faktu.

## Poza zakresem tej zmiany (do osobnego wpisu)

- **Podpięcie arkusza nie robi backfillu** — `syncSingleTransferToSheet` odpala się wyłącznie na
  mutacji transakcji, więc arkusz podpięty do istniejącej inwestycji pokazuje tylko to, co powstało
  po podpięciu. Zweryfikowane na sześciu arkuszach: wszystkie podpięte 2026-06-05/06-09, a przed tą
  datą powstało 31 (inw. 6), 22 (19), 18 (46), 22 (49), 12 (72) i 4 (77) transakcji, których w nich
  nie ma. Wypełnia je dopiero „Zresetuj wydatki inwestycyjne", więc zamierzony przepływ to zapewne
  „podepnij, potem zresetuj" i nikt tego kroku nie zrobił — to **osobna sprawa od wycieku**, choć
  z tego samego arkusza. Nie mylić jednego z drugim przy sprzątaniu.

- `e2e/helpers.ts:46` — `EXPENSE_INVESTMENT = 'Plac Hellera 3'` nie istnieje („Plac Hallera 6").
  Dwa spece (`transfer-create`, `transfer-cancel`) są martwe. **Nie naprawiać przed strażnikiem** —
  naprawa otwiera kanał na żywy arkusz.
- `KOSZTORYS_TEMPLATE_SHEET_ID` i `KOSZTORYS_DRIVE_FOLDER_ID` — wymagane w `env/schema.ts:88-89`,
  w runtime nieczytane.
- `package.json` deklaruje `seed:transfers` i `seed:ziutek`; pliki nie istnieją.
