# Review-gate ledger — kosztorys-contractor-price-columns-in-client-view (obie zmiany) · 2026-09-01

Zakres: cała gałąź `kosztorys-contractor-price-columns-in-client-view` = dwie zmiany czytane jako
jedna całość:

- `context/changes/2026-09-01-kosztorys-contractor-price-columns-in-client-view/`
- `context/changes/2026-09-01-kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/`

Diff: `git diff main...HEAD` (39 plików). Fan-out: `10x-impl-review`, `code-review`,
`tailwind-v4-audit`, `feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`
(diff-scoped), `comment-noise-audit` (flag-only). Krok 0.5 (przeglądarka) pominięty — Playwright
nie jest uruchamiany bez wyraźnego polecenia; manual checks pozostają blokerem archiwizacji.

## Findings

<!-- [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · co — dlaczego -->

- [x] 🟡 WARNING · dismissed · impl-review · `kosztorys-v2-columns.tsx:291` · w cenniku klienta cena
      wykonawcy jest edytowalna, a kolumny „Źródło" tam nie ma — jedyny powrót na „auto" to skasowanie
      komórki. Właściciel odrzucił oba warianty naprawy: „Źródła" w cenniku klienta nie chce, a stawki
      obu planów mają tam ZOSTAĆ edytowalne, bo to widok, w którym pracuje. Delete jako powrót na
      „auto" jest świadomie przyjęty. Zamknięte bez zmiany zachowania.
      test: TDD · unit — `plane-price-columns.test.ts` pilnuje edytowalności stawki w KAŻDYM widoku
- [x] 🟡 WARNING · fixed · właściciel (zrzut ekranu) · `globals.css:300` + `subcontractor-columns.tsx:41`
      · w komórce z zawyżoną stawką trójkąt ostrzegawczy lądował pod liczbą (przycięty do wierzchołka),
      a sama liczba siedziała na innej wysokości niż sąsiednie kolumny. Siatka kształtuje bezpośredni
      `span` komórki pod tekst TYLKO DO ODCZYTU — kolumna, zawijanie, przycinanie i marginesy 5/6px —
      a wrapper tooltipa przepuszczał przez ten box input. Ikona wypada (decyzja właściciela: zostaje
      czerwona liczba + dymek na hover/focus), a nowa klasa `kosztorys-cell-input-body` zeruje wrapper
      (`display: block`, bez marginesów), więc input wypełnia komórkę identycznie jak bez dymka.
      Błąd sprzed gałęzi (identyczny kod na `main`), zgłoszony przy tej okazji.
      test: no automated test · — · układ CSS w wirtualizowanej siatce; pilnuje go manual check
- [x] deferred · module-cohesion · `kosztorys-v2-columns.tsx:754` · 771 linii, 2 eksporty nad
      prywatnym `assembleV2Columns` — god module, który ten diff powiększył (EX-515 zatrzymał się
      przed nim). filed EX-764.
- [x] deferred · module-cohesion · `row-conditions.ts:140` · 599 linii: typy + stałe + ~300-liniowy
      rejestr `ROW_CONDITIONS` (22 warunki) + helpery zapytań. filed EX-765.
- [x] dropped · simplify (altitude) · `column-config.ts:219` · widoki wykonawcy otwierają się BEZ
      żadnej kolumny ceny (na `main` „Źródło" + „Mnożnik" + „Cena j.m." były tam widoczne; ta gałąź
      przeniosła stawki na id z planem, a `DEFAULT_HIDDEN_COLUMNS` chowa wszystkie cztery w KAŻDYM
      widoku). Właściciel: domyślne ukrycie mu nie przeszkadza — „to sobie odkryje ktoś". Bez fixu,
      bez issue.

- [x] 🟡 WARNING · fixed · code-review · `calc.ts:79` + `kosztorys-tree.ts:148` + `work-catalogue.ts:121`
      · po zawężeniu typu wiersz z zapisanym `'coeff'` (snapshot/szablon sprzed zmiany) czytał się
      jako „nie-auto": wyceniał się globalnym mnożnikiem inwestycji, a na ścieżce cennika zamrażał
      **0 zł**. Zwinięcie do „auto" w jednym miejscu (`overrideTypeFor`) + oba readery DB.
      test: test-driven-debugging · unit — czerwony spec na `'coeff'` w `calc`/`row-conditions`
- [x] 🟡 WARNING · fixed · impl-review · `row-conditions.ts:201` · cztery filtry stawki
      (`manual-rate-*`, `formula-rate-*`) nie miały `revealsColumns`, a po zmianie każda kolumna
      stawki startuje ukryta — filtr zawężał wiersze i nie pokazywał ani „Źródła", ani „Ceny j.m.".
      Manual check napisany w planie 2 asertował zachowanie, którego nie było.
      test: TDD · unit — spec pinuje reveal obu kolumn planu
- [x] 🟡 WARNING · fixed · impl-review · `row-conditions.ts:205` · etykiety filtrów „wpisaną ręcznie"
      / „z formuły" nazywały trzecie, nieistniejące już źródło. Przemianowane na „kwota stała" / „auto",
      zgodnie ze słownikiem, który phase 4 wpisała w notatki domenowe.
- [x] 🟡 WARNING · dismissed · impl-review · `use-hidden-columns.ts:16` · zapisany tick `price`
      z widoku wykonawcy przenosi się na cenę klienta w „Inwestor" (mapa ukrytych kolumn jest
      globalna). Nieosiągalne: produkcja nie ma ani jednego wiersza kosztorysu, więc nikt nie ma
      takiego stanu w localStorage; koszt naprawy = jeden tick.
- [x] 🔵 OBSERVATION · fixed · impl-review · `layer.ts:20` · `axisAllows` rozwiązuje po kluczu
      bazowym, `layerAllows` nie — kontrakt planu wymieniał obie. Dziś nieszkodliwe, bo `price`
      i `priceMode` są nieotagowane; pułapka na pierwszy tag.
      test: TDD · unit — spec pinuje symetrię obu funkcji
- [x] 🔵 OBSERVATION · fixed · code-review · `row-conditions.ts:338` · komentarz twierdzi, że reveal
      nie przełącza planu widoku — a `use-kosztorys-view-state.ts:48` nadal przełącza.
- [x] 🔵 OBSERVATION · fixed · impl-review · `plane-price-keys.ts` · brak spec-a na odwrotność
      namespace'u, czyli najbardziej wrażliwy kawałek zmiany (zły plan CZYTA i ZAPISUJE stawkę
      drugiej ekipy). Dopisany spec z przypadkami negatywnymi.
      test: TDD · unit — `src/__tests__/lib/kosztorys/plane-price-keys.test.ts`
- [x] 🔵 OBSERVATION · dropped · code-review · `column-order.ts:9` · cztery nowe kolumny przesuwają
      indeksy montażu, więc zapisane rangi kolumn dryfują o 1–2 miejsca. Kosmetyczne, samo się leczy
      przeciągnięciem, nieosiągalne na produkcji (zero kosztorysów).
- [x] fixed · comment-noise + impl-review · `kosztorys-v2-columns.tsx:158,624,671,689` ·
      `constants.ts:3` · `use-condition-row-latch.ts:10` · `calc.ts:88` · `build-catalogue-seed.ts:81`
      · `catalogue-rate.ts:7` · komentarze nazywały usuniętą kolumnę „Mnożnik" / „sześć kolumn" /
      „trzy kolumny" — nie restytucja kodu, tylko wprost nieprawda.
- [x] fixed · comment-noise · 11 miejsc · narracja „used to / no longer / before this change"
      przepisana na czas teraźniejszy albo wycięta; zostawione tam, gdzie `used to` nazywa buga,
      którego spec pilnuje.
- [x] fixed · scatter-audit · `column-config.ts:227` + `row-conditions.ts:75,84` · enumeracja
      wszystkich kluczy ceny planu przepisana znak w znak w trzech miejscach, choć namespace ma
      własny moduł. Wyeksportowane `planePriceKeysFor` / `ALL_PLANE_PRICE_KEYS`.
- [x] fixed · impl-review · plan 1 (`change.md`, `plan-brief.md`, `plan.md`) · dokumenty nadal
      opisują sześć kolumn i „Mnożnik", czyli stan cofnięty przez zmianę 2. Dopisany banner
      „Superseded by".
- [x] fixed · impl-review · `manual-checks.md` · check asertował reveal, którego nie było —
      zsynchronizowany z naprawionym zachowaniem.
- [x] dropped · feature-first · `kosztorys-sort-value.test.ts:1` · redundantny prefiks `kosztorys-`
      w nazwie spec-a wobec źródła `sort-value.ts`. Zgodne z regułą, sama zmiana nazwy to churn.
- [x] dismissed · tailwind-v4-audit · — · zero trafień w grupach A/B/C; diff nie dodaje ani jednej
      klasy CSS. Brak wtyczki ESLint dla Tailwinda to luka spoza tej gałęzi.
- [x] dismissed · feature-first · `plane-price-keys.ts:1`, `plane-price-columns.test.ts:1` ·
      umiejscowienie poprawne (wzorzec `stage-keys.ts`, pełne lustro ścieżki w `__tests__`).
- [x] dismissed · code-review · `calc.ts:104` ↔ `kosztorys-subcontractor-due.ts:38` · parity TS ↔ SQL
      czysta: obie strony rozgałęziają identycznie, legacy `'coeff'` też spada na tę samą gałąź.

- [x] fixed · simplify (reuse) · `subcontractor-price-edit.ts:14` · `overrideSnapshot` nadal rzutował
      surowy typ z kolumny — ostatnia obejście „jednego zwinięcia". Czyta przez `overrideTypeFor`,
      więc odrzucona edycja wraca do źródła, które piker faktycznie oferuje.
- [x] fixed · simplify (reuse) · `sort-value.ts:80` · sortowanie „Źródła" budowało cały snapshot
      (pojęcie z warstwy edycji) po jedno pole, i czytało typ NIEzwinięty → `overrideTypeFor`; import
      modułu edycji z sortera znika.
- [x] fixed · simplify (reuse) · `subcontractor-columns.tsx:36` · `SubcontractorCellDataT.typeField`
      powielał mapowanie plan→pole i dawał trzy odczyty z rzutowaniem; `columnData` niesie sam plan,
      a komórki pytają `overrideTypeFor`.
- [x] fixed · simplify (efficiency) · `column-config.ts:60` · `columnLabelForView` parsował to samo id
      dwa razy (`planeOfPriceKey` + `basePriceKey`) — jedno `planePriceKeyParts`.
- [x] fixed · simplify · `row-conditions.ts:2` · martwy import `TOOL_PLANES`.
- [x] fixed · simplify · `calc.ts:70` · `effectiveCoeff` bez konsumentów z zewnątrz po cięciu — bez
      `export`.
- [x] fixed · simplify · `plane-price-keys.ts:12` · `PlanePriceBaseKeyT` eksportowany, nieużywany
      poza modułem.
- [x] fixed · simplify · `kosztorys-v2-columns.tsx:292` · `view === 'client'` pytane wewnątrz
      `flatMap` po planach, choć jest niezmienne — wyniesione.
- [x] fixed · simplify (altitude) · `header-tips.ts` · `HEADER_TIPS` był jedyną mapą konfiguracji bez
      akcesora, więc rozwiązanie base-key siedziało w `.tsx`; `headerTipFor` domyka wzorzec
      `columnLabelForView` / `axisAllows` / `layerAllows`.
- [x] fixed · comment-noise · `collections/kosztorys-items.ts:6` · komentarz nadal opisywał
      `{coeff, amount}`.
- [x] fixed · simplify · `calc.ts`, `row-conditions.ts` · prettier.
- [x] filed · simplify (altitude) · `types.ts:24` · `SubcontractorOverrideTypeT = 'amount'` to
      jednoelementowa unia udająca enum; docelowo jeden `overrideValue: number | null`. Migracja +
      refaktor wire-schema — własne review, nie cleanup po slice'ie. filed EX-766.
- [x] dismissed · simplify (altitude) · `calc.ts:92` · propozycja skasowania `'coeff'` migracją
      zamiast zwijania na odczycie: kolumna jest zwykłym `text` (bez enuma w DB), a szablony i
      snapshoty to blob-y JSON, których migracja kolumn i tak nie ruszy — zwinięcie na jednej granicy
      odczytu zostaje właściwą głębokością.
- [x] dropped · simplify (altitude) · `subcontractor-columns.tsx:23` · wspólne
      `SUBCONTRACTOR_SOURCE_LABELS` dla pikera i etykiet filtrów: filtry odmieniają („ze stawką …
      z kwoty stałej"), więc mianownik z pikera czytałby się źle — dzielenie pogorszyłoby polszczyznę.
- [x] dropped · simplify (efficiency) · `sort-value.ts:74` · parsowanie id kolumny raz na wiersz przy
      sortowaniu 1000+ pozycji: ~0,2 ms na całe sortowanie, a przebudowa na akcesor per-kolumna rusza
      `row-view.ts` i `use-kosztorys-editor.ts`. Nie warte churnu.
- [x] dismissed · simplify (efficiency) · `kosztorys-v2-columns.tsx:292` · składanie kolumn stawek
      przed odfiltrowaniem ich przez piker — kilka obiektów na render, sam agent nie rekomendował
      zmiany.

## Simplify pass

Ran /simplify — 4 agentów (reuse / simplification / efficiency / altitude); 11 zastosowanych,
1 zgłoszony do Linear, 2 odrzucone, 2 oddalone, 1 otwarty do decyzji właściciela. Każde ustalenie
złożone do `## Findings` z tagiem `simplify`.

## Tests & suite

- `pnpm typecheck` — czysto
- `pnpm lint` — 90 problemów (4 błędy, 86 ostrzeżeń), co do sztuki tyle samo co przed zmianą; wszystkie
  w plikach spoza tej gałęzi
- `pnpm test` — 228 plików, 3177 asercji zielonych (55 plików / 203 asercje pominięte: specy na bazie
  5435, nieuruchamiane lokalnie)
- Nowe specy: `plane-price-keys.test.ts` (odwrotność namespace'u, przypadki negatywne),
  `kosztorys-calc.test.ts` (zwijanie zapisanego `'coeff'` do „auto" + skutek cenowy),
  `row-conditions.test.ts` (odsłanianie kolumn przez cztery filtry stawek; para „ręcznie"/„auto"
  komplementarna także dla wiersza sprzed cięcia), `plane-price-columns.test.ts` (warstwa
  Praca/Postęp rozwiązuje id planu tak samo jak oś pieniędzy; stawka wykonawcy edytowalna
  w każdym widoku, także w cenniku klienta, gdzie nie ma obok niej „Źródła")
- E2E: nie uruchamiane (nigdy bez wyraźnej prośby)
- Manual checks (przebieg 2026-09-01, Playwright na `db-test` 5435, inwestycja 106): **15/16
  odhaczonych**. Otwarty zostaje box importu wypełnionego arkusza testowego — karta robocizny w tym
  arkuszu nazywa się `"kosztorys_robocizny(dla inwestora) "`, więc `MissingLaborTabError` pada przed
  mapowaniem stawek. Wada fixture'a, nie gałęzi; sama logika `deriveOverride` potwierdzona kodem
  i `build-import-plan.test.ts`. To jedyny bloker archiwizacji.
