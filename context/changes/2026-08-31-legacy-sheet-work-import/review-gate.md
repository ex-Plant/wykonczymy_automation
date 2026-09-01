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

- [x] 🔴 CRITICAL · fixed · `code-review` · `src/lib/actions/work-catalogue.ts:44` · `toRow` liczyło
      `match_key` z pełnego opisu, więc każda edycja oznaczonej pozycji w katalogu przepisywała klucz
      tak, że zawierał ` [stary arkusz]` — praca przestawała trafiać w swój odpowiednik, a ponowny
      wsad wstawiłby drugą kopię. Naprawa: `stripLegacyMarker` w
      `src/lib/kosztorys/work-catalogue/legacy-marker.ts`, używany przez wszystkie cztery miejsca
      liczące klucz. Lokalna baza sprawdzona: 0 zatrutych kluczy, błąd złapany przed skutkiem.
      test: test-driven-debugging · integration — `src/__tests__/lib/actions/work-catalogue-legacy-marker.test.ts`,
      czerwony na utrwalonym `match_key`, po naprawie 3/3; cały zestaw katalogu 25/25.
- [x] fixed · `module-cohesion` + `feature-first` + `structure-scatter` (zgodnie, niezależnie) ·
      `collect-candidates.ts` · `LEGACY_SUFFIX` — wiedza domenowa sprzężona z `catalogueKey`
      siedziała w jednorazowym skrypcie i była importowana spoza pipeline'u. Przeniesiona do
      `lib/kosztorys/work-catalogue/legacy-marker.ts` razem z regułą zdejmowania. Ta sama zmiana
      zamyka 🔴 powyżej.
- [x] fixed · `code-review` 🔵 · `export-catalogue.ts:34`, `fix-kosztorys-descriptions.ts` ·
      `.replace(LEGACY_SUFFIX, '')` niezakotwiczone — `stripLegacyMarker` kotwiczy na końcu opisu.
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
- [x] fixed · `comment-noise` · `dump-store.ts:6` · komentarz przepisany przy przenosinach zrzutów
      do `dumps/legacy-sheets/`.

### Z `/10x-impl-review` (0 krytycznych, 6 ostrzeżeń, 4 obserwacje)

- [x] 🟡 fixed · `export-catalogue.ts:42` (F3) · eksport nie miał pre-flightu kolizji, a jest jedynym
      skryptem, którego wynik trafia na produkcję — i jest generowany PO tym, jak człowiek pozmienia
      nazwy przy przeglądzie. Dwie nazwy poprawione do tej samej zbiegają się w jeden klucz, a wsad
      insert-only przyjąłby je jako jedną pozycję i po cichu zgubił drugą. Dołożony ten sam pre-flight
      co w `rekey-catalogue.ts`: wypisuje kolidujące pary i przerywa bez zapisu.
      test: no automated test · — skrypt jednorazowy, kasowany po wgraniu; strażnik jest w samym
      skrypcie i pada głośno.
- [x] 🟡 fixed · `import-catalogue.ts:39` (F2) · dry-run zapowiadał `fresh`, `--apply` wstawiał `items`.
      Skutek ten sam dzięki `ON CONFLICT DO NOTHING`, ale przy wsadzie na produkcję raport ma być tym,
      co się wydarzy. Wstawiane jest teraz `fresh`.
- [x] 🟡 fixed · `katalog-prac.json` (F5) · zacommitowany na HEAD był wersją sprzed odwrócenia na
      sufiks. Przeeksportowany: 945 pozycji, 945 różnych kluczy, round-trip „do utworzenia: 0".
- [x] 🔵 fixed · F8, F10 · zamknięte przenosinami `LEGACY_SUFFIX` do `lib/` (wyżej).
- [x] dropped · 🟡 F6 `fetch-grids.ts:69`, 🔵 F9 `rekey-catalogue.ts:63` · pliki kasowane / chronione
      pre-flightem.
- [x] dismissed · 🔵 F7 · `useDeferredValue` poza planem — reakcja na zgłoszenie właściciela
      („search jest ekstremalnie powolny") na katalogu, który po wsadzie urósł do ~950 wierszy.

### Zamknięte w przeglądzie

- [x] fixed · `comment-noise` · `use-search-filter.ts:30`, `catalogue-key.ts:14`, `columns.ts:153` ·
      trzy komentarze przeszły strip test — zdania definiowały `useDeferredValue`, powtarzały docblock
      `foldUnit` i opisywały mapę `¹²³ → 123` stojącą linijkę niżej. Twarda liczba „946" zamieniona na
      „~950", bo zdążyła się zdezaktualizować w dobę.
- [x] fixed · `comment-noise` · `fix-kosztorys-descriptions.ts` · komentarze przetłumaczone na
      angielski (reguła z `AGENTS.md`); `console.log` zostaje po polsku, bo czyta go właściciel.
- [x] fixed · właściciel · dziewięć skryptów przebiegu A i B skasowanych (`fetch-grids`,
      `dump-store`, `parse-dumped-sheet`, `collect-candidates`, `similar-names`, `report`,
      `run-analysis`, `analyze`, `apply`). Zostają cztery pliki: `export-catalogue.ts`,
      `import-catalogue.ts`, `rekey-catalogue.ts`, `katalog-prac.json`. Typecheck czysty, zero
      wiszących importów w `src/` i `package.json`.

### Otwarte

- [x] skipped · 🟡 `/10x-impl-review` F1 · **30 pozycji wchodzi do katalogu z ceną klienta 0 zł**
      (trzy z pierwotnych 33 właściciel skasował już przy przeglądzie), w tym dwie zaczynające się
      od „- ". Rozbite na trzy kupki: (A) zaślepki, gdzie 0 zł jest informacją („wycena
      indywidualna", „wycena na miejscu", „do ustalenia"); (B) zwykłe prace bez ceny, z których
      „Montaż kinkietów", „Silikonowanie" i „Montaż zaworów" mają w katalogu wycenionego bliźniaka
      o identycznej nazwie, czyli są duplikatami; (C) śmieć z arkusza — `#229`, `#230`, bez j.m.,
      opisujące jednorazową robotę w konkretnym mieszkaniu. Nie jest to błąd kodu, tylko lista do
      przejrzenia — właściciel przejmuje ją w całości ręcznie w „Katalogu prac" (2026-09-01).

- [x] fixed · F4 · `plan.md` · dopisana sekcja „Odstępstwa od planu" z trzema rozjazdami wobec
      planu: sufiks zamiast prefiksu (z uzasadnieniem właściciela i z tym, dlaczego stała wylądowała
      w `lib`, nie w skrypcie), kasacja dziewiątki skryptów od razu po akcji, oraz poprawki literówek
      w opisach — dozwolone, bo zakaz z planu dotyczył j.m., nie opisów. Progress 4.4 mówi teraz
      „dopisek/sufiks", 4.5 odnotowuje 945 po ręcznych kasacjach. Bloki faz nietknięte — zostają jako
      zapis tego, co planowano.

- [x] fixed · `rekey-catalogue.ts` · skasowany. Przeliczył klucze wzoru raz (faza 1, `f8476290`)
      i nie ma czego liczyć ponownie: produkcja dostaje katalog plikiem eksportu, a
      `export-catalogue.ts` liczy `match_key` przy zapisie zamiast kopiować z bazy. Warunek, który
      to blokował — czy produkcja ma już wiersze w katalogu — rozstrzygnięty przez właściciela
      (2026-09-01): nikt nie puścił żadnej migracji, więc tabeli tam jeszcze nie ma.

- [x] fixed · `simplify` · `export-catalogue.ts:41` · komentarz odsyłał do `rekey-catalogue.ts`,
      skasowanego godzinę wcześniej w tej samej sesji — martwe odwołanie zdjęte.
- [x] fixed · `simplify` · `export-catalogue.ts`, `fix-kosztorys-descriptions.ts` · ręczne
      kubełkowanie po kluczu (6 linii pętli z `Map#get ?? []`) zastąpione `Map.groupBy` — dwa
      wystąpienia, oba w pre-flightcie kolizji. Trzecie zniknęło razem z `rekey-catalogue.ts`.
      Zweryfikowane przebiegiem: eksport i tryb `CATALOGUE=1` dają zero kolizji na 940 wierszach.
- [x] fixed · `simplify` · `export-catalogue.ts`, `import-catalogue.ts` · komentarze przetłumaczone
      na angielski. Te dwa skrypty wjeżdżają na `main`, więc obowiązuje ich reguła z `AGENTS.md` —
      to ta sama wpadka, którą wcześniej naprawiono w `fix-kosztorys-descriptions.ts`, tyle że
      przeoczona w plikach, które wtedy jeszcze były na liście do kasacji. `console.log` po polsku,
      bo czyta go właściciel.
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
