# Cutover rehearsal — regression log (staging on `cutover_rehearsal`)

Zapis próby przed scaleniem `staging` → `main`, w dwóch fazach. **Faza 1: czy to, co już
działa, nadal działa** (26 migracji na odbitce produkcji). **Faza 2: czy to, co przychodzi
nowe, robi to, co obiecuje** — tej części `main` nie ma z czym porównać, bo tych ekranów na
produkcji po prostu nie ma.

**Metoda — i to ona decyduje o wadze wyników:** żadna figura nie została uznana za poprawną
dlatego, że dwa ekrany pokazują to samo. Każda była odtwarzana od zera surowym SQL-em na bazie
po migracjach, a dopiero potem zestawiana z tym, co pokazuje aplikacja. Tam, gdzie liczyły się
bajty, a nie liczby (faktury, konwersja HEIC, ZIP), sprawdzany był plik, nie komunikat.

> Ten plik jest **destylatem** (25.08.2026). Pełny przebieg — każdy ekran, każde zapytanie,
> każdy pomiar, 2224 linie — zostaje w historii gita: `git log --follow --` na tej ścieżce,
> commit poprzedzający „docs(cutover): destylacja logu próby".

## Setup under test

|              |                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| URL          | `wykonczymy-git-staging-wykonczymys-projects.vercel.app`                                                          |
| deployment   | `dpl_As6aNg9gUxxtT79vu5YMY2GUWz9M` · sha `1e53af17` · fresh build (not a redeploy clone)                          |
| DB           | Neon branch `cutover_rehearsal`, `ep-wild-resonance-agwnbpae-pooler` — zero-copy branch of prod, taken 2026-08-25 |
| migrations   | 76 applied (50 pre-existing + the 26 under test); `index.ts` ↔ DB diff is empty both ways                         |
| account      | `test@test.pl` (Manager/Admin)                                                                                    |
| verified 1:1 | 3754 transactions · 115 investments · 1326 media · newest row `#4647 · 24.08.2026`                                |

Stopka aplikacji pokazywała `PREVIEW · neondb@ep-wild-resonance-agwnbpae-pooler`, więc każda
obserwacja poniżej jest przeciw odbitce produkcji, a nie przeciw staremu stagingowi.

**Sprawdzone ponownie 25.08:** produkcja nie ruszyła się od odbicia gałęzi ani o wiersz — te same
3754 transakcje, ten sam max id 4647, ten sam najnowszy wiersz (`2026-08-24 12:56:39`), 115
inwestycji, 1326 mediów, 50 migracji. Baseline `1:1` z tabeli wyżej nadal obowiązuje co do sztuki.

## Werdykt

**Nic nie blokuje scalenia.** Wszystkie 14 znalezionych usterek jest naprawionych na gałęzi
`heic-upload-gap` — lista niżej. Blokadą była jedna: „Usuń całą fakturę" zostawiało pliki
w magazynie bez wskazującego rekordu.

**Płaszczyzna v1 przeżyła 26 migracji bez rozjazdu** — transfery, kasy, salda, bilans
inwestora, marża, faktury. Żadna rekonstrukcja nie rozjechała się ani o grosz: ani saldo kasy
pracowniczej, ani największe saldo w systemie (715 347,78 zł), ani marża z rabatem, ani marża
ze stratą, ani sumy filtrów i zakresów dat. Zapis też jest udowodniony, nie założony: pełna
pętla „załóż → odczytaj → edytuj → anuluj" przez normalne UI, ze śladem audytowym w bazie
i arytmetyczną neutralnością anulowania na ścieżce jedno- i dwustronnej.

### Co jest w porządku, wbrew pozorom

- **Rabat jako przelew nie rusza v2** — i tak ma być, bo rabat należy do kosztorysu. Co
  ważniejsze, v2 tego nie zamiata: pokazuje wiersz „Rabat 0,00" z czerwonym trójkątem i pełnym
  rozliczeniem różnicy. Rozjazd między planami jest **głośny**, a nie wyzerowany.
- **Rekoncyliacja łapie realne rzeczy** — wyszła różnica 0,25 zł między kosztorysem a przelewem
  robocizny na inwestycji 31, której nikt nie szukał.
- **Bramka 4 MB nie przepuszcza bajtów na serwer**, a HEIC z telefonu jest konwertowany
  w przeglądarce — obie rzeczy sprawdzone plikiem, nie komunikatem.
- **„Wyczyść kosztorys" dotrzymuje wszystkich czterech obietnic** ze swojego okna, a
  przywrócenie odtwarza treść co do pola, w 336 pracach i 13 sekcjach.

### Czego ta próba NIE dowodzi

- **Wnętrze `/admin`** (panel Payloada) — świadomie poza zakresem, decyzja właściciela. To
  jedyna powierzchnia czytająca przez ORM Payloada i jego wewnętrzne tabele, a więc jedyna,
  która potrafiłaby się wywalić na migracji niewidocznej dla reszty aplikacji. Sprawdzony
  wyłącznie jako HTTP 200. **To jest znana, nazwana luka tej próby**, nie przeoczenie.
- **Synchronizacja z arkuszem Google w drugą stronę** — przycisku „synchronizacja" nie
  dotknąłem ani razu, bo pisze do żywego arkusza właściciela.
- **Zachowanie pod obciążeniem i przy współbieżności** — cała próba to jeden użytkownik.
  Blokada inwestycji (`lock-investment`) nie została wywołana ani razu.
- **Prawdziwe faktury** — wszystkie pliki użyte w próbie były sfabrykowane.
- **Blob** — staging czyta store preview, produkcja swój; ta wersja nie rusza logiki blobów,
  więc to nie jest ryzyko cutoveru, ale też nie jest przez tę próbę potwierdzone.
- **Wnętrze zgłoszenia** — lista 170 leadów zgadza się z bazą, ale pojedynczego nie otwierałem.

## Problemy — jedna lista, ze statusem

_Stan na 25.08.2026, gałąź `heic-upload-gap`. Wszystkie domknięte._

### Kasują dane

- [x] · 🔴 · **Usuwanie faktury wielostronicowej zostawiało pliki w magazynie bez rekordu.**
      Przyczyna odtworzona: sprzątanie kasowało wszystkie strony **równolegle**, a Neon przy
      równoległych zapisach Payloada utrzymuje jeden z nich i **melduje sukces dla wszystkich**.
      Naprawa: kasowanie strona po stronie. Na Neonie równolegle 5 stron → 3 sieroty,
      sekwencyjnie 12 na 12 czysto (`50c38119`, ta sama usterka we Flocie: `e164aecb`)
- [x] · 🔴 · **Zmiana typu wydatku kasowała wszystko: kwotę, netto, opis, notatkę i podpięty
      skan faktury.** Czyszczenie zawężone do pól nagłówka (kasa, pracownik, inwestycja,
      „rozliczone") — pozycje, ich pliki i znaczniki skanu zostają. Pola obce dla nowego typu
      i tak odpadają przy zapisie (`a69513bb`)
- [x] · 🔴 · **Escape w komórce siatki zapisywał zamiast anulować** (2× odtworzone: `7` i `8`
      wylądowały w Przedmiarze). Anulowanie nie przechodzi już przez zapis: `onEscape`
      przywraca wiersz sprzed edycji i oddaje komórkę siatce bez schodzenia wiersz niżej
      (`d109ddcc`, `fbb6a31f`, domknięcie `a19e0ee6`; zmiana zarchiwizowana w `05cade79`)
- [x] · 🔴 · **„Rabat wart.": 12,5 zapisywało się jako 125** — input zatwierdzał każdy klawisz,
      więc w tę komórkę nie dało się wpisać żadnego ułamka. Przecinek zostaje na ekranie,
      rozstrzygnięcie dopiero przy wyjściu z komórki (`d324351c`)

### Pokazują nieprawdę

- [x] · 🟡 · **Nagłówek sekcji podawał INWESTOROWI liczbę pozycji sprzed filtra** — „WC
      (52 poz.)" nad czterema wierszami. Ten sam filtr usuwał całą pustą sekcję, ale nie
      korygował licznika w przerzedzonych. Widział to klient, nie tylko właściciel. Naprawa:
      podsumowania sekcji liczą się z **dokumentu, który klient dostaje**, a nie z pełnego
      zbioru. Żadna kwota się nie rusza — ukrywany wiersz jest pusty na obu osiach (`2c3b0f2e`)
- [x] · 🟡 · **(czeka na migrację prod)** **Stawka „bez narzędzi" 0,55 zamiast 0,5525 — na
      produkcji we WSZYSTKICH 115 inwestycjach.** Zastane (leży w bazie od migracji z 8 lipca,
      która utworzyła kolumnę z `DEFAULT 0.55`), dziś nieosiągalne — bo na produkcji nie ma ani
      jednego kosztorysu. Odpaliłoby przy pierwszym złożonym z szablonu. Naprawa: migracja
      `20260825_0_fix_own_tools_coeff_rounding` poprawia i wartości, i domyślną kolumny, żeby
      baza przestała przeczyć `DEFAULT_COEFFS`. **Migrację na produkcji odpala człowiek**
      (`87b2f62a`)
- [x] · 🟡 · **„Tryb anulowań" na ekranie kasy nigdy nic nie pokazywał.** Wszystkie anulowania
      w bazie mają pustą kasę, pracownika i inwestycję, więc zawężenie do kasy wycinało je co do
      jednego. Zastane, strukturalne — nie migracyjne. Naprawa: zawężenie celuje w **transakcję
      anulowaną**, a nie w wiersz anulowania. Zmierzone: kasa 7 `0 → 74`, inwestycja 31 `0 → 13`,
      pracownik 25 `0 → 8`; widok bez zawężenia bez zmian, 298 (`e1c204d6`)
- [x] · 🟡 · **Niedopasowanie hydracji na kolumnie „Czas dodania" (React #418)** — serwer
      renderował UTC, przeglądarka Europe/Warsaw, więc każdy wiersz rozjeżdżał się o dwie
      godziny. Zastane: `main` ma ten plik bajt w bajt taki sam. Naprawa: obie funkcje
      formatujące datę mają przypiętą strefę `Europe/Warsaw`. Przy okazji wyszła druga, cichsza
      wersja tego samego: sama data (`YYYY-MM-DD`) czytana na zachód od Greenwich renderowała
      się **o dzień wcześniej** (`1a9af809`, `ed43cd50`)
- [x] · 🟡 · **Ta sama kwota różniła się o grosz w dwóch miejscach zakładki „Podwykonawcy"** —
      „Razem / Pozostało do wypłaty" pod tabelą pracowników czytało −131 494,73, a blok obok
      −131 494,72. Naprawa: „Razem" nadal sumuje kolumny (rozjazd w przypisaniu ma być widoczny),
      ale sumuje je na pełnej precyzji i zaokrągla **raz** — dotąd zbierało po pół grosza na
      każdym pracowniku, bo każdy wiersz jest zaokrąglany osobno (i musi być: to on decyduje
      o czerwonym „nadpłacone") (`1601b075`)

### Blokują albo mylą, ale nic nie psują

- [x] · 🔵 · **Rozwinięty panel podsumowania przykrywał jedyne wejście do importu na pustym
      kosztorysie.** Panel jest rozwinięty domyślnie, więc to pierwszy ekran, jaki właściciel
      zobaczy. Naprawa: nad pustym kosztorysem panel w ogóle się nie montuje (nie ma czego
      podsumować — same zera), a przycisk „Pokaż podsumowanie" jest wtedy nieaktywny
      z wyjaśnieniem; zapamiętane ustawienie wraca w chwili, w której pojawią się wiersze.
      **Druga połowa wpisu — przykrywanie siatki — odrzucona:** pełnoekranowy panel to zamierzony
      projekt (`96746dab`, „full-height panel"), więc otwarty zasłania **całą** siatkę i widać
      przycisk „Schowaj podsumowanie" obok. Dowód z próby („klik w wiersz nie dochodzi") pochodzi
      z kliknięcia po węźle drzewa dostępności, wizualnie zakrytym (`556d457f`)
- [x] · 🔵 · **Bramka „tylko właściciel" była wyłącznie po stronie serwera** — manager widział
      obie pozycje w menu jako klikalne i szedł przez trzy ekrany, żeby usłyszeć „nie". Zapis
      naprawdę nie przechodził (sprawdzone w bazie), więc to nie dziura, tylko droga donikąd.
      Naprawa: obie pozycje są dla nie-właściciela nieaktywne, a ich opis to **to samo zdanie**,
      które wcześniej padało dopiero przy „Zapisz". Bramka w interfejsie pyta `isAdminOrOwnerRole`
      — dokładnie tę funkcję, którą woła `ownerOnlyAction` — więc drzwi i zamek nie mogą się
      rozjechać (`66ec3869`)
- [x] · 🔵 · **Przycisk „Admin" w stopce na preview prowadził na PRODUKCJĘ.** Użytkownikowi nie
      szkodził (na produkcji link był poprawny), ale przenosił testującego na żywe dane jednym
      kliknięciem. Naprawa: link jest względny (`/admin`), tak jak jego bliźniak w bocznej
      nawigacji — leży na tym samym origin, więc z definicji nie wyjdzie poza swoje środowisko
      (`0e622c0f`)
- [x] · 🔵 · **dropped** · picker kasy podaje MANAGEROWI kasę główną, której `/kasy` mu nie
      listuje, a `/kasa/5` odmawia. Zastane, sprzed tej gałęzi, nie warte churnu

### Domknięte

- [x] · 🟡 · natywne okno przeglądarki przy usuwaniu faktury/strony — jedyne takie miejsce
      w aplikacji. Commit `e7d31903` (ConfirmDialog) **jest w `heic-upload-gap`, ale NIE ma go
      w `staging`** — czyli naprawa wjedzie tylko razem z tą gałęzią

## Świadome amputacje — co zniknie w dniu przełączenia

To klasa rzeczy, której metoda tej próby nie mogła złapać: porównywanie ekranu z bazą potwierdza,
że to, co jest, liczy się dobrze — nie powie, że **coś zniknęło**. Znalezione przez porównanie
`main` ze `staging` i sprawdzenie każdej pozycji na żywo. Wszystkie trzy są celowe, z decyzją
właściciela i numerem — ale w dniu przełączenia znikną z ekranu.

**1. Raporty — cała strona wygaszona (EX-598).** Dziś `/raporty` renderuje kafle finansowe plus
tabelę transakcji. Po przełączeniu ten sam adres pokazuje „W budowie" z wyjaśnieniem, że marża
i bilans nie uwzględniały obniżek za rozliczanie wydatków po kwocie netto, więc nie zgadzały się
z kartami inwestycji. Wejście „Raporty" **znika też z menu**, a jego miejsce zajmuje „Flota"
(`52b1f3d8` jest na `staging`, nie ma go na `main`).

**2. Wydruk i eksport CSV — usunięte z każdej tabeli transferów (EX-672).** Z trzech przycisków
(drukuj, CSV, faktury) zostaje trzeci. To nie były ozdobniki: **CSV** brał przefiltrowany zbiór
(nie tylko widoczną stronę), tylko widoczne kolumny, w kolejności z sortowania, z BOM-em — czyli
otwierał się w Excelu bez kombinowania. **Wydruk** budował osobny dokument z nagłówkiem
finansowym, z bilansem liczonym **po swojemu**; uzasadnienie usunięcia mówi to wprost: „druk nie
był zrzutem ekranu, tylko drugim niezależnym czytelnikiem tych samych figur". To był powód, żeby
go usunąć — ale jednocześnie znaczy, że właściciel traci wydruk zestawienia.

**3. Pobieranie faktur zawężone do trzech ekranów.** Przycisk „Faktury" jest teraz warunkowy
i włączony tylko na karcie inwestycji, kasy i pracownika. **Na pulpicie go nie ma**, a dziś jest.
Sama ścieżka działa na prawdziwych bajtach: na `/kasa/35` komunikat „Pobrano 3 z 3 — 1 pozycja
bez faktury" zgadza się z bazą, a ZIP zawiera 3 pliki o niezerowym rozmiarze, przemianowane
z nazw technicznych na `data_opis.jpg`.

**Czego przy okazji NIE straciliśmy, wbrew pozorom.** Znika `lib/google/drive.ts`, czyli
zakładanie arkusza kosztorysu przez skopiowanie szablonu. Wygląda jak ubytek, ale ta ścieżka
i tak nie działała — konto usługi nie ma miejsca na Dysku i kopia nigdy się nie tworzyła.
Zastąpiło ją okno „Nowy kosztorys", które prosi o podpięcie istniejącego arkusza. To opis tego,
co i tak trzeba było robić — tylko teraz aplikacja tego nie udaje.

## Sprzątanie należne po próbie

**Gałąź próbna jest arytmetycznie czysta, ale nie wróciła do 3754 wierszy — i nie miała jak.**
Stan na 25.08: 3772 wiersze, max id 4669. Nad ostatnim wierszem produkcji siedzi 9 wierszy
testowych, wszystkie z `cancelled = t`, oraz 9 wierszy `CANCELLATION`, które są ich śladem
audytowym — anulowanie z definicji **dodaje wiersz, a nie kasuje**, więc licznik nie może wrócić
do punktu wyjścia i nie jest to brud. Żywego wiersza testowego nie ma ani jednego. (Zdanie
„baza wróciła do 3754 / max 4647" opisywało koniec fazy 1; faza 2 dołożyła resztę.) Pozycje
odhaczone — przywrócone salda, dźwignie rozliczenia, kolejność pozycji, runbook blobów — są
w historii gita. Zostaje to, czego nie mogę zrobić sam:

- [ ] **migracja `20260825_0_fix_own_tools_coeff_rounding` na produkcji** — `pnpm db:migrate:prod`,
      odpala **człowiek**. Obie przesłanki, które migracja wypisuje w swoim komentarzu,
      potwierdzone odczytem na produkcji **25.08**: `kosztorys_items` = 0 oraz `own_tools_coeff`
      = 0.55 na **115 ze 115** inwestycji, jednorodnie — czyli `UPDATE … WHERE = 0.55` nie ma jak
      nadpisać wartości wpisanej ręcznie, bo innej wartości tam nie ma. Nie ma też czego wycenić:
      0 sekcji, 0 pozycji, 0 postępów, 0 migawek (56 nagłówków kosztorysu to same linki do arkuszy,
      a 2 etapy przy zerze pozycji nie liczą niczego). Przesłanka nie zgnije z upływem czasu —
      kosztorys nie ma jak powstać na produkcji, bo v2 tam nie stoi. **Warte powiedzenia wprost:**
      migracji nie odpalono jeszcze nigdzie — produkcja ma 50 migracji, gałąź próbna 76
      (najnowsza `20260824_1`), więc na produkcji pójdzie jako pierwsza w życiu
- [ ] `DB_POSTGRES_URL` na Vercel Preview z powrotem na `ep-still-term-agp9aqfa-pooler`
- [ ] branch Neona `cutover_rehearsal` — auto-delete po dobie; do tego czasu staging na nim stoi
- [x] · **odrzucone** · sfabrykowane PNG-i faktur w **preview'owym** store'u Blob (11 nazwanych + 28 `repro-orphan-*.png` z odtwarzania przyczyny, w tym pięć sierot nieusuwalnych z poziomu
      aplikacji). Pierwotne uzasadnienie — „żeby nie mylić ich z fakturą właściciela" — nie broni
      się: pliki nazywają się `orphan-test-*` i `repro-orphan-*`. Store preview jest odbitką
      punktową produkcji, czyli zeszytem do wyrzucenia, a `blob-restore.mjs` jest put-only, więc
      pliki zostaną tam bezterminowo i **nikomu to nie przeszkadza**. Jedyny realny koszt to kwota
      planu (store był raz zawieszony za przekroczenie) — przy ~2347 plikach te 39 to szum.
      Zapisane, bo gdyby store kiedyś znów padł na limicie, to jest jedno z miejsc do sprzątnięcia
- [ ] artefakty testowe, **wszystkie znikną razem z gałęzią próbną** — spis jest po to, by nie
      wziąć ich potem za dane właściciela: inwestycja `investments.id=135` („PROBA CUTOVER…",
      13 sekcji / 336 pozycji), inwestycja `investments.id=134` („000", pusta — 0 transakcji,
      0 sekcji, status `active`), użytkownicy `users.id=63` (`test@test.pl`) i `users.id=64`
      („Testowy Pracownik Próbny"; interfejs nie ma usuwania pracownika) — **żadnego z tych
      dwóch kont nie ma na produkcji, która kończy się na `id=62`**, migawki inwestycji 31,
      szablon `kosztorys_presets` #1, link
      dla inwestora `kosztorys_shares` #1, ustawienia podglądu `kosztorys_client_view` dla
      inwestycji 31 (tryb `OFFER`), rozliczenia etapów na inwestycji 31 (interfejs nie pozwala
      cofnąć etapu do „nieustawiony")
