# Review-gate ledger — 2026-08-28-investment-lock-on-completed (EX-748) · 2026-09-03

Scope: commits `2f3bbfdb`, `39eaea4b`, `28fc91f7`, `9e8542d8`, `678e7192`, `cdee7a10` on `staging`
(52 files). `3d080307` (worker-payouts-on-employee-card) is interleaved in the range but belongs to
another agent — excluded.

Step 0.5 (verification pass) skipped: no `verify-manual-checks` skill installed, and the browser is
not driven unprompted. Manual verification is tracked in `context/foundation/manual-checks.md`
§ EX-748.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` — all seven applied.

## Findings

- [x] 🔴 CRITICAL · fixed · `impl-review`+`code-review` · `src/lib/actions/investments.ts:201` · `payload.update` przekazuje ani `user`, ani `req`, więc `createLocalReq` ustawia `req.user = null` i `guardInvestmentStatusUnlock` odrzuca odblokowanie dla KAŻDEJ roli — właściciela i admina też. Zamek jest nieodwracalny z poziomu aplikacji; jedyne wyjście to `/admin`.
      test: test-driven-debugging · integration — spec na akcji, asercja na utrwalonym statusie (spec jednostkowy hookowi wstrzykuje `req.user`, więc konstrukcyjnie tego nie widzi)
- [x] 🔴 CRITICAL · fixed · `impl-review` · `src/lib/actions/kosztorys-import.ts:236` · `compareWithSheet` jest w planie opisane jako odczyt, ale woła `setSheetMeasuredQty` (`UPDATE kosztorys_items` + `UPDATE investments`). Nie przechodzi przez `investmentAction`, a `kosztorys-actions-menu.tsx` zostawia „Porównaj z arkuszem" w menu zablokowanego edytora pod komentarzem twierdzącym, że ocalałe pozycje „tylko czytają".
      test: test-driven-debugging · integration — dopisane do `kosztorys-lock.test.ts`
- [x] 🟡 WARNING · fixed · `code-review` · `src/collections/transfers.ts:75` · Usunięcie transakcji omija zamek — bramka siedzi w `validateTransfer` (`beforeValidate`), którego Payload nie odpala na delete, a `beforeDelete` nie ma. ADMIN/OWNER kasuje z `/admin` transakcję zakończonej inwestycji, a `recalcAfterDelete` + `syncSheetAfterDelete` zmieniają bilans i arkusz.
      test: test-driven-debugging · unit — spec na nowym hooku
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/utils/resolve-id.ts:2` i `src/access/investment-lock.ts:22` · Oba resolvery zwracają `undefined` dla relacji przysłanej jako **string** i failują OPEN: nierozwiązane id znaczy „żadna inwestycja nie tknięta", więc bramka nie odpala. `PATCH /api/transactions/123 {"investment":"99"}` wchodzi na zablokowaną inwestycję.
      test: TDD · unit — `resolveId` na stringu numerycznym
- [x] 🟡 WARNING · fixed · `impl-review` · `src/lib/actions/work-catalogue.ts:132` · `insertCatalogueItemsAction` dopisuje pozycje katalogowe do sekcji przez `protectedAction`, z pominięciem bramki.
      test: test-driven-debugging · integration — dopisane do `kosztorys-lock.test.ts`
- [x] 🟡 WARNING · fixed · `impl-review` · `src/lib/actions/investment-action.ts:44` · Wrapper zwraca „Pozycja nie istnieje." bez `code: 'NOT_FOUND'`, więc edytor przestaje przesiewać nieaktualne drzewo (`use-stale-tree-recovery`) i zostaje z martwym toastem.
      test: TDD · unit — dopisane do `investment-action.test.ts`
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/actions/sheets.ts:268` · `deleteSheetAction` jest jedyną mutacją arkusza bez bramki, choć jego rodzeństwo `unlinkSheetFromInvestmentAction` dostało ręczny check dokładnie z tego powodu.
      test: no automated test · — bramka wydzielona do wspólnego `lockedSheetError`, więc obie akcje idą tą samą, przetestowaną gałęzią
- [x] 🟡 WARNING · fixed · `impl-review`+`code-review` · `src/access/investment-lock.ts` · Bramka `/admin` nie ma ani jednego testu i failuje OPEN w dwóch miejscach; `payload.findByID` leci bez `args.req` (czyta poza transakcją) i jego `NotFound` nie jest łapany.
      test: TDD · unit — nowy spec na obu fabrykach
- [x] 🟡 WARNING · fixed · `impl-review` · `src/hooks/investments/guard-status-unlock.ts:27` · Goły `Error` zamiast `APIError` → 500 w `/admin` i REST zamiast 403 z czytelnym komunikatem.
      test: no automated test · — istniejący spec asertuje treść komunikatu; typ błędu to kwestia transportu
- [x] 🔵 OBSERVATION · fixed · `impl-review`+`code-review` · `src/lib/actions/investment-action.ts:43` · Dwa seryjne round-tripy (`investmentIdFor`, potem `isInvestmentLocked`) na najgorętszym zapisie edytora, mnożone przez liczbę komórek w `Promise.all`. Jedno zapytanie z JOIN-em wystarczy.
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/components/kosztorys/editor/use-kosztorys-editor.ts:1146` · Komentarz nazywa `if (preview) return` „przełącznikiem awaryjnym zapisu", ale warunku nie poszerzono o `locked`. Faktycznym bezpiecznikiem jest `disabled: true` w `buildV2Columns` — komentarz obiecuje więcej, niż linia trzyma.
- [x] fixed · `feature-first`+`scatter` · `src/__tests__/collections/investments-status-lock.test.ts` · Spec importuje `@/hooks/investments/guard-status-unlock`, a leży w mirrorze `collections/` — łamie regułę „nigdy pod mirrorem katalogu, który nie jest źródłem".
- [x] fixed · `feature-first`+`scatter` · `src/__tests__/components/kosztorys/editor/editor-lock.test.ts` · Mirror o jeden katalog za płytki — podmiot to `editor/grid/kosztorys-v2-columns`, gdzie leży dziesięć rodzeństwa.
- [x] fixed · `comment-noise` · `src/__tests__/components/kosztorys/editor/editor-lock.test.ts:32` · Komentarz powtarza tytuły dwóch testów pod nim.
- [x] fixed · `comment-noise` · `src/access/investment-lock.ts:15` · Pierwsze zdanie powtarza literał unii w linijce niżej.
- [x] fixed · `comment-noise` · `src/components/kosztorys/editor/use-kosztorys-editor.ts:380` · Pierwsze zdanie powtarza `readOnly ? undefined : handler` i dubluje uzasadnienie sprzed 230 linii.
- [x] fixed · `comment-noise` · `src/lib/actions/investment-action.ts:11` i `src/access/investment-lock.ts:6` · Dwa poprawne bloki JSDoc przypięte do złego symbolu — hover pokazuje je na typie, nie na funkcji, którą opisują.
- [x] skipped · `module-cohesion` · `src/hooks/transfers/validate.ts:64` · Bramka blokady wspawana w walidator kształtu pól: hook zrobił się `async`, wciągnął zależność od `lib/db` i ma teraz dwa powody do zmiany. Wydzielenie do osobnego `beforeValidate` jest słuszne, ale to refaktor wart własnego review — a w tym samym pliku ląduje właśnie poprawka krytyczna.
- [x] dropped · `code-review` · `src/lib/actions/investment-action.ts:35` · TOCTOU: status czytany poza transakcją handlera. Aplikacja ma pięciu użytkowników i dwie zakładki naraz to scenariusz teoretyczny — koszt przeniesienia checku do transakcji przewyższa ryzyko.
- [x] dropped · `tailwind` · `src/components/tables/transfers.tsx:51` · Inline `style={{ color: 'var(--color-…)' }}` zamiast literalnej mapy klas. Zastane, poza tematem slice'a, działa.
- [x] dropped · `tailwind` · `eslint.config.mjs` · Brak wtyczki ESLint świadomej Tailwinda — luka narzędziowa całego repo, nie tego slice'a.
- [x] filed · `10x-e2e` · E2E slice'a nierozliczone: brak specu w `e2e/`. Zgłoszone jako **EX-769** (label `e2e-backlog`, projekt Wykonczymy) — scenariusz spina trzy bramki w jedno przejście, czego żaden spec jednostkowy nie robi.
- [x] filed · `simplify`/`altitude` · `src/collections/sheets.ts:30` · Bramka `/admin` objęła cztery kolekcje kosztorysu, ale nie piątą — `kosztoryses`. MANAGER przepnie albo wyczyści `investment` na wierszu arkusza zakończonej inwestycji. Nie naprawione tutaj: FK `investment` jest nullable, więc gotowe `not_equals: 'completed'` odsiałoby również każdy arkusz **bez** inwestycji. Zgłoszone jako **EX-770**.
- [x] fixed · `simplify` · `src/lib/db/investment-lock.ts` · `investmentIdFor` + `isInvestmentLocked` to były dwa seryjne round-tripy; `lockStatusFor` zwraca właściciela i stan zamka jednym JOIN-em. `investmentIdFor` usunięty, cztery zapytania mniej na ścieżce zapisu edytora.
- [x] fixed · `reuse-scan` · `src/lib/db/investment-lock.ts` · Trzy kopie „rozwiąż relację → sprawdź zamek" (`validate.ts`, `sheets.ts`, `access/investment-lock.ts`) zwinięte w `isRelatedInvestmentLocked`.
- [x] fixed · `reuse-scan` · `src/lib/constants/investment-lock.ts` · Sześć literałów `'completed'` rozsianych po db/access/hookach/stronie/formularzu przepuszczonych przez `isLockedStatus` / `isBookableInvestment`.
- [x] fixed · `simplify` · `src/hooks/transfers/validate.ts:64` · Set + type-guard + pętla po dwóch id zastąpione dwuelementową listą; przy okazji goły `Error` → `APIError(…, 403)`, bo `routeError` przepisuje komunikat, którego nie umie uznać za publiczny.
- [x] fixed · `simplify` · `src/access/investment-lock.ts` · `CreateOwnerT` z unii obiektów (`{ field: 'item'; via: 'kosztorys-items' }`) na `'investment' | 'item'` — `via` miało jedną możliwą wartość.
- [x] fixed · `efficiency` · `src/components/tables/transfers.tsx:229` · `referenceData.investments.find(…)` wołane w renderze każdej komórki; zamienione na `Set` zbudowany raz w `getTransferColumns`.
- [x] fixed · `reuse-scan` · `src/components/tables/transfers.tsx:51` · Zdanie odmowy wpisane z ręki obok istniejącej stałej — przepięte na `INVESTMENT_LOCKED_MESSAGE`.
- [x] fixed · `simplify` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` · Martwe `locked` w zwrotce hooka (jedyny konsument czyta własny prop).
- [x] skipped · `altitude` · `src/access/investment-lock.ts` · Cztery kolekcje kosztorysu bronią się regułą `access` zwracającą `Where`, więc panel mówi „nie znaleziono" zamiast `INVESTMENT_LOCKED_MESSAGE`. Przepisanie na `beforeChange`/`beforeDelete` dałoby jeden idiom — refaktor wart własnego review, dopisany jako kierunek do **EX-770**.
- [x] skipped · `altitude` · `src/components/kosztorys/editor/toolbar/menus/` · Kontrolki zapisu chowane dwoma konkurencyjnymi idiomami (znikające wpisy vs `disabled`). Ujednolicenie to zmiana UI poza zakresem zamka.
- [x] dismissed · `efficiency` · `src/lib/actions/transfers.ts` · Propozycja skasowania `isTargetInvestmentLocked` i trzech pre-checków jako duplikatu bramki hooka. Pre-check istnieje po to, by odmowa wróciła jako czyste `ActionResult`, a nie jako błąd przepakowany przez `withPayloadTransaction` — intencja stoi w komentarzu obok.
- [x] dropped · `reuse-scan` · trzy formularze filtrujące inwestycje po `isBookableInvestment` · Wspólny selektor `bookableInvestments` oszczędziłby jedną linię na konsumenta.
- [x] dropped · `simplify` · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:330` · `locked` vs `editor.readOnly` w jednym pliku — różnią się o `preview`, więc scalenie zmieniłoby publiczną stronę.
- [x] dropped · `efficiency` · `src/lib/actions/investment-action.ts` · Wciągnięcie predykatu zamka do samego `UPDATE`. Znosi TOCTOU, ale rozlewa bramkę po każdym handlerze zapisu.
- [x] fixed · `suite` · `src/__tests__/lib/actions/investment-action.test.ts:31` · Podwójny mock `lockStatusFor` został na starym kształcie (goły status zamiast `{ investmentId, locked }`), więc `'completed'` przechodziło jako odblokowane i test „refuses a row whose investment is completed" zielenił się na złym powodzie po refaktorze z `/simplify`.
- [x] fixed · `suite` · `src/__tests__/resolve-id.test.ts:27` · Spec asertował stare, dziurawe zachowanie (`resolveId('42') === undefined`) — dokładnie tę lukę, którą slice zamknął. Odwrócony na parsowanie, z osobnym przypadkiem dla stringa nienumerycznego.
- [x] dropped · `efficiency` · `src/access/investment-lock.ts` · Memoizacja odpowiedzi o zamku na `req.context` dla bulk-create. Płaci się przy imporcie, którego zablokowana inwestycja z definicji nie robi.

## Simplify pass

`/simplify` — 8 applied, 2 skipped, 1 dismissed, 4 dropped, 1 filed (EX-770); każdy finding wpięty w `## Findings` (tag `simplify` / `reuse-scan` / `efficiency` / `altitude`). Bez osobnego pliku raportu — ledger jest jedynym zapisem.

## Tests & suite

- `pnpm typecheck` — zielony.
- `pnpm lint` — 4 błędy i 86 ostrzeżeń, wszystkie zastane i poza slice'em (`app/(legal)/*` używa `<a>` zamiast `<Link>`, `test.js` w korzeniu). Żaden plik slice'a nie zgłasza nic.
- `pnpm test` — 3249 passed / 240 skipped, 0 failed. Pierwszy przebieg wywalił dwa specy (oba wpisane wyżej jako findingi `suite`); po poprawkach zielono.
- `pnpm build` — zielony.
- `pnpm test:e2e` — nieuruchamiane; E2E slice'a rozliczone jako **EX-769**.
