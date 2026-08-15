# Review-gate ledger — sheet-column-mapping (EX-690) · 2026-08-14

Zakres: `43e5caa3..HEAD` (5 commitów, 34 pliki). Krok 0.5 (przejście manualne w przeglądarce)
pominięty — repo nie ma skilla `verify-manual-checks`, a sterowanie przeglądarką jest tu zabronione
bez wyraźnej prośby. Checklista manualna czeka w `context/foundation/manual-checks.md`.

## Findings

- [x] 🟡 WARNING · skip · `code-review` · `src/lib/actions/kosztorys-import.ts:210` · źle wskazana kolumna Pomiaru nadpisuje zapisany Pomiar przy „Porównaj" — zapisany Pomiar jest kopią arkusza, odświeżaną przy każdym porównaniu, więc poprawione wskazanie naprawia go samo; blokowanie zapisu byłoby zmianą zachowania na niepewnej przesłance
      test: no automated test — świadomie nieblokowane, do potwierdzenia checklistą manualną
- [x] 🔵 OBSERVATION · skip · `code-review` · `resolve-columns.ts:208` · dwa pola wskazane na tę samą kolumnę: drugie po cichu przepada i zostaje w jsonb bez „Usuń wskazanie" — naprawa to nowy kanał raportowania odrzuconych wskazań, nie jednolinijkowa poprawka
- [x] 🔵 OBSERVATION · skip · `impl-review` · `src/lib/actions/kosztorys-import.ts:196` · nagłówek rozwiązywany trzy razy na jedno porównanie; przekazanie gotowego `ResolvedRobociznaT` do obu builderów to refaktor przez trzy moduły i ich specki
- [x] skip · `feature-first` / `structure-scatter` · `src/lib/google/sheet-lookup.ts:22` · odczyt Payloada z domeną kosztorysu w warstwie infrastruktury — zastane, pięciu importerów łącznie ze stroną; przeniesienie to osobna zmiana
- [x] skip · `module-cohesion` · `sheet-compare-dialog.tsx` · dziewięć komponentów w jednym pliku — zastane, ta zmiana dołożyła 61 linii, nie kształt
- [x] dropped · `simplify` · `sheet-column-picker-options.ts:25` · filtr pustych etykiet jest nieosiągalny (`findCandidates` już je odsiewa), ale to obrona na granicy renderu, tania i pokryta testem — usuwanie jej kosztuje więcej niż zostawienie
- [x] dismissed · `simplify` (reuse / altitude) · brak uwag: fallback wpięty w jedyny wspólny resolver obu okien, walidacja wskazania w jednym module, komponenty odmowy i wyboru współdzielone
- [x] dismissed · `tailwind-v4` · brak naruszeń w pięciu plikach zmiany; `text-amber-600` to zastana konwencja repo, nie dryf tej zmiany
- [x] dropped · `structure-scatter` · `editor/dialogs/` ma 19 plików, 8 z prefiksem `sheet-` — sygnał (N+1) na podkatalog, ale dziś to nie jest śmietnik

## Simplify pass

`/simplify` (4 agenty: reuse / simplification / efficiency / altitude) — 2 zastosowane, 1 pominięte
(potrójne rozwiązywanie nagłówka, już zapisane wyżej jako `skip`), 1 dropped, reuse i altitude bez
uwag. Każda pozycja wpisana wyżej w `## Findings` z tagiem `simplify`; osobnego raportu nie ma —
ledger jest jedynym.

## Tests & suite

- Bramka całodrzewna po fazie 4: `pnpm typecheck` czysty, `pnpm lint` bez nowych błędów
  (2 pre-existing w `test.js` w korzeniu repo), `pnpm test` 2228 zielonych, `pnpm build` przechodzi.
- Bramka powtórzona po poprawkach z przeglądu: `pnpm typecheck` czysty, `pnpm lint` te same 2
  pre-existing błędy, `pnpm test` 2230 zielonych (111 pominiętych — specki DB), `pnpm build`
  przechodzi. Dwa nowe testy resolvera (kolumna porządkowa) i dwa naprawione mocki
  `sheet-lookup` zweryfikowane osobno na `db-test` (5435): 12/12.
- E2E nieuruchamiane (~1h, tylko na wyraźną prośbę). Ta zmiana nie ma jeszcze specki E2E — obsługa
  wskazywania kolumny jest przejściem przeglądarkowym z `manual-checks.md`.

## Stan slice'a

**Zarchiwizowany 2026-08-15 przy nieodhaczonym przejściu manualnym** (`context/foundation/manual-checks.md`
— pozycje tej zmiany zostają otwarte). Archiwum nie czeka na przejście manualne (właściciel,
2026-07-28); karta EX-690 zostaje w `In review`, dopóki checklista nie jest odhaczona.
