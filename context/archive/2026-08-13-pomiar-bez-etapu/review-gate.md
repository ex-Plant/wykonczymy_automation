# Review-gate ledger — pomiar-bez-etapu (EX-686) · 2026-08-13

Zakres: gałąź `pomiar-bez-etapu` względem `staging` (53 pliki, 5 commitów fazowych + epilog).
Krok 0.5 pominięty — projekt nie ma skilla weryfikacji przeglądarkowej.

**Przycięte przy archiwizacji (2026-08-14).** Znaleziska `fixed` zostały usunięte z listy poniżej:
ich trwałym zapisem jest commit, który je naprawił, a kod da się przeczytać. Zostaje to, czego git
nie niesie — decyzje o *nierobieniu*: `dismissed`, `dropped`, `skipped`. Bilans sprzed przycięcia:
**12 fixed, 4 dismissed, 4 dropped, 3 skipped · 0 open.**

Dwa z przyciętych zostawiam w jednej linii, bo niosą coś poza samą poprawką:

- 🔴 CRITICAL — wartość rozjazdu odejmowała **cały** rabat kwotowy od cząstkowej ilości, więc przy
  małej różnicy odwracała znak (arkusz 55,5 vs etapy 55 przy rabacie 500 zł → −450 zł zamiast +50 zł).
  Naprawione jako różnica dwóch pełnowierszowych wartości; repro w `measure-discrepancy.test.ts`.
- Kolumna „Rozjazd (arkusz − etapy)" **powstała po dogfoodingu, nie z planu** — właściciel na
  inwestycji 31: „nikt tego tak nie będzie sprawdzał" o podpowiedzi pod kursorem, która była wtedy
  jedynym miejscem z różnicą. Kolumna stoi na czele rozpiski (to lista roboty, nie kolejny odczyt
  arkusza) i pokazuje się tylko przy `hasDivergence`. Podpowiedź została — niesie oba składniki
  odejmowania, których sama różnica nie pokazuje.

## Findings

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
