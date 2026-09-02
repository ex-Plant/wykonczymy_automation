# Review-gate ledger — legacy-sheet-work-import (EX-753) · 2026-09-01

Zakres: diff gałęzi `legacy-sheet-work-import` względem `main` + niezacommitowane
`use-search-filter.ts`, `fix-kosztorys-descriptions.ts`, `collect-candidates.ts`,
`export-catalogue.ts`, `apply.ts`, `katalog-prac.json`.

Poza zakresem (praca równoległej sesji, nietykana): `src/components/forms/hooks/form-hooks.ts`,
`src/components/forms/work-catalogue-item/work-catalogue-item-form.tsx`,
`context/changes/2026-08-31-katalog-prac-auto-rates/review-gate.md`.

Fan-out: 10x-impl-review, code-review, feature-first-structure, module-cohesion-audit,
structure-scatter-audit, comment-noise-audit. Odpadł `tailwind-v4-audit` — slice nie rusza markupu.

## Findings

- [x] dismissed · `code-review` 🟡 · `run-analysis.ts:29` · `localeCompare` na znacznikach czasu —
      zweryfikowane na 57 zrzutach, sterownik zwraca format leksykograficznie chronologiczny.
- [x] dismissed · `code-review` 🔵 (zbiorczo) · `similar-names.ts` O(n²) offline, `use-search-filter.ts`
      deferral, `foldUnit` spacje, `parse-dumped-sheet.ts:77`, `void main()`, kubełkowanie kolizji,
      oba odwrócenia decyzji właściciela zaimplementowane zgodnie z ustaleniem.
- [x] dismissed · `module-cohesion` #3/#5/#6, `feature-first` #3 · `columns.ts` grab-bag, podział
      `use-search-filter.ts`, `dump-store.ts` — zastane albo nośne, poza zakresem diffu.
- [x] dismissed · `structure-scatter` · `katalog-prac.json` w repo — świadome: wsad ma być widoczny
      w diffie przeglądu. Repo prywatne, ceny są własnym cennikiem firmy.

### Zdezaktualizowane kasacją pipeline'u (właściciel, 2026-09-01: „więcej już tego nie będziemy robić")

- [x] dropped · `code-review` 🟡 · `apply.ts:23-25` · dry-run nie pokazywał 68 pozycji ze stawką
      0 zł — `apply.ts` idzie do kasacji, wsad lokalny wykonany.
- [x] dropped · `code-review` 🟡 · `fetch-grids.ts:69` · `JSON.parse` poza try/catch — plik kasowany.
- [x] dropped · `code-review` 🔵 · `rekey-catalogue.ts:63` niezawinięta pętla UPDATE — chroniona
      pre-flightem kolizji, skrypt kasowany po wgraniu na produkcję.
- [x] dropped · `comment-noise` (3 delete, 5 trim) · `collect-candidates.ts`, `report.ts`,
      `parse-dumped-sheet.ts`, `fetch-grids.ts` — pliki kasowane.
- [x] dismissed · `comment-noise` · rozjazd „56 budów" / „57 arkuszy" — nagłówki plików kasowanych.

### Z `/10x-impl-review` (0 krytycznych, 6 ostrzeżeń, 4 obserwacje)

- [x] dropped · 🟡 F6 `fetch-grids.ts:69`, 🔵 F9 `rekey-catalogue.ts:63` · pliki kasowane / chronione
      pre-flightem.
- [x] dismissed · 🔵 F7 · `useDeferredValue` poza planem — reakcja na zgłoszenie właściciela
      („search jest ekstremalnie powolny") na katalogu, który po wsadzie urósł do ~950 wierszy.

### Rozstrzygnięcia i odroczenia

- [x] skipped · 🟡 `/10x-impl-review` F1 · **30 pozycji wchodzi do katalogu z ceną klienta 0 zł**
      (trzy z pierwotnych 33 właściciel skasował już przy przeglądzie), w tym dwie zaczynające się
      od „- ". Rozbite na trzy kupki: (A) zaślepki, gdzie 0 zł jest informacją („wycena
      indywidualna", „wycena na miejscu", „do ustalenia"); (B) zwykłe prace bez ceny, z których
      „Montaż kinkietów", „Silikonowanie" i „Montaż zaworów" mają w katalogu wycenionego bliźniaka
      o identycznej nazwie, czyli są duplikatami; (C) śmieć z arkusza — `#229`, `#230`, bez j.m.,
      opisujące jednorazową robotę w konkretnym mieszkaniu. Nie jest to błąd kodu, tylko lista do
      przejrzenia — właściciel przejmuje ją w całości ręcznie w „Katalogu prac" (2026-09-01).

- [x] dropped · `simplify` · `columns.ts:153` · `SUPERSCRIPT_DIGITS` dałoby się zastąpić
      `normalize('NFKD')`, ale mapa mówi wprost, które trzy znaki obsługujemy, a NFKD złożyłoby przy
      okazji wszystko inne kompatybilnościowe. Wymiana bez wygranej.
- [x] dismissed · `simplify` · `columns.ts:165` · `.trim()` na końcu `foldUnit` wygląda na martwe
      (`fold` już trimuje), ale nie jest: `'szt .'` → po zdjęciu kropki `'szt '`. Sprawdzone, zostaje.
- [x] filed · `e2e` · dwie rzeczy widoczne w przeglądarce weszły bez spec'a browser-level: reset
      pola kwoty przy „auto" w formularzu katalogu (odmontowane pole trzyma błąd i blokuje każdy
      kolejny submit) oraz odroczone filtrowanie ~950 wierszy. Odroczone do `/10x-e2e` — EX-762.
- [x] filed · `deploy` · wsad katalogu na produkcję: migracja addytywna przed pushem, odświeżony
      eksport, wsad z jawnie nazwaną bazą, potem kasacja resztek `src/scripts/legacy-sheet-import/`.
      Robi człowiek — EX-763.

## Simplify pass

Przebieg na finalnym kształcie, po kasacji dziesięciu skryptów — 3 poprawki, 1 odrzucona, 1 oddalona;
każda pozycja w `## Findings` z tagiem `simplify`. Osobnego raportu nie ma: bramka trzyma jedną listę.

## Tests & suite

- `pnpm typecheck` — czysty
- `pnpm lint` — 4 błędy, wszystkie zastane (`src/migrations/*`, `test.js`), żaden w tej zmianie
- `pnpm test` — 3150 zielonych, 203 pominięte (specki DB-owe, osobna bramka)
- regresja 🔴 na `db-test`: `work-catalogue-legacy-marker.test.ts` — 3/3 zielone
- `pnpm build` — zielony
- E2E — nieuruchamiane; obowiązek odroczony do EX-762
