753 # Review-gate ledger — katalog-prac-auto-rates · 2026-09-01

Zakres: `6900a3f5~1..bbbc8989` (24 pliki). Fan-out: 10x-impl-review, code-review,
tailwind-v4-audit, feature-first-structure, module-cohesion-audit, structure-scatter-audit,
comment-noise-audit. Step 0.5 (verification pass) pominięty — repo nie ma skilla weryfikacji.

## Findings

- [x] 🟡 WARNING · dismissed · `code-review` · `src/components/tables/work-catalogue.tsx:43` · zdjęte wyrównanie do prawej w kolumnach kwotowych uznane za regresję spoza slice'a — to jawne polecenie właściciela z tej sesji („Tekst zawsze wyrównany do lewej, tak samo jak we wszystkich innych tabelach"), nie drive-by; dopisane do change.md
- [x] 🟡 WARNING · dismissed · `impl-review` · `src/lib/db/work-catalogue.ts:110` · dryf wobec planu: usunięty `JOIN investments` i współczynniki z `CatalogueSourceItemT`, choć plan kazał je zostawić — kod ma rację, plan się mylił (`subcontractorPrice` wycenia `'coeff'` jako `clientPrice * value` i globalnego nigdy nie czyta); odnotowane w change.md, żeby nikt ich nie „przywrócił"
- [x] 🔵 OBSERVATION · dropped · `code-review` · `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:106` · jedna rozbieżność cena j.m. przy obu planach auto raportuje się trzy razy i zawyża `maxDelta` w sortowaniu — kształt odziedziczony po istniejącym porównaniu, poprawka zmieniałaby kolejność listy, której właściciel jeszcze nie widział
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `src/lib/kosztorys/work-catalogue/item-to-catalogue.ts:27` · `globalWToolsCoeff: 0` na gałęzi nieosiągalnej — `ViewPricingT` bez tych pól dziś nie da się wyrazić, a komentarz mówi wprost, że to martwa wartość
- [x] 🔵 OBSERVATION · skipped · `code-review` · `src/migrations/20260901_1_work_catalogue_auto_rates.ts` · `20260901_0` i `_1` muszą pojechać na produkcję jednym przebiegiem, przed wypchnięciem kodu; `down()` jest nieodwracalny, gdy istnieje choć jeden wiersz auto — obowiązek człowieka (`pnpm db:migrate:prod`), agent go nie zdejmie
- [x] dismissed · `tailwind-v4-audit` · cały diff · zero `var(--x)` w klasach arbitralnych, zero `style=`, zero wartości arbitralnych, zero wariantów breakpointowych — nic do zmapowania na nadpisaną skalę repo
- [x] dismissed · `feature-first-structure` · cały diff · 20 plików źródłowych, zero naruszeń umiejscowienia; `use-field-value.ts` zostaje w `forms/hooks/` (4 konsumentów w 2 katalogach), lustra testów pełnej głębokości
- [x] dismissed · `structure-scatter-audit` · cały diff · rozbicie `work-catalogue` na `lib/db` / `lib/queries` / `lib/actions` / `lib/kosztorys` to podział warstwowy z AGENTS.md, nie rozsyp; dialogi trzymają regułę „dom = powierzchnia uruchomienia"
- [x] dropped · `structure-scatter-audit` · `AGENTS.md` · reguła „dom dialogu to powierzchnia uruchomienia, nie encja" jest dziś domyślna — dopisanie jej to zmiana reguł projektu, nie sprzątanie tego slice'a
- [x] dropped · `code-review` · `src/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog.tsx` · typograficzne `„auto”` zamiast `„auto"` w nowym copy — kosmetyka, koszt zmiany większy niż zysk
- [x] dropped · `tailwind-v4-audit` · `eslint.config.mjs` · brak lintera świadomego Tailwinda (jest tylko `prettier-plugin-tailwindcss`, który sortuje, nie waliduje) — poza slice'em, zmiana konfiguracji CI
- [x] skipped · `simplify` · `src/lib/kosztorys/sheet-import/{footer-totals.ts:49,build-sheet-comparison.ts:100}` · dwa pozostałe adaptery zostają: inny typ wejścia (`ParsedItemT`) i odwrotna kolejność spreadu (nulle PRZED itemem) — zwinięcie ich zmieniłoby zachowanie, nie tylko kształt
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
- `tsc --noEmit` po naprawie przełącznika „auto" — czysto

## Manualne checki (Playwright, 2026-09-01)

Przejechane skryptem Playwright na lokalnej bazie (`wykonczymy-db:5433`), inwestycja 9
„Al. Rzeczypospolitej 21/25" (współczynniki 0,65 / 0,5525). Wszystkie pięć checków wychodzi
zgodnie z opisem — właściciel odklikuje je sam, tu zapis obserwacji:

1. Nowa praca „bez narzędzi" na auto zapisuje się, a `/katalog-prac` pokazuje „auto" w kolumnie
   stawki i „—" w kolumnie `%`. W bazie `own_tools_rate IS NULL`.
2. Odznaczone auto przy pustym polu daje „Stawka bez narzędzi jest wymagana" pod polem.
3. Edycja pracy z auto otwiera formularz z zaznaczonym przełącznikiem tego planu, a jego pole
   kwoty jest schowane; drugi plan zostaje kwotowy.
4. „Zapisz do katalogu…" pokazuje „auto" w „W katalogu" i „Po zapisie", a potwierdzenie
   nadpisania mówi „stawka z narzędziami auto → auto, bez narzędzi auto → auto".
5. Wstawiona z katalogu praca auto ma w rozpisce „Źródło ceny wykonawcy = auto", pustą komórkę
   mnożnika (podpowiedź 0,5525) i cenę 55,25 zł z ceny 100 zł — czyli ze współczynnika
   inwestycji; drugi plan zostaje „kwota stała" 60 zł. Wybieranie z katalogu pokazuje „auto"
   również na liście w dialogu.

Po drodze wypadł jeden realny bug (pierwsza pozycja w `## Findings`) — naprawiony i przejechany
ponownie na zielono.

_Trimmed at archive (2026-09-02): 20 `fixed` finding(s) removed — a fixed finding's durable record is its commit; what survives is the negative space git cannot hold. Pre-trim tally: 20 fixed, 15 other, 0 open._
