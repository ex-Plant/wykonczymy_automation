# Review-gate ledger — strata-obniza-bilans (EX-675) · 2026-08-13

## Findings

- [x] 🔴 CRITICAL · fixed · repro (faza 0) · `src/hooks/transfers/validate.ts:59-124` · częściowa
      aktualizacja (PATCH jednego pola) leciała na czerwono na **trzech** wymaganiach naraz, nie
      tylko na `investment`: „Cash register is required… Investment is required… Expense category
      is required…". Naprawa czyta wszystkie pola relacyjne przez `originalDoc`, wzorem istniejącego
      fallbacku na `type`.
      test: test-driven-debugging · unit — `src/__tests__/validate-hook.test.ts`, repro napisany
      czerwony przed naprawą, plus guard, że brak inwestycji po obu stronach dalej odrzuca.

- [x] 🟡 WARNING · fixed · comment-noise · `src/__tests__/transfer-schema.test.ts:398` · kopia testu
      „LOSS without investment" w bloku `expenseFormSchema` parsowała `createTransferSchema` na
      payloadzie serwerowym — blok klienta nie sprawdzał więc niczego o schemacie klienta, a nowy
      wymóg inwestycji nie miał pokrycia po stronie formularza. Teraz `toClientPayload` +
      `expenseFormSchema` z pustym `investment`.
      test: test-driven-debugging · unit — sam test JEST regresją; poprawiony parsuje właściwy
      schemat i dalej jest zielony (74/74).

- [x] 🟡 WARNING · fixed · impl-review + code-review (zbieżnie) · `src/hooks/transfers/validate.ts:37-43`
      · fallback na `??` mylił „klucza nie ma" z „klucz wyzerowany". Panel admina zapisuje CAŁY
      dokument, więc wyczyszczona relacja przychodzi jako `null` — walidacja czytała wtedy STARY
      link ze `originalDoc`, przepuszczała zapis i utrwalała `null`. Dokładnie osierocona strata,
      której EX-675 zabrania; ta sama dziura na `sourceRegister`, `worker`, `targetRegister`,
      `otherCategory`, `expenseCategory`. Teraz pomocnik `stored()` pyta o OBECNOŚĆ klucza (`in`).
      test: test-driven-debugging · unit — `src/__tests__/validate-hook.test.ts`, PATCH
      `{ investment: null }` na zapisanej stracie; napisany czerwony (potwierdzone), zielony po
      naprawie. Motywujący przypadek fazy 0 (`{ invoice: 5 }`) dalej przechodzi.

- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/hooks/transfers/validate.ts:133` · poszerzony
      fallback każe `needsExpenseCategory` czytać inwestycję ze _stanu zapisanego_, więc legacy
      `CORRECTION` z inwestycją i bez kategorii odrzuciłby PATCH samej faktury. Zapytanie na
      lokalnej kopii produkcji (docker 5433, restore z dumpa): **0 takich wierszy**. Nie ma kogo
      zepsuć. (Nie odpytuję Neona — to reguła projektu.)

- [x] fixed · module-cohesion + structure-scatter (zbieżnie) · `src/lib/kosztorys/summary-economics.ts:107`
      → `src/lib/db/gross-balance.ts` · `grossBalance` nie nazywał żadnego pojęcia z kosztorysu, miał
      jednego konsumenta (listing) i brał te same człony co `calculateBalance` — a EX-675 rozjechał
      przez to jedną regułę („strata jest face value na obu płaszczyznach") na dwa katalogi w dwóch
      warstwach. Teraz leży obok `calculate-balance.ts`; guard VAT przeniesiony do lustra
      `src/__tests__/lib/db/gross-balance.test.ts`.

- [x] 🟡 WARNING · fixed · impl-review · `summary-panel-content.tsx:71` ·
      `tabs/summary-overview-tab.tsx:45` · `lossAmount?: number = 0` przy wymaganym sąsiedzie
      `rabatAmount: number` — trzeci host panelu kompilowałby się czysto, po cichu nie odejmując
      straty. To jest dokładnie ten dryf trzech mechanizmów, który plan nazywa głównym ryzykiem.
      Prop wymagany; oba hosty i tak go podawały (typecheck czysty).

- [x] skipped · impl-review · `src/lib/kosztorys/summary-economics.ts` · ten sam argument dla
      domyślnego `loss = 0` w `computeDoZaplatyRM` / `computeMixedSettlement` — ale to ostatni
      parametr pozycyjny z 35 miejscami wywołania, więc wymuszenie go dopisuje `, 0` w kilkunastu
      specach bez zysku: obie funkcje są wołane wyłącznie z komponentów, które właśnie uszczelniono.

- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/investments/financial-stats.tsx:24`
      · routing kafelków kredyt/koszt idzie po stringu etykiety, więc kategoria wydatku nazwana
      dokładnie „Strata" trafiłaby do zielonego wiersza i chowałaby się razem z kafelkiem straty.
      Mechanizm sprzed tej zmiany (`Wpłaty`, `Rabat netto` niosły go tak samo), a plik sam opisuje
      ten kompromis. Odnotowane, bo ta zmiana dokłada najbardziej kolizyjną nazwę.

- [x] 🔵 OBSERVATION · fixed · impl-review + code-review (zbieżnie) · `AGENTS.md` ·
      `context/foundation/investment-financials-and-discount.md:115,128` · oba dokumenty twierdziły
      dokładnie odwrotność tego, co weszło: inwestycja „opcjonalna", „nigdy nie rusza bilansu",
      „`LOSS` celowo trzymany poza `buildFinancialFields`". Poprawione wraz z regułą face value.

- [x] filed · impl-review · `e2e/` · brak jakiegokolwiek spec-a Playwrighta dotykającego straty, a
      zmiana jest przeglądowa na trzech powierzchniach (listing / v1 / v2 + podgląd klienta).
      Zgłoszone jako **EX-684** z etykietą `e2e-backlog`, ze scenariuszami i ryzykiem trzech
      mechanizmów. (E2E nie odpalam — pełny przebieg to ~1h i wymaga wyraźnej prośby.)

- [x] filed · module-cohesion + structure-scatter · `src/lib/db/map-category-costs.ts` ·
      `src/lib/kosztorys/summary-economics.ts:215-260` · dwa moduły-worki sprzed tej zmiany:
      trzy rodzaje eksportów w pliku kształtującym widok wewnątrz warstwy danych, oraz polityka
      klasyfikacji wpłat doklejona do arytmetyki rozliczenia. Zgłoszone jako **EX-685** —
      wieloplikowy refaktor, za duży na tę bramkę i bez związku ze stratą.

- [x] 🔵 OBSERVATION · filed · impl-review · `src/components/kosztorys/summary/settlement-groups.ts:32`
      · podpowiedź „Koszt, którego firma nie przerzuciła na klienta" trafia też do podglądu klienta,
      czyli klient czyta wewnętrzne sformułowanie firmy. To decyzja biznesowa, nie techniczna —
      dopisana jako pytanie do właściciela w `manual-checks.md` §EX-675.

- [x] dropped · structure-scatter · `src/hooks/` · dwie niepowiązane rzeczy pod jedną nazwą (hooki
      Reacta w korzeniu, hooki kolekcji Payloada w `transfers/`, plus dwa pliki-sieroty w korzeniu).
      Sprzed tej zmiany, 5 plików, edycja slice'a trafiła do właściwego — za mała dźwignia.

- [x] dropped · comment-noise · `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx:44`
      · klauzula pozycyjna („the deduction step between the wpłaty and the closing figure")
      powtarza to, co widać w `buildSettlementGroups`; nośna jest tylko druga połowa („Face value on
      both axes"). Kosmetyka nieprzekraczająca progu zmiany.

- [x] dismissed · comment-noise · `src/lib/kosztorys/types.ts:161`,
      `src/components/kosztorys/summary/summary-panel-content.tsx:68`,
      `src/components/investments/investment-summary-panel.tsx:79` · to samo uzasadnienie (prop poza
      bramką `financials`) trzy razy wzdłuż łańcucha propsów. Każde z osobna przechodzi STRIP TEST, a
      bramka jest widoczna tylko w panelu — powtórzenie jest tu celowe, nie szum.

- [x] dismissed · comment-noise · `src/components/kosztorys/summary/settlement-groups.ts:25` ·
      ogon nagłówka `lossRows` opisuje `if (lossAmount === 0) return []`, ale niesie powód
      („investment with no strata says nothing"), którego kod nie mówi. Zostaje.

- [x] dismissed · tailwind-v4 · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:173,287`
      · `h-[calc(100dvh-…)]` i `style={{ left: guideX }}` — obie poza tym diffem i obie poprawne:
      żaden token nie przechodzi przez nawiasy, a offset guide'a liczy się per klatkę.

- [x] fixed · simplify · `src/components/kosztorys/summary/tabs/summary-margin-tab.tsx:20` ·
      podpowiedź straty w zakładce Marża została na definicji sprzed EX-675 („Koszt pokrywany przez
      firmę."), więc dwie zakładki tego samego panelu tłumaczyły stratę inaczej i jedna z nich była
      już nieprawdziwa. Dopisany skutek dla bilansu.

- [x] fixed · simplify · `src/lib/db/map-category-costs.ts:137-154` · trzecia kopia tego samego
      spreadu „kafelek kredytowy, o ile ≠ 0" (rabat / obniżka materiałów / strata). Jeden pomocnik
      `creditFields([...])`; czwarta koncesja dopisuje się teraz w jednym miejscu.

- [x] fixed · simplify · `src/hooks/transfers/validate.ts:40` · `stored()` nazwane od gałęzi, którą
      wybiera rzadziej — zwraca wartość przychodzącą, gdy klucz jest obecny. Zmienione na
      `resolved()`. Przy okazji dopisany powód, dla którego kwoty zostają na `??`: pole pieniężne nie
      ma stanu „wyczyszczone", więc jawny null to brak do uzupełnienia, nie kasowanie.

- [x] fixed · simplify · `src/lib/db/gross-balance.ts:6` · nagłówek uzasadniał przeniesienie zdaniem
      „obie połowy reguły czytają się w jednym miejscu", czego rozdział na dwa pliki akurat nie daje.
      Uzasadnienie zamienione na prawdziwe: funkcja bierze człony `calculateBalance` i nie nazywa
      żadnego pojęcia kosztorysowego.

- [x] fixed · simplify · `context/foundation/investment-financials-and-discount.md:127` · dokument
      dalej mówił o „fioletowej Stracie w tym samym wierszu kredytów", a samodzielny fioletowy blok
      został usunięty — kafelek jedzie teraz przez `incomeRow` z `border-chart-green`.

- [x] dismissed · simplify · `src/components/kosztorys/summary/settlement-groups.ts:92,107` ·
      podpowiedź składana z fragmentu zależnego od danych (`'wpłaty netto i stratę'`). Rozpisanie obu
      wariantów w całości podwaja tekst, a wariant bez straty to najczęstszy przypadek — splice
      zostaje.

- [x] dropped · simplify · `src/components/kosztorys/summary/settlement-groups.ts:27` ·
      `lossRows(lossAmount, span)` z nienazwanym boolem. Dwa wywołania w jednym pliku, funkcja
      prywatna — kosmetyka poniżej progu zmiany.

- [x] dismissed · simplify · `src/lib/kosztorys/types.ts:164` · `investmentLoss` / `lossAmount` /
      `totalLoss` na trzech warstwach. Dokładna kalka istniejącego łańcucha rabatu — zmiana jest
      zgodna z sąsiadem, a nie nowatorska; ujednolicanie to osobny refaktor.

- [x] dismissed · simplify · `/raporty` · stare straty bez inwestycji dalej wchodzą do raportu
      globalnego jako kafelek podnoszący bilans. Wymóg inwestycji pilnuje tylko nowych wierszy;
      zapytanie na lokalnej kopii produkcji pokazało **0 takich wierszy** (patrz ustalenie wyżej).

## Simplify pass

Dwa przebiegi `/simplify` (reuse+efficiency, simplification+altitude) — 5 naprawionych,
3 odrzucone jako celowe, 1 porzucona kosmetyka, 1 pominięta (pozycyjne `loss` w
`summary-economics.ts`, patrz ustalenie wyżej). Wszystkie wpisane wyżej w `## Findings`
z tagiem `simplify`; osobnej listy nie ma.

## Tests & suite

- `pnpm typecheck` — czysto poza trzema błędami `importMap.js` sprzed tej zmiany (plik generowany, gitignore).
- `pnpm lint` — 0 błędów, 79 ostrzeżeń, wszystkie sprzed tej zmiany.
- `pnpm test` — 2154 zielone, 105 pominiętych (specy DB idą osobno).
- `pnpm test:integration` — 102 zielone (33 pliki, baza 5435).
- `pnpm test:parity` — 3 zielone. Za pierwszym razem czerwone na podłodze zbioru
  (`0 kosztorysItems`): `db-test` był świeżo po `db:import:test` z pustym kosztorysem, więc
  zgodnie z AGENTS.md dosiany `pnpm seed:kosztorys:test`.
- `pnpm build` — przechodzi.
- E2E: **nie odpalane** (pełny przebieg ~1h, wymaga wyraźnej prośby); brakujący spec zgłoszony jako
  **EX-684** z etykietą `e2e-backlog`.
