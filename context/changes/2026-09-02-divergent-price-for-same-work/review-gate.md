# Review-gate ledger — EX-761 divergent-price-for-same-work · 2026-09-02

Zakres: `5f08a608..HEAD` (fazy 1–2 + epilog) na `staging`.

Bramki pominięte i dlaczego:

- `/tailwind-v4-audit` — slice nie dotyka stylów ani JSX.
- `feature-first-structure` / `module-cohesion-audit` / `structure-scatter-audit` — jeden moduł
  39-liniowy z jednym eksportem, postawiony obok rodzeństwa w `src/lib/kosztorys/`, spec w lustrzanej
  ścieżce. Nie ma czego rozsypać ani scalać.
- Step 0.5 (przebieg w przeglądarce) — nie było o niego prośby w tej turze; ręczne punkty czekają
  nieodhaczone w `context/foundation/manual-checks.md`.

## Findings

- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/kosztorys/row-conditions.ts:310` · `revealsColumns: ['price']` było martwe poza widokiem „Inwestor" — kolumna „Cena j.m." powstaje tylko tam, więc gest na widoku wykonawcy nie odsłaniał niczego. Teraz `ALL_PRICE_COLUMNS`, jak obie siostrzane diagnostyki ceny.
      test: TDD · unit — `columnsRevealedBy(['divergent-client-price'])` w `row-conditions.test.ts`
- [x] 🔵 OBSERVATION · fixed · `code-review` + `impl-review` (F4) · `src/components/kosztorys/editor/use-kosztorys-editor.ts:388` · jedyne przejście po całym zbiorze bez skrótu pod podglądem klienta; teraz `preview ? new Set() : …`, jak `marginForecastByPlane` i `foldableSectionIds`.
      test: no automated test — ścieżka wydajnościowa, wynik identyczny (regułę czytającą zbiór podgląd i tak wycina)
- [x] ⚠️ WARNING · fixed · `impl-review` (F3) · `plan.md:46` · „rejestr trzyma rozłączne liczniki" to nadinterpretacja — rejestr nigdy jej nie trzymał (np. `no-client-price-with-work` i `work-without-planned-qty` zapalają się razem). Uzasadnienie przepisane na węższe: trzecia diagnostyka na tym samym szwie „Cena j.m." zgłaszałaby tę samą pozycję za to samo. Sama decyzja bez zmian.
- [x] 🔵 OBSERVATION · fixed · `impl-review` (F5) · `use-kosztorys-editor.ts:388` · memo `divergingPriceIds` vs pole ctx `divergentPriceRowIds` — jedno pojęcie, dwie nazwy. Memo przemianowane na `divergentPriceIds`.
- [x] fixed · `comment-noise` · `src/lib/kosztorys/price-divergence.ts:10` · ogon JSDoc powtarzał `catalogue-key.ts` niemal dosłownie (składanie j.m., ta sama j.m. = inna praca). Ucięty; został nośny powód wyboru klucza — rozjazd biegnie Łazienka ↔ Kuchnia.
- [x] fixed · `comment-noise` · `use-kosztorys-editor.ts:388` · nowe zdania doklejone pod blok komentarza `rowConditionCounts` czytały się jak jego czwarty akapit. Memo przeniesione **nad** ten blok, komentarz wrócił do swojego `useMemo`.
- [x] ⚠️ WARNING · dismissed · `impl-review` (F1) · `context/foundation/manual-checks.md:3679` · commit epilogowy `0cbb0240` niesie pięć odhaczeń EX-766. To cudza, prawdziwa robota weryfikacyjna, która leżała brudna w tym samym pliku, a plik był w zestawie EX-761 (dopisywał sekcję). Treść poprawna, kod nietknięty — nie warto przepisywać historii `staging`.
- [x] ⚠️ WARNING · fixed · `impl-review` (F2) · `review-gate.md` · pusty i nieśledzony — ten plik.
- [x] 🔵 OBSERVATION · dropped · `impl-review` (F6) · `plan.md § Whole-tree Gate` · `pnpm lint` jest czerwony na stałe (`test.js` w korzeniu + trzy migracje), więc bramka nie daje sygnału. Poza tym slice'em; sprzątanie lintu to osobna zmiana.
- [x] dropped · `simplify` · 5 plików spec · `divergentPriceRowIds: new Set<number>()` powtórzone w siedmiu literałach ctx. Wspólna fabryka ctx zaoszczędziłaby jeden edit przy następnym polu, ale ukryłaby, na jakich faktach stoi dany spec — literał jest tu dokumentacją. Nie warte churnu.
- [x] dismissed · `comment-noise` · `price-divergence.ts:7`, `row-conditions.ts:17`, `use-kosztorys-editor.ts:388` · to samo uzasadnienie („grupa, nie wiersz") w trzech plikach. Każde stoi w innym miejscu łańcucha i tylko wersja w hooku niesie skalę ~1000 pozycji; czytelnik trafia na jedno, nie na trzy.

## Simplify pass

Uruchomione w wątku głównym, bez rozsyłania czterech agentów — diff to jeden moduł 39-liniowy, jeden
wpis rejestru i przeszycie ctx (reguła proporcjonalności wysiłku). Cztery kąty przejrzane po kolei:
**reuse** — `catalogueKey` już użyty, nic nie jest reimplementowane; **simplification** — bez zmian;
**efficiency** — jedyne znalezisko to brak skrótu pod podglądem, naprawiony wyżej; **altitude** —
czysta funkcja w `lib/`, fakt wchodzi przez ctx dokładnie jak `hasSettledMaterial`.
Wynik: `0 applied, 1 dropped` (findingi wpięte w `## Findings` z tagiem `simplify`).

## Tests & suite

- `pnpm typecheck` — czysto.
- Sześć specyfikacji slice'u — 99 przypadków, wszystkie zielone (doszedł guard na `revealsColumns`).
- `pnpm test` (całość) — 229 plików, 3186 zielonych, 0 czerwonych.
- `pnpm lint` — 4 błędy, wszystkie sprzed tej zmiany i poza jej plikami (F6).
- E2E — nie uruchamiane (bez prośby); slice nie ma długu E2E: diagnostyka jest jednym wpisem rejestru
  pokrytym na poziomie jednostkowym.
