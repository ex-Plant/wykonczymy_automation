# Review-gate ledger — kosztorys-decimal-cell-draft · 2026-08-25

Zakres: commity `783514f8`, `d109ddcc`, `fbb6a31f`, `d324351c`, `df7ba6ec`, `6d8e637b` na gałęzi
`heic-upload-gap`. Step 0.5 (przebieg weryfikacyjny w przeglądarce) pominięty — projekt nie ma
skilla `verify-manual-checks`, a checki ręczne czekają na człowieka w
`context/foundation/manual-checks.md`.

Wachlarz: `/10x-impl-review`, `/code-review`, `comment-noise-audit`, `feature-first-structure`,
`module-cohesion-audit` + `structure-scatter-audit`, `primitive-reuse-scan`.
`tailwind-v4-audit` odpadł — slice nie dodał ani nie zmienił żadnej klasy Tailwind.

## Findings

- [x] 🟡 WARNING · filed EX-735 · `code-review` · `src/components/kosztorys/editor/grid/cells/use-cell-draft.ts:45` · komórka odmontowana w trakcie edycji nigdy nie rozstrzyga — odrzucony prefiks zostaje w wierszu i zapisuje się bez toastu
      test: test-driven-debugging · e2e — repro to scroll wirtualizacji przy otwartej edycji; guard jedzie razem z poprawką do issue
- [x] 🟡 WARNING · filed EX-736 · `code-review` · `src/lib/kosztorys/discount-edit.ts:31` · rabat procentowy > 100 daje ujemną wartość netto wiersza; polityka rabatu jako jedyna nie używa slotu `guard`
      test: TDD · unit — próg wpisany do `discountPolicy.guard`; zmienia to, co użytkownik MOŻE zrobić, więc decyzja właściciela, nie auto-fix
- [x] 🟡 WARNING · filed EX-737 · `code-review` · `src/components/kosztorys/editor/use-kosztorys-editor.ts:1035` · Cmd+Z potrafi przywrócić wartość, którą rollback zdjął — okno koalescencji (700 ms) wypycha serię przed wycofaniem
      test: test-driven-debugging · unit — na `undo-coalesce.ts`; poprawka siedzi w koalescencji undo, nie w komórce
- [x] 🔵 OBSERVATION · filed EX-738 · `impl-review` · `plan.md:385-397` · E2E należny i niezapisany — slice jest browser-level
      test: e2e — spec nazwany w planie; do napisania albo do backlogu `e2e-backlog`

- [x] dismissed · `impl-review` (F3) · `cells/use-cell-draft.ts` · „przenieść do `editor/hooks/`" — `feature-first-structure` orzekł przeciwnie i ma mocniejszy argument: `useInlineRename` ma konsumentów w dwóch katalogach, `useCellDraft` trzech w jednym. Zostaje skolokowany, reguła zapisana w AGENTS.md
- [x] dismissed · `cohesion` (Q1) · `cell-edit.ts:106` · `numericFieldPolicy` nie jest obcym bytem w module maszyny — to domyślny element kontraktu (nic nie importuje, generyczny po `Record<K, number>`), w przeciwieństwie do dwóch pozostałych polityk, które ciągną domenę
- [x] dropped · `impl-review` (F8) · `decimal-column.tsx:35` · kolumna przyjmuje politykę z guardem, ale nie renderuje `blockReason` — jedyny wołający (`numericFieldPolicy`) guardu nie ma, a wpięcie dymka to infrastruktura komórek wykonawcy
- [x] dropped · `code-review` (O1) · `decimal-text.ts` · `String(33.333333333333336)` pokazuje ogon float — wraca w tę samą liczbę, a ilości pochodzą z klawiatury, nie z dzielenia
- [x] dropped · `code-review` (O2) · `parse-decimal-input.ts:13` · `Number()` przyjmuje „0x1f", „1e3" i liczby ujemne — sprzed slice'a, wspólne z formularzami, zmiana dotknęłaby czterech innych wołających
- [x] dropped · `reuse-scan` (#7) · `kosztorys-v2-columns.tsx:89` · `keyCol` jest teraz nadmiarowo ogólny (`any` + eslint-disable dla drugiego typu kolumny, który już nie przychodzi) — dwa żywe wołania, zawężenie to czysta kosmetyka
- [x] dropped · `reuse-scan` (#6) · `parse-decimal-input.ts` · scentralizowanie zdejmowania spacji w samym parserze zmieniłoby zachowanie czterech wołających z formularzy („1 2" z `invalid` na 12) — konwencja siatki dostała własny eksport zamiast tego
- [x] dropped · `cohesion`/`reuse-scan` · `src/components/ui/decimal-field.tsx:60` · ten sam problem rozwiązany kropką, ale to współdzielony prymityw `ui/` — zmiana ruszyłaby wyświetlanie u wszystkich konsumentów
- [x] dropped · `reuse-scan` · `src/lib/kosztorys/format.ts:50` · `ratePercentText` bez ani jednego wołającego w całym repo — martwy kod sprzed slice'a, nie jego sprawa
- [x] dropped · `cohesion` · `kosztorys-v2-columns.tsx` · 745 linii, `assembleV2Columns` 313 — bóg-moduł sprzed slice'a (slice zwęził go netto), refaktor wart własnego przeglądu
- [x] dropped · `scatter` · `__tests__/lib/kosztorys/kosztorys-discount-edit.test.ts` · dwa speki na jedno źródło i nieaktualny prefiks `kosztorys-` w nazwie — świadome i udokumentowane wskaźnikiem w pliku
- [x] dismissed · `code-review` · zweryfikowane i czyste: kontrakty `copyValue`/`pasteValue`/`deleteValue` po zejściu z `keyColumn`, `isCellEmpty` względem starej ścieżki, tożsamość komponentu (EX-422) przez `withSyntheticRows`, `row: null` w rollbacku dla wszystkich trzech polityk, kolejność Escape, autosave zbieżny na wartości wycofanej, podgląd/`disabled`

- [x] dropped · `simplify` · `cells/decimal-column.tsx` vs `discount-columns.tsx` · obie kolumny mają teraz identyczne ciało (`cellPaste` + `policy.clear` + `decimalText`); scalenie w jedną fabrykę wymagałoby przepuszczenia komponentu przez `columnData`, co jest dokładnie pułapką EX-422 — różnica jest w komponencie, nie w hookach danych

## Simplify pass

Przebieg w głównym wątku, bez drugiego fan-outu — Krok 1 puścił po tych samych plikach sześciu
agentów, w tym `primitive-reuse-scan` i `module-cohesion-audit`, więc czteroagentowa runda po tym
samym diffie byłaby ceremonią bez zysku (`feedback_proportional_review_effort`). Zakres: dziesięć
plików slice'a. 3 zastosowane, 1 odrzucone, 0 wystawionych — wszystkie cztery jako `simplify`
w `## Findings` wyżej.

## Tests & suite

- `pnpm exec tsc --noEmit` — czysto
- `pnpm lint` — 0 błędów (85 ostrzeżeń, wszystkie sprzed slice'a: `src/migrations/*`, `test.js`)
- `pnpm test` — 2784 zdane, 161 pominiętych (speki DB-backed, kontener 5435 nie stał), 0 czerwonych
- `pnpm test:e2e` — **nie uruchamiane**, świadomie: przebieg to ~1h i wymaga wyraźnej prośby
  (`feedback_never_run_e2e_unprompted`). Spec należny slice'owi wystawiony jako **EX-738**
  (label `e2e-backlog`)
- `pnpm build` — nie uruchamiane; typecheck i lint pokrywają to, co slice ruszył

Nowe testy tej bramki: `cell-edit.test.ts` +4 przypadki na `cellPaste`. Reszta specek slice'a
(`cell-edit` 15, `subcontractor-price-edit` 23, `decimal-column` 6) przecelowana na ścieżkę
produkcyjną i zielona.

## Stan slice'a

**In review, nie done.** Sekcja „Kosztorys — jeden kontrakt edycji dla komórek liczbowych"
w `context/foundation/manual-checks.md` ma 15 nieodhaczonych boxów, a checki ręczne są twardym
blokerem `Done` i archiwizacji. Wszystkie boxy `## Findings` zamknięte — bramka nie trzyma nic
poza człowiekiem.
