# Review-gate ledger — pomiar-bez-etapu (EX-686) · 2026-08-13

Zakres: gałąź `pomiar-bez-etapu` względem `staging` (53 pliki, 5 commitów fazowych + epilog).
Krok 0.5 pominięty — projekt nie ma skilla weryfikacji przeglądarkowej.

## Findings

- [x] 🔴 CRITICAL · fixed · code-review + impl-review · `src/lib/kosztorys/settlement-rows.ts:124` ·
      wartość rozjazdu liczona przez `netForQtyForView(row, |qtyDiff|)` odejmowała **cały** rabat
      kwotowy od cząstkowej ilości — przy małej różnicy odwracała znak (arkusz 55,5 vs etapy 55 przy
      rabacie 500 zł dawało −450 zł zamiast +50 zł). Teraz różnica dwóch pełnowierszowych wartości,
      co skraca rabat dokładnie; znak wypada z odejmowania, więc `Math.sign`/`Math.abs` zniknęły.
      test: test-driven-debugging · unit — czerwona repro w
      `src/__tests__/lib/kosztorys/measure-discrepancy.test.ts` („prices a difference on a row with a
      kwotowy rabat…"), potwierdzona jako czerwona przed poprawką, teraz zielona.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/sheet-import/resolve-columns.ts:83` ·
      `OPTIONAL_FIELDS` sprawdzane wyłącznie na gałęzi zero-trafień, więc dwuznaczny nagłówek pola
      opcjonalnego (nowy `measuredQty`) blokował **cały** import arkusza, który wcześniej wchodził
      bez problemu. Pole opcjonalne jest teraz pomijane przy obu trybach nierozstrzygnięcia.
      test: test-driven-debugging · unit — nowy przypadek „imports a sheet whose »Pomiar z natury«
      matches twice rather than refusing it", zweryfikowany jako czerwony bez poprawki.
- [x] 🟡 WARNING · fixed · impl-review ·
      `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:348` · czerwony ton i podpowiedź
      wisiały na `stageQtySum`, filtrowanym po planie, podczas gdy `measureDiscrepancy` jest twardo
      zakotwiczone w planie klienta — w widokach podwykonawczych komórka i tooltip pokazywały dwie
      różne liczby „etapów". Rozjazd liczony teraz tylko przy `view === 'client'`.
      test: no automated test · — logika liczbowa jest już przypięta w `measure-discrepancy.test.ts`;
      to bramka montażu kolumn, którą pokrywa ręczny check „widok podwykonawcy" z manual-checks.
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/sheet-import/parse-robocizna.ts:73` ·
      komórka złożona z samych spacji przechodziła przez `Number('  ') === 0` i zapisywała się jako
      twierdzenie „pomiar = 0". Teraz `trim()` przed konwersją.
      test: no automated test · unit — jednolinijkowy guard w tej samej ścieżce co istniejące
      przypadki pustej komórki; osobna repro nic by nie dodała.
- [x] fixed · impl-review · `src/components/kosztorys/editor/use-kosztorys-editor.ts:411` ·
      `divergedCount` nie było bramkowane podglądem, mimo że filtr i komórka są — licznik liczył
      przez cały zbiór w widoku klienta, którego to nie dotyczy. Zero pod podglądem.
- [x] fixed · impl-review + module-cohesion ·
      `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:326` · rozjazd liczony na nowo
      dla tonu i dla podpowiedzi każdej komórki; wyciągnięty `memoisedByRow` (WeakMap po tożsamości
      wiersza — idiom, który plik już miał dla `totalQtyDone`) obsługuje teraz oba.
- [x] fixed · comment-noise + feature-first ·
      `src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx:119` · nowa pozycja
      menu owijała `DropdownMenuItem` bezpośrednio w `SimpleTooltip`, omijając własny `withHint`
      pliku — dwa prymitywy Radix biły się o ten sam ref. Przepięte na `withHint`.
- [x] fixed · code-review ·
      `src/components/kosztorys/editor/grid/cells/computed-cell.tsx:45` · `HintTooltip` owija dziecko
      w `inline-flex`, co zwijało `block w-full truncate` z `ReadOnlyCellText` — komórka z podpowiedzią
      przestawała się wyrównywać do prawej z resztą kolumny. Dodane `className="w-full"`.
- [x] fixed · AGENTS.md glossary ·
      `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:348` · `measureRozjazd` /
      `rozjazd` to polskie rdzenie w identyfikatorach (reguła 3) → `divergenceFor` / `divergence`.
      Polski zostaje tam, gdzie ma zostać: w UI i w komentarzach.
- [x] fixed · comment-noise · `src/lib/kosztorys/settlement-rows.ts:82`,
      `src/lib/kosztorys/row-view.ts:16` · komentarz mówił „A hundredth of a unit" o tolerancji 0,005
      (to pół setnej); pierwsze zdanie nad `divergedRows` powtarzało nazwę funkcji.
- [x] fixed · impl-review · `context/changes/2026-08-13-pomiar-bez-etapu/plan.md:410` · uzasadnienie
      kroku 5.4 w bloku fazy powoływało się na zbiór parity, ale `pnpm seed:kosztorys:test` odpala
      `perf-seed-kosztorys.ts`, nie `seed-kosztorys.ts`. Korekta dopisana w wierszu Progress (bloki
      faz są read-only).
- [x] dismissed · impl-review · `src/components/kosztorys/editor/use-kosztorys-editor.ts:991` ·
      `handleClearSheetMeasuredQty` nie woła `flushUndoBuffer()` jak sąsiednie usuwanie. Benign:
      tamte flushują, bo **kasują wiersze** i muszą przyciąć stos cofania; tutaj wiersz zostaje, a
      pole nie jest cofalne z założenia (wyjściem jest re-import).
- [x] dismissed · impl-review · `src/lib/kosztorys/format.ts:11` · propozycja `maximumFractionDigits: 2`
      dla `formatQty`, żeby pasowało do tolerancji 0,005. Odwrotnie: przy 2 miejscach różnica równa
      tolerancji renderowałaby dwie identyczne liczby w podpowiedzi, która właśnie krzyczy o różnicy.
      3 miejsca zostają.
- [x] dismissed · code-review · `src/lib/kosztorys/sheet-import/read-sheet.ts` · „formuły pobierane
      bezwarunkowo, nawet gdy kolumna się nie rozwiąże". Rezolwer kolumn działa **po** odczycie, więc
      nie ma momentu, w którym dałoby się to pominąć bez drugiego round-tripu do Sheets.
- [x] dismissed · code-review · `src/lib/kosztorys/serialize-preset.ts` · „restore snapshota zetrze
      liczbę odniesienia". Prawda i zamierzone — dane kosztorysu są jednorazowe do czasu wejścia
      dogfoodingu na `main` (AGENTS.md), a re-import przywraca figurę.
- [x] dropped · code-review · `src/lib/kosztorys/sheet-import/parse-robocizna.ts:71` · reguła
      „ARRAYFORMULA na poziomie kolumny" zamiast per-wiersz. Realne, ale zaszkodziłoby arkuszom
      mieszanym (część wierszy wpisana ręcznie w kolumnie z formułą) — czyli dokładnie temu, po co
      ta figura powstała.
- [x] dropped · code-review · `src/lib/kosztorys/sheet-import/columns.ts` · fallback prefiksowy dla
      nagłówków z dopiskami. `exactly` było świadomą decyzją zapisaną w Open Risks planu; zmiana
      dopasowania nagłówków to osobny temat, nie sprzątanie po tym slice'ie.
- [x] dropped · comment-noise · `src/__tests__/components/kosztorys/kosztorys-v2-rows.test.ts` ·
      polski komentarz w pliku anglojęzycznym. Ten plik jest już w większości polski — pojedyncza
      zmiana pogłębiłaby niespójność, a przepisanie całego to churn poza zakresem.
- [x] dropped · structure-scatter · `src/lib/kosztorys/row-view.ts` · `divergedRows` obok
      `filterRows`/`sortRows` a nie w `settlement-rows.ts`. To warstwa widoku wierszy i tam należy.
- [x] skipped · module-cohesion · `src/components/kosztorys/editor/use-kosztorys-editor.ts` ·
      hook dalej rośnie (1380+ linii). Realne, ale to EX-515 — świadomie odroczony podział wymagający
      najpierw harnessu testowego, nie zadanie dla bramki tego slice'a.
- [x] skipped · impl-review · brak asercji na bramkę podglądu w samym hooku — projekt nie ma harnessu
      do testowania `use-kosztorys-editor` (ta sama przyczyna co wyżej). Pokryte ręcznym checkiem
      „podgląd klienta czysty".
- [x] skipped · structure-scatter · trzy zastane znaleziska strukturalne poza diffem (rozrzut plików
      toolbara, duplikacja `EmptyState`, kolejność eksportów w `types.ts`) — sprzed tego slice'a,
      poza jego zakresem, nie pogłębione przez tę zmianę.

## Simplify pass

Wykonany inline, seryjnie, po triage'u (nie w fan-oucie): przebieg reuse/dedup po całym diffie
`staging...HEAD`. Zastosowane: `memoisedByRow` (jeden WeakMap-owy prymityw zamiast dwóch ręcznych
cache'y), przepięcie pozycji menu na `withHint`. Odrzucone: wspólny helper na dwa `EmptyState`
w `kosztorys-editor-body.tsx` — lista parametrów (tytuł, opis, etykieta, handler) jest równa
wyciąganemu kodowi, więc wyciągnięcie nic nie kupuje.

## Tests & suite

- Bramka całego drzewa przed przeglądem: `pnpm typecheck` ✓, `pnpm lint` ✓ (0 błędów),
  `pnpm test` 2150 ✓, `pnpm test:integration` 104 ✓, `pnpm build` ✓ przez `next build --webpack`
  (turbopack nie buduje w worktree z dowiązanym `node_modules`).
- Po poprawkach z bramki: `pnpm typecheck` ✓, `pnpm lint` ✓ (0 błędów, 79 zastanych ostrzeżeń),
  `pnpm test` → 2152 ✓ / 107 pominiętych (przed bramką 2150 — dwie nowe repro).
- Dwie nowe repro potwierdzone jako czerwone przed swoimi poprawkami (rabat kwotowy, dwuznaczny
  nagłówek opcjonalny).
- E2E: nie uruchamiane (reguła projektu — wyłącznie na wyraźne polecenie).
