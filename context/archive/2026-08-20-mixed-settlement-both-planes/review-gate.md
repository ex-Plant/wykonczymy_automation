# Review-gate ledger — mixed-settlement-both-planes · 2026-08-23

Zakres: `0c49c46c..HEAD` (spike `c7b62b64` + fazy 1–6), 61 plików źródłowych.
Folder changeu jest już w `context/archive/` (zarchiwizowany w tej samej sesji, commit `4f24faa7`),
więc ledger stoi tam, a nie w `context/changes/`.

Bramka jednostkowa/integracyjna/parity/build przebiegła przed bramką przeglądową — wynik
w `change.md`, sekcja „Zapis z domknięcia".

Krok 0.5 (przebieg weryfikacyjny w przeglądarce) **odpadł**: skill `verify-manual-checks` nie jest
zainstalowany. Ręczne checki changeu (7 pozycji w `change.md`) zostają nieodhaczone — od 2026-07-28
nie blokują `Done`.

## Findings

<!-- Format: [box] · [severity — tylko checki szukające błędów] · dyspozycja · `source` · `plik:linia` · co — dlaczego -->

- [x] 🔴 CRITICAL · fixed · impl-review+code-review · `src/components/forms/deposit-form/deposit-form.tsx:65` + `src/components/forms/expense-form/expense-schema.ts:53` · wpłata typu innego niż od inwestora, opłacona przelewem, była nie do zapisania: `planeFor` ustawiał `GROSS` dla każdego typu, a pole „Kwota brutto" renderuje się tylko dla wpłaty od inwestora — błąd lądował na polu, którego nie ma na ekranie, więc „Zapisz" milczał. Fix: `planeFor(type, paymentMethod)` + zawężenie gałęzi schematu do `INVESTOR_DEPOSIT`
      test: test-driven-debugging · unit — `src/__tests__/transfer-schema.test.ts`, czerwony na `OTHER_DEPOSIT`/`COMPANY_FUNDING`, kontrola na wpłacie od inwestora trzyma wymóg obu kwot
- [x] 🔴 CRITICAL · fixed · code-review · `src/components/forms/form-fields/plane-amount-field.tsx:22` · wznowiony szkic nadpisywał ręcznie wpisaną kwotę netto z faktury — zapadka `useRef` żyła tyle co montowanie. Fix: własność kwoty czytana z wartości (`netSuggestion`), nie zatrzaskiwana na keystroke
      test: TDD · unit — `src/__tests__/components/forms/form-fields/plane-amount-field.test.ts`, decyzja „sugerować czy nie" jako czysta funkcja
- [x] 🟡 WARNING · fixed · code-review · `src/__tests__/investment-render-parity-db.test.ts:191` · oracle bilansu liczył przez `totalIncome` (przelew brutto + `COMPANY_FUNDING`/`OTHER_DEPOSIT`), a listing czyta `paid.net` — 230 zł rozjazdu na każdą wpłatę brutto. Oracle przepięty na `computeAmountDue` + `depositPairFromPlaneSums`
      test: test-driven-debugging · integration — sam parity jest strażnikiem; podłoga zbioru osobno w EX-725
- [x] 🟡 WARNING · fixed · code-review · `src/lib/queries/investment-transactions.ts:66` · kształt wiersza urósł o `netAmount`, klucz cache został stary — wpis z poprzedniego builda deserializował się bez `netAmount`. Klucz podbity do `deposit-transactions-v2`, zgodnie z `deposit-plane-sums-v2` po stronie listingu
      test: no automated test — `unstable_cache` po stronie Next, klucz jest jednolinijkowym kontraktem; regresja widoczna tylko przez podmianę builda
- [x] 🟡 WARNING · filed EX-724 · code-review · `src/components/tables/investments.tsx:104` · „Bilans brutto v2" pomija każdą nieotagowaną wpłatę legacy bez znacznika — panel to sygnalizuje (`strandsDeposit`), listing nie. Wymaga przewleczenia liczby osieroconych wpłat przez SQL → shape → typy, więc nie mieści się w bramce
      test: no automated test przy zgłoszeniu — dyspozycja zapisana w issue
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/kosztorys/deposit-planes.ts:83` · `sumDeposits` — jedyna z czwórki funkcji kontraktu fazy 1 bez testu, a to ona renderuje pieniądze w panelu. Dopisany blok w `deposit-planes.test.ts` (kubełkowanie + most legacy razem)
- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/lib/queries/shape-investments.test.ts:572` · strażnik „jedna kolumna na tryb" przepisywał ciało `settlesOn` zamiast go wołać — asercja przechodziła z definicji. Test zawężony do tego, co `shapeInvestments` faktycznie posiada (przeniesienie trybu); tabelę rzutowania pilnuje `settlement-mode.test.ts`
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/kosztorys/format.ts:7` · `formatNet` przepisywał `roundToCents` co do znaku — teraz przez `roundToCents`
- [x] 🔵 · fixed · code-review · `src/components/forms/form-fields/plane-amount-field.tsx:27` · ta sama zapadka w drugą stronę: raz podniesiona nie opadała, więc po „zapisz i dodaj kolejną" żaden kolejny przelew nie dostawał sugestii — zamknięte tym samym fiksem
- [x] 🔵 · fixed · impl-review · `src/lib/queries/shape-investments.ts:26` · domyślne `= {}` na parametrach 3 i 4 nieosiągalne (piąty wymagany) — skasowane
- [x] 🔵 · filed EX-725 · impl-review · `src/__tests__/investment-render-parity-db.test.ts` · w `db-test` wszystkie 221 wierszy `INVESTOR_DEPOSIT` mają `vat_plane IS NULL` — przelewowa połowa modelu nie jest pilnowana przez żadną bramkę. Dotyka kontraktu `db:import:test` + `seed:kosztorys:test`
      test: unit/integration — dyspozycja zapisana w issue
- [x] 🔵 · fixed · impl-review · `src/__tests__/components/kosztorys/summary/settlement-groups.test.ts:83` · „krok straty pod wpłatami w każdym trybie" asertowane na jednej osi — test pętli teraz po obu
- [x] 🔵 · fixed · impl-review · `src/lib/kosztorys/deposit-planes.ts:29,31,33,81` · cztery komentarze po polsku — przetłumaczone
- [x] 🔵 · fixed · code-review · `src/lib/kosztorys/deposit-planes.ts:146` · `settledPlaneAmount` bez konsumenta produkcyjnego — skasowane
- [x] 🔵 · fixed · code-review · `src/components/kosztorys/summary/tables/summary-breakdown-table.tsx:60` · `span={net === gross}` zawsze prawdziwe; oś panelu nigdy nie jest `'both'`, a `materialsPair = faceValue(...)`. Cała zdolność `span` skasowana (`summary-row.tsx`, `summary-totals-table.tsx`, `settlement-groups.ts`)
- [x] 🔵 · fixed · code-review · `src/components/tables/investments.tsx:94,105` · sortowanie po ukrytej liczbie w kolumnie pokazującej „nie dotyczy"/„brak danych" — obie kolumny na `col.accessor` + `sortUndefined: 'last'`, wzorem `marginV2`
- [x] fixed · suite · `src/components/tables/investments.tsx:58` · helper dołożony w tej bramce nazwany `bilansOrUndefined` — polski rdzeń z angielskim afiksem, zbity przez `local/no-domain-drift` w pre-commicie; przezwany na `balanceOrUndefined`
- [x] 🔵 · dismissed · code-review · `src/lib/db/kosztorys-tree.ts:115` · `String(row.settlement_mode)` bez fallbacku — kolumna jest `NOT NULL DEFAULT 'NET'` (migracja `20260726_3`), więc `'null'` nie powstanie

- [x] fixed · structure-scatter · `src/lib/kosztorys/calc.ts:81` · przejście brutto→netto miało cztery domy i żadnej reguły — `x / (1 + rate)` przepisane trzy razy. Wszystkie trzy wołają teraz `toNet` (`net-gross-amounts.ts`, `deposit-planes.ts` legacyNet, `summary-economics.ts`)
- [x] fixed · feature-first · `src/lib/utils/net-gross-amounts.ts` · warstwa „utils bez wiedzy domenowej" importowała `@/lib/kosztorys/calc` — moduł przeniesiony do `src/lib/kosztorys/`, spec za nim
- [x] fixed · module-cohesion · `net-gross-amounts.ts:11` · `grossFromNet` bez konsumenta produkcyjnego — skasowane razem ze swoim describe
- [x] fixed · module-cohesion · `src/lib/kosztorys/deposit-planes.ts:155` · `NO_DEPOSITS` bez konsumenta, a jego doc twierdził, że tak czyta wiersz nieobecny na listingu (listing sięga po `NO_DEPOSIT_SUMS`) — skasowane
- [x] fixed · module-cohesion · `src/components/kosztorys/summary/tables/deposits-table.tsx:87` · predykat planu przepisany inline — teraz `isGross` z `deposit-planes.ts` na obu powierzchniach
- [x] skipped · module-cohesion · `src/lib/kosztorys/deposit-planes.ts` · dwa powody do zmiany w jednym module (arytmetyka planów vs polityka rozjazdu z trybem) — podział to refactor wart osobnego review, a oba predykaty (`isOffPlaneDeposit` / `strandsDeposit`) odpowiadają dziś na różne pytania i są tak udokumentowane
- [x] filed EX-726 · structure-scatter · `src/components/forms/expense-form/expense-schema.ts:44` · walidacja formularza wpłaty mieszka w schemacie formularza wydatku — to od dawna wspólny schemat tworzenia transakcji, źle nazwany i źle umieszczony. Zastane, nie wprowadzone przez ten change
- [x] dismissed · feature-first · `src/components/forms/form-fields/plane-amount-field.tsx:22` · „pole z jednym konsumentem od razu w warstwie współdzielonej" — siedzi wśród innych pól formularzy transakcji (`payment-method-field.tsx` obok), więc to jest jego dom, nie awans na zapas
- [x] dismissed · module-cohesion · `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx:145` · „ręcznie odtworzona głowica `CollapsibleSection`" — głowica prymitywu to `Collapsible.Trigger` (button), a tytuł tej sekcji to `<Link>`; `<a>` w `<button>` jest nieprawidłowe, więc współdzielenie byłoby rozwidleniem sterowanym propsem, nie dedupem
- [x] dropped · structure-scatter · copy po polsku o trybie rozliczenia / planie wpłaty w czterech domach · scalanie copy między `investor-impact.ts`, `constants/transfers.ts` i dwiema powierzchniami UI to churn bez zysku — każda z nich mówi to samo innym głosem (ostrzeżenie, etykieta filtra, nagłówek kolumny)

- [x] dismissed · tailwind-v4-audit · cały diff (15 plików `.tsx`) · zero nowych wzorców pre-v4 — grupy A (`bg-[var(--x)]`) i C (wartości w nawiasach) puste; regex zwalidowany na całym `src` (88 trafień repo-wide), więc zero jest prawdziwe
- [x] dropped · tailwind-v4-audit · `src/components/tables/transfers.tsx:50` · token składany z runtime stringu omija utility — linia sprzed changeu, decyzja udokumentowana w `constants/transfers.ts:255`
- [x] dropped · tailwind-v4-audit · `src/components/ui/pie-legend.tsx:23` · swatch malowany `style={{ backgroundColor }}` — poza diffem, fix to przewleczenie `swatchClass` przez wszystkie buildery `chart-slices.ts`
- [x] dropped · tailwind-v4-audit · `eslint.config.mjs` · brak pluginu ESLint świadomego Tailwinda — poza zakresem changeu, nie mnożę backlogu

- [x] fixed · comment-noise · `src/lib/kosztorys/summary-economics.ts:100` · klauzula o „wpłata brutto de-grossed" opisywała model SPRZED spike'u — przepisana na obecny (każdy plan odejmuje kwoty, które wpłaty naprawdę niosą)
- [x] fixed · comment-noise · `src/lib/kosztorys/deposit-planes.ts:81` · „Read, never derived" zaprzeczone przez most `legacyNet` — komentarze pól `DepositPlaneSumsT` przepisane na to, co każdy plan faktycznie zawiera
- [x] fixed · comment-noise · `src/lib/constants/transfers.ts:445` · ogon o `carriesNetAmount` nie składał się w twierdzenie — przepisany
- [x] fixed · comment-noise · `src/components/kosztorys/summary/tabs/summary-deposits-tab.tsx:18` · „folded below…" zdezaktualizowane w tym samym diffie
- [x] fixed · comment-noise · `src/components/kosztorys/summary/tables/summary-breakdown-table.tsx:13` · zdanie o rozjeździe w trybie mieszanym opisywało gałąź nieosiągalną — skasowane razem z `span`
- [x] fixed · comment-noise · `src/components/kosztorys/summary/blocks/settlement-summary.tsx:36` · restatement propsa
- [x] fixed · comment-noise · `src/components/forms/deposit-form/deposit-form.tsx:179` · `{/* Type */}` — czysty marker sekcji
- [x] fixed · comment-noise · `src/components/forms/form-fields/plane-amount-field.tsx:10` · restatement dwuelementowej unii
- [x] fixed · comment-noise · `src/components/forms/form-fields/payment-method-field.tsx:7` · restatement następnej linii
- [x] fixed · comment-noise · `src/__tests__/lib/kosztorys/summary-economics.test.ts:349` · komentarz powtarzał tytuł `it`
- [x] fixed · comment-noise · `src/__tests__/lib/kosztorys/deposit-planes.test.ts:100` · pierwsze zdanie powtarzało tytuł `it`
- [x] fixed · comment-noise · `src/__tests__/lib/kosztorys/deposit-planes.test.ts:139` · komentarz czytał oba `expect` na głos
- [x] fixed · comment-noise · `src/__tests__/lib/queries/shape-investments.test.ts:19` · vanished-state („wpłaty now arrive as their own map")
- [x] fixed · comment-noise · `src/__tests__/lib/queries/shape-investments.test.ts:521` · kolor historyczny („ran for three days")
- [x] fixed · comment-noise · `src/__tests__/lib/queries/shape-investments.test.ts:535` · komentarz po polsku — przetłumaczony
- [x] fixed · comment-noise · `src/__tests__/investment-render-parity-db.test.ts:122` · j.w.; ostrzeżenie o oracle zostawione
- [x] fixed · comment-noise · `src/__tests__/validate-hook.test.ts:364` · baner sekcji z ogonem, gdy reszta banerów w pliku to gołe etykiety
- [x] fixed · comment-noise · `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx:136` · narratorstwo o `SlicePie` przepisane na powód (obie ćwiartki na płaszczyźnie netto; udział z dwóch planów nie jest udziałem)
- [x] dismissed · comment-noise · `src/components/forms/deposit-form/deposit-form.tsx:63` · „Nothing else sets `vatPlane` any more." — vanished-state, ale linia zniknęła już przy fiksie CRITICAL #1

- [x] filed EX-723 · gate · e2e · gotówka na inwestycji rozliczanej brutto: ostrzeżenie → „Zapisz mimo to" → czerwony wiersz w panelu. Ścieżka przechodzi wszystkie granice naraz i nie ma strażnika end-to-end; issue w projekcie „Wykonczymy" z etykietą `e2e-backlog`

## Simplify pass

Uruchomiony `/simplify` — wszystkie ustalenia nadające się do fiksu zastosowane seryjnie po fan-oucie;
nic nie zostało wstrzymane jako „proposed". Ustalenia wpięte w `## Findings` powyżej (tagi
`comment-noise` / `module-cohesion` / `feature-first` / `structure-scatter`), bez drugiej listy.

## Tests & suite

- `npx tsc --noEmit` — zielone (po każdej partii fiksów)
- `pnpm test` — 185 plików zielonych, 43 pominięte
- `pnpm test:integration` — 41 plików / 140 testów zielone
- `pnpm test:parity` — zielone
- `pnpm build` — zielone
- `pnpm lint` — 2 błędy spoza changeu: `test.js:255` (`no-undef`, plik w `.gitignore`) i
  `src/hooks/use-latest-request.ts:15` (`Cannot access refs during render`, wniesione commitem `8e47fb80`)
- E2E — nie uruchamiane (zasada: nigdy bez wyraźnego polecenia); dług zapisany jako EX-723

Ręczne checki (7 pozycji w `change.md`) — nieodhaczone. Od 2026-07-28 nie blokują `Done`.
