# Audyt Done issues (Linear „Wykonczymy") — 2026-08-18

Cel: zwolnić limit darmowych issue. Przechodzimy Done od najstarszego. Dla każdego:
czy w treści siedzi wiedza/decyzja, której nie ma w repo → jeśli tak, wyciągamy do
docs; potem issue trafia na listę „ok to cancel".

**Uwaga:** samo _Canceled_ nie zwalnia limitu — Linear liczy issue nieprzearchiwizowane.
Zwalnia dopiero **archiwizacja**. Kasowaniem zajmuje się człowiek ręcznie.

Legenda: ptaszek odhacza człowiek, gdy issue faktycznie zniknie z Lineara. Wpis na liście = sprawdzone, wiedza wyciągnięta (albo jej nie było).

## Ok to cancel

- [x] **EX-395** · S-01 kosztorys-sections-items — nic do wyciągnięcia. Treść to outcome +
  ```
  PRD refs + lista „Folded from POC"; wszystko już w `context/foundation/roadmap.md`
  (blok „Reconciled with the POC (2026-07-08)", wiersz S-01 = done), surowe dokumenty POC
  w `context/archive/kosztorys-poc-in-app/`. Część ustaleń zdezaktualizowana (pomiar jest
  dziś formułą = suma etapów, EX-489) — przepisanie ich do docs zaszkodziłoby. Brak komentarzy.
  ```
- [x] **EX-397** · S-02 kosztorys-price-models — nic. Ciało = kopia bloku `### S-02` z roadmapy,
  ```
  łącznie z regułą „robocizna netto vs brutto wynika z kontekstu rozliczenia klienta (23% vs 8%)"
  (roadmap:300-302) i pułapką dsg „aktywny widok w kluczu remountu" — ta ostatnia jest już
  **nieaktualna**: klucz remountu usunięto w `ee497cb`, a archiwum
  `2026-07-15-kosztorys-stage-values/change.md:121-123` wprost ostrzega, żeby go nie dodawać z powrotem.
  ```
- [x] **EX-398** · S-03 kosztorys-stages — nic. Wszystko w bloku `### S-03` roadmapy (etapy dynamiczne,
  ```
  sparse progress, oś wartości etapu doszła obok slice'a). Zapis „kasowanie etapu z postępem = blokada"
  i tak został odwrócony przez EX-477.
  ```
- [x] **EX-401** · S-04 kosztorys-subcontractor-pricing — nic. Blok `### S-04` roadmapy niesie to samo
  ```
  słowo w słowo (dziedziczenie współczynnika inwestycja → sekcja → pozycja, override dwustanowy,
  otwarta kwestia 4 o miejscu ustawień).
  ```
- [x] **EX-402** · S-05 kosztorys-vat — nic. Blok `### S-05` roadmapy: jedna stawka na inwestycję,
  ```
  bez kaskady i override'ów, ta sama otwarta kwestia 4.
  ```
- [x] **EX-403** · S-07 kosztorys-undo — nic, mimo najbogatszej treści z tej partii. Cały wywód
  ```
  (Command pattern nad mapą tożsamości `uid → dbId`, undo jako odwrotny zapis serwerowy bo autosave
  utrwala w 500 ms, kaskady oddane snapshotom z S-06, dyscyplina „żadnego surowego id w stosie")
  siedzi w bloku `### S-07` roadmapy w wersji **obszerniejszej** niż w Linearze.
  ```
- [x] **EX-404** · S-08 kosztorys-delete-guard — nic. Odwrócenie polityki (twarda blokada → confirm +
  ```
  snapshot przed kasowaniem, EX-477) jest w wierszu S-08 „At a glance" i w
  `context/changes/kosztorys-delete-confirm/change.md`; stary folder nosi baner SUPERSEDED.
  ```
- [x] **EX-408** · wyszukiwarka kwot w transferach — nic. Dwutrybowy projekt (bez separatora =
  ```
  prefiks tekstowy na `amount::text`, z separatorem = zakres liczbowy `[low, high)`) jest
  w kodzie `src/lib/queries/transfer-filters.ts` i opisany komentarzami w regresji
  `src/__tests__/build-transfer-filters.test.ts`.
  ```
- [x] **EX-411** · granica importów w hookach Payloada — wiedza **wyciągnięta** (patrz sekcja niżej).
- [x] **EX-414** · S-09 kosztorys-preset — nic. Blok `### S-09` roadmapy niesie więcej: biblioteka
  ```
  nazwana, globalna tabela presetów, silnik serializacji z S-06, „zapisz jako" z nadpisaniem,
  kosztorysy zrodzone z presetu zostają zamrożone przy późniejszej edycji presetu, oraz
  uzasadnienie snapshotowania cen (ta sama praca kosztuje inaczej na innej inwestycji).
  ```
- [ ] **EX-416** · token Meta / utrata leadów — wiedza **wyciągnięta** (patrz sekcja niżej).
- [ ] **EX-417** · S-15 importer kosztorysu + „Porównaj z arkuszem" — nic. Dwa zarchiwizowane
  ```
  foldery zmian niosą całość: `context/archive/2026-08-11-kosztorys-importer/` (rozwiązywanie
  kolumn po nagłówku a nie po offsecie, 43/45 arkuszy, Dąbrowskiego 86 i Ryżowa jako
  niejednoznaczne, klucz tożsamości sekcja+opis+n-te wystąpienie, nazwany snapshot ręczny przed
  importem) i `context/archive/2026-08-13-sheet-live-compare/`. Otwarte sprawdzenia ręczne żyją
  w `context/foundation/manual-checks.md`, E2E w EX-687.
  ```
- [ ] **EX-418** · S-06 kosztorys-snapshots — nic. Blok `### S-06` roadmapy (linia 343) niesie ten
  ```
  sam wybór architektury (niezależne snapshoty zamiast event logu, wipe+reinsert, podział pracy
  z S-07), a realizacja siedzi w `context/archive/2026-07-10-kosztorys-snapshots/`.
  ```
- [ ] **EX-422** · migotanie gridu / aliasowanie eksportów dsg — nic **do dopisania**, bo lekcja już
  ```
  jest: `context/foundation/lessons.md:127-141` opisuje pułapkę aliasowania (`DataSheetGrid`
  **jest** `StaticDataSheetGrid`), unieważnia starą złą generalizację i zakazuje klucza remountu;
  linia 290 dokłada konsekwencję (wirtualizator kluczuje nagłówki indeksem).
  ```
- [ ] **EX-423** · drawer „Wersje" wisiał na „Wczytywanie" — nic. Zgłoszenie bez diagnozy; naprawa
  ```
  jest w kodzie, folder `context/archive/2026-07-11-kosztorys-editor-ux/` trzyma resztę rundy.
  ```
- [ ] **EX-424** · zwężanie kolumny zatrzymuje się na podłodze — nic. Treść to sam objaw + lista
  ```
  miejsc do sprawdzenia, żadnej decyzji.
  ```
- [ ] **EX-425** · trzy przyciski widoku ceny → jeden przełącznik — nic. Fakty (trzy stany,
  ```
  utrwalanie per inwestycja w localStorage) są w kodzie `use-price-view.ts`.
  ```
- [ ] **EX-429** · bramka wdrożeniowa S-06 (CRON_SECRET, GC snapshotów) — nic. Cron i harmonogram
  ```
  są w `vercel.json`, a zapis „potwierdzone na prodzie 2026-07-18" nie przenosi się na nic, co
  dziś trzeba wiedzieć.
  ```
- [ ] **EX-430** · hartowanie bulk-INSERT restore — nic. `context/archive/2026-07-18-ex-430-harden-bulk-insert-restore/change.md`
  ```
  niesie to samo **i poprawia liczby** (sufit ≈4 369, nie ~3 855) oraz odnotowuje, że limit
  5000 z serializacji już nie istnieje.
  ```
- [ ] **EX-432** · cichy obcięty snapshot przy 5000 pozycji — nic. Ta sama archiwizacja EX-430 mówi
  ```
  wprost, że cap zniknął; opis w Linearze jest dziś nieaktualny i przepisanie go szkodziłoby.
  ```
- [ ] **EX-435** · parasol „UX pass edytora kosztorysu" — nic. Sam spis podzadań; projekt leży
  ```
  w `context/archive/2026-07-11-kosztorys-editor-ux/`.
  ```
- [ ] **EX-436** · wstawianie pozycji przez menu kontekstowe — nic. Projekt w zarchiwizowanym
  ```
  `context/archive/2026-07-11-kosztorys-editor-ux/`; uzasadnienie „własne menu, bo `lockRows`
  wyłącza wbudowane dsg" jest przy kodzie handlera.
  ```
- [ ] **EX-437** · scalenie „Zapisz jako / szablon / Wersje" w jedno menu — nic, czysty UI.
- [ ] **EX-438** · wspólny `insertKosztorysTree` — nic. Duplikat EX-500, wdrożony; helper istnieje
  ```
  (`src/lib/kosztorys/insert-kosztorys-tree.ts`), obie ścieżki go wołają.
  ```
- [ ] **EX-439** · sprawdzanie `schema_version` przy odczycie presetu/snapshotu — nic. Zrobione:
  ```
  `src/lib/db/presets.ts:88` woła `assertReadableSchemaVersion`.
  ```
- [ ] **EX-440** · `withPayloadTransaction` — nic. Helper żyje w `src/lib/db/with-payload-transaction.ts`.
- [ ] **EX-443** · receipt-scan-line-items — nic. Trzy zarchiwizowane foldery zmian
  ```
  (`2026-07-11-receipt-scan-line-items`, `-heic-and-filesize`, `2026-08-10-...-netto-extraction`)
  niosą decyzje (mediaId zamiast File przez limit body, upload-once, pula 4, kategoria
  exact-match-or-blank).
  ```
- [ ] **EX-445** · `requireInvestmentOr404` — nic. Helper w `src/lib/queries/investments.ts`, użyty
  ```
  w trzech stronach; rozjazd celu redirectu rozstrzygnięty w kodzie.
  ```
- [ ] **EX-446** · sekwencje na prodzie — nic. Werdykt „prod zdrowy, to był artefakt bazy testowej"
  ```
  jest zakonserwowany w samych skryptach: `scripts/check-sequences.sql` (read-only guard) i
  `scripts/reset-sequences.sql` wołany po `db:import`.
  ```
- [ ] **EX-448** · stabilne id wierszy pozycji kosztowych — nic. Podwójnie udokumentowane:
  ```
  `context/foundation/lessons.md:391` i `:409` (indeks jako tożsamość = źródło dwóch błędów)
  plus `context/archive/2026-07-18-ex-448-stable-row-ids/`.
  ```
- [ ] **EX-452** · dwa komponenty eksportowały `Spinner` — nic. Zmiana nazwy na `GradientSpinner`
  ```
  jest w kodzie; odrzucenie wariantu „jeden Spinner z propsem" to nota z jednego dnia,
  nie reguła.
  ```
- [ ] **EX-454** — logError() helper. Nic do wyciągnięcia: `src/lib/utils/log-error.ts` + wywołania są samoopisujące.
- [ ] **EX-455** — podgląd faktury (HEIC / wolne obrazy / duplikaty kontrolek PDF). Nic do wyciągnięcia: `context/archive/2026-07-12-receipt-scan-heic-and-filesize/` i `context/archive/2026-08-10-invoice-attach-and-pdf-preview/`.
- [ ] **EX-457** — twardy limit 4.5 MB. Nic do wyciągnięcia: powód siedzi w komentarzu przy `bodySizeLimit: '4.5mb'` w `next.config.ts`, reszta w archiwum zmiany.
- [ ] **EX-461** — wskaźnik zapisu w tle. Nic do wyciągnięcia: kod store'a + toast są samoopisujące.
- [ ] **EX-463** — zimny start pustego kosztorysu (1 sekcja + 1 pusta pozycja). Nic do wyciągnięcia: decyzja „bez backfillu" dotyczy danych, których i tak nie chronimy (reguła w AGENTS.md).
- [ ] **EX-464** — insert w jednej transakcji. Nic do wyciągnięcia: kod + `with-payload-transaction`; uzasadnienie braku testu współbieżności to standardowa wiedza.
- [ ] **EX-465** — kontrola przynależności sekcji do inwestycji. Nic do wyciągnięcia: `sectionOwnerAndNextItemOrder` w `src/lib/actions/kosztorys.ts:390`.
- [ ] **EX-466** — zawieszona strzałka sortowania. Nic do wyciągnięcia: fix w kluczu remountu siatki.
- [ ] **EX-474** — przerobienie notatek z `tmp-lessons/`. Nic do wyciągnięcia do dokumentacji projektu (materiał osobisty, trafia do notatek). Uwaga: katalog `tmp-lessons/` nadal istnieje (`05`, `06`, `08`, `README.md`) mimo że issue zamknięte.
- [ ] **EX-476** — ujednolicenie ikonowych przycisków. Zamknięte jako niezrobione: `RemoveButton` nadal nie ma propa `title` ani konfigurowalnego rozmiaru ikony, a panel Sekcje i nagłówek etapu dalej mają surowe `<button>`. Odrzucone rozszerzenia (confirm/guard do `components/ui/`) to standardowa wiedza o granicach komponentów — nic do wyciągnięcia.
- [ ] **EX-477** — usuwanie zapełnionej pozycji/sekcji po potwierdzeniu. Nic do wyciągnięcia: `context/archive/2026-07-17-kosztorys-delete-confirm/`; decyzja właściciela zaimplementowana (twardą blokadę zastąpił confirm + snapshot).
- [ ] **EX-478** — mnożniki i VAT do drugiego rzędu toolbara. Nic do wyciągnięcia: rozstrzygnięcie stoi w `context/foundation/roadmap.md:677` (Otwarte pytanie #8 zamknięte, z odesłaniem do EX-478).
- [ ] **EX-479** — przełącznik kwota/procent. Nic do wyciągnięcia: `context/archive/2026-07-15-kosztorys-progress-percent/`; korekta „liczymy z wartości, nie z ilości" siedzi w notatkach domenowych.
- [ ] **EX-481** — ujednolicenie hooków localStorage + zapisy przez updater. Nic do wyciągnięcia: fabryka store'a i testy są samoopisujące.
- [ ] **EX-483** — porządki po fabryce kolumn. Nic do wyciągnięcia: sam opis mówi „nothing left to build", a stan potwierdzony w kodzie (brak `src/lib/tables`, `header-tips.ts`, `TOOLTIP_DELAY`).
- [ ] **EX-485** — select Netto | Brutto | Bez filtra. Nic do wyciągnięcia: `context/archive/2026-07-15-kosztorys-netto-brutto-select/` (plan + ledger bramki z tymi samymi decyzjami).
- [ ] **EX-486** — sortowanie przeżywa zniknięcie swojej kolumny. Nic do wyciągnięcia: naprawione, guard w kodzie.
- [ ] **EX-487** — sortowanie po kolumnach liczonych było no-opem. Nic do wyciągnięcia: naprawione, przypięte testami.
- [ ] **EX-489** — pomiar ≠ etapy. Nic do wyciągnięcia i **treść issue jest już nieaktualna**: Pomiar nie jest dziś osobnym polem (jest formułą = Σ etapów), a obowiązująca wersja tej domeny stoi w `context/reference/kosztorys-editor-domain-notes.md:319-341`.
- [ ] **EX-492** — `src/types/kosztorys.ts` w warstwie cross-feature. Nic do wyciągnięcia: przeniesienie zrobione przy EX-515, reguła sama siedzi w AGENTS.md.
- [ ] **EX-494** — decyzja „wartość kosztorysu na pracach w toku". Nic do wyciągnięcia: rozstrzygnięcie żyje w `context/reference/kosztorys-editor-domain-notes.md:319-341` (Przedmiar = oferta, Σ etapów = wykonanie) oraz w AGENTS.md („Load-bearing structural facts").
- [ ] **EX-495** — „Pozostało do rozliczenia": kwota czy procent. Nic do wyciągnięcia i treść już nieaktualna: kolumna ma dziś nazwę i kształt opisany w notatkach domenowych (`:357`), a kotwica przy Przedmiarze jest tam zapisana.
- [ ] **EX-496** — audyt kosztorys v2. Nic do wyciągnięcia: 7/8 ustaleń naprawionych i widocznych w kodzie, a headline (regresja perf po przywróceniu memoizacji) jest zapisany w AGENTS.md w sekcji „Editor hooks (EX-521)".
- [ ] **EX-500** — `insertKosztorysTree`. Nic do wyciągnięcia: helper istnieje, issue zamknięte jako tracking-only.
- [ ] **EX-501** — globalny rabat. Nic do wyciągnięcia: `context/archive/2026-07-15-kosztorys-global-discount/` + notatki domenowe.
- [ ] **EX-503** — „Dodaj sekcję z szablonu". Nic do wyciągnięcia: `context/archive/2026-07-16-kosztorys-section-append/`.
- [ ] **EX-504** — dedup bulk-insertów kosztorysu. Nic do wyciągnięcia: `insert-kosztorys-tree.ts` + `append-preset-sections.ts` mówią same za siebie.
- [ ] **EX-506** — status „Planowana". Nic do wyciągnięcia: `context/archive/2026-07-16-investment-planowana-status/`, enum w `src/collections/investments.ts:11`.
- [ ] **EX-508** — `createInvestmentAction` połykał błąd seeda. Nic do wyciągnięcia: naprawione, ścieżka błędu w kodzie.
- [ ] **EX-509** — luki w cofaniu stanu optymistycznego. Nic do wyciągnięcia: naprawione; brak testu wyjaśniony brakiem harnessu (dziś nieaktualne — hook został rozbity przy EX-521).
- [ ] **EX-512** — konsolidacja speców kosztorysu do lustrzanego katalogu. Nic do wyciągnięcia: reguła mieszka w AGENTS.md („Testing").
- [ ] **EX-513** — `blob-snapshot.mjs` do `scripts/`. Nic do wyciągnięcia.
- [ ] **EX-514** — `ring-[3px]` → `ring-3`. Nic do wyciągnięcia.
- [ ] **EX-515** — rozbicie god-modułów kosztorysu. Nic do wyciągnięcia: układ plików sam pokazuje wynik, a reguła „nowy klaster = leaf hook w `editor/hooks/`" stoi w AGENTS.md.
- [ ] **EX-516** — `usePersistedEnum` / `parseDecimalInput`. Nic do wyciągnięcia: helpery istnieją.
- [ ] **EX-517** — wydajność renderu/zapytań edytora. Nic do wyciągnięcia: naprawione; ogólna nauka („mierz skargę, nie metrykę") jest w `lessons.md`.
- [ ] **EX-518** — lista plików do uważnego przejrzenia przy dużym merge'u. Nic do wyciągnięcia: to była kartka robocza na jedno przejście review.
- [ ] **EX-519** — wspólna powłoka dialogów. Nic do wyciągnięcia: `context/archive/2026-07-17-kosztorys-dialog-shells/`.
- [ ] **EX-521** — server-owned display order + rozbicie god-hooka. Nic do wyciągnięcia: `context/archive/2026-08-15-kosztorys-editor-hook-split/`, twarde ograniczenia („nic nie wchodzi do kontekstu", „kształt zwracany zamrożony") są w AGENTS.md, a obalona przesłanka o `renderHook` — w `lessons.md`. Odrzucone findingi 2/3 to jednorazowe pomiary; ogólna nauka już zapisana.
- [ ] **EX-522** — `optimisticSettingSave`. Nic do wyciągnięcia: helper w kodzie; uwaga o braku harnessu nieaktualna po EX-521.
- [ ] **EX-523** — `withPayloadTransaction` bez domyślnego `context`. Nic do wyciągnięcia: wymagany parametr sam wymusza jawną politykę w każdym call site.
- [ ] **EX-524** — dogfooding rabatu w pasku sum. Nic do wyciągnięcia: pytania rozstrzygnięte w kodzie paska.
- [ ] **EX-526** — hartowanie undo (wyścig odwrotnego zapisu z autosave). Nic do wyciągnięcia: pełny wywód jest w `lessons.md:172`.
- [ ] **EX-527** — weryfikacja wyszukiwania fuzzy → substring. Nic do wyciągnięcia: pułapka z `ł` siedzi w komentarzu nad `foldText`.
- [ ] **EX-529** — kołowy wykres „% udziału" per sekcja. Nic do wyciągnięcia.
- [ ] **EX-530** — S-11 `kosztorys-bridge`. Nic do wyciągnięcia: `context/archive/2026-07-18-kosztorys-bridge/` + wpis slice'a w `roadmap.md`; wycofanie zaliczek na etap opisane przy EX-536.
- [ ] **EX-532** — S-13 podgląd dla klienta. Nic do wyciągnięcia: `context/archive/2026-07-20-kosztorys-client-share/`, a `roadmap.md` niesie znacznie pełniejszą historię niż issue (łącznie z odwróceniem postawy wobec wycieku i EX-695).
- [ ] **EX-534** — skasowanie trzech tymczasowych skryptów seedujących. Nic do wyciągnięcia: skryptów już nie ma.
- [ ] **EX-535** — S-12 rozjazd robocizny/rabatu vs kosztorys. Nic do wyciągnięcia: model VAT-u i sam rozjazd opisane w `kosztorys-editor-domain-notes.md:448` i w AGENTS.md.
- [ ] **EX-536** — zaliczka netto czy brutto. Nic do wyciągnięcia: rozstrzygnięcie właściciela wpięte w `kosztorys-editor-domain-notes.md:459`.
- [ ] **EX-537** — co przedstawia wykres kołowy sekcji. Nic do wyciągnięcia: pytanie rozstrzygnięte przez implementację (przełącznik Przedmiar ↔ Wykonane w `section-share-pie.tsx`), więc dowód z arkusza o wyborze kolumny stracił moc wiążącą.
- [ ] **EX-538** — nakładka textarea na długie teksty w siatce. Nic do wyciągnięcia: odrzucone warianty (Popover, rosnący `rowHeight`) opisane w komórce, reszta to zwykły plan.
- [ ] **EX-539** — rabat netto czy brutto. Nic do wyciągnięcia: model VAT-u wraz z rabatem stoi w `kosztorys-editor-domain-notes.md:448`.
- [ ] **EX-540** — inwestycja ciągnęła całe drzewo dla dwóch liczb. Nic do wyciągnięcia: zamknięte jako nieaktualne, a powody są widoczne w `kosztorys-tree.ts` i `investment-summary-panel.tsx`.
- [ ] **EX-541** — sygnalizacja rozjazdu przy liczbie zależnej od widoku cen. Nic do wyciągnięcia: wybrany wariant („gasimy poza widokiem klienta") stoi w komentarzu w `settlement-summary.tsx:56`.
- [ ] **EX-542** — strumieniowanie bloku rekoncyliacji przez Suspense. Nic do wyciągnięcia.
- [ ] **EX-543** — osierocony znacznik etapu na zaliczce. Nic do wyciągnięcia: kolumna wycofana razem z mostkiem zaliczka→etap, a ogólna reguła siedzi w `lessons.md:200`.
- [ ] **EX-548** — rozjazd nazewnictwa PL/EN. Nic do wyciągnięcia: glosariusz `context/domain/02-glossary.md` + rozdział w AGENTS.md + trzy wpisy w `lessons.md` (guard AST, zamrożona wartość na granicy).
- [ ] **EX-551** — model marży: robocizna = cena klienta, wypłaty = cena podwykonawcy. Nic do wyciągnięcia: potwierdzenie właściciela i rozstrzygnięcie „należne vs wypłacone" są w `kosztorys-editor-domain-notes.md:878` oraz w `investment-financials-and-discount.md:131`.
- [ ] **EX-552** · parasol pytań do właściciela (VAT / zaliczki / podwykonawcy) — nic. To spinacz
  ```
  na pod-issue; odpowiedzi na każde z nich siedzą w `context/reference/kosztorys-editor-domain-notes.md`.
  ```
- [ ] **EX-554** · „kwota do zapłaty podwykonawcy" — nic. Model (należne vs do zapłaty, zaliczki
  ```
  odejmowane) opisany w `kosztorys-editor-domain-notes.md:878-885`.
  ```
- [ ] **EX-555** · przełącznik zapisu: robocizna + rabat z kosztorysu na listingu — nic. Rozstrzygnięcia
  ```
  są w AGENTS.md dosłownie („There is no fallback, and no figure declares its source", „v1 vs v2 IS
  the source choice"), a odrzucone warianty A/B w komentarzach w kodzie. EX-649 częściowo to cofnął,
  co AGENTS.md też odnotowuje.
  ```
- [ ] **EX-556** · draft zostaje po udanym submicie bez `keepOpen` — nic. Właściciel zostawił zachowanie
  ```
  bez zmian; obie gałęzie `opts.onReset?.()` w `src/components/forms/hooks/use-form-submit.ts` nietknięte.
  ```
- [ ] **EX-557** · „Inna wpłata" / „Zasilenie" poza inwestycją — nic. Wynik zapisany komentarzem przy
  ```
  `INVESTMENT_TYPES` w `src/lib/constants/transfers.ts:436`. Obalona przesłanka („martwe od kwietnia")
  za cienka na wyciąg — AGENTS.md i tak mówi, że lokalna baza to kopia dumpa prod.
  ```
- [ ] **EX-560** · „Przeładuj z szablonu" — nic. Odrzucony projekt scalania w
  ```
  `context/archive/2026-08-12-ex-560-reload-from-preset/change.md:47`, zasada snapshot-przed-wipe
  w `context/foundation/lessons.md:259`.
  ```
- [ ] **EX-564** · procentowy rabat globalny (bulk apply) — nic.
  ```
  `context/archive/2026-07-22-kosztorys-percent-rabat-bulk-apply/`.
  ```
- [ ] **EX-565** · płaszczyzna narzędziowa etapu + rozliczenie podwykonawcy niezależne od widoku — nic.
  ```
  Sedno („oba widoki podwykonawcy wyceniają 100% wykonanej pracy, a relacja per-etap to OR, nie AND")
  jest w `kosztorys-editor-domain-notes.md:570` i `:233`.
  ```
- [ ] **EX-567** · `INVESTMENT_EXPENSE_NET` (spike) — nic. Cały projekt (dwie kwoty zamiast stawki VAT,
  ```
  dwa kubełki w `deriveFinancials`, kasa zawsze brutto, typ nierozliczalny) leży w
  `context/archive/2026-07-24-netto-expense-type/`, a reguły są komentarzami przy predykatach
  w `src/lib/constants/transfers.ts:46,76`.
  ```
- [ ] **EX-569** · „Pobierz faktury" w widoku klienta — nic. Kluczowa decyzja („publiczna
  ```
  powierzchnia nie może reużyć akcji, której filtr podaje wywołujący") jest już lekcją
  w `context/foundation/lessons.md:565-578`; reszta (w tym trwałość URL-i Blob po odwołaniu
  tokenu) w `context/archive/2026-07-25-kosztorys-client-invoices/change.md`.
  ```
- [ ] **EX-571** · widok podwykonawcy = rachunek jednej ekipy — nic.
  ```
  `context/archive/2026-07-25-subcontractor-view-settlement-only/` niesie fazy i obie decyzje
  właściciela (kolumny drugiego planu usuwane, etap bez trybu należy do żadnego planu).
  ```
- [ ] **EX-573** · tabela `TRANSFER_SPECS` — nic. Cały wywód (odwrócenie osi, `satisfies Record<…>`
  ```
  zamienia przeoczenie w błąd kompilacji, co świadomie NIE jest wyprowadzane) siedzi jako komentarz
  nad tabelą w `src/lib/constants/transfers.ts:18-60`, reszta w `context/archive/2026-07-25-transfer-type-spec-table/`.
  ```
- [ ] **EX-574** · „Suma wybranych transakcji" zawyżona o anulowania (+71%) — nic. Naprawa opisana
  ```
  w `context/archive/2026-07-28-cancellation-sum-overcount/`, a zasada „nieznany operator rzuca,
  nie znika po cichu" jest komentarzem w `src/lib/db/where-to-sql.ts:28-30,103`.
  ```
- [ ] **EX-575** · kasacja martwych kolumn `cost_variant` — nic. Skasowane; treść była uzasadnieniem
  ```
  kasowania, które po fakcie nie ma czego chronić.
  ```
- [ ] **EX-577** · skan AI czyta też netto — nic. Reguły („nullable, nigdy zgadywane", „na typie brutto
  ```
  pole zostaje niezapisane") są komentarzami przy `src/lib/ai/receipt-extraction-schema.ts:8-14`
  i `src/components/forms/expense-form/map-line-item.ts:31-34`.
  ```
- [ ] **EX-578** · jeden swap / jeden insert-at dla sekcji i pozycji — nic. Zrobione;
  ```
  `src/lib/kosztorys/display-order.ts` niesie w komentarzach powód transakcji (dwa wiersze na tym
  samym `display_order` = niedeterministyczna kolejność) i blokowanie `ORDER BY id FOR UPDATE`.
  ```
- [ ] **EX-579** · debounce zapisu koloru sekcji — nic. Zrobione, powód w komentarzu
  ```
  `src/components/kosztorys/editor/use-kosztorys-editor.ts:938`.
  ```
- [ ] **EX-580** · wiersze nagłówka sekcji — nic. `context/archive/2026-07-26-kosztorys-section-header-rows/`;
  ```
  niedokończone ptaszki manualne żyją w `context/foundation/manual-checks.md`, E2E w EX-582.
  ```
- [ ] **EX-581** · wydatki netto dostają własną zakładkę — nic.
  ```
  `context/archive/2026-07-26-netto-expenses-own-tab/` niesie rozstrzygnięcie właściciela
  („trzy rozłączne zbiory", korekty zostają w wydatkach inwestycyjnych, bo arkusz sam je tak etykietuje).
  ```
- [ ] **EX-585** · kolumna „Notatka" + podgląd faktury per wiersz — nic.
  ```
  `context/archive/2026-07-26-kosztorys-invoice-note-and-preview/`; kontrakt wirtualizatora
  (stała wysokość wiersza, brak pomiaru) siedzi komentarzem w
  `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:106`.
  ```
- [ ] **EX-586** · trzecia kopia triady trigger+state+dialog — nic. Zrobione; pułapka
  ```
  („podgląd zostaje otwarty za modalem uploadu") była o czymś, czego już nie ma.
  ```
- [ ] **EX-587** · rozbicie `queries/reference-data.ts` — nic; duplikat połowy EX-583,
  ```
  wykonany razem z nim.
  ```
- [ ] **EX-588** · tryb rozliczenia inwestycji (netto/brutto/mieszane) — nic. Rozstrzygnięcia
  ```
  właściciela (`MIXED` wybierane, nie wyliczane; zapisany tryb jest jedyną prawdą; bez backfillu;
  niezgodność krzyczy tylko u właściciela) są w `context/archive/2026-07-26-investment-settlement-mode/change.md:29-39`,
  a zasada „to decyzja o umowie, nie preferencja czytelnika" jako komentarz w
  `src/lib/kosztorys/settlement-mode.ts:4-6`.
  ```
- [ ] **EX-589** · krzyk o niezgodnej płaszczyźnie wpłat na inwestycji brutto — nic. Naprawione,
  ```
  a sedno („ta sama suma jest dobra do rozliczenia i zła jako dowód — wpłata bez znacznika nic
  nie mówi o swojej płaszczyźnie") stoi komentarzem nad `buildSettlementPlaneVerdict`
  w `src/lib/kosztorys/reconciliation.ts:75-83`.
  ```
- [ ] **EX-591** · widok klienta ignoruje wszystkie preferencje przeglądarki — nic. Zasada
  ```
  („to, co MOŻE być pokazane, decyduje allowlista, nie picker") żyje jako `PREVIEW_VISIBLE_COLUMNS`
  + komentarz w `src/lib/kosztorys/client-view-settings.ts:10-15`; ogólna reguła w
  `context/foundation/lessons.md:614`.
  ```
- [ ] **EX-592** · wspólne `makeTree()` / `createTestInvestment()` — nic. Jedyny nieoczywisty fakt
  ```
  (wygenerowany typ create Payloada nie modeluje `defaultValue` ani podziału draft/non-draft, więc
  pola z domyślną wartością i tak trzeba wypisać) jest komentarzem w
  `src/__tests__/helpers/investment.ts:5-11` z odwołaniem do EX-592.
  ```
- [ ] **EX-594** · panel Podsumowania na stronie inwestycji — nic.
  ```
  `context/archive/2026-07-26-investment-summary-panel/`.
  ```
- [ ] **EX-596** · trwała obniżka „materiały netto" — nic. Rozstrzygnięcia właściciela
  ```
  (dzielenie przez `1 + stawka`, nie mnożenie przez `1 − stawka`; własne pole, nie pochodna trybu
  rozliczenia; materiał to koszt przelotowy, więc marża nie dostaje z niego stałego członu) są
  w `context/foundation/investment-financials-and-discount.md:95-140` i w komentarzach
  `src/lib/db/investment-financials.ts:85-95`; reszta w
  `context/archive/2026-07-26-materials-net-pricing-persisted/`.
  ```
- [ ] **EX-600** — zakres filtrów panelu inwestycji. Nic do wyciągnięcia: reguła zakresu spisana
  ```
  w `context/reference/kosztorys-editor-domain-notes.md`, zmiana zarchiwizowana w
  `context/archive/2026-07-28-investment-panel-filter-scope/` (tam też korekty: `type` nie jest już
  strippowane po EX-574, a „czy filtr aktywny" trzeba czytać z surowych `searchParams`, nie z
  gotowego `Where`). 14 manualnych checków żyje w `context/foundation/manual-checks.md`, E2E na EX-634.
  ```
- [ ] **EX-602** — polskie literały `SummaryViewT`. Nic do wyciągnięcia: unia jest już angielska
  ```
  (`src/components/kosztorys/summary/hooks/use-summary-view.ts`), a reguła nazewnictwa siedzi w AGENTS.md.
  ```
- [ ] **EX-603** — strażniki widoczności marży. Nic do wyciągnięcia: pułapka `(share)/layout.tsx` bez
  ```
  `CurrentUserProvider` jest w `context/foundation/lessons.md:1338`, a przeciek liczb w payloadzie to
  trwała decyzja właściciela (nie zgłaszać ponownie).
  ```
- [ ] **EX-605** — rabat globalny, kontrakt sterowania. Nic do wyciągnięcia: cała reguła spisana w
  ```
  `context/reference/kosztorys-editor-domain-notes.md:525`.
  ```
- [ ] **EX-606** — masowe zerowanie rabatu 0%. Nic do wyciągnięcia: decyzja („destrukcyjne, bez cofania,
  ```
  okno potwierdzenia, wersja zapisuje się automatycznie") + notka „nie zgłaszaj ponownie" są w
  `kosztorys-editor-domain-notes.md:541-547`.
  ```
- [ ] **EX-607** — stopka sekcji. Nic do wyciągnięcia: zmiana w `context/archive/2026-07-27-kosztorys-section-footer-row/`,
  ```
  a obie trwałe zasady (jedna funkcja liczy „Razem" i stopki, więc Σ zgadza się z konstrukcji; kolumna
  bez uczciwej sumy jest pusta, nigdy 0) stoją w docblocku `src/lib/kosztorys/column-totals.ts:14`.
  ```
- [ ] **EX-609** — próg 80% ceny podwykonawcy. Nic do wyciągnięcia: cały wywód (stała a nie ustawienie,
  ```
  tolerancja pół grosza, mierzone od ceny sprzed rabatu, jeden werdykt zamiast drabinki) jest w
  docblockach `src/lib/kosztorys/subcontractor-price-guard.ts`; zmiana w
  `context/archive/2026-07-27-subcontractor-price-guard/`.
  ```
- [ ] **EX-611** — numery wierszy w rynience. Nic do wyciągnięcia: rola rynienki (numer + szyna sekcji,
  ```
  jedyny sticky-left element dsg) opisana w `src/components/kosztorys/editor/grid/ordinal-gutter-column.tsx`.
  ```
- [ ] **EX-612** — podwójny przebieg po wierszach na oś etapów. Nic do wyciągnięcia: złożone w jeden
      przebieg (`stageAxis` w `src/lib/kosztorys/column-totals.ts:71`).
- [ ] **EX-613** — przypisanie wykonawcy do etapu. Nic do wyciągnięcia: model i obie konsekwencje
      (przypisanie na etapie, nie na transakcji; `plane` dominuje, brak osoby nigdy nie blokuje ilości)
      w `context/reference/kosztorys-editor-domain-notes.md:625`, reszta w
      `context/archive/2026-07-27-kosztorys-stage-worker-assignment/`.
- [ ] **EX-615** — pusty edytor bez rusztowania pierwszej sekcji. Nic do wyciągnięcia:
      `context/archive/2026-07-28-drop-empty-kosztorys-scaffold/`, a „sekcja nigdy nie powstaje sama"
      stoi przy `createSectionWithFirstItem`.
- [ ] **EX-616** — komunikat przy zerowym wyniku wyszukiwania. Nic do wyciągnięcia: copy + jeden warunek.
- [ ] **EX-618** — dwupanelowy wybór sekcji z szablonu. Nic do wyciągnięcia: ograniczenie cmdk
      (filtruje tylko zamontowane) i decyzja o porzuceniu cmdk są w
      `context/archive/2026-07-28-scalable-preset-section-picker/change.md`.
- [ ] **EX-621** — szerokość wbita w `SearchFilterInput`. Nic do wyciągnięcia: szerokość wyniesiona do
      `SEARCH_FILTER_TOOLBAR_WIDTH`.
- [ ] **EX-623** — trzy konkurencyjne domy dla specek z `components/**`. Nic do wyciągnięcia: reguła
      pełnego mirroringu z przykładem głębokiej ścieżki jest w AGENTS.md § Testing.
- [ ] **EX-624** — założenia breakpointów w komponentach z shadcn. Nic do wyciągnięcia: reguła
      remapowania po intencji jest w AGENTS.md § Stack Notes.
- [ ] **EX-626** — dialogi przyklejone do lewej na telefonie. Nic do wyciągnięcia: `dialog.tsx` ma już
      jedno wyśrodkowanie dla wszystkich szerokości.
- [ ] **EX-630** — wspólny stub `next/cache`. Nic do wyciągnięcia: `src/__tests__/stubs/next-cache.ts` istnieje.
- [ ] **EX-632** — deadlock w speckach display-order. Nic do wyciągnięcia: uzasadnienie blokowania
      `ORDER BY id FOR UPDATE` stoi w `src/lib/kosztorys/display-order.ts:171,225`.
- [ ] **EX-635** — wspólny builder drzewa w speckach. Nic do wyciągnięcia: `src/__tests__/helpers/kosztorys-tree.ts`
      i `kosztorys-db-tree.ts` istnieją, z uzasadnieniem w komentarzu.
- [ ] **EX-641** — restore migawki z usuniętym pracownikiem. Nic do wyciągnięcia: decyzja (zerujemy
      przypisanie i ostrzegamy) widoczna w `src/lib/kosztorys/insert-kosztorys-tree.ts:81-87`.
- [ ] **EX-642** — wykonawca w nagłówku etapu. Nic do wyciągnięcia: czysto UI.
- [ ] **EX-643** — combobox gubiący wybraną, dezaktywowaną wartość. Nic do wyciągnięcia: reguła
      („aktywni to filtr, nie twarde wykluczenie") w `src/lib/utils/is-active-ref.ts:5`.
- [ ] **EX-645** / **EX-646** / **EX-650** — refaktory (expense-form, patcher etapu, split settlement.ts).
      Nic do wyciągnięcia: efekt widać w drzewie (`use-kosztorys-stage-ops.ts`, pięć modułów `settlement-*`).
- [ ] **EX-647** — `Description` w miejscach ręcznie sklejanych notek. Nic do wyciągnięcia: rozgraniczenie
      (notka vs etykieta, kiedy `role="alert"`) siedzi w `src/components/ui/description.tsx`.
- [ ] **EX-648** — wspólny store „w toku". Nic do wyciągnięcia: dlaczego kluczowany, a nie boolean —
      w `src/stores/pending-store.ts`.
- [ ] **EX-652** — jeden dom dla finansów całej inwestycji. Nic do wyciągnięcia: uzasadnienie rozdziału
      pobierania od wyliczania stoi w docblockach `src/lib/queries/whole-investment-financials.ts:20-27,45-51`.
- [ ] **EX-653** — panel podsumowania w pełni ślepy na filtry (odwrócenie EX-600). Nic do wyciągnięcia:
      zarchiwizowane w `context/archive/2026-08-08-summary-panel-filter-blind/` z własnym ledgerem
      bramki przeglądu; 17 sprawdzeń ręcznych stoi nieodhaczonych w `context/foundation/manual-checks.md`.
- [ ] **EX-658** — formularz wydatku netto: opis rozjeżdżał wiersz, „Kwota" bez brutto. Nic do
      wyciągnięcia: obie poprawki widać w kodzie (`expense-form.tsx:270` — zdanie pod wierszem,
      `line-items-field.tsx:270` — para „Brutto"/„Netto").
- [ ] **EX-659** — faktura wielostronicowa (`invoice` → `hasMany`). Nic do wyciągnięcia:
      zarchiwizowane w `context/archive/2026-08-10-multi-page-invoices/`, a powód jednego wywołania
      modelu na wszystkie strony (suma bywa na ostatniej) stoi komentarzem w `src/lib/ai/openrouter.ts:74`.
- [ ] **EX-660** — sweep uciszał zgłoszenie, które webhook miał zaraz powtórzyć. Nic do wyciągnięcia:
      całe rozumowanie w docblocku `src/lib/leads/reconcile-sweep.ts:25-45`, a kształt crona w
      `context/reference/facebook-leads-setup.md:120`.
- [ ] **EX-662** — „+" w tabeli otwiera systemowy picker zamiast dialogu. Nic do wyciągnięcia:
      zarchiwizowane w `context/archive/2026-08-10-invoice-attach-and-pdf-preview/change.md`, razem
      z rulingiem właściciela o odpuszczeniu ujednolicenia podglądu PDF (koszt `pdfjs-dist` + pager).
- [ ] **EX-665** — filtrowanie po kolumnach w siatce. Nic do wyciągnięcia: zgłoszenie stawiało tylko
      pytania otwarte, odpowiedziała na nie dowieziona funkcja
      (`context/archive/2026-08-18-kosztorys-filters-visible-and-extended/`).
- [ ] **EX-669** — `InvestmentRowT` / `CashRegisterRowT` do `src/types`. Nic do wyciągnięcia: typy
      siedzą w `src/types/table-rows.ts`, sama inwersja warstw jest regułą z globalnych zasad.
- [ ] **EX-672** — usunięcie wydruku i eksportu CSV. Nic do wyciągnięcia: zarchiwizowane w
      `context/archive/2026-08-12-ex-672-remove-print-csv-export/`, a jedyny nietrywialny wniosek
      (pulpit nie dostaje pobierania faktur, bo jego `where` nie jest zakotwiczone — spakowałby
      wszystkie faktury w systemie) stoi w JSDoc `transfer-table-config.ts:18-23`.
- [ ] **EX-675** — strata obniża dług klienta. Nic do wyciągnięcia: wiedza już przeniesiona do
      `context/foundation/investment-financials-and-discount.md` (tabela typów :155, `faceValue`
      :191, odwrócenie decyzji z 2026-06-11 :198); zmiana w `context/archive/2026-08-12-strata-obniza-bilans/`.
- [ ] **EX-680** — wpłaty per inwestycja z jednego źródła. Nic do wyciągnięcia: zarchiwizowane w
      `context/archive/2026-08-12-wplaty-jedno-zrodlo/`.
- [ ] **EX-682** — sortowanie wewnątrz sekcji. Nic do wyciągnięcia: `sortRowsWithinSections`
      w `src/lib/kosztorys/row-view.ts:72`, zmiana w `context/archive/2026-08-13-kosztorys-sort-within-sections/`.
- [ ] **EX-683** — trwałe sortowanie sekcji. Nic do wyciągnięcia: patrz EX-688, wspólne archiwum.
- [ ] **EX-685** — rozbicie dwóch modułów-worków. Nic do wyciągnięcia: `map-category-costs.ts` już
      nie istnieje, `deposit-planes.ts` niesie regułę „brak wartości = netto" komentarzem (:31),
      `gross-balance.ts` stoi obok `calculate-balance.ts`.
- [ ] **EX-686** — rozjazd „Pomiar z natury" vs suma etapów. Nic do wyciągnięcia: zgłoszenie samo
      odnotowuje destylację do `context/reference/kosztorys-editor-domain-notes.md` i `lessons.md`;
      zmiana w `context/archive/2026-08-13-pomiar-bez-etapu/`.
- [ ] **EX-688** — zakres sortowania + utrwalanie kolejności. Nic do wyciągnięcia: reguła „zapisujemy
      wynik (`display_order`), nie regułę sortowania" stoi w
      `context/archive/2026-08-13-kosztorys-sort-scope-and-bake/change.md:27-32`, a pasy vs zakres
      w notatkach domenowych (:826).
- [ ] **EX-690** — ręczne wskazanie kolumn arkusza + komunikaty o dostępie. Nic do wyciągnięcia:
      zasada „zapis jest tylko awaryjny, nagłówek zawsze wygrywa" w
      `context/archive/2026-08-14-sheet-column-mapping/change.md:34`.
- [ ] **EX-691** — porównanie z arkuszem a rabat globalny. Nic do wyciągnięcia: rozstrzygnięcie
      (porównujemy wiersz do wiersza, kwoty globalnej nie da się uczciwie rozsmarować, liczymy tylko
      CZY się rozjeżdża) stoi w docblocku `build-sheet-comparison.ts:130-137`.
- [ ] **EX-692** — kolejność kolumn w edytorze. Nic do wyciągnięcia: zarchiwizowane w
      `context/archive/2026-08-15-kosztorys-column-order/`, razem z odrzuceniem draga nagłówków
      (kolumny wirtualizowane poziomo).
- [ ] **EX-694** — scalenie lokalnego `staging` z origin. Nic do wyciągnięcia: obie sporne reguły
      (numeracja po pełnym zbiorze, tłumienie zwinięć) siedzą w notatkach domenowych (:766, :778),
      a tabela rozstrzygnięć hunków jest zapisem jednorazowej operacji.
- [ ] **EX-695** — ustawienia widoku klienta. Nic do wyciągnięcia: cała sekcja „Co widzi klient —
      ustawienie, nie stała" w `context/reference/kosztorys-editor-domain-notes.md:287`, łącznie
      z uzasadnieniem jednego złączonego filtru pustych pozycji.
- [ ] **EX-697** — dokończenie sprzątania po bramce EX-695. Tania partia weszła w commitach
      `8e47fb80`, `d717b452`, `b60c886c` (w tym `useDraft`); pięć refaktorów odłożonych „na własny
      review" siedzi co do słowa w `context/archive/2026-08-15-client-preview-settings/review-gate.md:34`
      — nic do wyciągnięcia.
- [ ] **EX-700** — blokada `FOR UPDATE` na całym gospodarzu przy przenumerowaniu. Cały pomiar i
      rozstrzygnięcie („zawężenie kupuje tę milisekundę i kosztuje własność poniżej, więc nie") stoją
      w komentarzu `src/lib/kosztorys/display-order.ts:80-95` — nic do wyciągnięcia.
- [ ] **EX-701** — bufor serii zmian poza `useUndoRedo`. Zweryfikowane jako nieszkodliwe, uzasadnienie
      w `src/components/kosztorys/editor/hooks/use-auto-snapshot.ts:18-26` — nic do wyciągnięcia.
- [ ] **EX-703** — zdjęcie kolumn „% wykonania" per etap i osi PLN/Procent. Zarchiwizowane w
      `context/archive/2026-08-17-drop-stage-percent-columns/` — nic do wyciągnięcia.
- [ ] **EX-706** — blok stawek w porównaniu z arkuszem. Rozstrzygnięcie właściciela („konflikt bije
      rozjazd, bo konflikt znaczy, że kwoty NIE MA") jest docblockiem
      `src/components/kosztorys/editor/dialogs/sheet-rates-verdict.ts:1-40` — nic do wyciągnięcia.
- [ ] **EX-707** — diagnostyka „praca bez przedmiaru". Wpis żyje w
      `src/lib/kosztorys/row-conditions.ts:279` — nic do wyciągnięcia.
- [ ] **EX-708** — ostrzeżenie o stawce liczonej od ceny z materiałem. Konwencja właściciela wyciągnięta
      wcześniej (przy EX-649) do `context/reference/kosztorys-editor-domain-notes.md`, a sam mechanizm
      — trzyczęściowy predykat, czytanie przez etap i liczenie po obu płaszczyznach — stoi w docblocku
      `src/lib/kosztorys/row-conditions.ts:84-100`. Odrzucona alternatywa (jawna flaga per pozycja)
      przegrała na braku odbiorcy, nie na trudności — nic do wyciągnięcia.
- [ ] **EX-713** — pasek aktywnych filtrów. Rozstrzygnięcia (pasek nazywa każde źródło ukrywania,
      brak przeliczania wysokości siatki bez ResizeObserver, „Wyczyść wszystko" nie zdejmuje
      sortowania) są w `context/reference/kosztorys-editor-domain-notes.md:806-822` — nic do
      wyciągnięcia.
- [ ] **EX-714** — rozszerzenie rejestru warunków. Reguła „zbiór wartości zamknięty → warunek w
      rejestrze, nigdy picker wartości" stoi w
      `context/archive/2026-08-18-kosztorys-filters-visible-and-extended/change.md:27`, a odrzucenie
      filtrów wartościowych na merit w `kosztorys-editor-domain-notes.md:819` — nic do wyciągnięcia.

## Wyciągnięte do dokumentacji

- [ ] **EX-411** → `context/foundation/lessons.md`: dopisana klauzula (5) do lekcji o statycznych
  ```
  audytach — decyzja z 2026-07-08, żeby **nie** wpinać dependency-cruisera w pre-push. Z dwóch
  granic `error` jedna egzekwuje się sama (`server-only` wywala `generate:types`), a druga to
  zakaz bezpośredniego importu, czyli teren ESLinta (`no-restricted-imports` w `eslint.config.mjs`
  na `src/hooks/**`) — działa w edytorze i na pre-commicie zamiast dopiero przy pushu. Po depcruise
  sięgamy tylko wtedy, gdy reguła naprawdę potrzebuje grafu przechodniego.
  ```
- [ ] **EX-416** → `context/reference/facebook-leads-setup.md`: (a) sekcja regeneracji tokenu przepisana
  ```
  na ścieżkę System User — **pięć** scope'ów, z nieoczywistym `pages_manage_ads` (bez niego
  `/{page_id}/leadgen_forms` leci `(#200)`), plus pułapka, że sam token System Usera dostaje
  `(#190) must be called with a Page Access Token` i trzeba wyprowadzić token Strony przez
  `GET /{PAGE_ID}?fields=access_token` (dziedziczy brak wygasania); stara ścieżka Explorera została
  jako fallback. (b) Nowa sekcja „Known gap: webhook rows carry no `form_id`" — `GET /{leadgen_id}`
  bez `?fields` nie zwraca `form_id`, więc webhook nigdy nie pobiera pytań formularza i normalizuje
  po heurystykach; ścieżka reconcile jest zdrowa, bo podaje `form.id` jawnie. **To jedyny żywy
  zapis otwartego buga** — archiwum `2026-08-10-cron-lead-reconcile` tylko odsyłało do EX-416.
  ```
- [ ] **EX-546** — panel admina / REST mógł osierocić znacznik etapu mimo poprawki w akcji. **Wyciągnięte** do `context/foundation/lessons.md`: niezmiennik samego wiersza należy do hooka kolekcji (akcja to tylko jeden z trzech zapisujących), a `beforeValidate` przy update dostaje pełny scalony dokument obok `originalDoc` — czyli wykrycie zmiany pola jest jednoznaczne. Przesłanka odwrotna wzięła się z czytania źródeł Payloada i obaliła ją dziesięciominutowa sonda po testowej bazie.
- [ ] **EX-558** → `context/reference/kosztorys-editor-domain-notes.md` (sekcja VAT). Wyciągnięto
  ```
  rozstrzygnięcie właściciela z 2026-07-21: rozliczenie z podwykonawcą idzie **bez VAT** (ekipa nie
  wystawia faktury, netto = brutto), więc blok „Podsumowanie podwykonawców" nie ma przełącznika
  netto/brutto — zostaje on tylko w widoku Klient. Nie miało domu w repo, a istniejący zapis
  o „3 wariantach ceny (klient + oba podwykonawcy) na osi netto/brutto" czytał się odwrotnie.
  ```
- [ ] **EX-572** → `context/foundation/lessons.md` (nowa sekcja „A fixture in a degenerate state
  ```
  makes every absence assertion vacuous"). Wyciągnięto pułapkę testową: fikstura ze stanem
  zdegenerowanym (`plane: null`) sprawia, że spec złożony z samych asercji nieobecności porównuje
  pustą listę z pustą listą — i tak właśnie CRITICAL z EX-571 przeszedł na zielono. W repo nie
  było tej reguły (lekcja o „vacuously true drift assertion" dotyczy dedupu dwóch list, nie fikstur).
  ```
- [ ] **EX-583** → `context/foundation/lessons.md` (nowa sekcja „A row type files with the producer
  ```
  when it is nominal, with the consumer when it is structural"). Wyciągnięto regułę rozmieszczenia
  typów, opisaną w issue wprost jako „worth reusing": typ nominalny (opisuje wynik konkretnego
  zapytania i zmienia się z jego schematem) ląduje przy producencie, typ strukturalny przy
  konsumencie — oś to „co go zmienia", nie „kto go importuje". Ani AGENTS.md, ani globalna reguła
  TS tego nie mówiły.
  ```
- [ ] **EX-590** → `context/foundation/lessons.md` (dopisany punkt do sekcji „A per-browser
  ```
  preference stops being a preference…"). Wyciągnięto następstwo, którego lekcja nie miała:
  przy zamianie preferencji na zapisany fakt **wędrują też jej blokady**, a większość z nich
  przestaje być prawdziwa — `disabled` przy VAT 0% miało sens dla ustawienia widoku, a na
  zapisanym trybie zamykało inwestycję w `GROSS`/`MIXED` na stałe.
  ```
- [ ] **EX-597** — `unstable_cache` nie deduplikuje w obrębie jednego renderu (3× `fetchReferenceData`),
  ```
  a zagnieżdżony w drugim `unstable_cache` w ogóle wyłącza cache. Wyciągnięte do
  `context/foundation/lessons.md` (nowa sekcja); część zapisowa była już w `lessons.md:652`.
  ```
- [ ] **EX-601** — relay propsów w powłoce edytora. Wyciągnięte do
  ```
  `context/foundation/investment-financials-and-discount.md`: `settledBreakdown` leci bezwarunkowo,
  a `financials` tylko dla ADMIN/OWNER, bo MANAGER ma widzieć rozliczone materiały bez marży —
  nakładanie się propsów to bramka dostępu, nie duplikacja.
  ```
- [ ] **EX-608** — nazwa inwestycji w okruszku. Wyciągnięte jako komentarz przy
  ```
  `getInvestmentName` (`src/lib/queries/investments.ts:68`): czyta z ciepłego `fetchReferenceData`
  zamiast trzeciego round-tripu, a bramka roli jest nośna — bez niej sesja spoza zarządu ciągnęłaby
  cały zestaw referencyjny po sam okruszek.
  ```
- [ ] **EX-622** — liczenie pozycji szablonu w SQL. Wyciągnięte do `context/foundation/lessons.md`:
      skorelowany `jsonb_array_elements` kosztuje nie tylko O(sekcje×pozycje) — planner wycenia SRF na
      100 wierszy, wjeżdża w JIT i płaci ~115 ms kompilacji za 26-wierszowy wynik (122 ms vs 2,5 ms dla
      CTE); plus `WITH ORDINALITY` przy zamianie stabilnego `.sort` z JS na sortowanie Postgresa.
- [ ] **EX-631** — netto i brutto w podglądzie klienta. Wyciągnięte do
      `context/reference/kosztorys-editor-domain-notes.md` (sekcja „Co widzi klient"): podgląd nie zna
      `settlementMode`, o ujawnieniu decyduje wyłącznie allowlista.
- [ ] **EX-649** — marża prognoza vs rzeczywista. Model jest już w
      `context/foundation/investment-financials-and-discount.md:117`; dodatkowo wyciągnięta konwencja
      właściciela do `context/reference/kosztorys-editor-domain-notes.md`: pozycja z materiałem
      wliczonym w cenę j.m. dostaje stawkę podwykonawcy kwotą stałą, bo na domyślnym współczynniku
      ekipa bierze procent od materiału.

## Do sprawdzenia

_Kolejka pusta — wszystkie Done issues z projektu „Wykonczymy" sprawdzone._
