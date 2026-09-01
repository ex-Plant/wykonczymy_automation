# Review-gate ledger — katalog-prac-auto-rates · 2026-09-01

Zakres: `6900a3f5~1..bbbc8989` (24 pliki). Fan-out: 10x-impl-review, code-review,
tailwind-v4-audit, feature-first-structure, module-cohesion-audit, structure-scatter-audit,
comment-noise-audit. Step 0.5 (verification pass) pominięty — repo nie ma skilla weryfikacji.

## Findings

- [x] 🟡 WARNING · fixed · `code-review` · `src/components/forms/work-catalogue-item/work-catalogue-item-form.tsx:129` · oba plany renderują identyczną etykietę „Auto — licz ze współczynnika inwestycji", a jedyne co nazywa plan (input) znika po zaznaczeniu — przy obu zaznaczonych nie da się odróżnić, który jest który — etykieta przełącznika niesie teraz nazwę planu („Stawka z narzędziami: auto — ze współczynnika inwestycji"), `label` wyprowadzana z `plane`
      test: no automated test · — czysto wizualne; nazwa planu w etykiecie jest widoczna gołym okiem, a asercja na string etykiety testowałaby copy, nie zachowanie
- [x] 🟡 WARNING · fixed · `impl-review` · `src/__tests__/lib/actions/work-catalogue-insert.test.ts` · brak testu: plan auto wpisuje `overrideType: null`, a pułap 80% dla niego milczy — dopisane „praca «auto» ląduje bez nadpisania i nie budzi pułapu 80%"
      test: TDD · integration — asercja na utrwalony wiersz (`w_tools_override_type IS NULL`) plus puste `warnings`; zielony @ 5435
- [x] 🟡 WARNING · fixed · `impl-review` · `src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-comparison.test.ts` · brak testu ścieżki auto — dopisane dwa: cennik auto kontra wiersz bez nadpisania = zgodność, oraz „auto liczy się z ceny KATALOGU, nie z ceny rozpiski"
      test: TDD · unit — moduł czysty, gotowy harness
- [x] 🟡 WARNING · fixed · `code-review` · `src/__tests__/lib/actions/work-catalogue.test.ts` · brak testu, że edycja kwota → auto zapisuje NULL — dopisane „zmiana kwoty na «auto» zapisuje NULL, a nie 0 zł"
      test: TDD · integration — asercja na utrwalony wiersz, nie na wynik akcji; zielony @ 5435
- [x] 🟡 WARNING · dismissed · `code-review` · `src/components/tables/work-catalogue.tsx:43` · zdjęte wyrównanie do prawej w kolumnach kwotowych uznane za regresję spoza slice'a — to jawne polecenie właściciela z tej sesji („Tekst zawsze wyrównany do lewej, tak samo jak we wszystkich innych tabelach"), nie drive-by; dopisane do change.md
- [x] 🟡 WARNING · dismissed · `impl-review` · `src/lib/db/work-catalogue.ts:110` · dryf wobec planu: usunięty `JOIN investments` i współczynniki z `CatalogueSourceItemT`, choć plan kazał je zostawić — kod ma rację, plan się mylił (`subcontractorPrice` wycenia `'coeff'` jako `clientPrice * value` i globalnego nigdy nie czyta); odnotowane w change.md, żeby nikt ich nie „przywrócił"
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/kosztorys/work-catalogue/build-catalogue-seed.ts:47` · `winningRate` liczyła zwycięzcę dwiema miarami (kubełek groszowy vs tolerancja 0,005) — `winningBucket` zwraca teraz `{ value, count }` i `winningRate` czyta liczność zwycięskiego kubełka zamiast przeliczać ją drugą regułą
      test: no automated test · — poprawka zdejmuje możliwość rozjazdu dwóch miar; jedyny obserwowalny skutek to remis auto/kwota na styku pół grosza, dane, których szablon nie produkuje
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:106` · `autoPricing` i domknięcie `catalogueRate` budowane dla każdej sparowanej pozycji — zastąpione czystą funkcją modułową `rate ?? clientPrice * coeff`; `NO_OVERRIDES` i dwa spready na wiersz zniknęły
- [x] fixed · `comment-noise` · `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts:23` · komentarz nad `RATE_PLANES` powtarza nazwę stałej — zero „dlaczego"
- [x] fixed · `comment-noise` · `src/components/forms/work-catalogue-item/work-catalogue-item-form.tsx:131` · przycięcie do jedynej nośnej klauzuli (ukryte, nie wyszarzone) + przeniesienie nad `RateField`, bo dziś opisuje `RateFieldNameT`
- [x] fixed · `comment-noise` · `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts:66` · pierwsze zdanie to ósma kopia definicji „auto"; zostaje tylko lokalne „dlaczego `.nullable()` nie osłabia bramki formularza"
- [x] fixed · `comment-noise` · `src/components/tables/work-catalogue.tsx:13` + `src/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog.tsx:16` · dwa czyste miejsca renderu powtarzają definicję „auto", której kanoniczny dom to `types.ts:7`
- [x] fixed · `feature-first` · `src/components/forms/hooks/use-field-value.ts:5` · nagłówek opisuje hook przez filtrowanie listy opcji („selection"), a po uogólnieniu czyta też boolean sąsiedniego pola
- [x] fixed · `module-cohesion` · `src/lib/kosztorys/work-catalogue/{build-catalogue-seed,append-catalogue-items}.ts` · adapter `KosztorysItemT → ViewPricingT` pisany ręcznie 5× — jeden `asViewPricing(item, coeffs?)` w `calc.ts`, wpięty w 4 miejscach (piąte świadomie pominięte, patrz `simplify` niżej)
- [x] 🔵 OBSERVATION · dropped · `code-review` · `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:106` · jedna rozbieżność cena j.m. przy obu planach auto raportuje się trzy razy i zawyża `maxDelta` w sortowaniu — kształt odziedziczony po istniejącym porównaniu, poprawka zmieniałaby kolejność listy, której właściciel jeszcze nie widział
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `src/lib/kosztorys/work-catalogue/item-to-catalogue.ts:27` · `globalWToolsCoeff: 0` na gałęzi nieosiągalnej — `ViewPricingT` bez tych pól dziś nie da się wyrazić, a komentarz mówi wprost, że to martwa wartość
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/migrations/20260901_1_work_catalogue_auto_rates.ts` · `20260901_0` i `_1` muszą pojechać na produkcję jednym przebiegiem, przed wypchnięciem kodu; `down()` jest nieodwracalny, gdy istnieje choć jeden wiersz auto — obowiązek człowieka (`pnpm db:migrate:prod`), agent go nie zdejmie
- [x] dismissed · `tailwind-v4-audit` · cały diff · zero `var(--x)` w klasach arbitralnych, zero `style=`, zero wartości arbitralnych, zero wariantów breakpointowych — nic do zmapowania na nadpisaną skalę repo
- [x] dismissed · `feature-first-structure` · cały diff · 20 plików źródłowych, zero naruszeń umiejscowienia; `use-field-value.ts` zostaje w `forms/hooks/` (4 konsumentów w 2 katalogach), lustra testów pełnej głębokości
- [x] dismissed · `structure-scatter-audit` · cały diff · rozbicie `work-catalogue` na `lib/db` / `lib/queries` / `lib/actions` / `lib/kosztorys` to podział warstwowy z AGENTS.md, nie rozsyp; dialogi trzymają regułę „dom = powierzchnia uruchomienia"
- [x] dropped · `structure-scatter-audit` · `AGENTS.md` · reguła „dom dialogu to powierzchnia uruchomienia, nie encja" jest dziś domyślna — dopisanie jej to zmiana reguł projektu, nie sprzątanie tego slice'a
- [x] dropped · `code-review` · `src/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog.tsx` · typograficzne `„auto”` zamiast `„auto"` w nowym copy — kosmetyka, koszt zmiany większy niż zysk
- [x] dropped · `tailwind-v4-audit` · `eslint.config.mjs` · brak lintera świadomego Tailwinda (jest tylko `prettier-plugin-tailwindcss`, który sortuje, nie waliduje) — poza slice'em, zmiana konfiguracji CI
- [x] fixed · `impl-review` · `context/changes/2026-08-31-katalog-prac-auto-rates/change.md` · notatka mówiła „puste pole = auto, nie błąd «jest wymagana»", a plan to odwrócił: auto jest przełącznikiem, puste pole nadal jest błędem
- [x] fixed · `simplify` · `src/lib/kosztorys/calc.ts:63` · dwa nowe eksporty tam, gdzie mieszka wycena: `overrideTypeFor(row, plane)` (ręcznie rozwijany trójargumentowy warunek w 3 plikach) i `asViewPricing(item, coeffs?)` — domyślne zera są udokumentowane jako obojętne, nie jako podstawiony współczynnik
- [x] fixed · `simplify` · `src/lib/kosztorys/work-catalogue/catalogue-rate.ts` · nowy `impliedCatalogueRate(row, plane)` — jedno miejsce reguły „własne nadpisanie → kwota, brak → auto"; `item-to-catalogue` i `build-catalogue-seed` przestały ją wyprowadzać osobno
- [x] fixed · `simplify` · `src/lib/kosztorys/work-catalogue/append-catalogue-items.ts:78` · pominięcie planu auto w pułapie 80% wyrażone RAZ — filtr po `overrideTypeFor`, a zera globalnych uzasadnione przy samym wywołaniu guardu; wcześniej poprawność filtra po cichu zależała od tego, że atrapa zer pozostanie atrapą
- [x] fixed · `simplify` · `src/lib/kosztorys/sheet-import/build-sheet-comparison.ts:113` · `asPlanePricing` zwinięte na `asViewPricing`
- [x] skipped · `simplify` · `src/lib/kosztorys/sheet-import/{footer-totals.ts:49,build-sheet-comparison.ts:100}` · dwa pozostałe adaptery zostają: inny typ wejścia (`ParsedItemT`) i odwrotna kolejność spreadu (nulle PRZED itemem) — zwinięcie ich zmieniłoby zachowanie, nie tylko kształt
- [x] fixed · `simplify` · `src/lib/utils/format-currency.ts:14` · `formatPLNOrAuto` obok `formatPLNOrDash`; dialog „Zapisz do katalogu…" stracił lokalny `rate` + jego komentarz
- [x] fixed · `simplify` · `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts:17` · `moneyInput` wstawione w jedyne miejsce użycia (`clientPrice`)
- [x] dropped · `simplify` · cały diff · wspólna tablica `TOOL_PLANES` dla całego repo — refaktor na osobny review, nie sprzątanie tego slice'a
- [x] dropped · `simplify` · `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts:61` · spłaszczenie `baseSchema.omit().extend()` — dzisiejszy kształt jest krótszy niż jego alternatywa
- [x] dropped · `simplify` · `src/components/tables/work-catalogue.tsx` · sortowanie wierszy auto (nulle) bez jawnej reguły — kosmetyka, właściciel nic o kolejności nie mówił

## Simplify pass

Ran /simplify (4 agentów: reuse / simplification / efficiency / altitude) — 7 applied, 3 dropped,
1 skipped; każde znalezisko wpięte do `## Findings` z tagiem `simplify`. Osobnego raportu nie ma:
bramka trzyma jeden rejestr.

## Tests & suite

- `pnpm exec vitest run` (work-catalogue + sheet-import + forms) — 17 plików, 293 testy, zielone
- `build-catalogue-comparison.test.ts` po dopisaniu ścieżki auto — 11 testów, zielone
- specy DB @ 5435 (`work-catalogue.test.ts`, `work-catalogue-insert.test.ts`) — 13 testów, zielone
- `tsc --noEmit` — czysto; `eslint` na 13 zmienionych plikach — czysto; `prettier` — bez zmian
- pełny pakiet (lint / build / e2e) — nie uruchamiany, do decyzji właściciela
