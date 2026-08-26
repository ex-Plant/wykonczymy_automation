# Lista kontrolna: sprzątanie po wycieku zapisów do arkuszy klientów

Stan na **2026-08-26**. Ustalenia i dowody: `research.md` §5. Ten plik jest listą roboczą —
odhaczaj w miejscu.

**Zasada nadrzędna: najpierw bramka, potem arkusze.** Dopóki ścieżka zapisu do Sheets nie ma bramki
środowiskowej, pierwszy wydatek dodany na localhoście na
inwestycji z kosztorysem wsypie do arkusza nowy wiersz i posprzątane trzeba będzie sprzątać drugi
raz.

**Numery wierszy są z odczytu 2026-08-26 i przesuwają się po każdym usunięciu.** Identyfikuj wiersz
po **kolumnie A (id)**, nigdy po numerze wiersza. Przy ręcznym kasowaniu idź **od dołu do góry** —
lista poniżej jest już w tej kolejności.

---

## 0. Blokery — odhacz przed dotknięciem arkuszy

- [ ] **Bramka środowiskowa na fabryce klienta zapisowego** — jeden szew, nie lista wejść: - [ ] `getClient()` — `src/lib/google/sheets.ts:42` - [ ] klient inline w `verifySheetAccess` — `src/lib/google/sheet-access.ts:32`
      To jedyne dwa miejsca w repo, gdzie powstaje token ze scope'em `spreadsheets`; wszystkie
      **7 zapisów** leży poniżej nich, więc bramki nie da się ominąć.
      **Dlaczego nie na wejściach** (`syncSheetAfterChange` / `syncSheetAfterDelete` /
      `applyMaterialSync` / `setupSheetAction`): `/admin` i `api/[...slug]/route.ts` mutują
      `transactions` bez przechodzenia przez którekolwiek z nich, a nowy typ dopisany do
      `SHEET_TRANSFER_TAB_TYPES` (`src/lib/constants/transfers.ts:309`) automatycznie ominąłby taką
      bramkę. Cztery asercje to konwencja, jedna fabryka to szew. Ta warstwa już raz próbowała —
      `skipSheetSync` pokrywa jedną ścieżkę z ~ośmiu, a `syncSheetAfterDelete` nie ma nawet jej.
      Wzorzec do powielenia: `blobTokenRefusal` w `src/lib/env/schema.ts:36` (odrzuca token Blob przy
      niezgodności `VERCEL_ENV` w obie strony) + bliźniacza kontrola w `src/payload.config.ts:43`.
      **Pułapka:** hook żyje w grafie Payloada, więc `serverEnv` z `server-only` tam nie zadziała —
      predykat musi wyjść do `env/schema.ts`, dokładnie jak `blobTokenRefusal`.
      Przy okazji: cztery odczyty (`sheets.ts:94,161,303`, `sheet-access.ts:35`) przechodzą na
      `getReadonlySheetsClient()`, żeby czytanie zostało otwarte wszędzie.
- [ ] **NIE naprawiać** `e2e/helpers.ts:46` (`'Plac Hellera 3'` → „Plac Hallera 6") przed bramką —
      naprawa literówki otwiera kanał na żywy arkusz `1EJu2jGPWD6Qg5qMzgsYCkBU7bdznhvr5Zch3uBAXhpc`,
      z tworzeniem **i usuwaniem** wierszy.
- [ ] **Uprzedzić właściciela**, że reset stawia zakładkę od zera: cokolwiek wpisał ręcznie
      w kolumnach `notatka` / `komentarz` tych trzech zakładek — przepadnie. Numery faktur w kolumnie G
      wrócą, bo trzyma je aplikacja.

---

## 1. Arkusze do naprawy — 4 arkusze, 4 wiersze

_Posprzątane arkusze są usuwane z tej listy. Pełny wykaz 36 wierszy sprzed naprawy: `research.md` §5._

**Reconcile („Synchronizuj") tego nie posprząta.** `buildSyncPlan` usuwa wyłącznie te id, które
w działającej bazie należą **do tej inwestycji** — żaden z 36 obcych wierszy do swojej inwestycji na
produkcji nie należy (4507 to na produkcji inw. 131, 3773 to inw. 97). Reconcile potraktuje je jako
ręczne wiersze właściciela i zostawi.

Dwie drogi na arkusz:

- **A (zalecana):** „Zresetuj wydatki inwestycyjne" + sync, **uruchomione z produkcji**. Czyści
  wszystkie trzy zakładki naraz i odbudowuje je ze stanu produkcyjnego.
- **B:** ręczne skasowanie wierszy z listy, od dołu do góry, dopasowując po kolumnie A.

Adres zakładki: `https://docs.google.com/spreadsheets/d/<sheet_id>/edit#gid=<gid>`

**Cztery ostatnie wiersze są wyciekiem, nie brakiem synchronizacji** — sprawdzone po id w dumpie
produkcyjnym 2026-08-26. Każdy z nich niesie w arkuszu inną kwotę i inny opis niż ten sam id na
produkcji, więc pochodzi z bazy nieprodukcyjnej:

| arkusz  | id   | na produkcji                                                       | w arkuszu                                  |
| ------- | ---- | ------------------------------------------------------------------ | ------------------------------------------ |
| inw. 19 | 3013 | `OTHER` „shell" 119,98 zł, **bez inwestycji**                      | Wypłata „rozliczenie siennickiej" 2 650 zł |
| inw. 46 | 3007 | `CANCELLATION` 4 650 zł, **bez inwestycji**                        | Wypłata 2 000 zł · Kamil Kamiński          |
| inw. 72 | 3002 | `PAYOUT` „wylewka" 1 336 zł, **inw. 60**                           | Wypłata „premia" 200 zł · Roman            |
| inw. 77 | 3784 | `INVESTMENT_EXPENSE` „Castorama 30.06.2026" 132,84 zł, **inw. 65** | „Leroy Merlin 24.04.2026" 57,23 zł         |

Brak **pozostałych** transakcji w tych arkuszach to faktycznie kwestia braku backfillu przy
podpięciu — ale te cztery wiersze nie są tym brakiem, tylko jego przeciwieństwem. Podbijają SUMIF-y
swojej zakładki. Wszystkie cztery inwestycje są `completed`, a żaden z tych arkuszy nie łączy
zakładek aplikacji z kosztorysem, więc klient tego nie zobaczy — decyzja o zostawieniu jest
uzasadniona, ale świadomie zostawia śmieci, a nie porządek.

### [ ] inw. 19 — „Siennicka 50/152" (plik: „Sławomir Jagiełło siennicka 50/152 - MIKOLA")

`16FQccu4nNGeRLe9GkEvOnyvy1BusebPso5qVxtWaosg` · 1 wiersz

- [ ] `transfery` (gid=885602602)

| wiersz | id (kol. A) | zawartość                                                                       |
| ------ | ----------- | ------------------------------------------------------------------------------- |
| r09    | 3013        | 2026-04-18 · Wypłata · „rozliczenie siennickiej" · 2 650,00 zł · Mykola (młody) |

### [ ] inw. 46 — „Dabrowskiego 86" (plik: „Patryk Pudlowski Dąbrowskiego")

`1gNIGqPljbHQtcUjel0hsLso_xfuu1O8Ca8T2W7H0Sfw` · 1 wiersz

- [ ] `transfery` (gid=1348580858)

| wiersz | id (kol. A) | zawartość                                           |
| ------ | ----------- | --------------------------------------------------- |
| r03    | 3007        | 2026-06-12 · Wypłata · 2 000,00 zł · Kamil Kamiński |

### [ ] inw. 72 — „Borzęcin mały, ul. Lasku Brzozowego 4" (plik: „Lasku Brzozowego 4 - Roman")

`1uRQBQRJeFL62LhF1bGNVw5EAwIQB-_9KvN7LdJu2Cqk` · 1 wiersz

- [ ] `transfery` (gid=1101626098)

| wiersz | id (kol. A) | zawartość                                           |
| ------ | ----------- | --------------------------------------------------- |
| r03    | 3002        | 2026-06-12 · Wypłata · „premia" · 200,00 zł · Roman |

### [ ] inw. 77 — „Aleja Polski Walczacej 28/43 Michal Sieniawski"

`1bSrOLY-WXMIW4Ek6WuFOV8e7qsPWXuP7Cfpttp69B6U` · 1 wiersz

- [ ] `wydatki inwestycyjne` (gid=677215168)

| wiersz | id (kol. A) | zawartość                                                                               |
| ------ | ----------- | --------------------------------------------------------------------------------------- |
| r10    | 3784        | 2026-07-13 · Pozostałe koszty · „Leroy Merlin 24.04.2026" · 57,23 zł · nota 807750/1072 |

## 2. Weryfikacja po naprawie

Po każdym resecie odczytaj naprawioną zakładkę i sprawdź, że żaden z jej id nie wrócił:

```bash
SHEET_ID=<id> TABS="transfery (tylko do odczytu)" MAX_ROWS=12 \
  node --env-file=./.env scripts/inspect-sheet.mjs
```

- [ ] wszystkie cztery arkusze odczytane po naprawie, żadne obce id nie wróciło

---

## 3. Do sprawdzenia poza arkuszami

- [ ] **Historia wersji arkuszy** (Plik → Historia wersji) — **jedyne źródło prawdziwego zasięgu**.
      Bieżący stan pokazuje tylko to, co przetrwało ostatni reset, więc licznik 36 jest dolną granicą
      liczby epizodów. Historia poda datę i konto serwisowe przy każdym wpisie, także wyczyszczonym.
- [ ] **`PAYLOAD_SECRET`** — porównać wartość lokalną z tą na Vercelu. Jeśli identyczna, ciasteczka
      JWT są wzajemnie ważne między środowiskami.
- [ ] **Czy zerować `google_sheet_id` w bazach nieprodukcyjnych po restore?** Test (5435) i preview
      trzymają komplet **56/56** produkcyjnych identyfikatorów; dopóki tak jest, każdy
      `pnpm db:import:test` ładuje pistolet z powrotem. Decyzja produktowa, nie ustalenie faktu.
- [ ] **Pięć produkcyjnych wierszy bez odbicia w arkuszach** — 4277 (inw. 127) oraz 4562–4565
      (inw. 86, bulk z 2026-08-18 13:45). Wszystkie nadal istnieją w bazach nieprodukcyjnych, więc
      **nie zostały skasowane** — to nieudany sync z błędem połkniętym przez `catch`. Osobna sprawa
      od wycieku, do zdiagnozowania po logach produkcyjnych.
- [ ] **Czy ktoś kiedykolwiek kliknął „Synchronizuj materiały" albo „Zresetuj" na preview lub
      localhoście?** To jedyne ścieżki kasujące hurtowo. Dowodów brak, ale dowód jest wyłącznie
      pośredni (arkusz 31 trzyma komplet produkcyjnych wierszy obok 16 śmieci, więc nigdy nie był
      resetowany z żadnej strony).
- [ ] **`e2e/helpers.ts:46`** — po wdrożeniu bramki naprawić `'Plac Hellera 3'` → `'Plac Hallera 6'`.
      Dwa spece (`transfer-create`, `transfer-cancel`) są dziś martwe i nic nie sprawdzają.
