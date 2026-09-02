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

Przycięte przy archiwizacji (2026-09-02): 23 ustalenia z dyspozycją `fixed` zdjęte — trwałym
zapisem naprawy jest commit i kod, więc powtarzanie ich tutaj tylko konkuruje z prawdą w drzewie.
Zostaje to, czego git nie trzyma: decyzje, żeby czegoś NIE zrobić. Bilans przed przycięciem:
**23 fixed, 7 dismissed, 5 dropped, 3 filed (EX-764, EX-765, EX-766) · 0 otwartych**.

- [x] 🟡 WARNING · dismissed · impl-review · `kosztorys-v2-columns.tsx:291` · w cenniku klienta cena
      wykonawcy jest edytowalna, a kolumny „Źródło" tam nie ma — jedyny powrót na „auto" to skasowanie
      komórki. Właściciel odrzucił oba warianty naprawy: „Źródła" w cenniku klienta nie chce, a stawki
      obu planów mają tam ZOSTAĆ edytowalne, bo to widok, w którym pracuje. Delete jako powrót na
      „auto" jest świadomie przyjęty. Zamknięte bez zmiany zachowania.
      test: TDD · unit — `plane-price-columns.test.ts` pilnuje edytowalności stawki w KAŻDYM widoku
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
- [x] 🟡 WARNING · dismissed · impl-review · `use-hidden-columns.ts:16` · zapisany tick `price`
      z widoku wykonawcy przenosi się na cenę klienta w „Inwestor" (mapa ukrytych kolumn jest
      globalna). Nieosiągalne: produkcja nie ma ani jednego wiersza kosztorysu, więc nikt nie ma
      takiego stanu w localStorage; koszt naprawy = jeden tick.
- [x] 🔵 OBSERVATION · dropped · code-review · `column-order.ts:9` · cztery nowe kolumny przesuwają
      indeksy montażu, więc zapisane rangi kolumn dryfują o 1–2 miejsca. Kosmetyczne, samo się leczy
      przeciągnięciem, nieosiągalne na produkcji (zero kosztorysów).
- [x] dropped · feature-first · `kosztorys-sort-value.test.ts:1` · redundantny prefiks `kosztorys-`
      w nazwie spec-a wobec źródła `sort-value.ts`. Zgodne z regułą, sama zmiana nazwy to churn.
- [x] dismissed · tailwind-v4-audit · — · zero trafień w grupach A/B/C; diff nie dodaje ani jednej
      klasy CSS. Brak wtyczki ESLint dla Tailwinda to luka spoza tej gałęzi.
- [x] dismissed · feature-first · `plane-price-keys.ts:1`, `plane-price-columns.test.ts:1` ·
      umiejscowienie poprawne (wzorzec `stage-keys.ts`, pełne lustro ścieżki w `__tests__`).
- [x] dismissed · code-review · `calc.ts:104` ↔ `kosztorys-subcontractor-due.ts:38` · parity TS ↔ SQL
      czysta: obie strony rozgałęziają identycznie, legacy `'coeff'` też spada na tę samą gałąź.
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
- Manual checks (przebieg 2026-09-01, Playwright na `db-test` 5435, inwestycje 106 i 85): **16/16
  odhaczonych, zero otwartych znalezisk**. Box importu przejechany end-to-end na prawdziwym arkuszu
  klienta zamiast na wypełnionym arkuszu testowym, którego karta robocizny nazywa się
  `"kosztorys_robocizny(dla inwestora) "` (wada fixture'a, nie kodu — szczegóły w
  `context/foundation/manual-checks.md`).
