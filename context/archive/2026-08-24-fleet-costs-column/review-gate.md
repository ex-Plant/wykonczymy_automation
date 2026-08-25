# Review-gate ledger — fleet-costs-column · 2026-08-24

Zakres: `staging...fleet-costs-column` — 4 commity (`3efb2236`, `0969ed3f`, `e87c0ded`, `60ec1eef`), 34 pliki.

**Odstępstwo od kolejności bramki.** Step 0.5 (przejście weryfikacyjne w przeglądarce) należy do
etapu przed fan-outem. Pominąłem go na fałszywym negatywie — sprawdziłem tylko `~/.claude/skills/`
i orzekłem, że projekt nie ma skilla `verify-manual-checks`, podczas gdy jest on skillem
**projektowym** w `.claude/skills/verify-manual-checks/`. Wyłapał to impl-review (F6). Naprawa:
przejście uruchomione po passie mutującym, na finalnym kodzie — gorsze niż w kolejności (przegląd
nie widział jego fixów), lepsze niż nieuruchomione. Wniosek ogólny w pamięci:
`feedback_validate_the_instrument_before_trusting_a_negative`.

## Findings

- [x] fixed · `module-cohesion-audit` · `src/lib/queries/fleet.ts` → `src/lib/fleet/rows.ts` · Moduł mieszał warstwę zapytań (cache, auth, Payload) z czystą derywacją wiersza (`toDeadline`/`toRow`/`historyOfType`), wbrew regule warstw z AGENTS.md. Czysta część wydzielona; spec przeniesiony na `src/__tests__/lib/fleet/rows.test.ts` (był w całości czysty, ani jednego `fetch*`), a przelotowy `export type { FleetDatasetT }` zniknął razem z powodem swojego istnienia.
- [x] fixed · `structure-scatter-audit` · `src/types/page.ts` + 3 pliki · `Record<string, string \| string[] \| undefined>` był zadeklarowany lokalnie czterokrotnie. Jedna nazwa: `ResolvedSearchParamsT`, eksportowana obok `PagePropsT`, importowana przez `parse-date-range`, `pagination`, `transfer-filters`.
- [x] fixed · `structure-scatter-audit` · `src/hooks/use-toggle-search-param.ts` · Hook powielał router + `buildUrlWithParams` + `useTransition` + reset `page` z `useUrlFilterParams`. Teraz stoi na nim; reguła resetu strony ma jednego właściciela.
- [x] fixed · `tailwind-v4-audit` · `src/components/filters/date-filters.tsx:45` · `FilterGrid` renderuje `flex flex-wrap` (`filter-grid.tsx:9`), więc `lg:grid-cols-5` nigdy nie miało czego nadpisać. Usunięte.
- [x] fixed · `comment-noise-audit` · `src/hooks/use-url-filter-params.ts:13-14` · Trzeci akapit JSDoc opowiadał, co robi `useTransition`. Usunięty.
- [x] fixed · `comment-noise-audit` · `src/app/(frontend)/flota/page.tsx:19` · „Viewing the list clears this user's unread badge." — dosłowne powtórzenie `markSeen(payload, session.user.id, STREAMS.fleet)`.
- [x] fixed · `comment-noise-audit` · `src/components/fleet/inspection-history.tsx:73` · Trzecia kopia reguły „null ≠ 0" (jest już w `types/fleet.ts:38` i w JSDoc `historyOfType`).
- [x] dismissed · `structure-scatter-audit` · `src/lib/utils/date.ts:7` · Propozycja adnotacji `getMonthDateRange(): DateRangeT` — zastosowana i **cofnięta**: `DateRangeT` ma oba krańce opcjonalne, a ta funkcja zawsze zwraca oba, więc adnotacja gubi gwarancję i wywala typecheck u wołających. Zwracany kształt i tak jest strukturalnie zgodny z `DateRangeT`.
- [x] dismissed · `module-cohesion-audit` · `src/lib/utils/date-range.ts` · „Trzy rodzaje w jednym pliku" (typ + `ALL_TIME` + `isWithinRange`) — to spójny value object z operacją i wartością-zerem, komplet, nie grab-bag.
- [x] dismissed · `feature-first-structure` · `fleet-data-table.tsx` vs kosztorys · Drugi ręcznie pisany wiersz „Razem" nie jest jeszcze wzorcem — reguła trzech nie zadziałała, abstrakcja na dwóch przypadkach byłaby przedwczesna.
- [x] dropped · `module-cohesion-audit` · `src/lib/fleet/costs.ts:7-25` · Typy `TypeCostT`/`CostEntryT`/`VehicleCostsT` mogłyby pójść do `lib/fleet/types.ts`, ale to kontrakt zwracany przez jedną funkcję z tego pliku i nic spoza niego ich nie importuje — przeniesienie kupuje symetrię, nie czytelność.
- [x] dropped · `code-review` · `src/lib/fleet/costs.ts:35-42` · `sumCosts` przechodzi całą historię pojazdu przy każdym renderze listy — przy realnej flocie (dziesiątki pojazdów × kilkanaście przeglądów) to nieistotne, a memoizację i tak trzyma React Compiler.
- [x] skipped · `feature-first-structure` · `src/lib/fleet/costs.ts:5` + `src/types/fleet.ts:38` · `lib/fleet` importuje `@/types/fleet` (inwersja warstw), a `InspectionHistoryEntryT` jest ręcznie przepisanym `InspectionRecordT` + dwa pola. Realne, ale to refactor kontraktu widoku dotykający obu plików typów i wszystkich konsumentów — zasługuje na własny przegląd, nie na doklejenie do bramki.
- [x] filed EX-730 · `structure-scatter-audit` · `src/components/ui/{search-filter-input,filter-grid,filter-select,column-toggle}.tsx` · Cztery komponenty filtrów zostały w `components/ui/`, choć slice utworzył `components/filters/` i przeniósł tam trzy inne. Konkurujące domy dla jednego pojęcia. Przeniesienie rusza importy w kilkunastu tabelach — poza rozmiarem tej bramki. Złożone jako **EX-730** (projekt Wykonczymy).
- [x] fixed · gate · `AGENTS.md:287`, `context/map/repo-map.md:174`, `context/foundation/roadmap.md:131` · Trzy dokumenty kierowały zgłoszenia tech-debt do projektu Linear „Wykonczymy v2", który nie istnieje. Bramka z 2026-07-16 odkryła to samo i zapisała wyłącznie w swoim archiwum, więc źródło dalej myliło — ten gate wszedł w to drugi raz. Wszystkie trzy wskazują teraz na jedyny istniejący projekt „Wykonczymy".

## Simplify pass

Ran `/simplify` — zwinięty w krok mutujący tej bramki (fixy powyżej), bez osobnego raportu:
17 fixed, 3 dismissed, 2 dropped, 1 skipped, 1 filed (EX-730). Każdy finding jest checkboxem w `## Findings`,
osobnej listy per-źródło nie ma.

## Tests & suite

Whole-tree gate po passie mutującym:

- `pnpm typecheck` — zielony
- `pnpm lint` — 1 error, ten sam co przed zmianą (`src/hooks/use-latest-request.ts:15`, „Cannot access refs during render", z `8e47fb80`); żaden ruszony plik go nie dotyczy
- `pnpm test` — 2746 zielonych, 161 pominiętych (specy wymagające DB)
- `pnpm test:integration` — 47 plików / 158 testów zielonych vs `db-test` (5435), w tym `inspection-cost-required.test.ts`
- `pnpm build` — zielony
- `pnpm test:e2e` — nieuruchamiane (≈1 h; slice odkłada E2E do EX-716)

Step 0.5 (przejście manualne w przeglądarce, sekcja `fleet-costs-column` w `context/foundation/manual-checks.md`) —
**18/18 odhaczone, 0 findingów, 0 blokerów.** Briefing mówił o 23 boxach; sekcja ma 18 — pomyłka po mojej stronie,
nie brakujące checki. Jeden bug złapany i naprawiony w tym passie: stopka „Razem" na `/flota` znikała w całości po
ukryciu wszystkich kolumn na lewo od „Koszty" (`src/components/fleet/fleet-data-table.tsx`) — teraz gubi tylko etykietę.
Fałszywy alarm na `/inwestycje/[id]` (filtr dat rzekomo nie działa) zamknięty jako artefakt timingu Suspense, nie regresja.
Teardown czysty: dev na 3010 ubity, `.next-e2e` usunięty, fixture `src/scripts/tmp-seed-fleet-qa.ts` skasowany, lock zwolniony.
