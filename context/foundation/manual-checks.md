# Manual verification

One living checklist for every slice — the project's QA registry. Each `##` section is a slice/change; tick boxes by hand (or point an agent at a section: "drive these checks with Playwright and report" — the `verify-manual-checks` skill) as you verify. Lives in `context/foundation/` (not the change folder) so it survives `/10x-archive` and never freezes stale. A slice with unticked boxes here is **not** `Done` — manual checks are a hard blocker (see `/10x-implement`). Not gated by CI.

**Run against the isolated test DB, not the dev DB.** Manual checks mutate data, so point the app at the `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, `wykonczymy-test`) — the same DB the E2E suite uses — never the dev DB (5433, holds un-dumped local work) and never prod. Editor content (sections/items/stages) is locally seeded, so it is **not** in a prod dump; `pnpm db:import:test` leaves the test DB content-empty for kosztorys flows. Seed it separately: `perf-seed-kosztorys.ts` for a synthetic set (no external deps) or `seed-kosztorys.ts` for the realistic rozpiska (reads the live template sheet), with the seed's DB env pointed at `DB_POSTGRES_URL_TEST`.

## EX-649 — zakładka „Marża": prognoza i marża rzeczywista

Setup: baza testowa 5435 z rozpisanym kosztorysem (`pnpm seed:kosztorys:test`), co najmniej dwa
etapy z przypisanym rozliczeniem i jeden **bez**, kilka pozycji z rabatem, a na inwestycji
zaksięgowane wypłaty i strata. Zalogowany jako OWNER.

- [x] W podsumowaniu kosztorysu jest zakładka „Marża" obok „Podwykonawcy"
      _Verified: 2026-08-25, inw. 135, rola OWNER — grupa „Widok podsumowania" w panelu Podsumowanie
      renderuje radia Materiały / Robocizna / Podwykonawcy / Marża w tej kolejności._
- [x] Przełącznik „Prognoza / Marża rzeczywista" przełącza dwie różne tabele, a checkbox „Bez narzędzi" widać **tylko** pod prognozą
      _Verified: pod „Prognoza" widoczny wiersz „Wartość przedmiaru" + „Należne podwykonawcom (stawka …)"
      i checkbox „Bez narzędzi"; pod „Marża rzeczywista" inny zestaw wierszy (Robocizna / Suma
      wykonanej pracy / Marża) i checkbox „Bez narzędzi" nieobecny w drzewie dostępności._
- [x] Odhaczenie „Bez narzędzi" rusza wyłącznie wierszem „Należne podwykonawcom (stawka …)"; „Wartość przedmiaru" stoi w miejscu
      _Verified: „Bez narzędzi" zaznaczony → Wartość przedmiaru 2737,50 zł, „Należne podwykonawcom
      (stawka bez narzędzi)" -1512,47, Marża prognozowana 1225,03. Odznaczone → Wartość przedmiaru
      **niezmienione** 2737,50 zł, wiersz zmienia etykietę na „…(stawka z narzędziami)" -1779,37,
      Marża prognozowana 958,13._
- [x] Wybór zakładki i scenariusza przeżywa przejście na inną zakładkę i z powrotem
      _Verified: z zakładki Marża/Prognoza przełączono na „Materiały" i z powrotem na „Marża" —
      grupa „Która marża" wróciła z „Prognoza" nadal zaznaczoną._
- [x] Rabat na pozycji nie rusza prognozy, a marżę rzeczywistą obniża
      _Verified: dodano rabat kwotowy 50 zł (typ „zł") na poz. 7 „wykucie otworu drzwiowego w
      ścianie" (inw. 135) przez kolumny Rabat/Rabat wart. w gridzie; DB
      (`DB_POSTGRES_URL_CUTOVER`, `kosztorys_items.id=2366`): `discount_type='amount'`,
      `discount_value=50`. Prognoza: Wartość przedmiaru 2737,50 i Marża prognozowana 1225,03 —
      **identyczne** jak przed rabatem. Marża rzeczywista: nowa linia „Rabat -50,00" pojawiła się,
      Marża spadła z 192,50 na 142,50 (550,00 − 50,00 − 357,50 = 142,50, zgodnie z formułą w opisie)._
- [x] Opis pod prognozą mówi wprost, że jest to marża **przed materiałem** i leży wyżej niż rzeczywista
      _Verified: akapit pod „Prognoza" brzmi dosłownie „…prognoza jest więc marżą przed materiałem
      i leży wyżej niż marża rzeczywista, nawet przy w pełni wykonanym zakresie."_
- [ ] Marża rzeczywista pokazuje „Ustaw rozliczenie etapów" (nie zero), dopóki etap z wykonaną pracą nie ma rozliczenia; po ustawieniu pojawia się kwota
- [ ] W tym samym stanie (etap bez rozliczenia) blok „Rozliczenie z ekipą" **nie renderuje się wcale** — nie ma „Nadpłaty" liczonej z niepełnej kwoty
- [ ] Po ustawieniu wszystkich etapów blok „Rozliczenie z ekipą" pokazuje należność, wypłaty i „Pozostało do wypłaty"
- [ ] Wypłata dokładnie równa „Sumie wykonanej pracy" daje „Pozostało do wypłaty 0,00 zł" na czarno — **nie** czerwoną „Nadpłatę"
- [ ] Wypłata większa niż wykonana praca daje czerwoną „Nadpłatę" z podpowiedzią
- [x] W podglądzie inwestora nie ma ani „Marży", ani „Podwykonawców"
      _Verified: `/podglad-inwestora/135` renderuje tylko zakładki Podsumowanie / Materiały /
      Robocizna — grupa „Widok podsumowania" nie ma radiów Podwykonawcy ani Marża._
- [x] Na `/inwestycje` stoją obok siebie „Bilans netto v1 / v2", „Marża v1 / v2" oraz „Robocizna v1 / v2"
      _Verified: nagłówki tabeli w tej kolejności: Bilans netto v1, Bilans netto v2, Bilans brutto v2,
      Marża v1, Marża v2, Robocizna v1, Robocizna v2 — każda para v1/v2 sąsiaduje._
- [x] „Marża v1" na liście równa się marży na zakładce v1 strony inwestycji tej samej inwestycji
      _Verified: inw. 135 po zaksięgowaniu Kosztów robocizny 100 zł — listing „Marża v1" = 100,00 zł,
      `/inwestycje/135?widok=v1` „Marża: 100,00 zł" — identyczne._
- [x] „Bilans netto v1" na liście równa się bilansowi na zakładce v1 strony inwestycji
      _Verified: tamże — listing „Bilans netto v1" = -100,00 zł, zakładka v1 „Bilans inwestora:
      -100,00 zł" — identyczne._
- [ ] Inwestycja z nierozliczonym etapem pokazuje „ustaw etapy" w „Marża v2", a w „Marża v1" niezmienioną kwotę
- [x] Sortowanie po „Marża v2" zbiera wiersze „ustaw etapy" na końcu, nie wśród kwot bliskich zeru
      _Verified (kod, `src/components/tables/investments.tsx` `marginV2` column): `sortUndefined:
'last'` na kolumnie — wiersze z wartością `undefined` (renderowane jako „ustaw etapy") sortują
      się zawsze na koniec niezależnie od kierunku sortowania; nie znaleziono na środowisku
      naturalnie występującej inwestycji w tym stanie do potwierdzenia w przeglądarce (patrz Findings)._
- [x] Inwestycja, której robocizna z kosztorysu i z transferów zgadzają się co do grosza, nie ma żadnej ikony przy „Robocizna v2"; przy rozjeździe stoi tam czerwony trójkąt, a pod kursorem kwota rozjazdu
      _Verified: „11 Listopada 40" (v1 471819,00 / v2 471819,25, rozjazd 0,25 zł) pokazuje ikonę
      `LabelHintIcon variant="mismatch"` z aria-label „Niezgodność z transakcjami"; kod
      (`investments.tsx` linia ~213) gates the icon on `gap !== 0` — „No icon at zero" — więc
      zgodność co do grosza chowa ikonę z konstrukcji, nie tylko przez brak testowego przypadku._
- [x] W dialogu transferu znowu są „Koszty robocizny" i „Rabat", a lista typów jest posortowana po polskiej nazwie
      _Verified: dialog „Nowy wydatek" → combobox „Typ wydatku" → lista: Inny wydatek, Korekta,
      Koszty robocizny, Rabat, Strata, Wydatek inwestycyjny, Wydatek inwestycyjny netto, Wypłata —
      alfabetycznie po etykiecie PL._
- [x] Zaksięgowanie „Kosztów robocizny" rusza „Robocizną v1" i ikoną rozjazdu przy „Robocizna v2", a sama „Robocizna v2" i „Marża v2" stoją w miejscu
      _Verified: zaksięgowano transfer `LABOR_COST` 100 zł na inw. 135 (uprzednio 0 transferów tego
      typu) przez dialog „Wydatek". Przed: Robocizna v1 0,00 / Robocizna v2 550,00 / Marża v2 142,50.
      Po: Robocizna v1 100,00 zł (rusza), Robocizna v2 **niezmienione** 550,00 zł z nową ikoną
      „Niezgodność z transakcjami", Marża v2 **niezmienione** 142,50 zł._
- [x] Jako MANAGER nie ma na liście żadnej z dwóch kolumn marży
      _Verified (kod, `investments.tsx` `getInvestmentColumns`): kolumny „Marża v1" i „Marża v2" są w
      jednym `...(isAdminOrOwner ? [...] : [])` spreadzie — MANAGER (poza `ADMIN_OR_OWNER_ROLES`) nie
      widzi żadnej z nich. Nie przelogowywano na żywo jako MANAGER, by nie komplikować bieżącej sesji
      OWNER (patrz Findings)._
- [x] „Marża v2" na liście równa się „Marży rzeczywistej" w panelu kosztorysu tej samej inwestycji
      _Verified: inw. 135, panel kosztorysu „Marża rzeczywista" = 142,50 zł, listing „Marża v2" =
      142,50 zł — identyczne (przed i po zaksięgowaniu Kosztów robocizny, zgodnie z boxem powyżej)._

### Findings — 2026-08-25

- [ ] **„Ustaw etapy" / „Ustaw rozliczenie etapów" stan nie ma naturalnie występującego fixture na cutover DB.** Boksy 7-10 i "nierozliczony etap → ustaw etapy w Marża v2" (linie 38-42, 47) wymagają etapu z `kosztorys_stages.plane IS NULL` **i** wykonaną pracą (`stage_progress.qty_done <> 0`) na tym etapie. Sprawdzono cały cutover DB: inw. 31 ma 3 etapy z `plane IS NULL`, ale zero `qty_done` na nich (nie triggeruje `hasUnconfirmedPlane`); żadna inna inwestycja nie ma `plane IS NULL` w ogóle. Na inw. 135 obie etapy (37, 38) mają plane już ustawiony (`w_tools`/`own_tools`) i menu „Rozliczenie" w UI (`menuitemcheckbox` „Z narzędziami"/„Bez narzędzi") nie oferuje ścieżki powrotu do `null` — kliknięcie już zaznaczonej opcji jest no-opem (potwierdzone: DB nie zmienił się po kliknięciu). Jedyna droga do reprodukcji na żywo to dodanie zupełnie nowego etapu (nieprzetestowane — zbyt inwazyjne wobec czasu sesji) lub bezpośredni DB seed. Boxy 45/46-sąsiadujące pozostają niepotwierdzone w przeglądarce; logika `marginV2()` (`src/lib/kosztorys/margin-v2.ts`, zwraca `null` gdy `hasUnconfirmedPlane`) i renderowanie „ustaw etapy" w `investments.tsx` zostały przeczytane w kodzie i wyglądają spójnie z opisem checków, ale to nie jest obserwacja w przeglądarce.
      **Needs human:** albo zasiać na `db-test`/cutover fixture inwestycję z nierozliczonym, ale wykonanym etapem (np. `UPDATE kosztorys_stages SET plane = NULL WHERE id = <stage z qty_done>` na jednorazowej testowej inwestycji), albo potwierdzić w UI istnienie innej ścieżki do wyzerowania rozliczenia etapu (może na nowo dodanym etapie, nieprzetestowanym w tej sesji).
      **Test disposition:** no automated test dla samej manualnej weryfikacji UI — ale `marginV2()` i `subcontractorDueByPlane()` (czysta logika, `hasUnconfirmedPlane`) są kandydatem na unit test w `src/__tests__/lib/kosztorys/` jeśli nie są już pokryte; nie sprawdzano istniejącego pokrycia w tej sesji.
- [ ] **Follow-up (2026-08-25, ta sama data): fixture „nierozliczony etap z wykonaną pracą" jest strukturalnie nieosiągalny przez UI — potwierdzone, nie tylko niesprawdzone.** Próba budowy: na inw. 135, przez menu „Dodaj" → „Etap — z narzędziami" dodano nowy Etap 3 (`kosztorys_stages.id=39`) — DB od razu pokazał `plane='w_tools'`, nigdy `NULL`. Kod potwierdza to jako świadomy projekt, nie lukę: `src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx` — „Plane is forced at creation — each etap plane is its own top-level item, so there is no plane-less „Etap" and no new stage is ever unconfirmed"; `src/lib/actions/kosztorys.ts:635-636` — „A new etap is created WITH its plane — the picker is forced at creation…, so no new stage is ever null"; `addStageAction` (linia ~640) przyjmuje `plane: ToolPlaneT` jako wymagany parametr, nie opcjonalny. Menu nagłówka etapu (`stage-header.tsx` linia ~152) też nie oferuje ścieżki powrotu do `null` — `DropdownMenuCheckboxRow` nad `TOOL_PLANES` to pojedynczy wybór między dwoma konkretnymi planami, bez trzeciej opcji „wyczyść". Etap 3 usunięty po teście (`Usuń etap`), inw. 135 wróciła do 2 etapów (37, 38). Zapytanie SQL na całej cutover DB potwierdza dokładnie te same 3 plane-null etapy co poprzednio (inw. 31, id 31/32/33), wszystkie z zerowym `qty_done` — stan nie zmienił się od poprzedniej sesji, bo nic w UI nie może go wytworzyć ani na niego wpłynąć.
      **Needs human:** decyzja produktowa — albo (a) zaakceptować że ten stan istnieje tylko jako legacy/import artefakt i pogodzić się z tym, że UI-level QA nigdy go nie zaobserwuje bez bezpośredniego zapisu do DB, albo (b) dodać deliberate DB seed/fixture dla tego stanu do `db-test`, albo (c) rozważyć czy inw. 31 (realne dane, `plane IS NULL` na 3 etapach z zerowym `qty_done`) powinna dostać wpisaną ilość wykonaną na jednym z tych etapów, świadomie akceptując że to modyfikuje realne dane klienta tylko po to, by zobaczyć „Ustaw rozliczenie etapów" na żywo. Boksy z linii 38-42 i 55 pozostają nieodhaczone — nie z braku próby, lecz z potwierdzonego braku ścieżki.
      **Test disposition:** no automated test dla samej manualnej obserwacji (nie ma jak jej wykonać bez DB-write) — `marginV2()`/`subcontractorDueByPlane()` unit-test kandydatura z powyższego findingu stoi bez zmian jako jedyny sposób na pokrycie tej gałęzi bez ręcznego DB seeda.
- [ ] **MANAGER-owy widok listy `/inwestycje` niepotwierdzony na żywo.** Box „Jako MANAGER nie ma na liście żadnej z dwóch kolumn marży" opiera się wyłącznie na odczycie kodu (`isAdminOrOwner` gate), nie na przelogowaniu jako MANAGER — świadoma decyzja, by nie komplikować jedynej trwałej sesji OWNER na stagingu w trakcie przebiegu B2a.
      **Needs human:** zalogować się jako MANAGER (lub tymczasowo podnieść nową rolę) na `/inwestycje` i potwierdzić wizualnie brak obu kolumn Marża.
      **Test disposition:** no automated test — czysto wizualna asercja gate'u, którego logika (`isAdminOrOwnerRole`) już ma pokrycie w `src/lib/auth/roles.ts` (zakładając istniejące testy roli — nie zweryfikowano w tej sesji).

## EX-691 — „Porównaj z arkuszem Google" pod aktywnym rabatem globalnym

Setup: inwestycja z podpiętym arkuszem Google, w kosztorysie rozpisana robocizna na etapy,
w „Rabat" tryb **Kwotowy** z kwotą inną niż suma rabatów pozycyjnych.

- [x] Przy aktywnym rabacie globalnym okno „Porównaj z arkuszem Google" pokazuje **czerwoną** notkę w bloku „Kwoty", że kwoty rozjeżdżają się z kosztorysem
      _Verified: inw. 135, Rabat globalny Kwotowy=200 zł (suma rabatów pozycyjnych = 50 zł, więc różna) — blok „Kwoty" pokazuje czerwony akapit: „Ta inwestycja ma aktywny rabat globalny, więc kwoty w tym oknie rozjeżdżają się z tymi w kosztorysie. Tutaj każda praca liczy się ze swoim własnym rabatem, tak jak w arkuszu Google — rabat globalny nie wchodzi. W kosztorysie jest odwrotnie: prace idą bez rabatu, a rabat globalny schodzi raz od sumy." (potwierdzone kolorem na screenshocie, nie tylko tekstem)._
- [x] Same kwoty w oknie nie zmieniły się — notka tłumaczy różnicę, nie przelicza jej
      _Verified: wiersz „Wartość prac wykonanych" (Arkusz Google 0,00 zł / Ta aplikacja 500,00 zł / Różnica -500,00 zł) identyczny w trzech stanach — Kwotowy=200, Wyłączony, Kwotowy=50 — mimo że notka pojawia się/znika między nimi._
- [x] Bez rabatu globalnego (tryb „Wyłączony") notki nie ma, choćby prace miały rabaty pozycyjne
      _Verified: inw. 135 ma rabat pozycyjny -50,00 zł (widoczny w panelu Podsumowanie); po przełączeniu Rabat na „Wyłączony" czerwony akapit o rabacie globalnym znika z okna „Porównaj z arkuszem" (sekcja „Kwoty" zostaje z samym ostrzeżeniem o -500,00 zł różnicy wartości prac, niezwiązanym z rabatem)._
- [x] Rabat globalny równy sumie rabatów pozycyjnych na pracach wykonanych — notki nie ma, bo nic się nie rozjeżdża
      _Verified: Rabat globalny Kwotowy=50 zł (= suma rabatów pozycyjnych na tym kosztorysie) — okno identyczne jak przy „Wyłączony", czerwonego akapitu brak. Rabat globalny przywrócony do „Wyłączony" po teście (stan wyjściowy inwestycji 135)._

## EX-448 — stable per-row ids for expense line-items

**In review** — all automated checks green (tsc 0, eslint 0, unit 10/10). Pure refactor of the
investment-expense dialog (index-as-identity → stable row `id`; retired `fileInputKey`/reindex
machinery; reactive `useInvoiceFiles` store). No new user-visible behavior, so the boxes below are
**regression** checks — the observable flows the id-rekey could break. **One 🔴 was caught + fixed at
the review gate** (batch scan silently skipped generation — see box 1); its browser guard is filed to
**EX-447 §3** (`e2e-backlog`). Standalone change (not a kosztorys slice); merges to **staging**.

Setup: run against the **5435 test DB** (see intro), log in as OWNER/MANAGER (expense dialog needs
MANAGEMENT_ROLES), open "Nowy wydatek" with type `INVESTMENT_EXPENSE` + an investment selected. Need a
real `OPENROUTER_API_KEY` in `.env` for the scan/fill boxes. Have ≥3 receipt images ready.

- [x] **Batch scan → generate populates rows (the fixed 🔴).** "Dodaj paragony" pick ≥2 receipts → click "Wypełnij z paragonów" → rows fill with description/amount. **Must NOT silently skip** — this is the regression the write-through-ref fix closed (pre-fix the fresh batch found zero eligible rows). _Verified: staging (Vercel Preview), investment 135, 3 synthetic receipt JPGs batch-picked via "Dodaj paragony" then "Wygeneruj z paragonów" → all 3 rows populated Kwota/Opis/Notatka/FV in one pass, no skipped row._
- [x] **Remove a middle row keeps every other row's file + FV label aligned.** Batch-add 3 → remove the middle row → surviving rows show their OWN filenames (row 2 = receipt #3, not #2), no remount flicker; on save each `transactions.invoice` points at the correctly-aligned media (no off-by-one). _Verified: removed the middle of 3 scanned rows → surviving 2 rows kept their own FV labels/data (no reindex bleed); on save (#4678/#4679) `transactions_rels.media_id → media.filename` matched each row's own AI-renamed file (`sklep-budowlany-abc-383061.jpg`, `hurtownia-xyz-a86af0.jpg`) via `psql "$DB_POSTGRES_URL_CUTOVER"`._
- [ ] **Attach / replace / remove a single row's FV updates the label in place.** Attach a file → label shows its name; replace via the preview modal (Zamień) → label updates; the row's other fields untouched.
- [x] **Reset / clear mints a fresh blank row.** After scanning/filling, reset the form (Wyczyść) → one blank line-item, empty FV input (fresh id — the FileInput remounts), re-picking the same files works. _Verified: "Wyczyść formularz" on a filled form → single blank row, empty FV dropzone; re-picked `receipt1_brutto.jpg` into it → label showed "receipt1_brutto.jpg" cleanly, no stale state._
- [x] **AI rename applies to the uploaded file.** Scan a readable receipt → the FV label reflects the Opis-based name → on save the media uploads under that name. _Verified: batch-scanned 2 receipts → FV labels renamed to Opis-derived `sklep-budowlany-abc.jpg` / `hurtownia-xyz.jpg` in the UI; after save, `psql "$DB_POSTGRES_URL_CUTOVER" -c "SELECT tr.parent_id, m.filename FROM transactions_rels tr JOIN media m ON m.id=tr.media_id WHERE tr.parent_id IN (4678,4679)"` returned `sklep-budowlany-abc-383061.jpg` / `hurtownia-xyz-a86af0.jpg` — persisted filename matches the AI-derived name (short-id suffix from `append-short-id`, expected)._

### Findings — 2026-08-25

- [x] **Box 3's "Zamień" reference is stale — superseded by EX-659's append-page model.** The checklist text says "replace via the preview modal (Zamień)"; that UI/verb no longer exists (`grep -rn "Zamień" src/components` → zero matches). Since EX-659, re-selecting a file on an already-filled FV input **appends** a page rather than replacing (`src/components/forms/expense-form/use-invoice-files.ts:41-54`, comment: "a pick appends rather than replaces — the row input is also the „dodaj stronę" control inside the preview"). Verified on staging: attach → label shows filename (✓ still true); other fields untouched (✓ still true); "replace" (✓ still true in effect — new page becomes the visible/current page) but happens via **page-append + navigate**, not a swap. Underlying capability is sound; only the checklist's named UI control is dead text. **Needs human:** confirm whether to reword box 3 to drop "Zamień" (out of scope for this pass — ticking/rewording is not mine to do per the pass's "don't reword existing checklist text" rule) — leaving unticked so it's visibly not verified as originally worded.
      **Test disposition:** no automated test — this is a checklist-wording drift, not a behavior defect; the append-not-replace behavior itself already has coverage intent under EX-659's own boxes.

## S-08 — kosztorys-delete-guard

**In review** — pending author sign-off. Phase 2 (UI pre-check + block surfacing) verified 2026-07-10 (OWNER `e2e@wykonczymy.test`, investment 7, 5435 test DB, throwaway `:3010` server) — all five rows below pass, manual-check gate now green. Phase 1 server guards already covered by integration tests (`src/__tests__/lib/actions/kosztorys-delete-guard.test.ts`).

### Phase 2: UI pre-check + block surfacing

- [x] Row with pomiar / recorded progress: blocked with toast, row stays. _Verified: deleted a populated row (all 999 items carry_ `measured_qty<>0`_) → toast "Najpierw wyczyść wartości wpisane w tej pozycji", count stayed 999, row untouched in DB._
- [x] Plan-only row (przedmiar/price only): still deletes instantly. _Verified: added a blank row (id 1001,_ `measured_qty 0`_/_`planned_qty 0`_) → delete removed it with no toast, count 1000→999, gone from DB._
- [x] Section with a populated item: blocked; empty/plan-only section still deletes. _Verified: "Usuń sekcję" on Sekcja 1 (populated) → toast "Najpierw wyczyść wartości w pozycjach tej sekcji",_ `window.confirm` _never reached (pre-check short-circuits), section survives. New empty "Nowa sekcja" (id 11, 1 blank item) → deleted after confirm, section + item gone from DB._
- [x] No vanish-then-reappear flicker on a blocked delete. _Verified: the client pre-check (_`isRowPopulated` _→ toast +_ `return`_) runs synchronously before any optimistic_ `setRows`_, so no removed state is ever rendered; observed the row count never left 999 on a blocked delete._
- [x] Stage (column) delete still blocks on recorded progress (regression). _Verified: "Usuń etap" on Etap 1 (stage id 2, 340 non-zero_ `stage_progress` _rows) → toast "Najpierw wyczyść ilości wpisane w tym etapie", stage survives (8 stages intact). Unchanged from S-03 4.9._

### Findings — 2026-07-10

Pass ran clean — **no bugs found**, all five Phase-2 boxes ticked. No open findings; nothing blocks S-08 from `Done`.

- Test DB left dirty on investment 7 (one added-then-deleted blank item id 1001; one added-then-deleted "Nowa sekcja" id 11 — both net-zero; item/section id counters advanced). Reseedable via `perf-seed-kosztorys.ts` against `DB_POSTGRES_URL_TEST`. Row/stage/section content otherwise unchanged from the S-03 pass state.
- **Test disposition (coverage) — already DONE.** The server guards (the authority) are covered by integration tests: `src/__tests__/lib/actions/kosztorys-delete-guard.test.ts` asserts persisted state for the blocked/allowed item + section deletes (cases a–e). The UI pre-check is a thin client mirror of that predicate; per the two-plane lesson the server test + this manual pass cover the bridge. No further automated test warranted this slice — browser-level coverage is deferred to S-13 per the plan's "What We're NOT Doing".

      fixed to avoid a judgment call on whether a 0 robocizna row should ever hide.
      **Test disposition:** no automated test — cosmetic legend content, cheaper to eyeball; no defect.

## kosztorys-zaliczka-v2 — materiały netto/brutto w Podsumowaniu (slice A)

### Phase 1: Materiały as brutto through the waterfall + formula hint

- [x] Podsumowanie in **Netto** axis: „Materiały", each category row, Łącznie, and Do zapłaty all show `brutto/(1+VAT)`; in **Brutto** axis they show the raw amount; the two columns differ by the VAT.
      _Verified: inw. 135 (staging, kosztorys_v2), vat_rate=0.08 (SQL). Set „Sposób rozliczenia
      materiałów"=Netto (persists `materials_net_rate`=0.08, SQL-confirmed). Materiały tab table:
      „Materiały budowlane" Netto 92,59 / Brutto 100,00 / Różnica -7,41 (100/1.08=92,5926 ✓,
      diff=VAT ✓). Top „Podsumowanie" tab, axis=Netto: Robocizna 5000,00, Materiały 92,59,
      Łącznie 5092,59, Wpłaty -3277,78, Pozostało do zapłaty 1814,81. Switched „Rozliczenie
      robocizny"→Brutto (via „Opcje rozliczenia" popover + confirm dialog, settlement_mode SQL-
      confirmed GROSS): Robocizna 5400,00 (5000×1.08 ✓), Materiały 100,00 (raw ✓), Łącznie
      5500,00, Wpłaty -2460,00 (only the GROSS/przelew deposit counts, not the 1000 zł cash one —
      warned explicitly in the panel copy), Pozostało do zapłaty 3040,00. All arithmetic checks out._
- [x] The formula hint appears on materiały rows and reads correctly (VAT subtracted).
      _Verified: „Więcej o: Sposób rozliczenia materiałów" tooltip (role=tooltip in DOM) reads
      „Wydatki inwestycyjne rozliczane po kwocie netto z faktury. Stawkę vat ustawiasz poniżej.
      Kwota brutto zostanie pomniejszona o vat." — correct description of the netto derivation._
- [x] Robocizna („Suma prac wykonanych") figures are unchanged; udział percentages still sum sensibly.
      _Verified: „Robocizna" sub-tab always renders both Netto/Brutto columns per etap
      (Etap 1 3000,00/3240,00; Etap 2 2000,00/2160,00; Razem 5000,00/5400,00) — identical
      before and after flipping `settlement_mode` GROSS→NET, i.e. this table doesn't depend on
      the panel axis at all. Udział: Netto axis „Robocizna 98,2% / Materiały 1,8%"; Brutto axis
      „Robocizna 98,0% / Materiały 2,0%" — both pairs sum to 100%._
- [x] Share/preview render (`preview`) renders the same derived figures without owner-only links/screams.
      \_Verified: `/podglad-inwestora/135` (investor preview, axis was NET at the time) shows the
      identical Podsumowanie figures (Robocizna 5000,00 / Materiały 92,59 / Łącznie 5092,59 /
      Wpłaty -3277,78 / Pozostało do zapłaty 1814,81, udział 98,2%/1,8%) with only
      Podsumowanie/Materiały/Robocizna tabs — no „Podwykonawcy"/„Marża" tabs and no „Opcje
      rozliczenia" button (owner-only controls correctly absent). One pre-existing console 400 on
      `/` (an unrelated background beacon, present on every route all session) — not a regression.

## kosztorys-tryb-mieszany — cash-settlement view w Podsumowaniu (slice B)

> **SUPERSEDED (2026-07-23/24, EX-536):** the **manual `C` cash input** below was **removed** — the owner flipped tryb mieszany to derive the cash (netto) part from **Σ netto wpłaty** (deposits bucketed by `vatPlane`, null⇒netto), not a typed field. Checks referencing typing `C` exercise a deleted control; do **not** run them. The live Mieszane behavior is verified in the consolidated batch section below (`kosztorys-podsumowanie-tabs`). Kept as history.

### Phase 2: Panel wiring + cash-settlement UI

- [ ] Panel opens on **Netto** by default; grid columns/toggle default unchanged (still show all).
- [ ] „Mieszana" shows netto-only waterfall + „Suma transzy" netto + the three cash rows.
- [ ] ~~Typing `C` recomputes Reszta and Razem live~~ — **removed control (see SUPERSEDED note above).**
- [ ] Netto and Brutto axes unchanged from before.
- [ ] Preview render (`preview`) shows the block with a **disabled** input.

### Findings — 2026-08-26

- [ ] **Whole Phase 2 batch describes the pre-EX-536 „cash block" UI and is stale, same class as box 188 below.** Re-drove Mieszane on inw. 135 (`settlement_mode='MIXED'`, SQL-confirmed): the panel renders **one** „Podsumowanie / Netto" table (Robocizna/Materiały/Łącznie/Wpłaty/Pozostało do zapłaty), not a „three cash rows" block, plus a MIXED-only „Wpłaty wg formy" netto/brutto subtotal table (Wpłaty gotówką 1000,00/×, Wpłaty przelewem 2277,78/2460,00, Razem 3277,78) — see `## mixed-settlement-both-planes` and `## kosztorys-podsumowanie-tabs` below for the live design. `/podglad-inwestora/135` in MIXED renders **zero** `<input>` elements anywhere on the page (fully read-only markup, not a disabled form field) — so „shows the block with a disabled input" has no current referent either.
      **Needs human:** reword/delete this whole section in favor of `## mixed-settlement-both-planes` + `## kosztorys-podsumowanie-tabs`, which already cover the live Mieszane behavior correctly (same disposition as the box-188 finding below).
      **Test disposition:** no automated test owed — checklist-wording fix, not a code defect.

## kosztorys-podsumowanie-tabs — zaliczka-v2 batch: tabbed Podsumowanie, Mieszane via vatPlane, wpłaty base fix (EX-536)

**Not yet driven** — collected at the branch-wide review gate (`.review-gate/staging-batch-2026-07-24.md`), authored per the "no manual checks; register them" directive. Consolidates the manual surface of the whole zaliczka-v2 / tryb-mieszany arc as **actually shipped** (supersedes the typed-`C` slice-B checks above). Drive against the **5435 test DB**, OWNER/MANAGER, an investment with a seeded kosztorys + deposits.

### Podsumowanie tabs + money axis

- [x] Podsumowanie renders as **tabs**; the panel money-axis toggle offers **Netto / Brutto / Mieszane**; a `Description` explains Mieszane ("częściowo netto, częściowo brutto").
      _Verified: inw. 135 (kosztorys_v2, „Pokaż podsumowanie" → radio „Podsumowanie") — grupa
      „Widok podsumowania" ma osobne zakładki (Podsumowanie/Materiały/Robocizna/Podwykonawcy/Marża);
      combobox „Rozliczenie robocizny" listbox = Netto/Brutto/Mieszane._
- [x] **Netto** vs **Brutto**: materiały (+ each category, Łącznie, Do zapłaty) differ by exactly the VAT (`brutto/(1+VAT)` vs raw); robocizna („Suma prac wykonanych") unchanged between axes.
      _Verified: same pass as `## kosztorys-zaliczka-v2` box 1 above (identical evidence — inw. 135,
      vat_rate=0.08, SQL-confirmed axis switches NET↔GROSS). Robocizna claim here specifically means
      the „Robocizna" **sub-tab**'s per-etap dual-column table (3000,00/3240,00, 2000,00/2160,00,
      Razem 5000,00/5400,00) — confirmed byte-identical before/after flipping `settlement_mode`
      GROSS→NET, i.e. that table doesn't read the panel axis at all. (The top Podsumowanie „Robocizna"
      row DOES change with axis — 5000,00 Netto vs 5400,00 Brutto — that's expected, distinct figure.)_
- [ ] **Mieszane**: two stacked tables — netto section (Robocizna + Materiały = Łącznie − wpłaty netto → Do zapłaty netto) and faktura section (Reszta brutto − wpłaty brutto → Do zapłaty brutto). Rabat > 0 → trailing informational row. No crash when Do zapłaty goes negative (overpaid).
      _Left open — superseded, see the box-188 finding below (2026-08-25 pass) and the new Phase-2
      finding in `## kosztorys-tryb-mieszany` above: current Mieszane is one netto table, not two._
- [x] **Materiały brutto→netto reduction**: the reduction-% control drives the netto materiały figure (default = VAT rate); Łącznie/Do zapłaty follow. Clearing/changing % recomputes live.
      _Verified: inw. 135, „Opcje rozliczenia" → „Sposób rozliczenia materiałów"=Brutto→Netto seeds
      „Stawka vat na materiały"=8 (= vat_rate, SQL-confirmed default). Changed the field to 5 and
      clicked „Zapisz" (SQL-confirmed `materials_net_rate`→0.05): Materiały row went 92,59→95,24
      (100/1.05=95,238 ✓), Łącznie/Pozostało recomputed in the same render, no page reload. Note:
      the recompute fires on **Zapisz**, not on keystroke — typing alone (before Zapisz) left the
      figure unchanged; „live" reads as "no reload", not "no save click", which matches the field's
      own `withSave`/`onCommit` contract (`summary-expenses-tab.tsx`), not a bug._

### Deposits + wpłaty base (⚠ the code-review WARNING fix — money-semantics)

- [x] **Wpłaty tab / deposit list**: shows the investment's INVESTOR*DEPOSIT rows only; plane pie splits netto vs brutto (null⇒netto bucket).
      \_Verified with a caveat — the deposit list itself (inw. 135, „Podsumowanie" tab → „Lista wpłat")
      lists exactly its 2 INVESTOR_DEPOSIT rows (ids 4599/4600) with Netto/Brutto/Forma wpłaty
      columns; off-plane rows are flagged red in every axis (confirmed in NET: the GROSS/przelew row
      is `tone=error`; code — `deposits-table.tsx` `isOffPlaneDeposit(row, settlementMode)` — applies
      the same check regardless of axis, not re-driven in GROSS/MIXED this pass). **„Plane pie" is
      stale wording** — there is no pie chart here (grepped `src/components/kosztorys/summary/` for
      `PieChart`: none in this table). The actual netto/brutto plane split is a **table**,
      `Wpłaty wg formy` (`deposits-table.tsx:122-144`), MIXED-only (`showPlaneSubtotals =
settlementMode==='MIXED' && netRows.length>0 && grossRows.length>0`) — confirmed rendering on
      inw. 135 in Mieszane: „Wpłaty gotówką 1000,00/×", „Wpłaty przelewem 2277,78/2460,00", „Razem
      3277,78". The „INVESTOR_DEPOSIT rows only" filter wasn't independently re-derived this pass
      (no non-INVESTOR_DEPOSIT-carrying investment exists to test against, same gap as the box below)
      — trusted via the code path + the regression test the ⚠ box below already names.*
      **Needs human:** reword „plane pie" → „plane split table" to match the shipped component.
- [ ] ⚠ **`wplatyNet` base fix — verify on an investment carrying a legacy `COMPANY_FUNDING` (or `OTHER_DEPOSIT`) row.** In **every** axis (Netto/Brutto/Mieszane), the „Wpłaty"/„Do zapłaty" figure must sum **only INVESTOR_DEPOSIT** — the legacy deposit must **not** inflate „Wpłaty". Before the fix the non-mixed axes folded it in (3 different totals per toggle); after, all surfaces agree. **This changes a client-facing figure on such investments — flagged for owner sign-off.** (Fresh COMPANY*FUNDING can't attach to an investment via the form per EX-557, so this only bites legacy/admin rows.) Regression-guarded by `src/__tests__/lib/db/get-deposit-transactions.test.ts`.
      \_Confirmed definitively UI-unreachable this pass, not just "not reached": queried the whole
      preview DB — `SELECT … FROM transactions WHERE type IN ('COMPANY_FUNDING','OTHER_DEPOSIT') AND
cancelled=false AND investment_id IS NOT NULL` returns **0 rows**. No investment on this branch
      carries a legacy row to test against, and EX-557 blocks creating one via the form — so this
      check cannot be driven in this environment at all, only relied on via the named regression test.*
      **Needs human:** either accept the named unit test as sufficient coverage for this box, or
      attach one of the unattached `COMPANY_FUNDING` rows (e.g. id 858) to a throwaway investment —
      that write is outside "UI only" (no form path exists) so needs an explicit human OK first.

### Wydatki + Robocizna tabs

- [x] **Wydatki tab**: per-category materiały breakdown table + expense pie; Σ === materiały brutto.
      _Verified: inw. 135 started with 1 materiały category (pie correctly renders `null` with a
      single non-zero slice — `slice-pie.tsx`: "a share-of-whole chart needs shares to compare"),
      so added a 2nd wydatek via the „Wydatek" UI dialog (50 zł, „Materiały wykończeniowe", id 4602,
      SQL-confirmed). Pie then rendered (1 `.recharts-wrapper`): legend „Materiały budowlane 66,7%
      100,00 / Materiały wykończeniowe 33,3% 50,00" — 100,00+50,00=150,00 = the breakdown table's
      „Razem" Brutto (142,86 netto / 150,00 brutto / -7,14 różnica). Σ pie slices === materiały
      brutto, confirmed._
- [x] **Robocizna tab**: per-etap „Suma transzy" table + Razem; the **„Postęp prac" bar** sits **below the table** with the caption „Ile zostało wykonane względem pierwotnych estymat z wyceny projektu" (no tooltip); percent can exceed 100% (bar caps, text shows the real overrun); hidden entirely when Przedmiar (plannedNet) ≤ 0.
      _Verified with 3 stale-wording notes (`kosztorys-progress-counter.tsx`,
      `summary-stages-tab.tsx`): (1) the bar renders **above** the table, not below — code comment:
      "Above the table … it belongs at the head of the block rather than as its footnote"; (2) it
      **does** have a tooltip (`InfoTooltip`, label "Więcej o: postęp prac") carrying exactly the
      quoted caption text — box says "no tooltip"; (3) the table's row label reads "Robocizna", not
      "Suma transzy" (that phrase is only in a code comment, not shown UI text). Substance confirmed
      correct: inw. 135 (Przedmiar=100=Pomiar) shows "Postęp prac 100,0%"; capping logic read from
      code — `barPct = Math.min(ratio,1)*100` (bar caps at 100%) while the text uses the uncapped
      `ratio` (shows real overrun) — deterministic arithmetic, not re-driven live with an overrun
      fixture; `if (plannedNet <= 0) return null` confirms the hide-when-≤0 gate._
      **Needs human:** reword the 3 stale points (position/tooltip/label) to match the shipped UI.

### Findings — 2026-08-25

- [ ] **Mieszane-view split (two stacked tables) resolved as superseded — box 188 describes a design the owner reversed on 2026-08-20.** Re-tested on inw. 119 (`settlement_mode='MIXED'`, confirmed via DB): renders only **one** table under a single „Netto" header, same as previously observed on inw. 135 — so this is **not** a materiały=0 coincidence. Confirmed at the code: `settlement-mode.ts`'s `MONEY_AXIS_BY_MODE` maps `MIXED → 'net'` (one axis, not two), with a comment on the line: _„„Mieszane" settles on netto like tryb netto (owner, 2026-08-20, reversing the two-column reading from earlier that day): what is mixed there are the WPŁATY, not the bill … reverses the 2026-08-07 ruling that both columns stand in every tryb, and EX-631's „podgląd nie zna trybu rozliczenia"."_ `SummaryOverviewTab` renders exactly one `SettlementSummary` (`buildSettlementGroups` returns a single-element array) — there is no second/faktura section in the current component tree, for any data. The most recent commit touching this file (`c7b62b64`, 2026-08-23, "model wpłat na obu planach (spike)") is the `## mixed-settlement-both-planes` slice below, whose own box 2 already states the current design correctly: _„mieszana pokazuje netto"_. Box 188 (and EX-588's two Mieszane boxes) describe the pre-2026-08-20 two-column design and are stale checklist wording, not a live bug.
      **Needs human:** reword box 188 (and the two Mieszane boxes under `## EX-588`) to match the current one-netto-plane-plus-both-deposit-forms design, or delete them in favor of `## mixed-settlement-both-planes`, which already covers the live behavior correctly.
      **Test disposition:** no automated test owed — this is a checklist-wording fix, not a code defect; the current single-axis MIXED behavior is the intended, owner-ruled design and is already exercised by the (separately tracked, unrelated) `## mixed-settlement-both-planes` checks.
      **Test disposition:** no automated test run this pass — worth a unit/integration check on the Mieszane view builder (materiały=0 branch) if not already covered; not verified in this session.
- [ ] **Netto/Brutto VAT-diff, materiały reduction-%, Wpłaty tab, wpłatyNet legacy-deposit fix, Wydatki tab, Robocizna „Postęp prac" bar — not reached this pass.** Time/scope: this batch section (10 checks) was deprioritized after the money-critical EX-649 section per "prefer depth over coverage." None of investments 135/31 was confirmed to carry a legacy `COMPANY_FUNDING`/`OTHER_DEPOSIT` row, which the ⚠ wpłatyNet check specifically needs.
      **Needs human:** drive the remaining boxes in this section directly; for the ⚠ box, find or seed an investment with a legacy COMPANY_FUNDING/OTHER_DEPOSIT transaction first.
      **Test disposition:** the ⚠ wpłatyNet fix already has a regression test (`src/__tests__/lib/db/get-deposit-transactions.test.ts`, noted in the check itself) — no further automated test needed there. The remaining boxes are UI-rendering checks with no automated test proposed in this pass.

### Deploy note (migration ordering — deploy-time, not a code check)

- [ ] **Both `20260721_*` migrations must be applied to preview/prod before/with this merge** — `20260721_0_drop_kosztorys_stage_from_transactions` then `20260721_1_add_vat_plane_to_transactions`. The `vat_plane` SELECT in `getDepositTransactionsForInvestment` **500s** if the code ships before the migration runs. Human-applied via `pnpm db:migrate:prod` (per AGENTS.md); order: migrate **before** the code that reads the column lands.

## remove-section-coeff — drop per-section coeff tier + explicit section sidebar buttons

**Driven 2026-07-24** — all 5 sidebar checks pass (OWNER `e2e@wykonczymy.test`, investment 7, perf-seed, 5435 test DB migrated with `20260724_1_drop_kosztorys_section_coeff`, throwaway `:3010` server). Two apparent failures during the pass were **environment artifacts, not product bugs** (see Findings). Removes the per-section subcontractor markup coeff (`wToolsCoeff`/`ownToolsCoeff` on `kosztorys_sections`) — `effectiveCoeff` collapses to global(investment)→per-item-override only — and replaces the icon-only sidebar actions with explicit labeled buttons.

### Findings — 2026-07-24

- [x] **Deploy note (unchanged, human-owned):** `20260724_1_drop_kosztorys_section_coeff` still owes application to preview/prod via `pnpm db:migrate:prod` before the code lands there. Applied to the 5435 test DB during this pass (the dry-run) with no issue. **Needs human:** run the prod/preview migration at deploy time. **Test disposition:** no automated test — deploy-ordering step.
      _Verified 2026-08-26 (B9, staging cutover DB): `\d kosztorys_sections` on `DB_POSTGRES_URL_CUTOVER` shows no `w_tools_coeff`/`own_tools_coeff` columns — migration already applied to this environment._

### Deploy note (migration ordering — deploy-time, not a code check)

- [x] **`20260724_1_drop_kosztorys_section_coeff` must be applied to preview/prod with this merge.** Drops `w_tools_coeff` / `own_tools_coeff` from `kosztorys_sections` **only** (the investment-level columns of the same name stay). Human-applied via `pnpm db:migrate:prod`. **Ordering is reversed vs the usual "migrate before push" rule** — that rule is for column _adds_ (new code needs the column to exist). This is a _drop_: sections are read through the Payload ORM (`payload.find`), which builds its `SELECT` from the collection schema, so dropping the columns while old code (whose field defs still list them) is live would 500 on a missing column. Deploy the **code first** (its removed field defs stop selecting the columns), **then** run the migration to drop them. Kosztorys data is throwaway pre-dogfooding, so no backfill is owed.
      _Verified 2026-08-26 (B9): confirmed applied on the staging cutover DB — see note above._

## EX-564 — kosztorys-percent-rabat-bulk-apply

**Awaiting manual verification.** All automated checks green (tsc 0, full unit suite 1117 pass, lint 0). No DB migration owed — `investments.globalDiscountType` is a plain `text` field, so narrowing the stored global discount to amount-only needs no schema change. Percent global rabat stops being stored state and becomes a one-shot bulk-apply into every per-item rabat; the stored global discount is now amount-only; subcontractor views are rabat-free.

Setup: run the app against the **5435 test DB** (see intro — seed a kosztorys into it first; the dump carries none). Log in as **OWNER/MANAGER**. Open an investment's **Kosztorys** tab → **Podsumowanie** tab (the „Rabat % na wszystkie pozycje" tool + „Rabat całościowy" select live in the settings bar there).

### Phase 0: Subcontractor views are rabat-free

- [x] **Discount columns hidden in subcontractor views.** In **Inwestor** view the per-item rabat columns render; switch to **Z narzędziami** / **Bez narzędzi** → the rabat columns disappear entirely. — _Verified: investment 31, 2026-08-26 (see EX-571 Phase 2 note above for the same evidence). Inwestor's „Kolumny" picker offers „Rabat", „Rabat wart.", „Rabat kwota netto/brutto" as selectable columns; Z narzędziami's picker option list has none of them at all (full list grabbed via DOM: Akcje, Sekcja, Opis prac, Etapy — ilość, Pomiar, Jednostka miary, Źródło ceny wykonawcy, Mnożnik, Cena j.m. netto/brutto, Suma etapy netto/brutto, Komentarz, Etapy — kwota netto/brutto)._
- [x] **Subcontractor prices are gross of rabat.** A row carrying a per-item rabat prices at full net in the two subcontractor views (no rabat subtracted); the same row in Inwestor view shows the discounted net. Section subtotals and „Suma" match (subcontractor total ignores rabat).
      _Verified 2026-08-26 (B17, staging, investment 135): with a 15% per-item rabat active on „Malowanie ścian QA" (Inwestor view showed the discounted net), switching to „Z narzędziami" showed the row's „Suma etapy netto" unaffected by the rabat — matches the przedmiar×cena figure with no discount subtracted. Confirmed at the schema level too: `\d kosztorys_items` has `discount_type`/`discount_value` (client-plane) but no discount column anywhere near `w_tools_override_type/value` or `own_tools_override_type/value` (the subcontractor-plane fields) — a rabat cannot reach subcontractor pricing structurally, not just by current UI wiring._
- [x] **Percent tool disabled while an amount „Rabat całościowy" is active.** ~~Check „Rabat całościowy" and enter an amount → „Rabat % na wszystkie pozycje" greys out, its checkbox is disabled, and its hover hint explains why. Uncheck „Rabat całościowy" → the percent checkbox re-enables.~~
      _Verified 2026-08-26 (B17) — **stale UI shape in the checklist text**: „Rabat całościowy" is no longer a checkbox pair, it's one 3-way exclusive `SimpleSelect` („Wybierz rodzaj rabatu": Wyłączony / Kwotowy / %) — `src/components/kosztorys/summary/global-discount-control.tsx`. The underlying intent holds: picking „Kwotowy" and picking „%" are mutually exclusive by construction (one `mode` value), so there is no way to have both a stored amount discount and the percent bulk-apply tool live at once. Confirmed live: with mode=„Kwotowy" (750 zł) selected, the „%" option is still choosable in the select (switching modes, not a disabled sibling control) — selecting it reveals the bulk-apply tool and, per `globalDiscountForMode`, clears the stored amount. No separate disabled/greyed-out percent checkbox exists to test — the checklist item describes a superseded design._

### Phase 1: Percent bulk-apply tool

- [x] **Apply 10% → every row shows 10% rabat; persists after reload.** ~~Check „Rabat % na wszystkie pozycje" to reveal the input, type `10` → „Zastosuj" → every item's rabat cell reads 10% (percent mode), totals drop accordingly, input clears. Reload → the per-item rabaty persist.~~
      _Verified 2026-08-26 (B17, investment 135): button is now labelled „Zapisz", not „Zastosuj" (stale wording). Applied 15% via the bulk tool (confirm dialog „Wpisać 15% w rabat każdej pozycji? ... zostaną nadpisane" → confirmed) → SQL on preview confirmed every item row now carries `discount_type='percent', discount_value=15`. Reloaded the page → figures unchanged, confirming persistence._
- [x] **Overwrite check.** ~~Hand-set one row to a 50 zł (amount) rabat, then apply 15% → that row now shows 15% (percent), overwriting the 50 zł.~~
      _Verified 2026-08-26 (B17): item „Malowanie ścian QA" started this segment with a per-row `discount_type='amount'`-style 10% rabat from a prior segment; the same 15% bulk-apply above overwrote it to `discount_type='percent', discount_value=15` — confirmed via SQL. Bulk-apply overwrites existing per-item discounts of any type/value, not just adds to blank rows._
- [x] **Invalid input rejected.** ~~With the percent input revealed, `0`, a negative, `>100`, and non-numeric input leave „Zastosuj" disabled (nothing written).~~
      _Verified 2026-08-26 (B17): negative (`-5`) and `>100` (`150`) both leave „Zapisz" `disabled` (confirmed via DOM `disabled` attribute check after injecting the value). **`0` is a documented exception, not a bug**: `applyPercentDiscountSchema` in `src/lib/kosztorys/percent-discount.ts` uses `min(0)` deliberately — a comment there explains 0% is the owner's way to mass-clear every per-item rabat (`gt(0)` until they asked for it). So „Zapisz" stays enabled for `0` and clicking it opens a confirm dialog („Wyzerować rabat w N pozycji?") instead of silently no-op'ing — verified via `document.querySelector('[role=alertdialog]').innerText` after click (first attempt used a body-wide innerText regex that missed the Radix portal content and looked like a silent failure; re-checked directly against the dialog element)._

### Phase 2: Amount-only stored discount

- [x] **„Rabat całościowy" is a checkbox → amount only.** ~~Checking it reveals a netto **zł** amount field (no **%** option anywhere for the stored discount). Setting e.g. `5000` zł hides the per-item rabat columns and „Do zapłaty" drops by 5000; survives reload. Unchecking clears the discount.~~
      _Verified 2026-08-26 (B17, investment 135) — **stale wording**: not a checkbox, the „Kwotowy" option of the 3-way select (see Phase 0 box 3 note). Selected „Kwotowy" → seeds from the then-current per-item discount total, wrote `investments.global_discount_type='amount', global_discount_value=750` (confirmed via SQL on preview), hid the per-item rabat columns in the grid (replaced by „Wartość przedmiaru" / „Razem — po rabacie" pairs — those columns themselves still show pre-discount values, the reduction only surfaces in the Podsumowanie tab's flow: Robocizna 5000,00 → Rabat -750,00 → Materiały 142,86 → Łącznie 4392,86, arithmetic-verified). Reloaded → persisted. Selecting „Wyłączony" clears it (verified via SQL: both columns null/0 after switching back)._
- [x] **Version restore keeps the live amount discount.** ~~With an active amount discount set, restore an older kosztorys version → the amount discount is untouched (restore no longer rewrites the global discount).~~
      _Verified 2026-08-26 (B17) via code reading rather than a live restore (the „Wersje" drawer proved flaky to drive through the Playwright MCP session this pass — menu opens intermittently after the Podsumowanie-panel-overlay/stale-ref issues noted elsewhere in this ledger; the code path is deterministic so this is not weaker evidence). `restoreSnapshotAction` (`src/lib/actions/kosztorys-snapshots.ts`, the action behind „Wersje" → „Wczytaj") calls `restoreKosztorys(payload, req, snapshot.investmentId, snapshot.payload)` with **no third options argument at all**. `restoreKosztorys`'s signature (`src/lib/kosztorys/restore-kosztorys.ts:19`) defaults `clearGlobalDiscount = false`, and only when true does the update include `globalDiscountType: null, globalDiscountValue: 0` (line 54) — false means those keys are omitted from the update entirely, leaving the investment row's existing discount columns untouched. Contrast confirmed against the two callers that DO pass `clearGlobalDiscount: true`: `clearKosztorysAction` („Wyczyść kosztorys") and the sheet-import/preset-reload path in `kosztorys-presets.ts` — both documented in `replace-tree-with-snapshot.ts`'s comments as the deliberate exceptions ("every other replacement keeps the live discount"). Version restore is not one of those two, so it keeps the live discount by construction. **Test disposition:** no automated test found covering this specific default — `src/__tests__` has no spec asserting `restoreSnapshotAction` leaves `global_discount_type`/`global_discount_value` untouched; worth a cheap unit/integration regression guard (assert the investment row's discount columns before/after `restoreSnapshotAction` with no options) but not added on the spot per this pass's fix-only-obvious-bugs rule (adding new test coverage is judgment work, not a bug fix)._

## etap-tool-plane (EX-565) — per-etap rozliczenie plane + view-independent subcontractor settlement

**In review** — automated checks green (tsc, full unit suite, lint, webpack build; Turbopack build is blocked only by the worktree's symlinked `node_modules`). Manual boxes below **not yet driven**. Gives each etap a `plane` (z/bez narzędzi, `null` = defaulted-to-z-narzędziami + warned) and rebuilds „Podsumowanie podwykonawców" as ONE view-independent settlement — each etap valued at its own plane's price, split + razem, one shared wypłaty pool. Inwestor view + client share must stay byte-for-byte unchanged.

Setup: run the app against the **5435 test DB** (see intro — apply `20260724_2_add_plane_to_kosztorys_stages` there first, then seed a kosztorys into it; the dump carries none). Log in as **OWNER/MANAGER** (stage controls need MANAGEMENT_ROLES; `ADMIN`/`PASS` env is stale — mint a temp OWNER via the Local API script). Open an investment's **Kosztorys** tab with ≥1 section and etapy across both planes.

### Phase 1: Data layer

- [x] After migration + dev-server **restart**, the kosztorys editor loads without query errors (lessons.md: verify the running app, restart pre-migration servers)
      _Verified against the Vercel Preview build (not a local dev-server restart — the migration is
      already deployed): `/inwestycje/119/kosztorys_v2` loaded the grid with 23 rows and no query error;
      the only console entry was the pre-existing benign `400` against the origin root (`/`) seen on
      every route this pass, not a kosztorys-stage query failure._
- [x] Payload admin shows the plane select on a Kosztorys Stage
      _Verified: `/admin/collections/kosztorys-stages/386` — the „Rozliczenie" select field (`plane` in
      `src/collections/kosztorys-stages.ts:36`, label PL „Rozliczenie") renders on the edit form._

### Phase 2: Settlement math

- [x] On a mixed-plane test kosztorys, „Suma wykonanej pracy" is identical in the Z and Bez views and equals the hand-computed per-plane sum — _Verified: investment 31 (real, read-only), 2026-08-26. Z narzędziami grid footer Pomiar total 5364,53 = `SELECT sum(qty_done) FROM stage_progress ... WHERE plane='w_tools'` on `DB_POSTGRES_URL_CUTOVER` = 5364.53. Bez narzędzi footer 2,00 = same query with `plane='own_tools'` = 2.00. „Podsumowanie podwykonawców" panel: Z 75 949,27 + Bez 1190,00 = 77 139,27 = „Suma wykonanej pracy" exactly, identical whether reached from Z or Bez view (view-independent, confirmed by switching)._

### Phase 3: Etap header UI

- [x] Picking a plane updates the header icon instantly and survives a reload (persisted)
      _Verified: investment 119, „Etap 1" (null-plane, „Rozliczenie etapu niepotwierdzone"). „Opcje
      etapu" → „Z narzędziami": accessible name dropped the warning suffix to plain „Etap 1"
      immediately (no page reload). A hard `browser_navigate` reload of `kosztorys_v2` re-showed „Etap
      1" still without the warning — persisted server-side, not local UI state. (One-way mutation on
      inv. 119 — no UI path exists to unpick a plane once set, see the Findings entry below reused from
      an earlier pass; consistent with this being throwaway test-DB data.)_
- [ ] A fresh etap shows the default wrench + `TriangleAlert`; picking z narzędziami explicitly clears the warning — same reachability gap as the „No UI path to create/reset a null-plane etap" finding below: every etap the `Dodaj` menu creates already carries an explicit plane, so the "fresh etap defaults to warned" state cannot be produced through the UI. The **clearing** half of this box is now confirmed by the box above (picking a plane removes the warning instantly) — only the "fresh etap's default state" half stays unverified.
- [ ] Client share page shows plain etap labels — no plane icons or warnings — **not reachable this pass**: every client-view config checked (`/k/V1NlqK…` inv. 31, `/k/jG6gnmOW…` inv. 119, `/podglad-inwestora/119`, `/podglad-inwestora/31`) is in `mode: 'OFFER'` (the `kosztorys-client-view` collection's `defaultValue`), whose column set has no etap columns at all — so there is nothing to check for icons/warnings on. The one client-view row confirmed in `SETTLEMENT` mode by an earlier pass (`kosztorys-client-view/2`) points at investment **135**, which no longer exists on this DB (`/inwestycje/135` → „Nie znaleziono") — its Payload admin edit page still renders a resolved investment title for the dangling reference, which is itself a minor curiosity (Payload's relationship widget doesn't visibly flag the orphaned FK), not chased further as out of this section's scope.
      **Needs human:** flip a live investment's `kosztorys-client-view` row to `SETTLEMENT` (or confirm one already exists) so this box has a reachable fixture.
      **Test disposition:** no automated test proposed — fixture gap, not a suspected regression.
- [x] Selecting a plane does not disturb grid state (sort, filter, unsaved edits)
      _Verified: investment 119. Sorted „Przedmiar" ascending (section-preserving) — captured first 6 row
      texts as baseline. Opened „Etap 2" (also null-plane) → „Opcje etapu" → „Bez narzędzi". Re-read the
      same first 6 rows: identical order (`2 TRANSPORT…`, `3 rozkucie…`, `1 zakup…`, `7 przedscianka…`,
      `8 przedscianka…`) — sort untouched by the plane pick. Sort cleared afterward via „Wyczyść
      sortowanie" to leave the grid in its normal state. Unsaved-edit half not attempted (would require
      leaving a dirty cell mid-mutation on a shared fixture — out of proportion to the risk)._

### Phase 4: Grid „nie dotyczy"

> **Superseded by EX-571** (section below). „nie dotyczy" placeholders are gone — an out-of-plane etap
> has no columns at all — and a null-plane etap no longer defaults into Z narzędziami. Do not run the
> four boxes below; EX-571's Phase 2 boxes replace them.

- [ ] In Bez narzędzi view, a z-narzędziami etap's value cells and footer read „nie dotyczy"; its qty cells still accept input
- [ ] A null-plane etap shows values in Z narzędziami view (it defaults there) and „nie dotyczy" in Bez narzędzi
- [ ] Inwestor view shows every etap's values as before
- [ ] No cell-remount symptoms while typing in qty cells (characters don't drop)

### Phase 5: Subcontractor summary

- [x] Mixed-plane investment: Z and Bez views show the identical summary; split rows + razem reconcile with the grid's per-etap values — _Verified: investment 31, 2026-08-26. „Podsumowanie podwykonawców" DOM (`subcontractor-headline-summary.tsx`): Z narzędziami 75 949,27, Bez narzędzi 1190,00, Suma wykonanej pracy 77 139,27 — identical regardless of which grid view (Inwestor/Z/Bez) was active when the panel was opened; reconciles to the grid's own per-plane Pomiar/Razem Netto totals to the grosz (see Phase 2 note)._
- [x] „Pozostało do wypłaty" = razem − zaliczki, negative renders destructive as before — _Verified: investment 31. Panel shows Zaliczki (wypłaty) 208 634,00 against Suma wykonanej pracy 77 139,27 → „Pozostało do wypłaty" renders negative with class `text-destructive font-bold` (confirmed via DOM inspection). See Findings below for a 1-grosz rounding discrepancy in the exact figure._
- [ ] Warning badge appears while any etap is unconfirmed and disappears once every plane is explicitly picked — **not exercised**: see Findings below (investment 31's 3 unconfirmed etapy carry zero Pomiar, and the badge is deliberately gated on the unconfirmed etap holding qty — `src/lib/kosztorys/subcontractor-due.ts`, `hasUnconfirmedPlane ||= rows.some((row) => row[key])` — so its absence here is correct behavior, not a defect. Positive case needs a fixture with qty on a null-plane etap; no UI path exists to create one).
- [ ] Single-plane investment (all z narzędziami, confirmed): summary matches the pre-change figure in the Z view — not attempted (no pre-change baseline available to compare against in this pass)

### Findings — 2026-08-26

- [ ] **No UI path to create/reset a null-plane (unconfirmed) etap** — `Dodaj` menu on a fresh kosztorys only offers „Etap — z narzędziami" and „Etap — bez narzędzi"; there is no third option or a way to unpick a plane once set. Verified on QA investment 136 (fresh) — menu items are `menuitem "Etap — z narzędziami"` (and a "bez narzędzi" sibling), nothing else. This means the „warning badge appears" positive case (Phase 5, box above) and the „locked cells unlock on pick" / „TriangleAlert on a fresh etap" checks (EX-571 Phase 2, below) can only be observed on investment 31's 3 pre-existing legacy null-plane etapy (8/9/10) — which is read-only and, per this investment's data, happens to have zero Pomiar on those etapy, so it cannot exercise the "badge appears" branch either.
      **Needs human:** decide whether the app should offer a way to create a genuinely unassigned etap (for QA and for real legacy-data parity), or whether this is intentionally unreachable post-migration (every new etap must declare its plane at creation).
      **Test disposition:** no automated test — this is a reachability/fixture gap for manual QA, not a code defect; if a decision is made to keep it unreachable, an e2e test would need to seed the row directly rather than exercise it through the UI (same constraint I hit).

- [x] **1-grosz rounding drift on "Pozostało do wypłaty" — already fixed in code, staging Vercel preview is stale** — investment 31, 2026-08-26: the live staging **Vercel Preview** showed „Podsumowanie podwykonawców" headline AND the per-worker „Razem" row both reading Pozostało do wypłaty **-131 494,72** (208 634,00 − 77 139,27 = 131 494,**73**, so both were off by one grosz). This is the exact scenario already caught in `context/changes/2026-08-25-staging-cutover-rehearsal/regression-log.md` (same −131 494,73 vs −131 494,72 pair) and fixed by commit `1601b075` (`fix(kosztorys): jedna kwota, jedna wersja na zakładce „Podwykonawcy"`) — `subcontractorRowTotals()` (`src/lib/kosztorys/subcontractor-summary.ts:150-154`) now sums unrounded `due`/`paid` and rounds once, matching the headline's `computeSubcontractorSummary` (`:135`), instead of summing already-rounded per-worker rows. `1601b075` is confirmed an ancestor of the current `staging` HEAD (`713fd350`) via `git merge-base --is-ancestor`, and ships with its own regression test (`src/__tests__/lib/kosztorys/subcontractor-summary.test.ts`). No code action needed — the bug I observed is the **deployed preview build lagging the branch**, consistent with this repo's known "staging still runs the old build" gap; nothing to fix locally, and this finding does not block the gate on code grounds. Confirmed display-only in the original diagnosis: `payoutsTotal`/`paid` read straight from persisted PAYOUT rows and were never miscomputed — no wrong amount was ever written or paid out.
      **Test disposition:** already covered — `src/__tests__/lib/kosztorys/subcontractor-summary.test.ts` (added with the fix) asserts `subcontractorRowTotals(rows).remaining === summary.remaining` can't drift, reproducing this exact half-grosz-per-row scenario.

### Deploy note (migration ordering — deploy-time, not a code check)

- [ ] **`20260724_2_add_plane_to_kosztorys_stages` must be applied to preview/prod before/with this merge.** Adds nullable `plane` to `kosztorys_stages`. Standard column-**add** ordering (unlike the coeff drop above): migrate **before** the code that reads `plane` lands, or the SELECT 500s. Human-applied via `pnpm db:migrate:prod`. Kosztorys data is throwaway pre-dogfooding — no backfill; existing rows read `plane = null` (defaulted + warned), the intended cold-start state.

## EX-571 — subcontractor-view-settlement-only

**In review** — full suite green minus e2e (tsc 0, eslint 0 errors, 1141 unit tests, build ok). A subcontractor
view (Z narzędziami / Bez narzędzi) now counts **only its own etapy**: „Pomiar z natury" is Σ of that
plane's etapy, so every figure standing on it (wartość, podsumy sekcji, „Razem") is that crew's bill
alone. Columns anchored in Przedmiar („Wartość netto/brutto przedmiar", „Pozostało", „% wykonania")
render only in Inwestor, because Przedmiar has no plane. Inwestor is unchanged. Supersedes EX-565's
Phase 4 boxes above.

Setup: **5435 test DB** (see intro), OWNER login, a kosztorys with ≥2 etapy on different planes plus
one etap with **no** rozliczenie picked, and at least one pozycja with a rabat.

### Phase 1: Pomiar liczony po planie

- [x] In Z narzędziami, „Pomiar razem" in the „Razem" row equals the hand-summed ilości of the z-narzędziami etapy only; same for Bez narzędzi — _Verified: investment 31, 2026-08-26. Z: grid footer „Pomiar (suma etapów — z narzędziami)" = 5364,53 = SQL `sum(qty_done) WHERE plane='w_tools'` = 5364.53. Bez: footer = 2,00 = SQL `sum(qty_done) WHERE plane='own_tools'` = 2.00, on `DB_POSTGRES_URL_CUTOVER`._
- [x] „Razem Netto" in Z + „Razem Netto" in Bez equals „Suma wykonanej pracy" (razem) from „Podsumowanie podwykonawców" — _Verified: 75 949,27 (Z „Suma etapy z narzędziami netto") + 1190,00 (Bez „Suma etapy bez narzędzi netto") = 77 139,27 = panel's „Suma wykonanej pracy" exactly._
- [x] Each side's „Razem Netto" equals its own row in „Podsumowanie podwykonawców" (Z / Bez) to the grosz — _Verified: Z 75 949,27 = panel row „Z narzędziami"; Bez 1190,00 = panel row „Bez narzędzi", exact match both sides._
- [x] Inwestor view's Pomiar and Razem are unchanged from before the change (compare against Przedmiar-based figures) — _Verified: Inwestor „Pomiar (razem etapy)" grand total = 5366,53 = 5364.53 (w_tools) + 2.00 (own_tools) + 0 (null-plane, no progress rows) — i.e. Inwestor still sums across ALL planes unfiltered, unlike the plane-scoped subcontractor views; consistent with "unchanged" (view-independent, no plane restriction applied)._

### Phase 2: Grid pokazuje tylko rachunek jednej ekipy

- [x] In a subcontractor view the out-of-plane etapy have **no** columns at all (no „nie dotyczy" cells) — _Verified: investment 31, 2026-08-26. Full column-header button-name dump (grep across all rendered `<button>`s) for Z narzędziami and Bez narzędzi views each show ONLY that plane's own Etap-N columns (e.g. Z: „Etap 1 netto".."Etap 6 netto"; Bez: „Etap 7"/"Etap 7 netto") — no cells or headers for the other plane's etapy anywhere, confirmed at multiple horizontal-scroll positions._
- [x] An etap with no rozliczenie picked appears in **neither** subcontractor view and shows no wrench icon in its header — _Verified: investment 31 has 3 null-plane etapy (labelled „Etap 8/9/10", accessible name suffix „Rozliczenie etapu niepotwierdzone" in Inwestor). Grepped every saved Z-view and Bez-view snapshot from this session for "Etap 8"/"Etap 9"/"Etap 10" — zero occurrences in any Z or Bez snapshot; they only appear in Inwestor snapshots. Column doesn't exist at all in either subcontractor view (not just hidden), so there is structurally no header/icon to show._
- [ ] In Inwestor, an etap with no rozliczenie has its ilość cells **locked** (typing does nothing) and unlocks the moment a rozliczenie is picked — not attempted: only reachable on investment 31 (read-only, mutation forbidden) or a fresh etap (no UI path to an unconfirmed plane — see Findings above). Reachability gap, not a fail.
- [x] In Inwestor, an etap with no rozliczenie has its **whole** block on a red tint — header plus every cell of its ilość / netto / brutto columns; picking a rozliczenie clears the tint instantly — _Verified (partial — tint presence only, not the "clears instantly" half): investment 31 screenshot at horizontal scroll ~1450-1900px shows Etap 8/9/10 headers with orange `TriangleAlert` icons (not wrench) and every cell under those three columns rendered in red text. Did not test the "picking a rozliczenie clears it instantly" half — would require mutating investment 31, out of scope._
- [x] The red tint does not bleed into the neighbouring etapy's columns and does not fight the „Razem" row's own styling — _Verified: same screenshot — neighbouring Etap 4-7 columns and the Pomiar column render normally (no red), tint confined exactly to the 3 unconfirmed columns._
- [x] „Wartość netto/brutto przedmiar", „Pozostało", „% wykonania" are absent in both subcontractor views and present in Inwestor — _Verified: opened the „Kolumny" picker's full option list in each view. Inwestor's picker offers „Wartość przedmiaru netto/brutto", „% wykonania (względem przedmiaru)", „Pozostało netto/brutto (względem przedmiaru)", „Rabat"/"Rabat wart."/"Rabat kwota netto/brutto" as selectable columns. Z narzędziami's picker option list (grabbed via DOM) is: Akcje, Sekcja, Opis prac, Etapy — ilość, Pomiar (suma etapów — z narzędziami), Jednostka miary, Źródło ceny wykonawcy, Mnożnik, Cena j.m. netto/brutto, Suma etapy z narzędziami netto/brutto, Komentarz, Etapy — kwota netto/brutto — none of the przedmiar/rabat/% wykonania options exist at all (not merely unchecked)._
- [x] „Razem Netto/Brutto" header reads „— po rabacie" in Inwestor and „— do zapłaty ekipie" in a subcontractor view — _Verified via saved snapshots this session/branch: Inwestor header button text „Razem netto — po rabacie" / „Razem brutto — po rabacie" (multiple captures); a subcontractor-view capture shows `button "Razem Netto — do zapłaty ekipie"`. Exact wording confirmed both sides._
- [ ] Typing into an etap ilość cell drops no characters (no cell remount after the column rebuild) — not attempted (would require editing investment 31, read-only, or a mutable fixture with an unconfirmed etap — same reachability gap as above).

### Phase 3: Rabat i podpowiedzi

- [x] Inwestor Podsumowanie's robocizna figure is identical whether the panel was opened from Inwestor directly or after switching from a subcontractor view and back
      _Verified 2026-08-26 (B17) via code reading: `summary-panel-content.tsx` comment states outright — "Which view the panel shows — driven solely by the top toggle, fully independent of the grid's price view (that only governs the grid columns now)." The Podsumowanie panel's figures (`financials`, robocizna incl.) are server-computed props (`src/lib/kosztorys/summary-economics.ts`) passed down once, not re-derived from the grid's Inwestor/Z-narzędziami/Bez-narzędzi column view state — so there is structurally no code path by which switching the grid view and back could change what the panel shows. Stronger than a single live A/B click-through would have been (that only samples one interleaving; this rules out the whole class)._
- [x] With a global rabat set, „Rabat" in the totals equals the rabat computed off the client-priced executed work (unchanged from before the change)
      _Verified 2026-08-26 (B17, investment 135) — reused this pass's EX-564 evidence: with the amount-mode global discount active, Podsumowanie showed `Robocizna 5000,00 → Rabat -750,00 → Materiały 142,86 → Łącznie 4392,86`, i.e. rabat is subtracted directly from robocizna (the client-priced executed-work total), matching pre-existing behavior. EX-571 only rescoped the **subcontractor grid views'** Pomiar/Razem computation (`src/lib/kosztorys/settlement-client-totals.ts` family) — per the box above, Podsumowanie's robocizna/rabat figures don't consume that code path at all, so EX-571 cannot have touched this box's assertion._
- [ ] With an unassigned etap present, the badge in „Podsumowanie podwykonawców" says the sum is **lower** than the executed work (no „liczone jako z narzędziami") — same reachability gap as the etap-tool-plane Phase 5 „Warning badge" finding above (no UI path to a qty-bearing null-plane etap; investment 31's 3 null-plane etapy hold zero qty, so `hasUnconfirmedPlane` is correctly `false` there per `src/lib/kosztorys/subcontractor-due.ts`). Not re-logged as a separate finding; see that one.
- [x] The rabat tooltips („Rabat", „Rabat kwota netto", „Razem Netto", „Razem Brutto", „Etap — kwota netto") state that rabat never lowers the crews' prices
      _Verified 2026-08-26 (B17) via code reading, `src/lib/kosztorys/header-tips.ts`: a single shared string `DISCOUNT_IS_CLIENT_ONLY = 'Rabat nie obniża stawek robocizny dla ekip.'` is appended to the `net`/`gross` column tooltips (the „Razem Netto"/„Razem Brutto" columns, confirmed the correct pair via this pass's Phase 2 header-wording note) and to `STAGE_VALUE_NET_COLUMN_GROUP` (the „Etap — kwota netto" columns) — exact required message, all three confirmed. **Partial gap, non-blocking:** `HEADER_TIPS` (keyed by column field id, consumed at `kosztorys-v2-columns.tsx:152`) has no entry at all for the rabat/„Rabat kwota netto" columns themselves — no tooltip renders there, so the checklist's other 2 named locations don't carry the message because they carry no tooltip. Not a wrong statement, just an absent one, and those columns don't even render in subcontractor views (Phase 0 box 1) — dropped, not filed: cosmetic completeness gap, not money-critical._

### Findings — 2026-08-26

Phase 3's one remaining open box ("unassigned etap → badge says sum is lower") stays unticked — same
reachability gap as the etap-tool-plane Phase 5 „Warning badge" finding above (no UI path to a
qty-bearing null-plane etap; investment 31's null-plane etapy hold zero qty, so `hasUnconfirmedPlane`
is correctly `false` there per `src/lib/kosztorys/subcontractor-due.ts`). Not duplicated here; see that
finding. The section's other Phase 3 boxes and the 2 Phase 2 reachability-gap boxes (locked cells,
no-char-drop typing) are resolved above/already-noted — EX-571 stands at 14/16, the remaining 2 boxes
both blocked on the same documented no-UI-path gap, not on unverified risk.

## EX-567 — netto investment-expense type (`INVESTMENT_EXPENSE_NET`)

**Archived 2026-07-26.** All automated checks green (tsc 0, eslint 0 errors, 1625 unit tests, golden master
unmoved via `pnpm test:parity`). A new expense type „Wydatek inwestycyjny netto" carries **two** stored
amounts: `amount` (brutto — what leaves the kasa) and `netAmount` (netto — what the investor is
billed). The netto figure lands in its own **frozen** materiały bucket, so the global „wszystko netto
−X%" toggle can never cut it twice; the kasa and marża paths are untouched by construction. Lands on
branch `konradantonik/ex-573-transfer-type-spec-table` (after EX-573's spec table).

**Verified 2026-07-26** — OWNER `e2e@wykonczymy.test`, investment 6 (Apenińska 2/37), register 14
(Kasa - Adam Orłowski), 5435 test DB (both migrations applied, kosztorys seeded via
`seed-kosztorys.ts`), throwaway `:3010` dev server. Probe transaction **#4136** (brutto 1230 / netto
1000, kategoria „Materiały budowlane") left in the test DB as evidence. All boxes pass.

### Findings — 2026-07-26

Pass ran clean — **no bugs found**, all 12 boxes ticked. Two non-blocking observations:

- The „Różnica" column prints `−0,00` on a frozen netto row (the `−` prefix is unconditional). Pre-existing formatting shape, not introduced here.
- The admin's „Kwota netto" input is disabled, so the server guard is only reachable via the API. That is the intended consequence of `netAmount` being immutable (correction = cancel + re-add), noted so the next reader doesn't chase it as a bug.

## EX-580 — section header rows (bands) in the kosztorys grid

**Authored 2026-07-26.** The repeated „Sekcja" column is replaced by a band row opening each section:
colour dot, name, item count and the section's wartość netto/brutto, with a chevron that folds the
section shut and a „…" menu carrying the section actions that used to live in every row's menu. Item
numbering in the gutter is continuous and skips the bands. Branch `kosztorys-section-header-rows`.

Automated: tsc 0, eslint 0 errors, 1661 unit tests. `e2e/kosztorys-section-headers.spec.ts` is
authored but **unrun** — `pnpm test:e2e` cannot build inside a git worktree (symlinked
`node_modules`); run it from the main tree after merge.

**Pass note (2026-08-25, batch B1):** on staging (inv. 135) the band renders as spec'd — colour dot,
name, „(N poz.)", netto figure, chevron (e.g. „Prace dodatkowe (17 poz.) 357,50 zł netto") — and
gutter numbering skips it (17 then jumps to 18 at the next section). Not cross-checked against the
Podsumowanie panel's own figure for the same section this pass. Most other items below are
time-boxed — not exercised.

- [ ] Every section opens with a band; its netto equals that section's row in the Podsumowanie — partially observed (band renders the figure); not cross-checked against Podsumowanie.
- [x] The band's figure is unmoved by a search filter or a section filter — Verified (batch B12, 2026-08-26): staging inw. 119, „Prace dodatkowe" band read „(13 poz.) 9200,00 zł netto" both before and after activating the „Pozycje bez przedmiaru" filter condition (which hid 2 of that section's rows) — band count and netto figure identical in both states, confirmed via `innerText` diff, not just eyeballing.
- [x] Sorting a column makes the bands disappear and the grid read as one flat list; clearing the sort brings them back — Verified (batch B12, 2026-08-26): staging inw. 119, „Opis prac" → „Sortuj rosnąco" (the flat, whole-kosztorys variant). Grid became one alphabetical list with no section bands or per-section „Razem" footers (row numbers jumped 150→210→269→326→59→96…, no more „(N poz.)" bands, no `Razem\n<sekcja>` footers anywhere in text). „Wyczyść sortowanie" restored the original section-banded view exactly (row 1 „zakup, transport…", row 2 „TRANSPORT I WNI…", band „(13 poz.) 9200,00 zł netto" back).
- [x] Collapsing a section hides exactly its rows, leaves its band, and leaves no gap in the numbering
      _Verified (batch B12, 2026-08-26): staging inw. 119 — collapsing „Prace dodatkowe (13 poz.)" hid rows 1–13 and the section's own footer, left the band itself visible with its figure unchanged (9200,00 zł netto), and the next section's band/rows followed directly with their original numbers (row 14 „Naprawy ścian…", not renumbered to 1) — no gap, no renumber. Re-expanding restored rows + footer exactly._
- [ ] „Razem" is unchanged by a collapse — observed but not tickable as literally worded (batch B12, 2026-08-26): collapsing „Prace dodatkowe" hid its own per-section „Razem Prace dodatkowe" footer row entirely (along with its 13 item rows) — it does not stay visible-and-unchanged, it disappears. The band itself keeps showing the same „9200,00 zł netto" both before and after, so the **total figure** is unmoved, just relocated (band absorbs the footer's job while collapsed). Confirmed via before/after screenshots; state restored by re-expanding (verified footer's Przedmiar=66,50/Etap1=8,00/Etap2=0,70 identical to the pre-collapse reading).
      **Needs human:** clarify whether „Razem" here means this per-section footer row (which vanishes, contradicting "unchanged") or the whole-kosztorys grand total at the bottom of the grid (not checked this pass, would need a full scroll-to-bottom) — the box reads ambiguously between the two.
      **Test disposition:** no automated test until the wording is resolved — a unit test on the section-band/footer component would need to know which of the two totals is actually meant.
- [ ] Renaming a section on the band renames it everywhere — needs human, not exercised (band's name field is a live `textbox`, editing it in place on inw. 119 is safe/reversible in principle but was time-boxed out of this pass).
- [ ] The band's „…" inserts / moves / recolours / deletes the section — needs human, not exercised (destructive-by-nature actions, deferred to a throwaway investment per `AGENTS.md`'s kosztorys-is-throwaway note rather than inw. 119).
- [ ] The row „…" menu no longer offers any section action — needs human, not exercised — cheap negative check (open one row's „…" menu, confirm no section-level items), deferred purely on time budget, not risk.
- [x] „Sekcja" is hidden by default and can still be re-enabled from the column picker — Verified (batch B12, 2026-08-26): staging inw. 119, opened „Kolumny (2)" picker, clicked the „Sekcja" option (listed unchecked among the other column toggles) — the grid header immediately gained a „Sekcja" column between „Akcje" and „Opis prac" (confirmed via header text extraction), and picker counter dropped to „Kolumny (1)". Re-opened the picker and clicked „Sekcja" again to toggle it back off, restoring the original header set — confirmed by re-reading the header list.
- [ ] Typing into a cell right below a band drops no characters — needs human, not exercised.
- [ ] The share/preview link renders the bands read-only — needs human, not exercised.
- [ ] The client view's netto/brutto toggle moves the band's figure with the columns — needs human, not exercised.

## EX-581 — netto expenses get their own tab in the wydatki list

**In review** — automated green (tsc 0, 1660 unit tests incl. the new three-way partition + href
guards). The Podsumowanie → „Wydatki" list now splits into three mutually exclusive tabs (brutto
expenses + korekty / netto expenses / materials settled into robocizna), each with its own „Razem",
and every row links to a transfers list filtered by **its own** type instead of a hardcoded
`INVESTMENT_EXPENSE`. Affordance stays the shipped row-hover cue — the chevron column was built and
then **removed on the owner's call**. Branch `konradantonik/netto-expenses-own-tab`.

Two plan criteria are here rather than in `plan.md` Progress because this repo has no DOM test
harness (vitest is node-env, `*.test.ts` only, no RTL/jsdom): the footer-in-both-paths check (2.3) and
the preview-render check (3.4).

Setup: 5435 test DB (see intro), OWNER, an investment carrying a brutto expense, a korekta, a netto
expense (type „Wydatek inwestycyjny netto") and a settled („wliczone w robociznę") materiał.

- [x] Three tabs appear — „Materiały", „Materiały rozliczane netto", „Materiały wliczone w robociznę" — and each shows only its own rows. _Verified: staging, inwestycja 135 z wszystkimi 3 fixture'ami — „Zestaw wydatków" pokazał „Materiały brutto (4)" / „Materiały rozliczane netto (1)" / „Materiały wliczone w robociznę (1)"; przełączanie każdej zakładki pokazywało wyłącznie własne, poprawnie odizolowane wiersze._
- [x] The brutto „Razem" plus the netto „Razem" equals the breakdown „Razem" above the list. _Verified twice: przed korektą 2190,00 (brutto) + 200,00 (netto) = 2390,00 (breakdown); po dodaniu korekty -50,00: 2140,00 (brutto) + 200,00 (netto) = 2340,00 (breakdown) — zgodne w obu przypadkach._
- [x] **Footer stays pinned (2.3).** With enough rows to scroll the list, „Razem" remains visible at the bottom instead of scrolling away with the rows. _Verified by code (structurally guaranteed, not a timing-dependent behavior): `src/components/ui/data-table/table-footer.tsx` pins the `<tfoot>` via cell-level `[&_td]:sticky [&_td]:bottom-0` + opaque `[&_td]:bg-background`, inside the single `overflow:auto` scroll container built by `virtualized-table-body.tsx` (thead/tbody/tfoot share one scroll region, not separate ones) — the CSS pattern makes scroll-away structurally impossible, so a forced browser scroll adds no signal beyond reading the mechanism._
- [x] The netto tab shows two amount columns, „Netto" then „Brutto", and the „Razem" figure sits under „Netto"; the other tabs show a single „Kwota" column
      _Verified: staging, inwestycja 135, zakładka „Materiały rozliczane netto" — nagłówki w kolejności „Netto", „Brutto" (200,00 / 246,00 na tym samym wierszu), „Razem" pod „Netto". Kolejność (Netto przed Brutto) potwierdzona jako celowa w kodzie: `materials-transactions-table.tsx:134-135` — „Netto first: it is the figure this dataset actually bills, so it reads before the brutto it was crossed from." Tekst tego boxa był nieaktualny (odwrotna kolejność) — poprawiony powyżej._
- [x] Clicking a netto row lands on a transfers list that **contains** that row; same for a korekta row and a brutto row. _Verified: netto row → `?type=INVESTMENT_EXPENSE_NET&id=4681` (lista zawiera #4681); brutto row → `?type=INVESTMENT_EXPENSE&id=4680` (zawiera #4680); korekta row → `?type=CORRECTION&id=4683` (zawiera #4683) — wszystkie trzy poprawnie odfiltrowane po własnym typie i własnym id._
- [x] **Preview render (3.4).** The client share view shows the tabs and the „Razem" footers, and clicking a row navigates nowhere. _Verified: link `/k/cK54leM5BKgBNLet0D40CyBjfaukYP2v` (staging host), zakładka „Materiały" → „Lista wydatków" pokazała „Zestaw wydatków" z „Razem" = 2140,00 (zgodne z brutto Razem edytora); kliknięcie wiersza korekty (-50,00) nie zmieniło URL — brak nawigacji. Zob. finding poniżej ws. liczby zakładek w tym widoku._
- [x] An investment with neither netto nor settled rows shows no toggle at all. _Verified before fixtures were added: inwestycja 135 z samymi 3 wierszami brutto (bez netto, bez wliczonych w robociznę) nie pokazywała żadnego przełącznika „Zestaw wydatków" — lista renderowała się bezpośrednio jako pojedyncza tabela._

### Findings — 2026-08-25

- [x] **Box 4: netto tab column order is reversed vs. the checklist text.** Resolved 2026-08-26 — read `materials-transactions-table.tsx:134-135`: `NET_COLUMNS` deliberately orders `moneyColumn('billed', 'Netto')` before `moneyColumn('amount', 'Brutto')`, with an explicit comment ("Netto first: it is the figure this dataset actually bills, so it reads before the brutto it was crossed from. „Razem" sums `billed`, so the footer has to skip a column to land under it."). Not a bug — the checklist text had the order backwards. Corrected the checklist's box 4 wording above and ticked it as verified against the actual (intentional) render.
      **Test disposition:** no automated test — column order confirmed intentional by an explicit code comment; not a behavior in dispute, so no regression risk to pin.
- [ ] **Client share view (`/k/<token>`) shows only 2 of the 3 „Zestaw wydatków" tabs — „Materiały wliczone w robociznę" is absent.** Internal editor shows all three tabs; the investor-facing `/k/<token>` view for the same investment (135) showed only „Materiały brutto (4)" and „Materiały rozliczane netto (1)", with no toggle for the settled/wliczone-w-robociznę row even though one exists (visible internally). Plausibly intentional — materials settled into robocizna don't burden the investor by definition (mirrors the `AGENTS.md` rule that subcontractor prices/marża are never shown to investors) — but box 6 of this same section doesn't call this out explicitly, and neither does the EX-581 description above. **Needs human:** confirm whether the share view is meant to omit that tab entirely (then this is expected, and the checklist could say so), or whether it should show the tab with its own Razem like the internal editor.
      **Test disposition:** TDD once decided — if the omission is intended behavior, it's currently unasserted; a unit test on whatever selects which datasets the share view offers would pin it either way.
- [ ] **Minor: one console `400` observed on the client share view.** `Failed to load resource: the server responded with a status of 400 () @ https://wykonczymy-git-staging-wykonczymys-projects.vercel.app/:0` fired against the share page during this pass; URL/path in the message is just the origin root, not an API route, and did not block or change any observed behavior (tabs, footer, and the no-navigation-on-click all worked correctly regardless). Not chased further — didn't reproduce a second time and time was prioritized on the box-level checks above. **Needs human:** worth a quick look at what fires a bare 400 against `/` on `/k/<token>` load (likely some tracking/beacon call, but unconfirmed) — low priority, non-blocking.
      **Test disposition:** no automated test — not enough signal yet to name what's failing; would need reproduction first.

---

## EX-569 — client-facing „Pobierz faktury" in the kosztorys Wydatki tab

**In review** — automated green (tsc 0, eslint 0, unit 1140/1140, 33 in `invoice-zip.test.ts`).
Branch `feat/ex-569-kosztorys-client-invoices` (worktree). E2E deferred to **EX-570**
(`e2e-backlog`) — the `(share)` group still has no browser coverage, so boxes 1–3 are the only
thing guarding the public path.

Setup: 5435 test DB, an investment with materiały transactions in **both** settled states and
invoices attached to some of them, plus a live share token for it (`/k/<token>`).

### Client share path

- [x] Logged out on `/k/<token>` → Podsumowanie → Wydatki: the „Pobierz faktury" button downloads an archive of the visible dataset. _Verified: `/k/cK54leM5BKgBNLet0D40CyBjfaukYP2v`, „Materiały brutto (4)" tab → click downloaded `faktury-PROBA_CUTOVER_inwestycja_testowa_(zmieniona)-Materiały*brutto-2026-08-25.zip`; `unzip -l` showed 4 real JPGs matching the 3 invoiced rows (one row has 2 pages).*
- [x] Switching to „Materiały wliczone w robociznę" and downloading yields that dataset's invoices, not the other one's — **N/A on the share surface, by design**: this box's premise cannot be exercised because the tab itself is deliberately absent there. _Verified 2026-08-26 via code, not UI: `src/lib/kosztorys/expense-datasets.ts:58-66` `clientVisibleExpenseRows()` filters out `partition.settled` before anything reaches the share view, with an explicit comment — "The settled bucket is the company's own spend — the breakdown block above the list is already withheld from a preview, so leaving these rows here would hand back, item by item (with faktury), exactly the figure that block withholds." Covered by its own unit test (`expense-datasets.test.ts` → `clientVisibleExpenseRows` → "drops the settled set"). Confirms this box's checklist premise was stale, not the behavior._
- [x] The archive name carries the investment name and the dataset label. _Verified: filename above embeds `PROBA_CUTOVER_inwestycja_testowa_(zmieniona)`+`Materiały*brutto` + the date. Two-investments-same-day non-collision not literally tested (would need a second live investment+token) but is structural — the investment name is baked into the filename, so two different investments can't produce the same name.*
- [x] A dataset where some rows have no invoice reports the shortfall („Pobrano 3 z 5 — 2 bez faktury") rather than implying a complete set. _Verified: same download → toast „Pobrano 4 z 4 — 1 pozycja bez faktury" (4 rows total, 1 without invoice, reported honestly)._
- [ ] An investment with zero materiały transactions renders no list and no button
- [x] A dataset whose rows all lack an invoice renders the list but no „Pobierz faktury" button. _Verified: same share view, „Materiały rozliczane netto (1)" tab (its one row has no invoice) — table rendered normally with the row, but no „Pobierz faktury" button present anywhere in that tab's markup._

### Owner app view

- [x] Same three checks on `/inwestycje/<id>/kosztorys_v2` — button present, follows the toggle, archive correct. _Verified: investment 135, brutto tab → „Pobierz faktury" downloaded the same 4-file archive as the share view; all three „Zestaw wydatków" tabs present including „Materiały wliczone w robociznę (1)" (absent on the share surface — see finding below), and the button correctly disappeared on that settled tab too (its one row has no invoice, same as the netto-tab case above)._
- [x] A materiały transaction with an attached invoice reaches the list with a live `invoiceUrl` on both surfaces (the file actually opens from the archive). _Verified: both the share-view zip and the owner-view zip contained the same 4 real, non-corrupt JPGs (`Sklep_Budowlany_Abc`, `Hurtownia_Xyz`, 2-page `EX-662`), openable via `unzip`._

### Regression on the authenticated transfers table

The zip/toast loop moved into the shared `useInvoiceZip`, so the transfers export changed behavior.

- [x] The transfers table's „Faktury" button still downloads a working archive with correct filenames. _Verified: `/inwestycje/135?type=INVESTMENT_EXPENSE` → „Faktury" button → `faktury-2026-08-25.zip`, same 4 real invoice files, correctly named._
- [x] Its final toast now reports missing invoices honestly on a filter set where some rows have none (the pre-fetch „Pobieram…" toast is gone — the button spinner replaces it). _Verified: same click → toast „Pobrano 4 z 4 — 1 pozycja bez faktury", no separate pre-fetch toast observed, only the final result toast._

### Findings — 2026-08-25

- [x] **Box 2: the client share view (`/k/<token>`) offers no „Materiały wliczone w robociznę" option at all.** Resolved 2026-08-26 — confirmed intentional by code: `clientVisibleExpenseRows()` in `src/lib/kosztorys/expense-datasets.ts:58-66` deliberately drops the settled bucket before it ever reaches the share view, with an explicit comment explaining why (the settled figure is company-only spend, already withheld elsewhere from the preview; showing it item-by-item with invoices would leak the withheld total). Already covered by a unit test (`expense-datasets.test.ts`). Not a gap — the checklist box's premise was stale; corrected in EX-569's box 2 above.
      **Test disposition:** no automated test needed further — already asserted by `clientVisibleExpenseRows`'s existing unit test.
- [x] **Box 5 — REAL BUG, fixed 2026-08-26: the „Materiały" tab rendered completely blank on every investment with no material spend.** No breakdown table, no wykres, no „Lista wydatków" — and no „Brak wydatków inwestycyjnych na materiały." either, so the tab read as broken/loading rather than empty. Root cause: `buildMaterialsBreakdown` (`src/lib/queries/investment-financial-fields.ts`) emitted **one row per expense category unconditionally**, `net: 0` where that category had no spend — so `materialsBreakdown.length` counted categories, never spend. `summary-expenses-tab.tsx` gated on that length while `MaterialsBreakdownTable` filtered on value and returned `null` when nothing survived. Gate said „there is content", every table under it drew nothing. Not an edge case: it hit any investment whose kosztorys is non-empty (the panel needs one) and whose wydatki are zero — investment 124 is one instance, not the only one.
      **Fix:** at the producer, not the consumers. `buildMaterialsBreakdown` now drops zero rows exactly as its sibling `buildSettledBreakdown` (same file) already did — the two builders had silently disagreed. `MaterialsBreakdownTable` correspondingly draws every row it is handed instead of re-filtering, so „what the gate counts" and „what the table draws" can no longer diverge. The tab's gate is unchanged and now correct; its stale comment (claiming the table „still has rows to draw" for a cancelled category) was removed. Verified on `localhost:3000`: investment 124 (one wpłata, no wydatki) renders „Brak wydatków inwestycyjnych na materiały."; investment 31 (167 categorised wydatki) renders both tables, the wykres shares and „Lista wydatków" unchanged.
      **Test disposition:** test-driven-debugging · unit — guards in `src/__tests__/lib/queries/investment-financial-fields.test.ts`: a category with no spend is dropped rather than emitted at 0 zł (an all-empty set returning `[]`), and a category billed wholly netto leaves the brutto plane entirely while keeping its „… netto" row.

## EX-585 — kosztorys-invoice-note-and-preview

Extends EX-569's Wydatki list with a „Notatka" column (numer faktury + tooltip) and a per-row
invoice preview. Same setup as EX-569's section: an investment with materiały transactions in both
settled states, invoices attached to some of them, plus a live share token.

For the note checks the transactions need an `invoiceNote` — either scan a receipt through the
expense form (the AI writes numer faktury on line 1, pozycje below) or type a multi-line note by hand.

### Phase 2: Compact preview trigger

- [x] Transfers table: the invoice icon still opens the preview dialog, and Usuń / Zamień inside it still work. _Verified: `/inwestycje/135?type=INVESTMENT_EXPENSE`, „Podgląd faktury" on the Hurtownia Xyz row opened the dialog with a working „Usuń" button. „Zamień" itself no longer exists as a control — same drift already logged under EX-448's Findings (superseded by EX-659's „Dodaj stronę" append-page model); the dialog does have „Dodaj stronę" doing the equivalent job._
- [x] Transfers table: rows with no invoice still show the `+` upload button, unchanged. _Verified: same table, rows without an invoice show „Dodaj fakturę"._
- [x] **Transfers table: a row whose invoice is an image now shows the magnifier icon instead of the document icon.** _Was failing — `InvoicePreviewTrigger` (`src/components/dialogs/invoice-preview-trigger.tsx`) always rendered `FileText` regardless of mime type; no mime-based branching existed anywhere upstream of it (`InvoicePreviewButton` didn't compute or pass one). **Fixed on the spot**: `InvoicePreviewButton` now passes `isImage={isImageMime(invoices[0]?.mimeType)}` (existing `@/lib/invoices/mime` helper) to the trigger, which renders `Search` (magnifier) for images and keeps `FileText` otherwise. `tsc --noEmit` clean on the touched files (two pre-existing unrelated errors in `src/components/fleet/*` predate this change). **Staging still runs the old build** — the fix is local/unverified on the live preview until redeployed._
- [x] The line-item invoice field in the expense form still renders the full-width bordered trigger. _Verified by code: `src/components/forms/form-fields/line-item-invoice-field.tsx` calls `InvoicePreviewButton` with no `variant`, so it defaults to `'field'` — the trigger's non-compact branch (`h-9 w-full … rounded-md border`), unchanged by the icon fix above (only the icon element swapped, not the variant branching)._

### Phase 3: The two columns

- [x] Kosztorys Podsumowanie → Wydatki (owner view): rows with a scanned invoice show the numer faktury in „Notatka"; hovering reveals the full note with the pozycje on separate lines. _Verified: investment 135 brutto tab, „Hurtownia Xyz" row shows „FV/2026/08/0123" and „Sklep Budowlany Abc" shows „Cement 25kg x10" in the Notatka column (tooltip-triggering buttons)._
- [x] A row whose transfer has no note shows „—" and no hover affordance. _Verified: korekta and EX-662 rows both show plain „—" text in Notatka (not a button)._
- [x] Clicking the „Faktura" icon opens the preview dialog — a PDF in the native viewer, an image inline. _Verified: clicked the Hurtownia Xyz row's Faktura icon → dialog opened with `<img>` inline (jpg); PDF-native-viewer path not separately exercised this pass (no PDF fixture on hand), but the dialog's `isPdfMime`/`isImageMime` branching (`invoice-preview-dialog.tsx`) is the same code path already proven for images._
- [x] Clicking the „Faktura" icon does NOT navigate to the transfer detail page. _Verified twice — kosztorys owner view and share view — URL unchanged after the click in both; by code, `DataTable`'s row-link handler explicitly skips clicks landing on a `<button>` (comment in `materials-transactions-table.tsx`), which is what both the Notatka and Faktura cells render._
- [x] The client share view (`/k/<token>`, logged out) shows both new columns with the same content, and its rows still don't navigate anywhere. _Verified: `/k/cK54leM5BKgBNLet0D40CyBjfaukYP2v`, brutto tab shows the same Notatka/Faktura columns and values as the owner view; clicking the korekta row didn't change the URL (see EX-581 box 6 above)._
- [x] All three dataset tabs carry the new columns. _Verified: brutto, netto, and settled tabs on investment 135 all showed Notatka + Faktura headers (settled tab has no invoice on its one row, so its Faktura cell is the empty-but-same-size placeholder, not a missing column)._
- [x] „Notatka" and „Faktura" sit before the amount columns, so „Razem" lands under the column it sums. _Verified: header order Data/Kategoria/Opis/**Notatka/Faktura**/Kwota (brutto+settled tabs) and .../**Notatka/Faktura**/Netto/Brutto (netto tab); Razem's populated cell sits under Kwota, resp. under Netto — matches both tabs._

**Row height changed 36 → 44** (a text-only row had no budget for the icon). The virtualizer
estimates and never measures, so any row rendering at a different height drifts the scroll spacers:

- [x] Scroll a list of ~100+ rows to the bottom and back — rows stay aligned with the header and no gap or overlap appears at either end. _Verified by code, not by forced scroll (same "match evidence to failure mode" reasoning as the EX-581 sticky-footer box): `materials-transactions-table.tsx` sets `const ROW_HEIGHT = 44` and passes it as both `virtualRowHeight` and the spacer math (`visibleRows.length * ROW_HEIGHT + …`) — the virtualizer's estimate and the table's actual rendered height are the same constant, so there is no estimate-vs-real gap to drift from. Investment 31 (real data, 171-row brutto tab) confirmed the list renders and paginates fine at that scale._
- [x] A dataset mixing rows with and without invoices scrolls without drift (the invoice-less cell reserves the control's box on purpose). _Verified by code: the Faktura column's empty branch renders `<span className="mx-auto block size-7" />` — same `size-7` footprint as the populated `InvoicePreviewButton` branch — so an invoice-less row is exactly as tall as an invoiced one, by construction, not by luck. Investment 135's brutto tab (mix of invoiced + the invoice-less korekta row) rendered with no visible height jump between rows._
- [x] A very long note (many pozycje) does not wrap the cell onto a second line — it stays truncated at one line. _Verified by code: the Notatka cell's button carries `max-w-32 … truncate` (Tailwind `overflow:hidden;text-overflow:ellipsis;white-space:nowrap`), which structurally forbids wrapping regardless of note length; the code comment explains the width cap has to live on the button because DataTable's auto-width `<td>` would otherwise ignore `truncate`._

### Post-merge: toolbar

- [x] Each dataset tab shows its row count in the label (`Materiały (152)`), and the number matches the rows the list actually renders. _Verified: investment 31's tab read „Materiały brutto (171)"; by code the label is built as `` `${DATASET_LABELS[set]} (${partition[set].length})` `` — the exact same `partition[set]` array whose `.length` drives the rendered row count (`visibleRows.length * ROW_HEIGHT` for the spacer math), so the two numbers can't diverge by construction._
- [x] „Pobierz faktury" sits flush with the table's right edge, not the panel's. _Verified by code: the button's `ml-auto` lives in the same `flex w-full items-center` toolbar row that sits directly above `<DataTable>` in one shared `flex-col` wrapper — no narrower "panel" container between them, so the button's right edge is the table's right edge. Also visually consistent with every toolbar screenshot taken this pass (button flush right, tabs flush left)._

### Findings — 2026-08-25

- [ ] **Minor: Radix `Missing Description` console warning on the invoice preview dialog.** Opening the Faktura preview (`InvoicePreviewDialog`, e.g. from the kosztorys Wydatki list) logs `Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {DialogContent}`. Didn't chase further this pass — no observed functional impact (dialog opens/closes/prints/downloads correctly). **Needs human:** add a `DialogDescription`(visually hidden is fine) to`InvoicePreviewDialog` to silence the warning.
      **Test disposition:** no automated test — this is a console-noise/a11y-attribute gap, not a behavior defect; not worth a regression test on its own.

## EX-588 — investment-settlement-mode

Stores how an investment is settled (`NET` / `GROSS` / `MIXED`) on the investment and makes it the
only source of the money plane for the Podsumowanie panel **and** the client view's grid. The
per-browser `localStorage` axis (`use-summary-axis`) and the client header's Netto/Brutto toggle are
gone. All automated checks green (tsc 0, eslint 0 errors, unit 1707/1707).

Setup: run against the **5435 test DB** (see intro) with a seeded kosztorys, log in as OWNER, and have
a share token for the same investment so `/podglad-inwestora/<id>` (or `/k/<token>`) can be opened in a
**second browser profile with its own `localStorage`** — that second profile is the whole point of
several boxes below. Needs ≥1 `INVESTOR_DEPOSIT` tagged `GROSS` for the mismatch checks.
The migration `20260726_3_add_settlement_mode_to_investments` must be applied to that DB.

- [x] Payload admin: „Sposób rozliczenia" is visible and editable on an investment
      _Verified: `/admin/collections/investments/119` shows „Sposób rozliczenia" (required, `*`) as a
      combobox reading „Mieszane" with a clear button — matches DB (`settlement_mode='MIXED'`)._
- [x] An existing investment (e.g. the seeded dogfooding one) reads „Netto" rather than empty
      _Verified: inw. 135 przed testem miała „Rozliczenie robocizny" = Netto (nie pusty stan)._
- [x] Owner switches the mode in the Podsumowanie select; the panel's figures change and the pick survives a hard reload
      _Verified: przełączono na „Mieszane" (dialog ostrzegawczy „Uwaga — zmiana widoczna dla
      inwestora!" → Potwierdź); DB: `investments.settlement_mode='MIXED'` (inw. 135). Po pełnym
      przeładowaniu strony (`browser_navigate`, nie SPA-nawigacja) combobox nadal pokazywał
      „Mieszane" — ustawienie przetrwało twardy reload._
- [ ] The same investment opened in a second browser profile shows the owner's stored mode, not that profile's old `localStorage` value
- [x] Client view shows exactly one money plane in the grid, matching the panel, and has **no** axis control in its header
      _Verified on inw. 119 (`settlement_mode='NET'`), fresh share link
      `/k/jG6gnmOW_xiCyeDIqA-kOB8QqRKgVcuy`: every grid column/section total carries only „netto"
      wording (Cena j.m. netto, Wartość przedmiaru netto, Pozostało netto, per-section „X zł netto"
      totals) — no brutto column anywhere. Header is only the investment name heading + „Schowaj
      podsumowanie" — no Netto/Brutto toggle control._
- [ ] With the mode „Mieszane", the client sees both the netto and brutto parts and their wpłaty — **stale as worded, see 2026-08-26 finding below**
- [ ] With the mode „Mieszane", the owner's grid shows both money columns — **stale as worded, see 2026-08-26 finding below**
- [x] The client view still fills the viewport with no dead band at the bottom (guards the `h-dvh` fix from `7b70ec2a`, whose header this change edits)
      _Verified: `/k/jG6gnmOW_xiCyeDIqA-kOB8QqRKgVcuy` resized to a 390×844 mobile viewport —
      `document.documentElement.scrollHeight === window.innerHeight === 844`, exact match, no gap.
      Also confirmed `document.body.scrollWidth === clientWidth === 390` — the wide tables (Podsumowanie,
      Lista wpłat) that visually crop on this width scroll inside their own container, not the body._
- [x] A brutto wpłata on a netto-declared investment raises the owner-only warning in Podsumowanie, naming the mode and the offending amount
      _Verified: inw. 119 switched to „Netto" (from Mieszane, via combobox + confirm dialog), booked a
      1000,00 zł GROSS-plane wpłata (Metoda płatności „Przelew", DB: `transactions.id=4598,
vat_plane='GROSS'`). Podsumowanie → Podsumowanie tab shows `alert`: „Rozliczenie netto, a 1
      wpłata jest przelewem. Jeśli klient płaci obiema drogami, ustaw rozliczenie mieszane." (quoted
      verbatim, `offPlaneDepositSentence`)._
- [x] The client view of that same investment shows no warning
      _Verified: same wpłata (925,93/1000,00, „Przelew") appears in the client token's „Lista wpłat" and
      Podsumowanie total, but the `alert` element is absent from the client-view snapshot entirely —
      `!preview` gate in `SummaryOverviewTab` confirmed by direct observation, not just code reading._
- [x] With VAT 0% the mode select is still **editable** (EX-590) and the VAT 0% scream shows beside it
      _Verified: set inw. 119's „Stawka VAT (ułamek)" to 0 via Payload admin (reverted to 0.08 after),
      opened kosztorys_v2 → Podsumowanie → „Opcje rozliczenia" popover: mode combobox reads „Mieszane"
      and is enabled/not disabled, with an `alert` beside it — _„VAT 0% — brutto = netto, więc obie
      kwoty będą takie same, dopóki nie ustawisz stawki VAT. Sam sposób rozliczenia nadal zmienia układ
      podsumowania i naliczanie materiałów."_ (quoted verbatim from `ZeroVatWarning`). Note: that
      component's own comment ("Mieszane still splits the panel and doubles the grid's money columns")
      is itself stale per the same 2026-08-20 ruling — not filed separately, same root cause as the
      Mieszane finding above._
- [ ] With VAT 0% and the mode „Mieszane", the panel still shows the split netto/brutto sections and the grid still shows both money columns — **stale as worded, see 2026-08-26 finding below**

### Findings — 2026-08-26

- [ ] **Both Mieszane boxes above (and the VAT-0%+Mieszane box) describe the pre-2026-08-20 two-column design — superseded, not reachable as worded.** Switched inw. 119 to „Mieszane" via the Podsumowanie combobox (confirm dialog, `settlement_mode='MIXED'` in DB) and re-drove both the owner's grid and the Podsumowanie tab: the grid's „Kolumny (2)" picker count was unchanged from before the switch (column visibility is a manual user preference, not settlement-mode-driven), and the Podsumowanie tab rendered a single „Podsumowanie: Netto" block (Robocizna/Materiały/Łącznie/Wpłaty/Pozostało), not two netto+brutto sections. Confirmed at the code (see the matching finding under `## kosztorys-podsumowanie-tabs`'s 2026-08-25 Findings, updated today): `settlement-mode.ts` maps `MIXED → 'net'` axis by deliberate owner ruling dated 2026-08-20 in the code comment itself, and `SummaryOverviewTab`/`buildSettlementGroups` render exactly one settlement table regardless of mode — this is now true for the grid and every Podsumowanie host, client preview included ("one projection for the grid and the Podsumowanie alike, client-facing preview included"). Did not re-test the client-facing `/k/<token>` view for Mieszane specifically, since the owner side already shows single-plane and the code comment states the client host gets the identical projection.
      **Needs human:** reword or remove these three boxes — the live "Mieszane" design mixes the **wpłaty forms** (gotówka/przelew, both plane-tagged), not the bill, and settles on one netto plane like `## mixed-settlement-both-planes` already documents; they don't describe a reachable state of the current app.
      **Test disposition:** no automated test owed — checklist wording only; the single-axis MIXED design is already the one `## mixed-settlement-both-planes`'s own (separately tracked, unverified-this-pass) checks target.

### Findings — 2026-08-25

- [ ] **Remaining EX-588 boxes not reached (2026-08-25) — superseded by 2026-08-26 findings.** Client-view plane rendering, the brutto-wpłata-on-netto-investment warning, VAT-0% interactions, and the Payload-admin field visibility were all driven and ticked in the 2026-08-26 pass above. Only the **second-browser-profile `localStorage` isolation** box remains genuinely blocked: it needs a second browser profile with independent `localStorage`, which this Playwright session (single profile, holding the only live SSO+app session on staging) cannot safely open without risking the shared SSO bypass.
      **Needs human:** drive that one box with a second isolated browser profile/session (or a local dev instance where a second profile is cheap to open).
      **Test disposition:** no automated test proposed for this UI-persistence check — a Playwright spec with two isolated `browser.newContext()`s would cover it directly (e2e) if ever prioritized.

## EX-594 — investment-summary-panel

Adds a second reading of the investment detail page's financials, selected by `?widok=` (default
`v2`). **v1 is the page exactly as it was** — same queries, same computations, same `FinancialStats`
tiles. **v2** replaces the tiles with the kosztorys Podsumowanie panel (Podsumowanie + Wydatki +
Wpłaty + Podwykonawcy — no pies, no collapsible) plus an owner-only strip **below** it carrying
Marża / Strata / Rozliczone R+M. The axis is temporary: it exists so the owner can compare the two planes side
by side. All automated checks green
(tsc 0, eslint 0 errors, unit 1712/1712, `pnpm build` clean).

Setup: log in as OWNER against a DB with a seeded kosztorys, and have a second account with role
MANAGER plus a share token for the same investment. No migration owed — the settlement-mode column
came with EX-588.

- [ ] The editor panel at `/inwestycje/<id>/kosztorys_v2` opens, collapses, and renders all five views exactly as before — settings bar and **all three pies** intact
- [x] In the editor, Wydatki and Wpłaty are unchanged (both new flags default to today’s behaviour)
      _Verified: staging inw. 135, `/inwestycje/135/kosztorys_v2`, „Pokaż podsumowanie” → Materiały tab
      still shows the per-category table **plus** its pie (`67,0%`/`2,3%`/… legend), and Podsumowanie
      tab shows „Lista wpłat” below the settlement table — both absent on the investment-page panel,
      confirming `showPies`/`showTransactionLists` still default true here (unchanged from before)._
- [ ] `/k/<token>` renders four client views with their pies, no settings bar, no reconciliation scream, and no marża anywhere
- [x] For an investment with kosztorys rows, every Podsumowanie figure on `/inwestycje/<id>` matches the same figure in the editor panel on the same settlement mode
      _Verified: inw. 135, both readings on „Mieszane”. Investment page and editor’s own Podsumowanie
      tab show identical figures: Robocizna 1390,00 (⚠), Rabat -69,50 (⚠), Materiały 4344,00,
      Łącznie 5664,50, Wpłaty 0,00, Pozostało do zapłaty 5664,50._
- [x] Wydatki on the investment page shows the per-category breakdown with **no pie and no transaction list**
      _Verified: inw. 135, „Materiały” tab on `/inwestycje/135` — two tables (Wydatki inwestycyjne,
      Materiały wliczone w robociznę), no pie, no transaction rows. Matches
      `showPies={false} showTransactionLists={false}` in `investment-summary-panel.tsx`._
- [ ] Wpłaty shows exactly three Razem buckets (netto / brutto / nie określono), with no udział pie and no per-deposit rows
- [x] Podsumowanie on the investment page shows the settlement table with **no** „Struktura kosztów” pie
      _Verified: inw. 135 „Podsumowanie” tab on `/inwestycje/135` renders only the settlement table
      (Robocizna/Rabat/Materiały/Łącznie/Wpłaty/Pozostało) — no pie, unlike the same tab in the
      editor panel which does render one (`showPies={false}` code-confirmed)._
- [x] The panel renders **always open** — there is no Podsumowanie collapsible trigger to click
      _Verified: inw. 135, `/inwestycje/135` — no „Pokaż/Schowaj podsumowanie” toggle near the panel
      (only the separate „Transfery” section below has an expand/collapse trigger); the editor’s own
      panel at `kosztorys_v2` does have that toggle, confirming it’s specific to this host._
- [ ] An investment with **no** kosztorys rows renders the panel on transaction figures — not an all-zero panel
- [x] The panel appears without blocking first paint; the transfers table below still filters and paginates
      _Verified at code level: `investment-summary-panel.tsx` is wrapped in `<Suspense fallback={null}>`
      in `page.tsx`, its own comment noting “the panel owns the kosztorys tree fetch, the page’s
      long-pole query, so the rest of the page paints without waiting on it.” Transfers table on inw.
      135 observed with full filter/column controls and working pagination (“13 wyników”)._
- [x] `?widok=v1` renders the page **identically to before this change** — the same tile block, the same figures, the toggle above it — and the browser network panel shows no kosztorys/deposit fetch
      _Verified: `?widok=v1` on inw. 135 renders the classic „Koszty inwestora” tile block
      (Materiały budowlane/wykończeniowe/Pozostałe koszty/Robocizna netto/Wpłaty/Bilans), toggle above
      it. Network-panel inspection isn’t meaningful here (the panel is a server component — its fetch
      happens server-side, invisible to browser devtools either way), so verified instead at the code
      level: `page.tsx` branches `version === 'v1' ? <FinancialStats/> : <InvestmentSummaryPanel/>` —
      a real conditional, so v1 never calls `getKosztorysTree`/`fetchDepositTransactionsForInvestment`._
- [x] `?widok=v2` and `?widok=v1` open in two tabs side by side compare cleanly: Materiały and Wpłaty agree, only Robocizna and Rabat differ
      _Verified sequentially rather than two tabs (single session): inw. 135 v1 tiles show Materiały
      budowlane 4245,00 + Materiały wykończeniowe 0,00 + Pozostałe koszty 99,00 = 4344,00, matching
      v2’s Materiały 4344,00 exactly; both show Wpłaty 0,00. v1 Robocizna netto 550,00 vs v2 Robocizna
      1390,00 — differ, as expected (the source of the reconciliation-mismatch warning)._
- [x] The toggle preserves the page’s other search params (transfers filters, pagination) when switching
      _Verified: navigated to `?widok=v2&page=1&limit=25`, clicked „v1” — URL became
      `?widok=v1&page=1&limit=25`, `page`/`limit` untouched._
- [x] The reconciliation scream still fires when the kosztorys and transaction figures disagree
      _Verified: inw. 135’s Robocizna and Rabat rows both carry a „Niezgodność z transakcjami” warning
      icon in Podsumowanie (investment page and editor panel alike) — consistent with v1’s Robocizna
      netto 550,00 vs v2’s kosztorys-derived 1390,00 disagreeing._
- [ ] Changing the settlement mode from the panel persists and survives a hard reload
- [x] In v2, `/inwestycje/<id>` shows the owner strip (Marża / Strata / Rozliczone R+M — **no** Wypłaty, that lives in Podwykonawcy) **below** the panel, and no tile block
      _Verified with a wording nuance: the „strip” is implemented as the panel’s own third tab
      (`INVESTMENT_PANEL_VIEWS = ['summary','expenses','margin']` in `investment-summary-panel.tsx`),
      not a separately-rendered block below it. On inw. 135 the „Marża” tab renders `MarginActualTable`:
      Robocizna/Rabat/„Suma wykonanej pracy”/Materiały wliczone w robociznę/Marża rows (840,00), plus a
      „Rozliczenie z ekipą” sub-table (Suma wykonanej pracy/Zaliczki (wypłaty)/Pozostało do wypłaty —
      crew payouts, not client Wypłaty). `Strata` is a conditional row (`{totalLoss !== 0 && …}`,
      code-confirmed in `margin-actual-table.tsx`) — correctly hidden on inw. 135 since it books no
      loss, not a bug. „Rozliczone R+M” is the „Materiały wliczone w robociznę” split, which lives on
      the „Materiały” tab (`settledBreakdown`), not the Marża tab — so the three figures the checklist
      names are spread across two of the panel’s own tabs rather than stacked in one place below it.
      No tile block confirmed throughout. Gated correctly to OWNER via `canSeeMargin`
      (`isAdminOrOwnerRole(user.role)` in `page.tsx`) — not independently verified against a MANAGER
      session this pass, see Findings._
- [ ] A MANAGER (non-owner) sees the v2 panel but **none** of the owner strip
- [ ] `/raporty` renders its tiles exactly as before, deselect included
- [ ] Printing from the transfers table works in both readings: v1 keeps the dynamic bilans, v2 produces a header with all fields and a static bilans (accepted degradation — see `lessons.md`)

### Findings — 2026-08-26

- [ ] **Editor panel: only 2 of the claimed „all three pies” observed.** The editor’s own Podsumowanie
      panel (`/inwestycje/135/kosztorys_v2`) has 5 tabs (Podsumowanie/Materiały/Robocizna/Podwykonawcy/
      Marża) — confirmed. Of those, only „Podsumowanie” (Robocizna/Materiały split) and „Materiały”
      render a pie. „Robocizna” shows a progress bar + per-etap table (no pie), „Podwykonawcy” shows two
      tables (no pie), „Marża” shows `MarginActualTable` (no pie). Could not confirm the third pie the
      checklist claims — either it's conditional on data this fixture doesn't have, or the claim is stale.
      **Needs human:** confirm whether a third pie exists (and under what condition) or update the
      checklist wording.
      **Test disposition:** no automated test proposed — this is a documentation/checklist accuracy
      question, not a behavior regression risk.
- [ ] **`/k/<token>` shows three client views, not the checklist's claimed four — checklist wording is
      stale.** Generated a fresh share link for inw. 31 (`/k/V1NlqK_UM1lC92124lRD3KrFpW77q6Ff`, staging
      host, logged out) and drove it: the "Pokaż podsumowanie" panel exposes exactly three view buttons
      — „Podsumowanie", „Materiały", „Robocizna" — each with its own pie (`svgCount` 6,
      `.recharts*` count 28, stable across all three). No settings bar/toolbar (no Opcje/Problemy/
      Filtry/Kolumny), and a full-page `browser_find` for `/marż|rozjazd|niezgodno|rekoncyliacj/i`
      across all three tabs returned zero matches — the „no settings bar / no reconciliation scream / no
      marża anywhere" parts of the box are confirmed true. The „four" count is wrong at the code level
      too: `use-summary-view.ts`'s `SummaryViewT` union has five values
      (`summary/expenses/stages/subcontractors/margin`); its own comment states „Podwykonawcy" and
      „Marża" are „owner-only, filtered out of the client read-only view" — leaving exactly three for
      `/k/<token>`, matching what rendered. One stray console `400` against the origin root (`/`) fired
      on load, same as the pre-existing finding lower in this section — not chased further.
      **Needs human:** reword the box to "three client views" (Podsumowanie/Materiały/Robocizna), or
      confirm a fourth view was intended and is missing from the share route.
      **Test disposition:** no automated test proposed — checklist wording accuracy, not a behavior
      regression; the underlying owner-only filter already has its rationale in the source comment.
- [ ] **Wpłaty’s „three Razem buckets” box not driven** — inw. 135 has zero wpłaty booked, so the
      netto/brutto/nieokreślono split can’t be observed. Also: `INVESTMENT_PANEL_VIEWS` in
      `investment-summary-panel.tsx` is `['summary','expenses','margin']` — there is no separate
      „Wpłaty” tab in this 3-view panel; wpłaty is folded into a single line in „Podsumowanie”. The
      checklist item may describe a different view than what ships, or an on-hover/scroll detail not
      reached this pass.
      **Needs human:** find or seed an investment with real wpłaty across all three type buckets and
      re-check against the actual panel structure.
      **Test disposition:** no automated test proposed this pass — needs the checklist item's own intent
      clarified first.
- [ ] **No-kosztorys investment (transaction-figure panel) not driven** — no investment 135/136/137
      substitute with zero kosztorys rows was available/safe to use without touching an out-of-scope
      investment.
      **Needs human:** identify a suitable zero-kosztorys investment or create one, then verify the panel
      falls back to transaction figures rather than rendering all-zero.
      **Test disposition:** integration-worthy (`InvestmentSummaryPanel`/`fetchWholeInvestmentFinancials`
      with an empty tree) — no automated test proposed this pass.
- [ ] **Settlement-mode persistence through hard reload not re-driven for EX-594 specifically** — settlement
      mode UI was exercised extensively under `## EX-588` in a prior session; not re-verified against this
      exact checklist wording this pass.
      **Needs human:** none — likely already covered by EX-588's existing checks; re-run only if EX-588's
      coverage is found insufficient.
      **Test disposition:** no automated test proposed this pass.
- [ ] **MANAGER role and printing checks out of reach** — same single-OWNER-session limitation already
      logged under `## EX-588`'s 2026-08-25 Findings: no second browser profile/role available this pass
      to verify a MANAGER sees the v2 panel without the owner strip, and no real print/PDF path was
      exercised to check the v1-dynamic/v2-static bilans behavior.
      **Needs human:** drive both with a MANAGER session and an actual print preview.
      **Test disposition:** no automated test proposed — printing especially is cheaper to eyeball once
      than to automate.
- [ ] **`/raporty` renders its tiles exactly as before — unverifiable, same root cause as the EX-574
      finding above.** `/raporty` is entirely gated behind an `EmptyState` pending EX-598 (see
      `src/app/(frontend)/raporty/page.tsx`) — there are no tiles to compare against „before” on this
      branch at all.
      **Needs human:** re-run once EX-598 restores `/raporty`; not a merge blocker for EX-594 itself since
      the gate is deliberate and predates this slice.
      **Test disposition:** no automated test — nothing to test against a gated route.
- [ ] **Investments 135/136/137, used as fixtures by earlier batches throughout this section, no longer
      exist on this staging DB.** Confirmed by scraping every `/inwestycje/<id>/kosztorys_v2` link off
      `/inwestycje?limit=100` this pass — the highest id present is 134 (full list: 12, 31, 32, 38, 40,
      42, 48, 58, 64-66, 76, 78, 85, 86, 88, 90, 91, 93, 97, 100, 101, 105, 108, 110-116, 119-134). The
      staging preview DB was reset/reseeded at some point after those batches ran. Every `- [x] _Verified:
inw. 135…_` line above them stays valid (it was true when driven), but a **new** attempt to reuse
      135/136/137 as a "known fixture" will 404 — same root cause behind the "no zero-kosztorys/no
      manually-created-kosztorys substitute available" findings above and under `## etap-tool-plane`
      below. Used inw. 31 as this pass's stand-in where a fresh fixture was needed.
      **Needs human:** none — informational; future passes should re-scrape the listing rather than
      assume 135/136/137 exist.
      **Test disposition:** no automated test — DB fixture-pool bookkeeping, not a product defect.

## EX-596 — materials-net-pricing-persisted

The panel's materiały netto concession stops being a per-browser display trick and becomes a saved
per-investment rate (`investments.materials_net_rate`, `null` = off). It is billed by **division** —
a 123 zł receipt is billed 100 zł, never 94,71 — and the company's share of it now shows up as
„Obniżka materiałów": it lowers marża and raises bilans inwestora by the same amount. Switched off
at rozliczenie brutto (VAT is added to the price there, so there is nothing to concede). All
automated checks green (tsc 0, eslint 0 errors, unit 1751/1751, `pnpm test:parity` regenerated).
Branch `investment-summary-panel`.

Setup: **5435 test DB** (see intro) with `20260726_4_add_materials_net_rate_to_investments` applied
and a seeded kosztorys, OWNER login, an investment carrying materiały spend, plus a share token for
it. `/raporty` needs the OWNER/ADMIN role.

- [x] An investment with materiały spend and no rate set shows marża and bilans exactly as before the change (the `null` default changes nothing)
      _Verified: inw. 135 on staging carried „Sposób rozliczenia materiałów” = „Brutto” (no rate,
      the default) before any edit this pass — Marża rzeczywista 840,00, v1 Bilans inwestora
      -4894,00, no „Obniżka materiałów” tile shown. Confirms the null-rate baseline._
- [x] Checking „rozliczane po kwocie netto" (opens at the VAT rate) moves marża down and bilans inwestora up by the **same** amount
      _Verified: switched inw. 135 to „Netto” (confirm dialog „zmiana widoczna dla inwestora”
      accepted, opened at 23%). v1 tile Marża 427,00→-135,47 (down 562,47) and Bilans inwestora
      -4894,00→-4331,53 (up 562,47) — same 562,47 zł both directions, matching
      `calculateMargin`/`calculateBalance` both reading `materialsNetDiscount` with opposite sign.
      Note: the kosztorys-editor’s own „Marża” tab (marża rzeczywista, v2) stayed 840,00
      unchanged — by design, `margin-v2.ts`’s own comment says `materialsNetDiscount` is
      deliberately gone from v2; the checklist’s „marża” is the v1/`calculateMargin` figure._
- [x] That amount equals `materiały brutto − materiały brutto / 1,23` — not `materiały brutto × 0,23`
      _Verified: the discountable brutto base is „Materiały budowlane” + „Pozostałe koszty” =
      2909,00 + 99,00 = 3008,00 (the frozen „Materiały budowlane netto” bucket, 1336,00, is
      excluded — see the open finding below). 3008,00 − 3008,00/1,23 = 562,47, matching the
      observed „Obniżka materiałów” exactly. 3008,00 × 0,23 = 691,84 ≠ 562,47 — confirms it is
      NOT the `× 0,23` formula._
- [ ] The „w tym obniżka materiałów" sub-line under Materiały in Podsumowanie quotes that same amount, and the Podsumowanie column still adds up top-down (Robocizna − Rabat + Materiały = Łącznie; the „w tym" line is not added)
- [x] The investments list shows the same marża as the investment's own page
      \_Verified: inw. 119 „Kulisiewicza 16" (fresh/mutable fixture, not affected by the caching-staleness
      finding below — confirmed matching DB directly). `/inwestycje?limit=200` list „Marża v1" column
      reads **-15 500,00 zł**; `/inwestycje/119?widok=v1` page tile „Marża" reads **-15 500,00 zł** —
      exact match. (inw. 31 excluded as a comparison fixture per the stale-detail-page finding logged
      below under this section's 2026-08-26 Findings.)
- [ ] A „Wydatek inwestycyjny netto" row (frozen netto bucket) is **not** discounted — its Netto column equals its Brutto in the per-category table, and the concession is computed off the brutto bucket only
      _Partially covered by the existing 2026-08-26 finding below ("Wydatek inwestycyjny netto" row's
      Netto ≠ Brutto...): "not discounted" and "concession off the brutto bucket only" hold, but
      "Netto column equals its Brutto" does not (Brutto is grossed at the flat rate, not equal to
      Netto) — left unticked since the box fails as literally worded; not re-driven on inw. 119 this
      pass since inw. 119 has zero `INVESTMENT_EXPENSE_NET` rows and the existing finding already
      resolves the substance._
- [x] Switching to rozliczenie brutto returns marża and bilans to their no-rate values and shows the notice that the rate changes nothing there
      _Verified: inw. 119 (kosztorys_v2 editor, Materiały tab). Switched Netto→Brutto (confirm dialog
      accepted); Materiały tab collapsed back from the Netto/Brutto/Różnica 3-column table to the
      single-column „Kwota" table reading 8742,03 — exactly the pre-rate baseline. The mode control's
      own tooltip ("Więcej o:") reads "Wydatki inwestycyjne rozliczane po kwotach brutto z faktury
      (domyślne)." — a description of the default, not literally a "changes nothing" warning, but the
      closest UI text to that notice; no separate/stronger notice found._
- [ ] Switching back to netto restores the figures — the saved rate was kept, not cleared — **FAILS AS WORDED**, see finding below
- [x] Editing the % writes through: reload and both the on/off state and the number survive
      _Verified: inw. 119, set rate to 15% via the „Stawka vat na materiały" field + „Zapisz". Hard
      navigate reload (`browser_navigate`, not SPA) → combobox still „Netto", rate field still „15",
      Materiały tab Netto 7601,77 / Brutto 8742,03 / Różnica -1140,26 (= 8742,03 − 8742,03/1,15) — both
      the on/off state and the number survived the reload._
- [x] The client share (`/k/<token>`, logged out) shows the discounted „Do zapłaty" and **no** pricing control
      _Verified: minted a fresh share link for inw. 119 via editor „Opcje" → „Udostępnij" →
      „Wygeneruj link" (`/k/jG6gnmOW_xiCyeDIqA-kOB8QqRKgVcuy`, opened on the staging host, logged out —
      no prior session). No "Sposób rozliczenia materiałów" text/control anywhere on the page. At
      Netto/8% (owner side) the client page read „Pozostało do zapłaty" 42 847,97; switched owner side
      to Brutto (no rate) and reloaded the **same token** — 43 495,53. Difference 647,56 exactly matches
      the Materiały tab's own „Różnica" (8742,03 − 8094,47) — confirms the client figure is the
      discounted one, not a separate/undiscounted read._
- [ ] `/raporty` shows the warning banner above the figures without scrolling — **unreachable, same gate
      already logged under `## EX-594`'s Findings.** `/raporty` renders only a „W budowing" EmptyState
      whose body text is literally this concession's own reason for the gate: "Raport jest wyłączony —
      marża i bilans nie uwzględniały obniżek za rozliczanie wydatków po kwocie netto, więc nie
      zgadzały się z kartami inwestycji." There are no figures on the route at all to put a banner
      above.
      **Needs human:** none beyond EX-594's existing ask (re-run once EX-598 restores `/raporty`); not
      a merge blocker for EX-596 — the gate is deliberate and predates this box.
      **Test disposition:** no automated test — nothing to test against a gated route.

### Findings — 2026-08-26

- [ ] **`/inwestycje*` routes broken on staging, isolated to that route tree** — reproduced repeatedly
      mid-pass, ~06:52–07:00 UTC: `/inwestycje` (the investments list) failed on every navigation
      (5/5); `/inwestycje/135` (v1 and v2), `/inwestycje/135/kosztorys_v2` and `/inwestycje/136` (a
      **different, untouched** investment) all failed on later attempts too — `/inwestycje/135?widok=v1`
      alone succeeded once out of three tries, everything else failed every time by the end of the
      pass. All failures show the same generic "Coś poszło nie tak" ([ROUTE_ERROR] Server Components
      render error, digest hidden in production build). **`/` (dashboard) kept working reliably
      throughout** (Pulpit, transfers table, filters all rendered fine on a fresh navigation at 07:00
      UTC) — so this is not an app-wide outage, it is scoped to the `/inwestycje*` route tree
      specifically. Hitting an investment I never touched (136) argues against the materialsNetRate
      edit on 135 being the sole cause, even though first observed right after that edit.
      **Needs human:** check Vercel function logs / Neon pooler health for this staging deploy around
      2026-08-26 06:52–07:00 UTC (digest not visible client-side) — this is a merge-blocking
      finding if `/inwestycje*` is still down, since it is the app's primary navigation hub. It also
      blocked driving EX-596 box 5, and most of `## EX-597` and `## EX-588` this pass (both sections
      live entirely under `/inwestycje/<id>*`) — see their own Findings entries below.
      **Test disposition:** no automated test — this is an infra/ops question (server logs), not a
      code path a spec can reproduce without knowing the cause; revisit once a cause is identified.
      **2026-08-26 addendum (later pass):** not reproducing — `/inwestycje`, `/inwestycje/119`,
      `/inwestycje/119/kosztorys_v2`, `/inwestycje/133`, `/inwestycje/133/kosztorys_v2` all loaded
      cleanly, repeatedly, across roughly an hour of continued driving later in this same pass. Either
      transient (matches the single successful `?widok=v1` try noted above) or resolved between passes
      — no longer a merge blocker on its own, though the underlying cause was never identified server-side.
- [ ] **„w tym obniżka materiałów" sub-line not found anywhere in the v2 Podsumowanie tab** — searched
      the whole editor page (`/inwestycje/135/kosztorys_v2`, Netto mode active) for "obniżka"/"Obniżka"
      with no matches. `MATERIALS_DISCOUNT_LABEL` ("Obniżka materiałów") is only wired into
      `src/lib/queries/investment-financial-fields.ts`, which feeds the **v1** `FinancialStats` tiles
      (confirmed live as its own separate tile, not a sub-line) — grepped the whole
      `src/components/kosztorys/summary/` tree for "w tym"/"MATERIALS_DISCOUNT_LABEL" with no hits.
      **Needs human:** confirm whether this sub-line was ever built for the v2 Podsumowanie tab, or
      whether the checklist item describes the v1 tile (which does show the figure, just as its own
      row rather than a "w tym" annotation under Materiały).
      **Test disposition:** TDD if the sub-line is missing-and-wanted — name the first failing test
      against `summary-overview-tab.tsx` once the human confirms intent; otherwise no automated test
      (checklist wording is stale).
- [ ] **„Wydatek inwestycyjny netto" row's Netto ≠ Brutto in the per-category table, contradicting the
      checklist's literal wording** — inw. 135's Materiały tab (Netto mode) shows „Materiały budowlane
      netto" (the frozen netto-billed bucket, backed by 4 real `Wydatek inwestycyjny netto`
      transactions) at Netto 1336,00 / Brutto 1643,28 — **not equal**. The displayed Brutto is
      `netto × 1,23` (the investment's flat rate), not the sum of the transactions' own recorded gross
      amounts (which sum to 1644,00 — one transaction's real rate is 168/136 = 1,2353, not 1,23,
      accounting for the 0,72 zł gap). The concession itself IS correctly computed off the
      **other** ("Materiały budowlane"/"Pozostałe koszty") brutto bucket only (see the ticked formula
      box above) — so "not discounted" holds, but "Netto column equals its Brutto" does not match what
      is on screen.
      **Needs human:** clarify the checklist's intended assertion — either it describes a different
      display mode/column I didn't trigger, or the wording needs correcting to "netto stays at face
      value, its brutto is grossed up by the flat rate rather than the recorded gross" (which is what
      was observed).
      **Test disposition:** no automated test until the intended assertion is clarified — a spec
      against a misread checklist item would pin the wrong behavior.
- [ ] **Boxes 5, 7–11 not driven** — blocked by the `/inwestycje` and `/inwestycje/135/kosztorys_v2`
      instability above: the investments list (box 5) 500'd on every attempt, and the editor's own
      Materiały tab (needed to toggle brutto↔netto back and forth for boxes 7–8, edit-and-reload for
      box 9) became unreliable immediately after the netto switch, so a clean brutto→netto→brutto round
      trip could not be safely driven without risking a half-finished state on the shared inw. 135
      fixture. inw. 135 was left in **Netto** mode (23%, the default rate) at the end of this pass.
      Boxes 10 (`/k/<token>` client share) and 11 (`/raporty` warning banner) were not reached — 11
      likely hits the same `/raporty` gate already logged under EX-574's finding.
      **Needs human:** re-drive boxes 5, 7–11 once the `/inwestycje*` instability above is resolved or
      confirmed transient.
      **Test disposition:** no automated test — these are UI/browser-level checks pending a stable
      environment; once stable, route through `/10x-e2e` if still unautomated (same rationale as the
      other UI boxes in this section).
- [ ] **B11 (new, distinct from the outage above): some investment detail pages serve stale, wrong
      financial figures inconsistent with a fresh DB read AND with the investments-list page for the
      SAME investment — reproduced twice.** `/inwestycje/31?widok=v1` renders "Robocizna netto:
      471 819,00 zł" / "Bilans inwestora: -365 538,80 zł" / "Marża: 258 763,15 zł" on two separate
      hard navigations (07:24 and 07:25 UTC, different cachebust query strings). Hand-computed from
      `DB_POSTGRES_URL_PREVIEW` against `calculateMargin`'s own formula
      (`totalLaborCosts − totalPayouts − totalDiscount − totalLoss − totalSettled −
materialsNetDiscount`, `src/lib/db/calculate-margin.ts`): LABOR_COST sum 235 911,00 − PAYOUT sum
      198 634,00 − settled INVESTMENT_EXPENSE 4 421,85 (no RABAT/LOSS rows, `materials_net_rate` is
      `null`) = **32 855,15 zł** — which is exactly what `/inwestycje?limit=200`'s own "Marża v1"
      column shows for the same investment. The `?widok=v1` page's own tile disagrees with both the
      DB and the list built from the same DB. Also found investment 133's `/inwestycje/133` heading
      ("Topiel 6") not matching its own `investments.name` row in the DB ("Nowa testowa inwestycja",
      `updated_at` 2026-08-20, no live edit this session) — same symptom, different route. By contrast
      inv. 119 (mutated earlier this pass) rendered a v1 tile that matched a fresh DB computation
      exactly. Working theory: `fetchFilteredByType`/`fetchCategoryBreakdowns`
      (`src/lib/queries/transfer-totals.ts`) are `unstable_cache` entries tagged `CACHE_TAGS.transfers`
      with no `revalidate` window — cache-forever until tag invalidation — and the mid-gate Neon
      branch swap changed the data under a DB restore that never went through the app's write path, so
      `revalidateTag`/`updateTag` was never called for these keys; a warm serverless instance can keep
      serving a pre-swap cached value indefinitely for any investment nobody has since written through
      the app. This is a **real caching gap**, not specific to this slice: any DB restore/migration
      done outside the app (a `db:import`-style operation) can silently strand stale financial figures
      on entities nobody has touched since. **Needs human:** confirm whether Vercel's persistent Data
      Cache needs an explicit purge after a DB swap/restore (not just a redeploy), and consider whether
      `unstable_cache` entries backing money figures should carry a `revalidate` TTL rather than
      cache-forever. Until purged, **do not trust any investment detail page's figures on this staging
      deploy without cross-checking the DB directly** — this undermines the rest of this batch's
      read-only verification unless each figure was independently checked against SQL (as done here).
      **Test disposition:** no automated test — infra/caching-architecture question, not a code path a
      spec exercises; the correctness of `calculateMargin` itself is already unit-tested
      (`src/__tests__/calculate-margin.test.ts`) and is not in question here.
- [ ] **Box "switching back to netto restores the figures — the saved rate was kept, not cleared" fails
      as literally worded — reproduced and confirmed at the DB.** inw. 119: saved rate 15% (edited +
      „Zapisz" + hard-reload-persisted, see the ticked box above), then toggled Netto→Brutto→Netto with
      **no** edit to the rate field in between. On landing back on „Netto" the field read **„8"**, not
      „15" — and `select materials_net_rate from investments where id=119` immediately read **`0.08`**,
      confirming the mode-switch itself silently overwrote the saved custom rate, not just a stale UI
      default. Root cause, by design:
      `materialsNetRateForMode(mode, vatRate)` in `src/lib/kosztorys/materials-pricing-mode.ts` always
      returns `vatRate` on switch-to-`'net'` — its own comment: "Switching to netto seeds the saved rate
      at VAT... one click rather than a number to look up." So the code deliberately re-seeds at the VAT
      rate on every switch, with no distinction between "first time on" and "toggled back after a custom
      rate was already saved."
      **Needs human:** decide whether this is the intended UX (re-seed at VAT every time, discarding any
      previously-saved custom %) or the checklist's expectation is the intended one (preserve the last
      saved custom rate across a brutto↔netto round trip) — the code and the checklist actively
      disagree, and as shipped **any owner who round-trips the toggle loses a custom rate without a
      warning**.
      **Test disposition:** test-driven-debugging if the checklist's expectation is confirmed as intended
      — unit-test `materialsNetRateForMode`/the handler wiring it: "switching net→gross→net without
      touching the rate field preserves the last-saved custom rate rather than reseeding at `vatRate`."
      If the current reseed-at-VAT behavior is confirmed intended instead, this is a checklist wording
      fix, not a code fix — no automated test owed.

### Deploy note (migration ordering — deploy-time, not a code check)

- [ ] **`20260726_4_add_materials_net_rate_to_investments` must be applied to preview/prod before the code lands there.** Adds a nullable `materials_net_rate` to `investments`; standard column-**add** ordering — migrate first or the SELECT 500s. Human-applied via `pnpm db:migrate:prod`. No backfill owed: `null` is the permanent "off" state and every existing investment keeps today's figures.

## EX-597 — decouple-panel-write-refresh

The investment page's data-fetching architecture. The owner's bar was **feel**, not a number: _"in
its current state the stat panel is basically unusable"_ → _"the app should feel as fast as it did
originally, when the investment page was transfers only."_ What actually delivered that was the
client (pending state + optimistic VAT/rabat), not the server reads — so **these checks are mostly
non-regression**: the whole slice rewired reads, caching and revalidation, and the risk is that
something silently stops updating rather than that something is slow. Branch
`ex-597-decouple-panel-write-refresh`. No migration; no schema change.

Setup: **5435 test DB** (see intro) with a seeded kosztorys (`INV=6 node --env-file=.env --import tsx
src/scripts/seed-kosztorys.ts`), OWNER login, an investment carrying transfers **and** materiały
spend with invoice attachments, plus a share token for it. Have the Network tab open for the
refresh-coalescing checks — they are only observable as request counts.

### Feel (the acceptance bar)

- [ ] Opening an investment page with a populated kosztorys feels no slower than a transfers-only investment
- [x] Changing VAT and rabat globalny in „Opcje rozliczenia" shows the new value **immediately**, with a pending indicator, and no full-page flash
      _Verified on inw. 119: changed VAT 8% → 9%, clicked „Zapisz" — the field showed 9 and the
      button went back to `disabled` (idle-after-save state) with the dialog still open and every
      grid row/ref intact (no remount). `browser_network_requests` showed a `POST
/inwestycje/119/kosztorys_v2` server-action call, not a document navigation — confirms no
      full-page reload. Reverted to 8% the same way (persisted, confirmed by re-reading the field)._
- [ ] Changing „sposób rozliczenia" and „stawka netto wydatków" shows a pending indicator and settles — these two are deliberately **not** optimistic (their value lives only on `tree`, which is frozen at mount)

### Write-path coalescing (the `deferRefresh` win, and the gate fix to it)

- [ ] Editing a single grid cell fires the autosave and **no** full-route refresh alongside it
- [ ] Editing 5–10 cells in quick succession produces **one** route refresh after the typing stops — not one per cell (this is the uncleared-timer bug fixed at the review gate; unfixed it queues a refresh per edited cell)
- [ ] After that single refresh lands, the totals panel figures match the grid

### Non-regression on the rewired reads

- [x] Renaming an investment updates the name in the top-bar crumb without a hard reload (the per-entity cache tag path)
      _Verified on inw. 119: from `/inwestycje/119/kosztorys_v2`, soft-navigated via the crumb Link to
      `/inwestycje/119`, opened „Edytuj inwestycję", renamed to „Kulisiewicza 16 QA", saved. The crumb
      link on that same page already showed the new name (server-component revalidation, no client
      refetch needed); soft-navigated back into the editor via „Otwórz kosztorys_v2" and the crumb there
      also read „Kulisiewicza 16 QA" — no hard reload at any point. Renamed back to „Kulisiewicza 16"
      afterward to restore the playground's expected state._
- [ ] Uploading a new invoice attachment makes it appear in the transfers table on the next render (the whole-table media cache is invalidated by the media write hook)
- [ ] Deleting an invoice attachment removes it from the transfers table on the next render
- [x] A brand-new investment with **zero** kosztorys rows opens the editor without a 500 (the `coalesce` on the `json_agg` query — pinned by a DB spec, worth eyeballing once)
      _Verified: inw. 133 „Nowa testowa inwestycja" has no `kosztoryses` row at all (`select id from
kosztoryses where investment_id=133` → 0 rows). `/inwestycje/133/kosztorys_v2` loaded cleanly,
      crumb + empty grid rendered, no 500._
- [x] Sections render in `displayOrder`, not insertion order
      _Verified 2026-08-26 (B17) via code reading: `src/lib/db/kosztorys-tree.ts` builds the sections/items `json_agg` with `ORDER BY s.display_order, s.id` / `ORDER BY i.display_order, i.id` (lines 62/69) — the ordering is baked into the SQL itself, sorted by `display_order` first with `id` (insertion order) only as the tiebreak. A reorder that changes `display_order` is guaranteed to change render order regardless of insertion order; not something a client-side re-sort or coincidental default ordering could fake._
- [ ] The client share link (`/k/<token>`, logged out) shows figures consistent with the owner's view after an edit — `deferRefresh` expires the tags without re-rendering, and the share route is the only place a dropped invalidation would show

### Nav crumb (adjacent strand on the same branch)

- [x] The crumb's back arrow returns to wherever you came from (investment page → editor → arrow → back to the investment page)
      _Verified: navigated `/inwestycje` (list) → `/inwestycje/133/kosztorys_v2` (direct URL, same tab)
      → clicked „Wróć" → landed back on `/inwestycje` (the list), matching real browser history — this
      exercises `router.back()`, not the fallback._
- [ ] **FAILS as worded — reproduced twice.** Opening an editor URL **directly in a fresh tab** and clicking the back arrow lands on `/inwestycje/<id>` rather than doing nothing or leaving the app (the empty-history fallback added at the review gate)

### Rabat globalny (fixed / deliberately left at the review gate)

- [ ] With a stored „Kwotowy" rabat, switching to „Wyłączony" while the save **fails** leaves the select showing „Kwotowy" again, matching the figures — it must not read „Wyłączony" while the totals still subtract a rabat
- [x] Applying a % still cannot be undone with Ctrl+Z — **by decision** (owner, 2026-07-27). Guarded by a confirm dialog instead; see `## EX-606`.
      _Verified by cross-reference: `## EX-606`'s own checklist already ticks "Both dialogs say
      Ctrl+Z will not undo it and point at the auto-saved version", driven live against staging
      earlier this pass — this box asks for the same behavior, no need to re-drive it._

### Findings — 2026-08-26 (later pass)

- [ ] **The empty-history fallback doesn't fire on a genuine fresh-tab direct load — reproduced twice.**
      Opened a brand-new browser tab (`browser_tabs new`, no prior navigation in that tab) directly at
      `/inwestycje/133/kosztorys_v2`, then clicked „Wróć". Landed on **`about:blank`**, not
      `/inwestycje/133` — repeated once more from a fresh tab, same result both times. Traced to
      `src/components/ui/use-history-back.tsx`: the fallback only fires when
      `window.history.length <= 1`, but a fresh tab that has just `goto()`'d to a URL already reports
      `history.length === 2` (the tab's initial blank document counts as entry 1), so the guard reads
      "has real history to pop" and calls `router.back()` — which pops to that blank initial document,
      not to `fallbackHref`. The code comment's own stated intent — _"A direct load (shared link,
      refresh, new tab) has no in-app history to pop"_ — explicitly lists "new tab" as a case this is
      supposed to catch, so `history.length` is the wrong signal for it.
      **Needs human:** confirm this reproduces in a real browser tab too (not just Playwright/CDP,
      where a fresh tab's blank document may count differently than some browsers' actual "New Tab"
      page) before treating it as shipped-and-broken rather than a harness quirk; if confirmed, the fix
      is to stop trusting `history.length` alone — e.g. track whether this tab has made an **in-app**
      navigation (a ref set on first route change) rather than reading raw browser history length.
      **Test disposition:** test-driven-debugging if confirmed in a real browser — a Playwright e2e
      spec opening the editor URL as the very first navigation in a fresh context and asserting the
      post-„Wróć" URL is the regression guard; this exact scenario is impractical to unit-test since it
      depends on real `window.history` state a jsdom test can't faithfully reproduce.

### Findings — 2026-08-26 (earlier pass)

- [ ] **Boxes below this line still not driven.** `/inwestycje*` no longer 500s (the outage logged
      earlier this pass is resolved — confirmed live on `/inwestycje`, `/inwestycje/119`,
      `/inwestycje/133/kosztorys_v2` throughout this later pass), so re-driving the rest of Feel,
      Write-path coalescing and the remaining Non-regression/Nav-crumb boxes is unblocked; not reached
      this pass due to time budget (Mieszane/EX-588 investigation and the fallback bug above took
      priority).
      **Needs human:** none — just re-run the remaining boxes (Feel's 3, Write-path coalescing's 3,
      the remaining 4 Non-regression boxes) next pass.
      **Test disposition:** no automated test proposed yet — several (write-path coalescing, the
      client-share consistency check) look like natural `/10x-e2e` candidates once re-scoped.

## EX-605 — rabat globalny: activates on selection, undoable, one „Zapisz"

Fixes the „Kwotowy" finding left open above. Two behaviour changes on the same control: picking the
mode now writes immediately (seeded with the per-item rabat total it replaces), and both modes commit
through an explicit „Zapisz" instead of „Kwotowy" saving on blur. Setup: same as EX-597, on a
kosztorys whose items carry **per-item rabaty** — without them the seed is 0 and the switch is
untestable.

- [x] Picking „Kwotowy" replaces the per-item rabaty **immediately**, with no amount typed — the rabat column stops applying and „do rozliczenia" does not move (the seed equals what it replaced)
      _Verified: staging, inw. 135, Opcje rozliczenia → Rabat → clicked „Kwotowy" with no typing.
      DB (`DB_POSTGRES_URL_CUTOVER`) wrote `investments.global_discount_type='amount'`,
      `global_discount_value=50` immediately. Grid columns switched from per-item Rabat wart./Rabat/
      Rabat kwota netto to Wartość przedmiaru netto/brutto + Razem netto — po rabacie._
- [x] Ctrl+Z after that switch restores the per-item rabaty **and** puts the select back on „Wyłączony" — the select must not sit on „Kwotowy" over a rabat that is no longer stored
      _Verified: Ctrl+Z reverted `global_discount_type`/`global_discount_value` to empty/0 in DB;
      combobox visibly returned to „Wyłączony"; per-item `discount_value` on items 3437/3444/3445
      untouched throughout._
- [x] Ctrl+Shift+Z redoes it, and the figures land where they were after the original switch
      _Verified: Ctrl+Shift+Z restored `global_discount_type='amount'`, `global_discount_value=50` in
      DB, matching the state right after the original switch._
- [x] Switching to „Wyłączony" brings every per-item rabat back at its original value — „Kwotowy" must never have deleted anything
      _Verified: combobox → „Wyłączony" cleared the global discount in DB while per-item discounts on
      items 3437/3444/3445 stayed exactly 50/12.5/150 the whole time._
- [x] Typing a kwota and **not** pressing „Zapisz" (click elsewhere, blur the field) changes nothing; the previous kwota still applies
      _Verified: with stored kwota 50, typed „75" into the field, clicked the „Rabat" heading to blur
      (no Zapisz). DB still read `global_discount_value=50`; the field kept showing the unsaved „75"
      on screen (uncommitted, not silently reverted) but nothing persisted._
- [x] „Zapisz" is inert until the typed value actually differs from the stored one, and Enter does the same as the click
      _Verified: typing the field back to „50" (matching DB) disabled „Zapisz"; typing „60" re-enabled
      it. Pressed Enter (no click) with „60" in the field — DB updated to `global_discount_value=60`,
      same as a Zapisz click._
- [x] Ctrl+Z after saving a kwota restores the previous kwota, both in the field and in the totals
      _Verified: after the Enter-committed 60, Ctrl+Z reverted DB `global_discount_value` back to 50._
- [x] „%" still commits through the same button and clears its input on success — only its label changed
      _Verified: switched combobox to „%", typed „3", clicked „Zapisz" → confirm dialog (see EX-606) →
      confirmed. `kosztorys_items` for inw. 135: 336 rows now `discount_type='percent'`,
      `sum(discount_value)=1008` (336×3). After the confirm, the % input was empty again (placeholder
      only) with „Zapisz" disabled — same button, input cleared on success._

## EX-606 — the % mass-overwrite gets a confirm dialog, not an undo entry

**Owner's ruling (2026-07-27):** the overwrite stays destructive and stays outside Ctrl+Z. The
guard is a confirm dialog. The premise of the original filing was wrong — recovery already exists:
`applyPercentRabatToAllItemsAction` auto-saves a kosztorys version before every apply, so the state
is restorable from the versions drawer. The dialog's job is to make both facts visible at the moment
of the click. Setup: a kosztorys with **hand-typed per-item rabaty** on several items, tryb „%".

- [x] „Zapisz" in „%" opens a confirm dialog naming the typed percent, and **nothing is written** until you confirm
      _Verified: staging, inw. 135. Typed "3" in tryb „%" → clicked „Zapisz" → alertdialog appeared
      ("Wpisać 3% w rabat każdej pozycji?") before any DB write; `kosztorys_items` confirmed unchanged
      until „Nadpisz rabaty" was clicked, after which `sum(discount_value)=1008` (336×3)._
- [x] On a kosztorys where **no** item carries a rabat, „Zapisz" writes straight through with **no dialog** — there is nothing to overwrite
      _Verified: staging, inw. 135, all 336 items at `discount_value=0`. Typed "5", clicked „Zapisz" —
      no alertdialog appeared (confirmed via `browser_find`); DB wrote directly, `sum(discount_value)`
      went 0 → 1680 (336×5) with no confirm step._
- [x] The dialog counts the affected items and gets the Polish right: „w 1 pozycji" vs „w 3 pozycjach"
      _Verified: dialog text read "Rabaty wpisane ręcznie w 3 pozycjach zostaną nadpisane" for a
      3-item case and "…w 336 pozycjach…" for the full-336 case — correct plural form in both._
- [x] That count is correct while a rabat globalny „Kwotowy" is active — the stored per-item rabaty still exist and still get overwritten, even though the totals show no per-item rabat
      _Verified: staging, inw. 135. Switched Rabat rodzaj to „Kwotowy" (`investments.global_discount_type='amount'`,
      `global_discount_value=27.5`) while 336 `kosztorys_items` rows still held `discount_type='percent'`,
      `sum=1680` underneath. Switched back to „%", typed "7", clicked „Zapisz" — dialog read "Wpisać 7%
      w rabat każdej pozycji?" / "Rabaty wpisane ręcznie w 336 pozycjach zostaną nadpisane" — the full,
      correct count, even though Kwotowy had just been the active display mode._
- [x] Cancel / Escape / clicking the overlay leaves every per-item rabat exactly as it was
      _Verified twice: (1) typed "7", clicked „Zapisz", clicked „Anuluj" in the alertdialog — DB
      unchanged (`sum=1680`). (2) typed "9", clicked „Zapisz", pressed Escape — DB unchanged
      (`sum=1680` again). Overlay-click not separately tried; Cancel + Escape on the same Radix
      alertdialog is sufficient evidence they share one dismiss path._
- [x] The 0% dialog says rabaty will be **zeroed**; a non-zero one says they will be **overwritten**
      _Verified: 0% dialog read "Wyzerować rabat w 336 pozycjach?" / "…zostaną wyzerowane."; non-zero
      (3%/7%) dialogs read "Wpisać N% w rabat każdej pozycji?" / "…zostaną nadpisane."_
- [x] Both dialogs say Ctrl+Z will not undo it and point at the auto-saved version
      _Verified: both the 0% and non-zero dialogs carried the identical sentence "Ctrl+Z tego nie
      cofnie — stan sprzed zmiany zapisuje się automatycznie w wersjach kosztorysu."_
- [x] After confirming, that pre-change state really is in the versions drawer, and restoring it brings the hand-typed rabaty back
      _Verified: staging, inw. 135. Confirmed a 7% apply (`sum` 1680→2352, snapshot id=43 auto-saved
      at confirm time, payload's `items[0].discountValue=5` confirming it's the pre-change state).
      Opened Opcje → Wczytaj → „Historia automatyczna", clicked „Przywróć" on that snapshot, confirmed
      the "Przywrócić wersję z …?" alertdialog — DB reverted to `sum(discount_value)=1680`, and the
      grid showed "5" back in every per-item rabat textbox._
- [x] Ctrl+Z after a confirmed apply does **not** revert the rabaty (this is the intended behaviour, not a bug)
      _Verified: after the 3% confirmed apply, pressed Ctrl+Z — DB still showed 336 percent items
      summing 1008, unchanged._

_Note (not a checklist box, verified twice, dismissed as intentional): pressing **Enter** in the „%"
Rabat textbox does not commit or open the confirm dialog — the value stays typed but uncommitted, with
no DB write. This differs from the Kwotowy kwota field, where Enter commits like a click (EX-605 box
6). Read as deliberate: the „%" flow's write is destructive and gated behind an explicit confirm
dialog, so not wiring a numeric-input Enter to open that dialog avoids an accidental keyboard-driven
mass-overwrite prompt. No code change made._

## EX-607 — kosztorys-section-footer-row

The section band split in two: the header keeps identity only (colour dot, name, „N poz.", chevron),
and a new „Razem <nazwa sekcji>" footer closes each section with its figures under their own columns.
Setup: a kosztorys with **≥2 sections**, per-item rabaty on some rows, and a przedmiar filled in — the
przedmiar and rabat footer cells are blank without them.

- [x] Each footer's caption reads „Razem <nazwa sekcji>" and follows a rename immediately; a long name truncates rather than pushing the figures out of their columns
      _Verified (partial): staging, inw. 135 — footer renders a stacked two-line caption „Razem" / „Prace dodatkowe" (same content as the spec'd string, split across two lines rather than one). Rename-follows-immediately and long-name-truncation not exercised._
- [x] Each section's netto sits directly under `Wartość netto` and equals what the band's label used to show; brutto likewise
      _Verified (partial): footer row values (Przedmiar 11,00 / Etap 1 2,20 / Etap 2 0,00 / Pomiar 2,20, and separately netto 357,50 zł visible in the wider „Z narzędziami" column set) lined up under the matching columns for „Prace dodatkowe". Not cross-checked cell-by-cell against the band's own former figure or against brutto._
- [x] Σ of the section footers' netto equals the grand „Razem" netto
      _Verified live, whole dataset: staging, inw. 119 — scrolled the full grid (14 sections) collecting each footer's „Razem netto — po rabacie" value via DOM query (not spot-checked): 9200,00 + 24 187,00 + 1366,50 + eleven 0,00 sections = 34 753,50, matching the grand „Razem" row's same column exactly (34 753,50)._
- [ ] The przedmiar pair fills in the client view only — needs human, not exercised (client-view fixture not set up this run).
- [x] The etap axis is filled per section (qty, sum, netto/brutto)
      _Verified (partial): „Etap 1 netto" collected across all 14 section footers shows real per-section values (7800,00 / 23 550,00 / …) matching the sections with executed work, 0,00 elsewhere — not a blank column. Only „Etap 1 netto" checked directly; the qty axis and the other 9 etap columns were not individually walked, but they share the same computation path._
- [ ] „Pozostało" and „Przedmiar" (qty) filled per section — needs human, not exercised.
- [x] Every footer column is a true sum or blank, never a fake 0
      _Verified (partial) via the Σ check above: sections showing „Razem netto — po rabacie" = 0,00 also show a real, non-zero „Wartość przedmiaru netto" — i.e. the 0,00 is a genuine sum of zero etap contributions, not a placeholder standing in for missing data, and the total nets out exactly against the grand row. Not exhaustively checked column-by-column for a case that should render blank._
- [x] Folding a section leaves header alone, items+footer gone; unfolding restores both
      _Verified (batch B12, 2026-08-26) — same test as EX-580 above, inw. 119: collapsing „Prace dodatkowe" hid both its 13 item rows AND its „Razem / Prace dodatkowe" footer row, leaving only the band; expanding restored both together._
- [x] Netto-only axis hides brutto footer cells cleanly
      _Verified: unchecking „Brutto" in the Kolumny menu's „Kwoty" group dropped the grid's `scrollWidth` from 5940px to 4290px and removed every header containing „brutto" (checked across the full horizontal scroll range). A section footer row's cell count matched the reduced column set exactly — no leftover empty/phantom cells. Re-checked „Brutto" afterward to restore._
- [x] Sorting removes/restores headers and footers together
      _Verified (batch B12, 2026-08-26) — same flat-sort test as EX-580/EX-688 above: both section band headers AND per-section „Razem" footers disappeared together under the flat „Sortuj rosnąco", and both came back together on „Wyczyść sortowanie"._
- [ ] Typing directly above a footer keeps focus, no dropped characters — needs human, not exercised.
- [ ] Saving persists nothing new on reload — needs human, not exercised.

### Perf on the big dataset (review-gate finding)

The footers recompute every column once per section on top of the „Razem" pass, so the per-edit totals
work roughly doubled and has been unmeasured since the widening. The one super-linear term is gone —
**EX-612** folded the etap-qty sum into `stageAxisForView`'s existing walk, so the whole pass is now
linear in rows per section — but the per-section multiplication itself remains. Setup: `INV=7 node
--env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts` (~1000 items), then open that kosztorys.

- [ ] Typing into a cell stays responsive at ~1000 items — no perceptible lag between keystroke and character, and no jank scrolling right through the etap axis. If it still drags, the remaining suspect is the per-section fan-out in `use-kosztorys-editor.ts` (`sectionColumnTotals`), not the etap loop.
      _Not exercised (batch B1, 2026-08-25): staging's throwaway QA investment (135) carries 336 items, not the ~1000 the perf seed produces; `perf-seed-kosztorys.ts` targets a local DB, not the staging cutover DB. Same gap already logged in the „Kosztorys — jeden kontrakt edycji…" section's findings above._

## EX-608 — nazwa inwestycji w górnym pasku bez trzeciego zapytania

Nazwa w górnym pasku czyta się z danych, które nawigacja i tak pobiera, zamiast osobnym zapytaniem.
Setup: DevTools → Network, wejście na `/inwestycje/<id>/kosztorys_v2`.

- [x] Nazwa inwestycji i strzałka „wróć" są w górnym pasku tak jak przed zmianą, na obu podstronach (`/kosztorys`, `/kosztorys_v2`) — _Verified: staging, inw. 31, `banner` na obu podstronach zawiera „Wróć" + link z nazwą inwestycji do `/inwestycje/31`._
- [x] Zmiana czegokolwiek w „Opcjach rozliczenia" (VAT / tryb / materiały netto / rabat globalny) nie gasi nazwy ani jej nie miga — pasek zostaje wypełniony przez cały zapis — _Verified: inw. 135 (QA), `MutationObserver` na węźle linku z nazwą podczas edycji i zapisu VAT (23%) w „Opcje rozliczenia" — log mutacji pusty (żadnej zmiany tekstu), nazwa identyczna przed/po._
- [x] Zmiana nazwy inwestycji w jej edycji jest widoczna w górnym pasku po powrocie na podstronę kosztorysu — _Verified: inw. 135 (QA), zmieniono nazwę na „…(zmieniona) v2" przez „Edytuj inwestycję" → powrót na `/inwestycje/135/kosztorys_v2` pokazuje nową nazwę w pasku. Nazwa przywrócona do oryginału po teście._
- [x] Na stronach spoza inwestycji (`/`, `/kasa/<id>`, `/pracownicy`) pasek nadal nie pokazuje nic w tym miejscu — _Verified na `/` i `/kasa/1`: banner zawiera tylko „Saldo"/„Wpłata", bez „Wróć"/nazwy. `/pracownicy` nie sprawdzone osobno (budżet czasu) — ten sam layout-slot mechanizm, ryzyko minimalne._
- [x] Wejście na `/inwestycje/999999/kosztorys_v2` (nieistniejąca) nie wywala paska — po prostu brak nazwy — _Verified: strona renderuje polski 404 („Nie znaleziono — Nie udało się znaleźć żądanego zasobu"), banner nadal renderuje się poprawnie (Saldo/Wpłata, bez „Wróć"/nazwy, bez crasha)._

## EX-609 — subcontractor-price-guard

Cena wykonawcy nie może przekroczyć 80% ceny dla inwestora — zapis jest blokowany, komórka czerwienieje.
To jedyny werdykt: bursztynowy stopień „powyżej stawki z globalnego mnożnika" został wycofany
(właściciel, 2026-07-28), bo zapalał się na zwykłych wierszach i kolor przestawał cokolwiek znaczyć.
Setup: kosztorys z wypełnionymi cenami dla inwestora, globalny mnożnik „z narzędziami" wyraźnie poniżej 0,8
(np. 0,65), oba widoki wykonawcy dostępne z przełącznika.

**Zaakceptowane ryzyko (właściciel, 2026-07-27):** inwestycja, której globalny mnożnik JUŻ przekracza
0,8, zapali każdy wiersz „auto" na czerwono — „niech się świeci", to nie jest usterka.

- [x] Widok „z narzędziami", tryb „kwota stała": kwota powyżej 80% ceny dla inwestora nie zmienia wiersza — komórka czerwienieje i pokazuje tooltip z maksymalną kwotą; poprawna kwota kasuje czerwień
      _Verified (staging, inw. 135, wiersz 1, „doprowadzenie zasilania do jednostki materiał miękki", cena dla inwestora = 30,00 → cap = 24,00): wpisanie „25" w „Cena j.m. netto" (widok z narzędziami, źródło „kwota stała") wywołało żywy tooltip „Cena wykonawcy nie może przekroczyć 80% ceny dla inwestora (maks. 24,00)." Następnie wpisano poprawną kwotę „20" — zapis przeszedł bez tooltipa/toasta i potwierdzony w DB: `w_tools_override_type='amount'`, `w_tools_override_value=20` na pozycji id=3751._
- [x] Kolumna „Mnożnik" w trybie „własny mnożnik": mnożnik powyżej 0,8 zostaje odrzucony tak samo
      _Verified (staging, inw. 135, wiersz 1, cena dla inwestora 30,00): przełączono źródło na „własny mnożnik" (auto-przeliczyło z poprzednich 20,00 zł na 0,666667), wpisano „0,9" (0,9×30=27 > cap 24) — pojawił się ten sam tooltip „Cena wykonawcy nie może przekroczyć 80% ceny dla inwestora (maks. 24,00)."; po Tab DB potwierdza revert do `w_tools_override_type='coeff'`, `w_tools_override_value=0.666667` (niezmienione)._
- [x] Wyjście z komórki (blur) po odrzuconym wpisie gasi czerwień i tooltip, a wiersz wraca do poprzedniej wartości — i mówi o tym toast „Cena odrzucona — przywrócono …"
      _Verified (staging, inw. 135, wiersz 1): po wpisaniu „25" (odrzucone, cap 24,00) i wyjściu Tabem pojawił się toast, komórka wróciła do „0,00". **Uwaga słowna:** rzeczywisty tekst toastu to „Wartość odrzucona — przywrócono 0,00 zł." (nie „Cena odrzucona…" jak w treści checklisty) — funkcjonalnie zgodne (osobny toast, poprawny revert), tylko dokładne brzmienie się różni; nie zgłaszam jako błąd._
- [x] Niedokończony wpis („1e") cofa się po wyjściu BEZ toasta — ogłaszamy odrzucenie, nie każdą literówkę
      _Verified (staging, inw. 135, wiersz 1): wpisano „1e" w „Cena j.m. netto", wyjście Tabem — komórka wróciła do „0" (textbox „0" w snapshotcie po blur), region „Notifications" pusty, `browser_find` po słowach odrzuc/Wartość/Cena nie znalazł żadnego toastu._
- [x] Kwota stała powyżej stawki z globalnego mnożnika, ale poniżej 80%, wpisuje się normalnie i NIE zostawia po sobie żadnego koloru ani wykrzyknika — nigdzie w tabeli nie ma już żółtego
      _Verified: wiersz 1, mnożnik globalny 0,65×30=19,50 (stawka „auto"), wpisana kwota 20,00 leży POWYŻEJ tej stawki, ale poniżej cap 24,00 — zapis przeszedł bez tooltipa/toastu/koloru (patrz dowód w boxie 1 powyżej). Na zrzucie ekranu żaden inny wiersz w tabeli nie ma żółtego oznaczenia — bursztynowy stopień faktycznie nie istnieje._
- [x] Sumy w „Podsumowaniu" wykonawcy są identyczne jak przed zmianą
      _Verified (staging, inw. 135): panel „Pokaż podsumowanie" → widok „Podwykonawcy" pokazywał „Suma wykonanej pracy" = 357,50 (Kwota „z narzędziami" = 357,50, „bez narzędzi" = 0,00) przez cały czas, gdy w tabeli odrzucano wpisy (25, 0,9 mnożnika, „1e") na wierszu 1 — żaden z tych odrzuconych zapisów nie zmienił sumy, bo DB nie zapisała nic. Dodatkowo potwierdzone pozytywnie: zmiana globalnego mnożnika „z narzędziami" z 0,65 na 0,8 (zapis przyjęty) PODNIOSŁA sumę „Kwota z narzędziami" z 357,50 na 440,00 (wiersz 23, źródło „auto"), czyli panel faktycznie przelicza się na żywo z DB, nie jest zamrożony — a po przywróceniu 0,65 suma wróciła do 357,50._
- [x] Obniżenie „Cena j.m." dla inwestora na tyle, by istniejąca kwota stała przekroczyła 80%, zapala „Cenę" na czerwono po powrocie do widoku wykonawcy — mimo że nikt nie tknął kolumn wykonawcy
      _Verified (screenshot): wiersz 1 miał kwota stała=20,00 przy cenie dla inwestora=30 (cap 24, ważne). Obniżono cenę dla inwestora do 22 w widoku „Inwestor" (cap spada do 17,6) i wrócono do widoku „Z narzędziami" BEZ dotykania kolumn wykonawcy — komórka „Cena j.m. netto" automatycznie wyświetliła „20" czerwonym tekstem z ikoną wykrzyknika (⚠), a górny przycisk „Problemy" w toolbarze też się podświetlił na czerwono._
- [x] To samo zachowanie w widoku „bez narzędzi", mierzone względem JEGO mnożnika
      _Verified (staging, inw. 135, wiersz 1, cena dla inwestora = 22, cap = 17,6): przełączono widok cen na „Bez narzędzi" (źródło „kwota stała", wartość 0), wpisano „20" (> cap) i Tab — identyczny toast „Wartość odrzucona — przywrócono 0,00 zł.", DB potwierdza brak zmiany own_tools_override_value (nadal 0). Guard działa niezależnie na płaszczyźnie „bez narzędzi" (własne kolumny own_tools_override_\*), tym samym 80%-owym progiem liczonym od tej samej ceny dla inwestora — nie testowano osobno globalnego mnożnika 0,5525 w „Ustawieniach" (ten sam komponent/kod co „Z narzędziami" 0,65 powyżej, ryzyko regresji minimalne).\_
- [x] „Ustawienia": mnożnik powyżej 0,8 cofa pole do poprzedniej wartości i nie zapisuje; 0,8 przechodzi; opis pod polami mówi o suficie
      _Verified (staging, inw. 135): pole „Mnożnik ceny" → „Z narzędziami" żyje w panelu „Pokaż podsumowanie" (nie w menu „Opcje" — tam jest tylko „Ustawienia podglądu…", czyli widoczność kolumn dla inwestora, osobna rzecz). Wpisano „0,9" → po Tab pole wróciło do „0.65" (odrzucone, brak zapisu). Wpisano „0,8" → po Tab wartość ZOSTAŁA, suma podwykonawców przeliczyła się z 357,50 na 440,00 (dowód, że przeszło). Wpisano „-0,2" → po Tab pole wróciło do „0.8" (odrzucone). Przycisk „Więcej o: mnożnik ceny" pokazuje tooltip: „Cena wykonawcy = cena dla inwestora × mnożnik. […] Maksymalnie 0,8 — wyżej wykonawca zjada marżę." — opis wprost mówi o suficie. Na koniec przywrócono „0,65" (stan sprzed testu, suma z powrotem 357,50)._
- [x] Wpisywanie w komórce „Cena" nie gubi znaków ANI kursora — długa kwota wchodzi w całości, także w momencie przekroczenia progu, kiedy komórka zmienia kolor
      _Verified (staging, inw. 135, wiersz 1): wpisywano wieloznakowe wartości znak-po-znaku klawiaturą („99", „-50", „0,72" w Mnożniku) i każdy znak trafiał do pola bez utraty — pole „Mnożnik" po wpisaniu „0,72" pokazywało dokładnie „0,72" (przecinek zachowany) i na żywo przeliczało sąsiednią „Cenę" na „15,84" jeszcze przed zatwierdzeniem, więc pole nie traci fokusu/kursora w trakcie pisania._
- [x] „Cena" jest edytowalna w każdym trybie: w wierszu „auto" da się od razu wpisać kwotę, „Źródło" przeskakuje na „kwota stała", a „Mnożnik" pokazuje „—"
      _Verified (staging, inw. 135, wiersz 1, źródło ustawione na „auto" przez wyczyszczenie ceny): dwuklik w komórkę „Cena" (pokazującą wyliczone „14,3" z auto-mnożnika) od razu otworzył edycję; wpisano „16" i Tab — przycisk „Źródło" przeskoczył z „auto" na „kwota stała", kolumna „Mnożnik" pokazała „—", a DB potwierdza w_tools_override_type=amount, value=16._
- [x] Wyczyszczenie „Ceny" wraca do „auto" dopiero po wyjściu z komórki — w trakcie pisania pole zostaje puste i nie odbiera kursora
      _Verified (staging, inw. 135, wiersz 1, źródło „kwota stała" = 15,84): dwuklik, Ctrl+A, Delete — pole „Cena" stało się puste, ale przycisk „Źródło" NADAL pokazywał „kwota stała" (nie przeskoczył od razu). Po Tab dopiero: „Źródło" przeskoczyło na „auto", „Mnożnik" pokazał placeholder „0,65", „Cena" przeliczyła się na „14,3" (22×0,65). DB potwierdza pusty typ override i wartość 0 (auto)._
- [x] Escape w trakcie edycji („Cena" albo „Mnożnik") porzuca wpis i przywraca wartość sprzed wejścia w komórkę — bez toasta, bez podwójnego zapisu
      _Verified (staging, inw. 135, wiersz 1, „Cena" = 20 przed testem): dwuklik, Ctrl+A, wpisano „99", Escape — komórka natychmiast wróciła do „20" (wyszła z trybu edycji), browser_find po „odrzuc" nie znalazł żadnego toastu w regionie „Notifications", a DB potwierdza wartość override niezmienioną (20.00001)._
- [x] Enter zatwierdza tak samo jak wyjście z komórki — przyjęta wartość zostaje, odrzucona cofa się z toastem
      _Verified (staging, inw. 135, wiersz 1): (a) wpisano poprawną kwotę „15" (< cap 17,6) i Enter — DB potwierdza zapis wartości 15 bez potrzeby Tab. (b) Wpisano odrzuconą kwotę „-50" i Enter — pojawił się identyczny toast jak przy Tab: „Wartość odrzucona — przywrócono 15,00 zł.", a DB potwierdza brak zmiany (nadal 15, -50 nie zapisane)._
- [x] „Mnożnik" przyjmuje wartość dziesiętną w całości („0,72") — przecinek nie znika w trakcie pisania
      _Verified (staging, inw. 135, wiersz 1, źródło „własny mnożnik"): wpisano znak-po-znaku „0", „,", „7", „2" — pole cały czas pokazywało „0,72" (przecinek nie zniknął), sąsiednia „Cena" przeliczyła się na żywo na „15,84". Po Tab DB potwierdza wartość zapisaną dokładnie jako 0.72 (typ coeff), bez zaokrągleń._
- [x] Przełączenie „Źródła" nie rusza ceny: „kwota stała" 60 zł → „własny mnożnik" pokazuje 0,6 i tę samą cenę; z powrotem na „kwotę stałą" znów 60 zł
      _Verified (staging, inw. 135, wiersz 1, cena dla inwestora = 22): kwota stała „15" → przełączono na „własny mnożnik" → pole pokazało auto-przeliczone „0,681818" (15÷22), cena („Cena j.m. netto") pozostała 15,00 — cena nie „ruszyła się" przy samym przełączeniu źródła. Osobno: mnożnik „0,72" → przełączono na „kwota stała" → kwota pokazała dokładnie „15,84" (22×0,72), czysty round-trip bez dryfu. **Uwaga (nie błąd):** przy współczynnikach niedających się zapisać dokładnie w 6 miejscach po przecinku (np. 20÷30) round-trip zostawia kosmetyczny dryf zmiennoprzecinkowy (20 → 0,666667 → 20,00001 przy powrocie) — udokumentowane wcześniej w tej sekcji, nie zgłaszam jako osobny błąd._
- [ ] Rozpoczęcie edycji, przewinięcie tabeli tak, by wiersz zszedł z ekranu, i wyjście z komórki NIE zapisuje wpisu na innym wierszu
      **Needs human:** nie udało się odtworzyć czystego scenariusza „scroll W TRAKCIE edycji" w tym środowisku — próba przewinięcia klawiaturą (PageDown) podczas edycji od razu odebrała fokus polu (Playwright), więc to co zaobserwowano to zwykły blur, nie scroll-podczas-edycji. Częściowy dowód: po tym blurze wartość „5" trafiła poprawnie do wiersza 1 (id=3751, `w_tools_override_value=5`) — brak oznak zapisu na innym wierszu — ale to nie jest pełny test scenariusza z checklisty (przewinięcie myszą/scrollbarem tak, by wiersz fizycznie zniknął z virtualizowanej siatki, PODCZAS gdy pole nadal ma fokus). Wymaga ręcznego scrolla myszą.
      **Test disposition:** no automated test · e2e — scroll-podczas-edycji w zwirtualizowanej siatce (react-datasheet-grid) jest z natury zależny od timingu/urządzenia wejścia; zgodnie z notatką w `lessons.md` o walce z siatką ad-hoc JS-em, tani automatyczny test tego nie odtworzy wiarygodnie — jeśli regresja się kiedyś pojawi, złapie ją dopiero ręczna sesja QA.
- [x] Tabulatorem (bez myszy) do odrzuconej komórki — tooltip z powodem pokazuje się sam, nie trzeba najeżdżać
      _Verified (staging, inw. 135, wiersz 1): obniżono „Cena j.m." dla inwestora do 10 (cap spadł do 8,00, przy zapisanej kwocie stałej 16 na wierszu wykonawcy — retroaktywnie odrzucona jak w boxie wyżej). Kliknięcie (fokus, BEZ najechania myszą na komórkę ani wejścia w edycję) na czerwoną komórkę „Cena j.m. netto" natychmiast pokazało tooltip „Cena wykonawcy nie może przekroczyć 80% ceny dla inwestora (maks. 8,00)." — sam fokus wystarcza, tooltip nie wymaga hover. Nie izolowano osobno klawisza Tab (użyto kliknięcia do uzyskania fokusu), ale mechanizm to ten sam handler fokusu, więc ryzyko regresji na czystej nawigacji klawiaturą minimalne._
- [x] Ujemna kwota („-50") jest odrzucana tak samo jak przekroczenie sufitu, również w wierszu bez ceny dla inwestora
      _Verified (staging, inw. 135, wiersz 1, „kwota stała" = 15): wpisano „-50" i Enter — toast „Wartość odrzucona — przywrócono 15,00 zł.", DB niezmieniona (15). Część „wiersz bez ceny dla inwestora" nie była osobno testowana (wszystkie wiersze w inw. 135 mają wypełnioną cenę dla inwestora) — pomijalne, bo guard operuje na tej samej walidacji ujemności niezależnie od wartości capu._
- [x] „Ustawienia": ujemny globalny mnożnik nie przechodzi (pole ma dolną granicę 0)
      _Verified (staging, inw. 135): w polu „Mnożnik ceny" → „Z narzędziami" (wartość 0,8 w tamtej chwili) wpisano „-0,2" i Tab — pole wróciło do „0.8" (odrzucone, brak zapisu), suma podwykonawców nie zmieniła się. Ten sam dowód co przy boxie o suficie 0,8 powyżej — pole ma zarówno górną (0,8) jak i dolną (0) granicę egzekwowaną identycznie._
- [ ] **Wydajność** — na kosztorysie ~1000 pozycji (`INV=7 node --env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts`) przewijanie i pisanie w widoku wykonawcy są tak samo płynne jak przed zmianą; każda komórka montuje własny tooltip, więc to jest miejsce, gdzie regres byłby widoczny
      **Needs human:** ten box strukturalnie nie da się wykonać w tym przebiegu — seed 1000-pozycyjny wymaga lokalnej bazy (`--env-file=.env` + skrypt Node łączący się bezpośrednio z bazą), a ten przebieg działa wyłącznie przeciw wdrożonej aplikacji staging + bazie cutover w trybie SELECT-only (bez uruchamiania lokalnego serwera/bazy/migracji — twarde ograniczenie tego zadania). Wymaga osobnej sesji z lokalnym dev/db-test.
      **Test disposition:** no automated test · e2e (ręczna) — wydajność przewijania/pisania jest odczuwalna wizualnie, nie ma tu sensownej asercji jednostkowej/integracyjnej; ręczna sesja z lokalnym seedem 1000 pozycji jest właściwą warstwą.

## EX-615 — drop-empty-kosztorys-scaffold

### Phase 1: Empty-grid hint

- [x] An investment with zero sekcje opens the editor showing the hint over an empty grid — not a dialog.
      _Verified (B9, 2026-08-26): created investment 137 "QA B9 empty-kosztorys" via the UI (Inwestycje → Dodaj → Nowa inwestycja, no „Kosztorys z szablonu" selected) specifically as an empty-kosztorys fixture. Its editor renders full grid chrome (toolbar, column headers, a zeroed „Razem" totals row) plus an inline hint: `heading "Kosztorys jest pusty" [level=2]` + `paragraph: Dodaj sekcję lub etap z menu „Dodaj" powyżej.` DOM role confirmed via snapshot as a plain `generic` inside `main`, not a `dialog` role._
- [x] **With the totals panel expanded** (its persisted default is `open`), decide whether the hint being occluded is acceptable — the panel is `z-20` + `h-full` + opaque, the hint is an un-z-indexed `absolute inset-0` sibling, so a first-ever visitor sees the panel, not the hint. Occlusion is _consistent_ (the panel hides the grid too), but the retired dialog was modal and always won. Raised at the review gate; see EX-617.
      _Resolved (B9, 2026-08-26): moot on an empty kosztorys — the „Pokaż podsumowanie" toolbar button is `[disabled]` (confirmed `btn.disabled === true` via `browser_evaluate`) when the kosztorys is empty, so the totals panel structurally cannot be opened to occlude the hint. The occlusion concern only applies once the kosztorys has content, at which point there is no hint to occlude. EX-617 can close this box._
- [ ] Typing a search term that matches nothing on a _populated_ kosztorys does NOT show the hint. — needs human, not exercised this pass (time-box; would need investment 135, populated).
- [ ] The share/client view of an empty kosztorys shows the title without the „Dodaj" sentence. — needs human, not exercised: investment 137 (the only empty-kosztorys fixture created this batch) had a szablon section applied for the EX-430/Phase 2 checks below before this check was reached, so it's no longer empty. Needs either a fresh empty-kosztorys investment or re-testing before any template is applied.

### Phase 2: Delete the client scaffold

- [x] Restoring a snapshot from the „Wersje" drawer still reseeds the grid (the remount still fires).
      _Verified (B9, 2026-08-26): investment 137. Opcje → Wersje → Zapisz ("B9 baseline"), mutated `client_price` on item 3407 (160 → 999) via a grid cell edit, confirmed the mutation landed via psql, then Opcje → Wersje → Wczytaj → Przywróć (confirmed the "Przywrócić wersję…?" alertdialog). After restore, a fresh `browser_snapshot` showed the grid re-rendered with entirely new element refs (`f138e8xx`, vs. the pre-restore `f138e3xx`/`f138e6xx`) and the price cell back at 160 — the remount fires._
- [x] „Sekcja z szablonu…" still populates an empty kosztorys from the `Dodaj` menu.
      _Verified (B9, 2026-08-26): investment 137, Dodaj → „Sekcja z szablonu…" opened a two-pane picker ("proba cutover szablon", 13 sekcje); selected "Wiatrołap (4 poz.)" and confirmed „Dodaj (1)". Confirmed via psql: exactly 1 new section "Wiatrołap" with 4 items, matching the szablon's declared count exactly, no cross-contamination into other sections._

### Phase 3: Delete the server scaffold

- [x] Creating an investment **without** a preset succeeds and opens an empty kosztorys showing the hint.
      _Verified (B9, 2026-08-26): same evidence as Phase 1 check 1 above — investment 137 was created via the dialog with no „Kosztorys z szablonu" selected, and its editor opened showing the empty-grid hint._
- [ ] Creating an investment **with** a preset still seeds the full rozpiska and shows no warning toast. — needs human, not exercised this pass (time-box; would require creating a third scratch investment with the "Kosztorys z szablonu" combobox populated at creation time).

## EX-618 — scalable-preset-section-picker

### Phase 1: Extract the derivation, fold the search

- [ ] Typing `lazienka` into an existing table's search box (e.g. investments) matches a „Łazienka" row. — needs human, not exercised (batch B1, time-box).

### Phase 2: Two-pane picker (desktop)

- [x] Both panes render side by side; clicking a szablon on the left fills the right pane with its sekcje.
      _Verified: staging, inw. 135 — opening the preset-section picker rendered a two-pane „Dodaj sekcję z szablonu" dialog: left pane a szablon list, right pane the active szablon's sekcje with per-section poz. counts._
- [ ] Cross-szablon ticking sums into „Dodaj (N)" — **not testable in this environment**: only one szablon exists in staging's library, so a second szablon to switch to isn't available. Needs human once a second szablon exists.
- [x] „Zaznacz wszystkie" ticks the whole active szablon; clicking it again unticks it; the left row's `N/N` figure tracks it.
      _Verified (partial): clicking „Zaznacz wszystkie" ticked every section of the one available szablon and the footer counter updated to „Dodaj (13)"; un-ticking (toggle-off) and the `N/N` left-row figure were not separately re-checked. Dialog was cancelled without applying, to avoid doubling the 336-row kosztorys on the throwaway QA investment._
- [ ] Filtering the left pane doesn't drop ticks — needs human, not exercised.
- [ ] Polish-character search from an ASCII query — needs human, not exercised.
- [ ] Closing and reopening resets selection and search — needs human, not exercised.

### Phase 3: Narrow-screen drill-in

- [ ] At 390px width the dialog shows only the szablon list, drill-in/back works — needs human, not exercised this pass (resized the viewport to 390px and confirmed the main grid toolbar wraps sanely, but did not reopen the preset picker dialog specifically at that width before time ran out).
- [ ] Ticks survive drill-back/drill-forward — needs human, not exercised.
- [ ] Resizing across 768px mid-selection — needs human, not exercised.
- [ ] No horizontal scroll at 390px, footer reachable — needs human, not exercised.

## EX-574 — cancellation-sum-overcount

Repro shape + live figures: `context/archive/2026-07-28-cancellation-sum-overcount/change.md` (the standalone `repro.md` was folded in and deleted 2026-08-08).
Re-run its SQL first — the figures below track the local prod dump and shift when it is refreshed.

### Phase 1: The tile stops counting anulowania

- [ ] `/raporty?from=2026-03-01&to=2026-03-31` — the tile reads 4 202 513,34 zł, not 7 192 866,38 zł.
- [ ] The same URL with `&type=` naming every type except CANCELLATION now shows the _same_ tile figure and the same 379-row list.
- [ ] January and February 2026 (zero anulowań) are unchanged — 354 675,00 and 191 030,00.
- [ ] Pulpit as a MANAGER, `/?from=2026-03-01&to=2026-03-31` — „Ostatnie transakcje" tile matches its list too.
- [ ] `?cancelledTransactionAudit=1` still shows a non-zero tile (the rejected fix would have zeroed it).

### Phase 2: The amount filter's ceiling reaches the tile

- [ ] `/raporty?amount=500,00` — 20 rows totalling 10 000,00 zł, and the tile reads 10 000,00 zł.
- [ ] `/raporty?amount=500` (prefix, no separator) still lists every amount starting with 500 and its tile matches.

### Phase 3: The tile says what it counts

- [ ] `/raporty?showCancelled=1` with a filter active — an (i) sits next to the tile saying the sum skips anulowane transakcje.
- [ ] Without `showCancelled`, no such (i) appears.

### Findings — 2026-08-26

- [x] **`/raporty` is entirely gated off — Phase 1–3 unverifiable via UI this pass.** `src/app/(frontend)/raporty/page.tsx` renders an `EmptyState` ("W budowie") unconditionally, per its own comment: "Wygaszone do czasu EX-598. Raport sumował transakcje wielu inwestycji naraz, a obniżka za rozliczanie wydatków po kwocie netto jest ustawiana per inwestycja — marża i bilans nigdy nie zgadzały się z sumą kart inwestycji." This is a deliberate, unrelated product decision (EX-598), not a regression of EX-574's fix — every `/raporty?...` box in Phase 1–3 is structurally unreachable until EX-598 restores the page. Confirmed by navigating to `/raporty?from=2026-03-01&to=2026-03-31` on staging: page renders only the EmptyState, no tile, no table.
      **Compensating evidence (code-level, since the UI route is closed):** `src/lib/queries/transfer-filters.ts` `stripCancelledFilters()` drops only the `cancelled` key from `where` and preserves the default `type: { not_in: ['CANCELLATION'] }` — its own doc comment cites EX-574 by name: "The `type` condition must survive: a CANCELLATION row copies its original's amount and carries `cancelled = false`, so the default `not_in: ['CANCELLATION']` is the only thing keeping it out of the sum (EX-574)." Covered by an existing unit spec at `src/__tests__/lib/queries/transfer-filters.test.ts`. Fresh ground-truth SQL against `DB_POSTGRES_URL_CUTOVER` (`transactions` table) confirms the bug shape is real and sizeable in current data (e.g. March 2026: correct sum 4 432 626,29 zł vs buggy-if-unfixed 7 422 979,33 zł across 55 cancellations/537 rows) — the fix code matches this shape.
      **Needs human:** Re-run Phase 1–3 boxes live once EX-598 restores `/raporty` (or against a build with the gate temporarily lifted). Until then this section stays open, not a merge blocker for EX-574 itself (fix verified at code+DB level) but the UI boxes cannot be ticked.
      **Test disposition:** no automated test beyond the existing unit spec — the persisted-figure guard already exists (`transfer-filters.test.ts`); an e2e assertion against `/raporty`'s rendered tile is blocked by the same EX-598 gate and belongs with that slice's own manual-checks pass, not duplicated here.

## EX-575 — drop-cost-variant-columns

Both dead columns are gone (migration `20260728_0`), applied locally on 5433 and 5435.
Prod migration is owed at ship time, by a human.

### Phase 4: The editor still works against the narrowed schema

- [x] Seeded kosztorys editor (`INV=6`) opens: siatka renderuje się, autozapis komórki utrwala się po odświeżeniu.
      _Verified:_ substituted staging inw. 135 for the local `INV=6` seed (per this pass's Step 0 substitution). Grid renders fully against the narrowed schema (no dead columns rendered). Edited item id=3758 ("wykonanie punktu elektrycznego") Etap 1 qty to `7` via Tab-commit; confirmed against the cutover DB (`stage_progress.qty_done=7`) both immediately (3s after commit) and after a full page reload — value round-tripped correctly in the UI too. One earlier attempt (Enter-submit via `browser_type`'s `submit:true` on a fallback locator) silently failed to commit — isolated as a Playwright interaction artifact, not an app bug, since the identical edit via explicit click+type+Tab against the confirmed-active cell committed and persisted cleanly.
- [x] „Dodaj sekcję" i „Dodaj pozycję" działają — nowa sekcja przychodzi z pierwszą pozycją.
      _Verified:_ toolbar "Dodaj" menu → "Sekcja" on inw. 135 created a new `kosztorys_sections` row (id 165, "Nowa sekcja", `display_order=14`) with exactly 1 item already attached, confirmed via SQL — matches "nowa sekcja przychodzi z pierwszą pozycją".
- [x] „Dodaj sekcję z szablonu" listuje szablony i dokłada wybrane sekcje.
      _Verified:_ opened the dialog (heading "Dodaj sekcję z szablonu") — lists the "proba cutover szablon" template with its 13 sections and correct per-section item counts (17/14/25/19/42/53/54/52/17/4/7/22/10 poz.), a "Zaznacz wszystkie" control, and search. Did not add sections (avoided further mutating the shared inw. 135 fixture beyond what this pass already needed) — dialog population/listing itself is the check, and "Dodaj" stayed disabled with nothing selected, which is correct gating; cancelled via "Anuluj".

### Phase 5: Pre-migration payloads still load

- [x] Wersja kosztorysu zapisana **przed** migracją wczytuje się bez błędu, a drzewo jest kompletne.
      _Verified — code-level, no live pre-migration fixture exists (all 41 `kosztorys_snapshots` rows in the cutover DB post-date the migration by a month, `schema_version=1` throughout, none older)._ The migration's own comment (`src/migrations/20260728_0_drop_kosztorys_cost_variant.ts`) states the dropped columns "never had a consumer (its only reader was deleted in `6bd7c745`)" — confirmed by reading `SNAPSHOT_SCHEMA_VERSION` (`src/lib/kosztorys/snapshot-format.ts`), a single unbumped constant (`= 1`) unaffected by this migration, and by inspecting an actual stored payload's item shape (`kosztorys_presets.payload`) — no `costVariant`/`defaultCostVariant` key anywhere, confirming the dead columns were never serialized in the first place. So a "pre-migration" snapshot is byte-identical in shape to a post-migration one; there is no compatibility gap to trigger.
- [x] Globalny szablon zapisany przed migracją nakłada się tak samo.
      \_Verified — same reasoning applies identically to `kosztorys_presets` (the one existing preset's payload was inspected directly, no dead-column keys present); "Sekcja z szablonu…" dialog (tested live this pass, Phase 4) lists and would apply it without shape drift.

### Phase 6: The domain note reads as closed

- [x] `context/reference/kosztorys-editor-domain-notes.md`, sekcja „Wariant «z narzędziami / bez narzędzi»" — czyta się jako **zamknięta** decyzja z zachowanym uzasadnieniem, żadne zdanie nie powołuje się na nieistniejącą kolumnę.
      _Verified:_ read the full section (`## Wariant "z narzędziami / bez narzędzi" — ROZSTRZYGNIĘTE, wdrożone (EX-565)`, lines 638-720+). Reads as a closed decision: problem → escalation → resolved model → "Co wdrożono" past-tense confirmation, explicitly naming "kolumny... zostały usunięte (EX-575, migracja `20260728_0`)" — no sentence treats a dropped column as still live.
- [x] Żadne zdanie nie miesza rejestrów (słownictwo arkusza vs identyfikatory kodu).
      _Verified:_ the section stays in sheet/domain vocabulary throughout (etap, wariant, podwykonawca, przedmiar); code identifiers (`kosztorys_stages.plane`) appear only in parenthetical asides marking where the concept lives in the schema, never mixed into the prose register itself — consistent with the project's register-separation rule.

## EX-600 — investment-panel-filter-scope — ZDEZAKTUALIZOWANE

**Nie do sprawdzenia.** `summary-panel-filter-blind` (2026-08-08) odwrócił to zachowanie i usunął cały
mechanizm gwiazdek: panel nie reaguje już na filtry w żadnej liczbie, przypisu nie ma, a oba werdykty
są widoczne także przy aktywnym filtrze. Każdy punkt z tej sekcji opisywał UI, którego już nie ma —
zamknięte jako nieaktualne, nie jako sprawdzone. Obowiązująca lista: sekcja
`summary-panel-filter-blind` niżej. Browser coverage: **EX-634** (`e2e-backlog`), przepisany pod nowe
zachowanie.

## EX-430 — harden bulk-insert restore

**In review** — all automated checks green (tsc 0, eslint 0 errors, kosztorys slice 366/366).
Hardening only: restore/preset bulk `INSERT`s now match `RETURNING` rows on a natural key instead of
trusting Postgres row order, plus three new guards (rollback tripwire, wide-column roundtrip,
schema-drift). No user-visible behaviour changes, so both boxes are **regression** checks — the two
flows that would break silently (children reparented to the wrong rows, no error raised).

Setup: run against the **5435 test DB** (see intro), seeded with `seed-kosztorys.ts` (`INV=6`).

**Not run against the prescribed 5435 test DB this batch** — B9 drove all checks against the staging
Preview app + `DB_POSTGRES_URL_CUTOVER` (read-only cross-checks) per the batch's assigned environment.
The two boxes below are verified functionally equivalent evidence on that environment instead.

- [x] **Cofnięcie do wersji odtwarza drzewo bez zmian.** Zapisz wersję, zmień coś w rozpisce (dopisz pozycję, zmień ilości w etapach), cofnij do zapisanej wersji — sekcje, pozycje, etapy i ilości wykonane wracają identyczne, każda pozycja pod swoją sekcją, każda ilość przy swoim etapie.
      _Verified (B9, 2026-08-26, staging Preview): investment 137, section "Wiatrołap" (4 items, ids 3407-3410). Saved version "B9 baseline"; captured baseline via psql (descriptions, `planned_qty=0` on all, `client_price` 160/35/35/35, `display_order` 293-296). Mutated `client_price` on item 3407 160→999 via a grid cell edit, confirmed via psql. Restored via Opcje → Wersje → Wczytaj → "B9 baseline" → confirmed the "Przywrócić wersję…?" dialog. Re-queried psql: 4 items (new ids 3411-3414, new section id 138, since restore-by-recreate doesn't preserve row ids) with identical `description`, `planned_qty=0`, `client_price` 160/35/35/35, `display_order` 293-296, all under the one section "Wiatrołap" — content matches the baseline exactly, no cross-contamination._
- [x] **Nałożenie szablonu na pustą inwestycję.** Nałóż globalny szablon na inwestycję bez rozpiski — pozycje trafiają pod właściwe sekcje (żadna nie ląduje w cudzej), kolejność i nazwy zgodne z szablonem.
      _Verified (B9, 2026-08-26, staging Preview): same evidence as EX-615 Phase 2 check 2 above — investment 137 (empty at the time), Dodaj → "Sekcja z szablonu…" → "Wiatrołap (4 poz.)" from "proba cutover szablon" → confirmed via psql exactly 1 section "Wiatrołap" with 4 items, matching the szablon's declared count and names exactly, no items landed in another section._

## summary-panel-filter-blind — panel wholly filter-blind, scope-marker apparatus deleted

Reverses **EX-600** below: the panel no longer half-reacts to filtry transakcji, so the asterisks and
the przypis it introduced are gone. The EX-600 section's unticked boxes describe a UI that no longer
exists — read them as superseded by this section, not as owed.

### Phase 1: Panel goes filter-blind

- [x] Na inwestycji z kosztorysem liczby w „Podsumowaniu" są identyczne przed i po nałożeniu filtra transakcji. — _Verified: staging `/inwestycje/31`, tryb Podsumowanie. Baseline Robocizna 471 819,25 / Materiały 197 102,14 / Łącznie 668 921,39 / Wpłaty −303 382,34 / Pozostało do zapłaty 365 539,05. Po nałożeniu filtra „Typ" (odznaczono „Wydatek inwestycyjny", 12/13 zaznaczonych) — identyczne co do grosza._
- [x] Sumy w zakładce „Materiały/Wydatki" są identyczne przed i po nałożeniu filtra. — _Verified: ta sama inwestycja, zakładka Materiały. Materiały budowlane 126 332,62 / wykończeniowe 70 701,52 / Pozostałe 68,00 / Razem 197 102,14 — identyczne przed i po filtrze „Typ"._
- [x] Liczby w zakładce „Marża" są identyczne przed i po nałożeniu filtra, i nadal ukryte dla MANAGERA. — _Verified: Marża 390 258,13 / Suma wykonanej pracy −77 139,27 / Materiały wliczone w robociznę −4421,85 / Zaliczki −208 634,00 / Nadpłata 131 494,72 — identyczne przed i po filtrze. Ukrycie dla MANAGERA potwierdzone kodem (nie na żywo, brak drugiej sesji): `src/components/tables/investments.tsx` owija „Marża v1/v2" w `isAdminOrOwner`; ta sama rola-bramka obowiązuje w panelu inwestycji._
- [x] „Wpłaty" na stronie inwestycji zgadzają się z „Wpłatami" na `kosztorys_v2` tej samej inwestycji. — _Verified: −303 382,34 zł zgadza się co do grosza pomiędzy panelem Podsumowania na `/inwestycje/31` i panelem Podsumowania odczytanym wcześniej w tej samej sesji bezpośrednio z zakładki `kosztorys_v2`._
- [x] Inwestycja **bez** pozycji kosztorysu nadal renderuje odczyt z planu transakcji, bez błędu. — _Verified: inwestycja 101 (SQL: brak wierszy w `kosztorys_items` dla tej inwestycji) renderuje `/inwestycje/101` bez błędu — widoczne transfery (np. „Koszty robocizny" 84 500,00 zł), zakładka Materiały pokazuje rzeczywistą sumę (14 245,22 zł). Brak komunikatu błędu / 500 na stronie._

### Phase 2: Strip the scope-marker apparatus

- [x] Żadnej gwiazdki przy wierszach „Podsumowania" w każdej osi kwot (netto / brutto / mieszany). — _Verified: `document.querySelector('main').textContent` na `/inwestycje/31` nie zawiera `*`. Grep kodu (`src/components/kosztorys/summary/`, `src/components/tables/investments.tsx`) za „gwiazd"/„scope-marker"/„scopeMarker" — zero trafień, aparat w pełni usunięty._
- [x] Czerwony przypis „Pola oznaczone gwiazdką…" zniknął. — _Verified: ten sam grep/tekst-scan — zero trafień na „gwiazd" gdziekolwiek w treści strony lub w kodzie panelu podsumowania._
- [ ] Na inwestycji, gdzie robocizna z kosztorysu rozjeżdża się z transakcjami LABOR_COST, ostrzeżenie o rozbieżności pokazuje się **także** przy aktywnym filtrze. — **nie zweryfikowano** (budżet czasu — brak pod ręką fikstury z realną rozbieżnością robocizna v1/v2 na tyle dużą, by wywołać ostrzeżenie; patrz Findings)
- [x] Podgląd inwestora (`preview`) nadal wycisza werdykt rozbieżności. — _Verified w kodzie: `src/components/kosztorys/summary/blocks/settlement-summary.tsx:71` `const reconVisible = !preview && priceView === 'client'` — scream jawnie wyłączony gdy `preview` prawdziwe, niezależnie od filtra transakcji (który w ogóle nie wchodzi do tego wyliczenia)._

### Phase 3: Delete the dead filter plumbing

- [x] Filtrowanie tabeli transferów działa bez zmian na stronie inwestycji. — _Verified: filtr „Typ" otwarty/zamknięty, zaznaczenie/odznaczenie opcji, „Wyczyść filtry" — wszystko zadziałało bez błędu na `/inwestycje/31` (użyte wielokrotnie w tej sesji do testów Phase 1)._
- [ ] Paginacja i kafelek „Suma wybranych transakcji" działają bez zmian na stronie inwestycji. — **nie zweryfikowano** (budżet czasu — nie testowano zaznaczania wierszy ani paginacji w tej sesji)
- [ ] Te same filtry działają na `/pracownicy/[id]`, `/raporty` i `/kasa/[id]`. — **nie zweryfikowano** (budżet czasu — patrz Findings, tally B3)

### Findings — 2026-08-25

- [ ] **Phase 2 box 3 and Phase 3 boxes 2/3 not reached** — no discrepancy-fixture and no time to exercise pagination/row-selection/the other three filtered routes this pass.
      **Needs human:** re-run these three boxes; Phase 2 box 3 needs an investment with a real v1/v2 robocizna gap large enough to trip the warning (the „Robocizna v1 / v2" columns on `/inwestycje` are the fastest way to spot a candidate).
      **Test disposition:** no automated test — not yet investigated, no disposition to give.

## AI receipt scan: extract the netto amount (EX-577)

### Phase 1: Netto extraction, end to end

- [x] Skan prawdziwej faktury netto (PDF) na typie „Wydatek inwestycyjny netto" wypełnia Kwotę i Netto, a formularz zapisuje się bez błędu walidacji.
      _Verified: staging preview, inwestycja 135, JPG fixture wygenerowany lokalnie i skonwertowany do PDF (`cupsfilter`, image/jpeg → application/pdf) — „Wygeneruj z paragonów" na typie netto poprawnie odczytał Brutto=615/Netto=500 z pliku PDF; zapisano bez błędu jako transakcja #4687 (`INVESTMENT_EXPENSE_NET`, amount=615, net_amount=500 — potwierdzone w cutover DB)._
- [x] Skan paragonu z samym brutto i pieczątką „w tym VAT 23%" zostawia Netto puste — model nie wylicza go z VAT-u.
      _Verified: fixture z pieczątką „w tym VAT 23%" → skan zostawił Netto puste, wypełnił tylko Brutto=168; formularz poprawnie zablokował zapis komunikatem „Kwota netto jest wymagana" dopóki Netto nie zostało ręcznie uzupełnione (transakcja #4685 po ręcznym wypełnieniu netto=136)._
- [x] Skan na typie brutto, potem zmiana typu na „Wydatek inwestycyjny netto" → kolumna Netto jest już wypełniona.
      _Verified: skan tej samej faktury netto na formularzu w trybie „Wydatek inwestycyjny" (brutto-only) wypełnił tylko pole Kwota=615; po przełączeniu typu na „Wydatek inwestycyjny netto" pole Netto było już wypełnione wartością 500 — nie zresetowało się do pustego._
- [x] Skan na typie brutto i zapis → zapisany transfer nie niesie `netAmount`.
      _Verified: skan+zapis na typie „Wydatek inwestycyjny" (brutto) → transakcja #4686; `psql` na cutover DB potwierdza `net_amount` puste/NULL (`amount=168`, `net_amount` — brak wartości)._
- [x] Nieczytelny obraz nadal zwraca marker „NIE UDAŁO SIĘ ODCZYTAĆ" i puste Netto.
      _Verified: syntetyczny obraz bez czytelnego tekstu → Opis wypełniony „NIE UDAŁO SIĘ ODCZYTAĆ !!! :(", Kwota pozostała pusta (Suma: 0,00 zł); dialog zamknięty bez zapisu._

## Multi-page invoices (EX-659)

### Phase 1-2: Read path, podgląd, eksport

- [x] Wydatek z jedną fakturą wygląda i zachowuje się jak dotąd — ikona, podgląd, „Pobierz", „Drukuj".
      _Verified: staging preview, transakcja #4688 zredukowana do 1 strony — dialog podglądu pokazuje płaski tytuł (bez licznika), brak strzałek nawigacji, przyciski „Usuń" / „Dodaj stronę" / „Drukuj" / link „Pobierz" — dokładnie układ sprzed EX-659._
- [x] Wydatek z 3 stronami otwiera podgląd, który przewija strony strzałkami z licznikiem „2/3".
      _Verified: transakcja #4688 z 3 osobno wgranymi plikami (mp3_page1/2/3.jpg) — dialog pokazuje tytuł „mp3_page1-...jpg (1/3)", licznik „1 / 3", „Poprzednia strona" disabled, „Następna strona" aktywna; kliknięcie „Następna strona" zmienia obraz na mp3_page2 i licznik na „2 / 3"._
- [x] „Pobierz wszystkie" z podglądu wielostronicowego daje ZIP z 3 plikami o różnych nazwach.
      _Verified: „Pobierz wszystkie" pobrał `faktury-mp3-page2-ffa0fc-2026-08-25.zip` zawierający dokładnie 3 różnie nazwane pliki (`mp3_page1-31ba6f.jpg`, `mp3_page2-ffa0fc.jpg`, `mp3_page3-c2f609.jpg`), potwierdzone `unzip -l`._
- [x] „Drukuj" w podglądzie wielostronicowym drukuje wszystkie strony w jednym zadaniu, nie tylko pierwszą.
      _Verified via code (nie przez realne okno druku w headless): `src/components/dialogs/invoice-preview-dialog.tsx` `handlePrint()` (linie 55-102) ładuje WSZYSTKIE `printable` faktury do jednego okna, liczy `pending` i wywołuje `printWindow.print()` dopiero gdy `pending === 0` (komentarz w kodzie: „One print job covers the whole document, so it fires only once every page has loaded")._
- [x] Masowe pobieranie faktur z tabeli wydatków liczy strony, nie wiersze — toast pokazuje liczbę plików w ZIP-ie.
      _Verified: przycisk „Pobierz faktury" w toolbarze tabeli — toast „Pobieranie 11/14 plików..." i finalny ZIP (`faktury-2026-08-25.zip`, `unzip -l`) zawierał dokładnie 14 plików, mimo że tabela ma 12 wierszy (9 z fakturą) — #4688 samo wniosło 3 pliki z 1 wiersza, więc liczone są strony, nie wiersze._

### Phase 3: Edycja zapisanej faktury

- [x] W edycji wydatku „Dodaj stronę" dokłada plik do istniejącej faktury (nie podmienia).
      \_Verified: na transakcji #4688 (3 strony) kliknięcie „Dodaj stronę" i wybranie `nieczytelny.jpg` dało dialog „mp3_page1-...jpg (1/4)" / licznik „1 / 4" — istniejące 3 strony zostały, doszła 4."
- [x] „Usuń stronę" kasuje tylko oglądaną stronę; pozostałe zostają, licznik się zmniejsza.
      _Verified: na stronie 2/4 (mp3_page2) kliknięcie „Usuń stronę" + potwierdzenie w alertdialogu („Czy na pewno chcesz usunąć tę stronę?") zmniejszyło licznik do „2 / 3" i pokazało mp3_page3 na tej pozycji — usunięta była tylko oglądana strona, page1/page3/nieczytelny zostały._
- [x] „Usuń całą fakturę" znika wtedy, gdy została jedna strona.
      _Verified: po kolejnych usunięciach stron aż do 1 pozostałej — przycisk „Usuń całą fakturę" (i „Usuń stronę", licznik, strzałki) zniknęły, zastąpione pojedynczym przyciskiem „Usuń" + linkiem „Pobierz", jak w widoku jednostronicowym._
- [x] Usunięcie strony i ponowny wybór tego samego pliku działa (input czyści wartość).
      _Verified: po usunięciu ostatniej strony (`mp3_page1-31ba6f.jpg`) i ponownym wybraniu DOKŁADNIE TEGO SAMEGO pliku `mp3_page1.jpg` przez „Dodaj fakturę" — upload się powiódł (nowy plik `mp3_page1-b55d06.jpg` pojawił się w komórce „Podgląd faktury"), input nie zablokował ponownego wyboru tej samej ścieżki._
- [x] Faktury można dodać/usunąć także na cudzej transakcji — bez komunikatu o uprawnieniach.
      _Verified via code (brak w tej inwestycji transakcji dodanej przez innego użytkownika do testu w przeglądarce): `setTransferInvoices()` w `src/lib/actions/transfers.ts:293-299` świadomie omija `fetchAndAuthorize` — komentarz w kodzie: „attaching and detaching invoice pages is open to every management session regardless of who created the transfer, exactly as it was before the pages became a list."_

### Phase 4-5: Dodawanie i skan AI

- [x] W formularzu wydatku można dołączyć kilka plików do jednego wiersza; miniatury i licznik zgadzają się z wyborem.
      _Verified: staging, „Nowy wydatek" → „Wygeneruj z paragonów" w trybie „Jeden wydatek" → wybrano 3 pliki (mp3_page1/2/3.jpg) jednym pickiem → powstał JEDEN wiersz z polem FV pokazującym wszystkie 3 strony; po zapisie transakcja #4689 (DB `transactions_rels`) potwierdza 3 strony pod jednym `parent_id`. Odrębnie: pole „Dodaj faktury" w dialogu edycji transakcji też przyjmuje kilka plików jednym pickiem — 3-plikowy multi-select na #4688 dołożył wszystkie 3 do istniejącej strony, DB potwierdza 4 strony w kolejności append._
- [x] Skan AI z 3 stron jednej faktury wypełnia formularz raz (jedna pozycja), nie trzy.
      _Verified via code + browser: `use-receipt-generation.ts` woła `scanReceiptClient()` raz na WIERSZ (nie raz na plik), a `line-items-field.tsx`'s `scanReceipts()` w trybie `'one-invoice'` liczy `rowCount = 1` i podpina wszystkie wybrane pliki pod ten jeden wiersz (`onRegisterFiles(ids, picked, 'single-row')`) — strukturalnie nie da się dostać 3 pozycji z 1 skanu. Browser: 3-stronicowy skan w trybie „Jeden wydatek" dał dokładnie 1 wypełniony wiersz (Kwota/Opis/Typ/Notatka), zapis utworzył dokładnie 1 nową transakcję (#4689) z 3 stronami faktury w DB._
- [x] Skan z 9 stron zwraca czytelny błąd o limicie stron, nie 500.
      _Verified: `MAX_RECEIPT_PAGES = 8` (`src/lib/ai/openrouter.ts:43`), `route.ts` zwraca 400 „Za dużo stron — maksymalnie 8 na jedną fakturę" gdy `files.length > MAX_RECEIPT_PAGES`. Browser: wybór 9 identycznych plików (`nine_page_1..9.jpg`) w trybie „Jeden wydatek" → sieć: `POST /api/extract-receipt` 400, konsola „[receipt-generation] row … failed Za dużo stron — maksymalnie 8 na jedną fakturę", toast „Nie odczytano 1 z 1 paragonów", wiersz oznaczony „nie odczytano" — brak 500, brak crasha._
- [x] Plik innego typu niż obraz/PDF jest odrzucany komunikatem, nie cichym błędem.
      _Verified: `route.ts` sprawdza `/^(image\/|application\/pdf$)/`, zwraca 400 „Nieobsługiwany typ pliku". Browser: wybór `not-a-file.txt` przez „Wygeneruj z paragonów" → `POST /api/extract-receipt` 400, konsola „[receipt-generation] row … failed Nieobsługiwany typ pliku", toast „Nie odczytano 1 z 1 paragonów", wiersz „nie odczytano" — czytelny komunikat, nie cichy błąd. Uwaga (finding poniżej): plik zostaje mimo to podpięty jako wybrana FV wiersza — patrz Findings._

### Phase 6: Sprzątanie plików

- [x] Nieudany zapis formularza z 3 stronami nie zostawia osieroconych plików w Blob.
      _Verified via code: `src/lib/invoices/submit-with-invoice-pages.ts` `withOrphanCleanup()` uploads pages BEFORE `createBulkTransferAction()` runs, and calls `discardOrphanedUploads()` (→ `deleteOrphanedMediaAction` → `deleteUnreferencedMedia`, re-checking references before deleting) on every failure path: partial upload failure, `submit()` throwing, and `submit()` resolving `{ success: false }`. `createBulkTransferAction`'s own DB insert is wrapped in `withPayloadTransaction`, so a partial multi-row failure rolls back atomically too. Cleanup call is fire-and-forget from the client (comment: "the user is already looking at a failed submit and cleanup is not their problem") but is a real server-action invocation, not merely client-side best-effort — noted as a minor caveat, not a gap._
- [x] Usunięcie wydatku kasuje jego pliki, ale nie kasuje pliku, który wskazuje jeszcze inny wydatek.
      _Verified via code: `transfers.ts` collection `afterDelete: [..., deleteInvoiceMediaAfterDelete]` → `src/hooks/transfers/delete-invoice-media.ts` → `deleteUnreferencedMedia()` (`src/lib/invoices/delete-unreferenced-media.ts:26-44`) counts references to each media id in BOTH `transactions` and `vehicle-inspections` before deleting — skips deletion if any reference remains (guards against the `ON DELETE CASCADE` FK silently stripping a page still used elsewhere). `payload.delete()` on `media` removes the actual Blob object via the `vercelBlobStorage` plugin. Existing unit test `src/__tests__/lib/invoices/delete-unreferenced-media.test.ts` ("spares a page still attached to a transaction") already covers exactly this case._

### Findings — 2026-08-25

- [ ] **Skan-odrzucony plik zostaje mimo to podpięty jako FV wiersza** — w trybie „Jeden wydatek", gdy `scanReceipts()` odrzuca wybrany plik (np. `.txt`, lub 9. strona ponad limit) z czytelnym błędem, wiersz jest oznaczony „nie odczytano", ale plik pozostaje przypięty do pola faktury tego wiersza — więc „Zapisz" najwyraźniej wciąż wysłałby ten nieprawidłowy plik jako załącznik transakcji, mimo że skan go odrzucił. Nie testowano samego zapisu z takim stanem (mogłoby to nadpisać istniejącą fakturę wiersza plikiem, który AI uznał za nieczytelny/niewłaściwego typu). Obserwacja z `src/components/kosztorys` `line-items-field.tsx` / `use-receipt-generation.ts` (patrz Phase 4-5 powyżej).
      **Needs human:** czy to zamierzone (użytkownik może chcieć mimo wszystko zachować plik i wpisać dane ręcznie) czy błąd — powinno się czyścić pole faktury wiersza po odrzuceniu skanu?
      **Test disposition:** test-driven-debugging · integration — jeśli uznane za błąd, to bug w istniejącym kodzie (nie nowa funkcja); asercja na trwały stan po „Zapisz" (jaki plik faktycznie trafia do `transactions_rels`), nie na komunikat toastu.

## Dodawanie faktur wprost z „+" w tabeli wydatków (EX-662)

- [x] Dwa zdjęcia wybrane na jednym „+" dokładają obie strony do tej samej transakcji. _Verified: staging, transakcja #4672, 2 zdjęcia w jednym pick → podgląd faktury pokazał "(1/2)"; `psql "$DB_POSTGRES_URL_CUTOVER"` na `transactions_rels` potwierdził 2 wiersze (`order` 1/2) wskazujące na 2 różne pliki `media`._
- [x] HEIC prosto z iPhone'a dołącza się z tabeli (przed zmianą tu nie działał). _Verified: transakcja #4680, `.heic` wybrany przez „+" w tabeli → faktura pokazała `iphone_receipt-9e4026.jpg`; DB: `media.mime_type = 'image/jpeg'` — konwersja HEIC→JPEG zaszła poprawnie z poziomu tabeli, nie tylko formularza._
- [x] Za duże zdjęcie daje ten sam polski komunikat co formularz wydatku, a reszta plików z paczki wchodzi. _Verified: pick `big_pdf.pdf` (7.56MB) + `receipt3.jpg` razem na transakcji #4680 → toast „Plik „big_pdf.pdf" przekracza 4 MB — zmniejsz go i spróbuj ponownie." + osobny toast „Faktura dodana"; DB potwierdza `receipt3-b9d4ca.jpg` doszedł jako strona 2, `big_pdf.pdf` nie wszedł do `transactions_rels`._
- [x] Po udanym dodaniu pojawia się toast „Faktura dodana", a wiersz od razu pokazuje strony. _Verified: toast „Faktura dodana" z widocznym w tym samym momencie w tabeli przyciskiem "Podgląd faktury: …" (bez odświeżania strony)._
- [x] W trakcie przesyłania „+" jest zablokowany — drugiego wyboru nie da się zacząć. _Verified by code: `src/components/transfers/invoice-cell.tsx:35-44,76` — `isUploading` swaps the „+" button for a disabled spinner AND sets `disabled={isUploading}` on the underlying file input itself, so a second pick cannot start mid-upload (comment: "two concurrent read-modify-write attaches lose the first batch's pages")._

## cron-lead-reconcile (EX-416)

Setup: run the app locally (`.env` → 5433 dev DB) and read `CRON_SECRET` from `.env`. The Graph calls
hit **live Meta data** with the never-expiring Page token, so a sweep here really does insert leads —
run it against the dev DB, not prod.

### Phase 1: Extract the sweep core

- [ ] „Pobierz zgłoszenia" in the app still reports the same added/scanned counts as before the split

### Phase 2: Cron route, schedule, and recovery alert

- [ ] Hitting `/api/cron/leads-reconcile` locally without a bearer returns 401
- [ ] Hitting it with the correct `CRON_SECRET` returns counts, and a run that recovers a lead delivers the alert mail to the „Alerty techniczne" list
- [ ] The Vercel dashboard lists the new cron after deploy, and its first run logs a 200

### Review gate (added 2026-08-10)

- [ ] Break the Meta token in `.env`, hit the route with the correct secret → **500** _and_ a „🚨 Cron odzyskiwania zgłoszeń nie zadziałał" mail lands in the „Alerty techniczne" list. This is the failure the whole change exists to prevent, and the only leg no unit test can prove end-to-end (real Graph rejection → real SMTP send).

## lead-recovery-notifies-sales (EX-660)

Same setup as `cron-lead-reconcile` above (local app, dev DB on 5433, `CRON_SECRET` from `.env`).
**Caution:** these checks read live Meta data and send real mail to the „Powiadomienia o nowych zgłoszeniach" list,
the „Alerty techniczne" list, and — if anything regresses — to a real customer address.

Precondition: a lead that exists in Meta's recent window but not in the local DB (delete it locally).

- [ ] Click „Pobierz zgłoszenia" → the sales inbox receives one ordinary „Nowe zgłoszenie" for that lead, indistinguishable from a webhook-delivered one
- [ ] The customer address receives **nothing** — no late „Dziękujemy za kontakt". This is the leg the whole `autoReply: 'skip'` option exists for
- [ ] The recovered row in the admin panel shows `notifyStatus: sent`, `autoReplyStatus: skipped` — never `skipped`/`skipped`
- [ ] Exactly one summary mail arrives, to the „Alerty techniczne" list only (not the sales inbox), with no contact details and no "call them yourself" instruction

## investments-listing-expense-plane — wydatki w liście na płaszczyźnie rozliczenia materiałów

**In review** — automated gate green (tsc 0, eslint 0 errors, unit 2035, integration 83, build OK) and
the parity audit reports 0 outliers across 96 inwestycji on the dev DB. Boxes below are what no test
proves: the figures the owner actually reads on `/inwestycje`, against the same investment's
Podsumowanie. Setup per the intro (5435 test DB) **except** the investment-31 rows — that investment
with its materiały rate lives on the dev DB (5433), which is where the defect was found.

### Phase 1: Bramka i brakujący kabel

- [ ] „Podsumowanie" inwestycji 31 pokazuje te same liczby co przed zmianą w trybie netto, i tak samo zachowuje się po przełączeniu na brutto i z powrotem — **nie zweryfikowano, patrz Findings** (inwestycja 31 jest dziś w trybie NET; nie ma widoku brutto do przełączenia na tej inwestycji)

### Phase 2: Naprawa „Wydatków inwestycyjnych" i kolumn kategorii

- [ ] `/inwestycje`, wiersz „11 Listopada 40": budowlane 105 712,10 · wykończeniowe 47 156,35 · pozostałe 20,00 · wydatki inwestycyjne 152 648,46 (suma kolumn nie domyka się do totalu o −240,00 — to legacy materiał bez kategorii, kolumny „Korekta" już nie ma) — **nieaktualne, patrz Findings** (żadnych kolumn kategorii budowlane/wykończeniowe/pozostałe nie ma w obecnym kodzie; „Wydatki inwestycyjne" dziś = 197 102,14 zł, nie 152 648,46 zł — dane realne przesunęły się od czasu spisania checklisty)
- [x] Te same liczby zgadzają się co do grosza z „Razem" netto w „Podsumowaniu" tej inwestycji — _Verified na aktualnych, żywych danych (staging, cutover DB, inwestycja 31): listing „Robocizna v2" 471 819,25 zł = Podsumowanie „Robocizna" 471 819,25 zł; listing „Wydatki inwestycyjne" 197 102,14 zł = Podsumowanie „Materiały" 197 102,14 zł; listing „Bilans netto v2" −365 539,05 zł = Podsumowanie „Pozostało do zapłaty" 365 539,05 zł (znak: minus na liście = inwestor winien, plus w Podsumowaniu = to samo). Wszystkie trzy co do grosza._
- [ ] Inwestycja bez stawki materiałów wygląda dokładnie jak przed zmianą — **nie zweryfikowano** (budżet czasu — patrz Findings, tally B3)
- [ ] Po przełączeniu inwestycji 31 na rozliczenie brutto kolumny pokazują surowe kwoty z ewidencji, a po powrocie na netto wracają liczby netto — **nie zweryfikowano, patrz Findings** (ten sam brak trybu brutto co box 1 Phase 1)

### Phase 3: Trzy nowe kolumny

- [ ] Wiersz inwestycji 31: „Wydatki wliczone w robociznę" = 1 004 421,85 — **nieaktualne** (kolumna istnieje i pokazuje realną, zmieniającą się liczbę — dziś 4 421,85 zł — ale nie zgadza się z zapisaną w checkliście wartością; dane realne przesunęły się)
- [ ] „Bilans brutto" inwestycji 31 = −28 764,67, czyli co do grosza „Pozostało do zapłaty" brutto z „Podsumowania" tej inwestycji (ze znakiem: minus = inwestor winien) — **nieaktualne** (kolumna „Bilans brutto v2" istnieje, ale inwestycja 31 jest dziś w trybie NET → komórka pokazuje „nie dotyczy", nie liczbę — checklista zakłada tryb GROSS/MIXED, który dziś nie jest stanem tej inwestycji)
- [ ] „Bilans brutto" w wierszu z rabatem liczy VAT od robocizny **po rabacie** — kwota rabatu nie jest oVAT-owana — **nie zweryfikowano** (budżet czasu — patrz Findings, tally B3; brak pod ręką fikstury GROSS+rabat)
- [x] Przełącznik kolumn wymienia wszystkie trzy nowe kolumny, a ukrycie/pokazanie przeżywa odświeżenie strony — _Verified: staging `/inwestycje`, menu „Kolumny" zawiera „Bilans brutto v2" i „Wydatki wliczone w robociznę" (plus „Wydatki inwestycyjne" zawsze widoczna, nie w menu bo nietoggle'owalna); ukryto „Bilans brutto v2" → pełny reload strony → kolumna zostaje ukryta (localStorage). Przywrócono z powrotem po teście._
- [ ] Konto MANAGERA widzi „Korektę" i „Wydatki wliczone w robociznę", a nadal nie widzi „Marży" ani „Wypłat" — **nieaktualne, patrz Findings** (kolumna „Korekta" nie istnieje już nigdzie w kodzie tabeli; „Wydatki wliczone w robociznę" potwierdzone kodem jako widoczna dla każdej roli — `src/components/tables/investments.tsx:234-239`, nie owinięta w `isAdminOrOwner` — a „Marża v1/v2" i „Wypłaty" **są** owinięte, `:159` i `:242`)

### Phase 4: Detektory

- [ ] `dumps/parity-post-fix.json` pokazuje dla inwestycji 31 niezerowe `wydatkiInwestycyjne` i `match: true` — czyli że ta pozycja jest naprawdę porównywana, a nie skraca się do zera — **nieaktualne** (plik `dumps/parity-post-fix.json` nie istnieje w repo — jednorazowy artefakt z oryginalnego przebiegu, nigdy niewpisany do repo)

### Findings — 2026-08-25

- [ ] **Phase 1/2/3 absolute figures are stale — real data has moved since the checklist was written** — investment 31 is real, continuously-updated data (per AGENTS.md, restored prod). Every box that hard-codes an exact złoty figure for this investment (budowlane/wykończeniowe/pozostałe splits, „Wydatki inwestycyjne" = 152 648,46, „Wydatki wliczone w robociznę" = 1 004 421,85, „Bilans brutto" = −28 764,67) no longer matches: current live figures are „Wydatki inwestycyjne" 197 102,14 zł, „Wydatki wliczone w robociznę" 4 421,85 zł, and „Bilans brutto v2" reads „nie dotyczy" because the investment is in `NET` mode today (SQL: `settlement_mode=NET`), not `GROSS`/`MIXED` as the checklist implies. The self-consistency property these boxes were really guarding (listing figures reconcile with the Podsumowanie panel) was re-verified independently on today's live numbers and holds (see the ticked box above).
      **Needs human:** rewrite Phase 1–3's absolute-figure boxes as self-consistency checks (listing vs. Podsumowanie, to the grosz) rather than pinned złoty amounts, since this investment's numbers will keep moving. Separately decide whether investment 31 should be in GROSS/MIXED mode for the brutto-column boxes to be checkable at all, or whether a different, static fixture should carry those boxes instead.
      **Test disposition:** no automated test — this is a checklist-staleness issue, not a code defect; the underlying reconciliation already has parity-test coverage per the section's own "In review" gate note.
- [ ] **Phase 3 box 5 stale — "Korekta" column no longer exists** — grep of `src/components/tables/investments.tsx` finds no "Korekta" column at all (matches Phase 2's own parenthetical "kolumny „Korekta" już nie ma", which directly contradicts Phase 3 box 5's claim that MANAGER sees it). The "Wydatki wliczone w robociznę" half of the claim is confirmed correct by code (not gated by `isAdminOrOwner`, unlike "Marża v1/v2" and "Wypłaty" which are).
      **Needs human:** strike the "Korekta" clause from Phase 3 box 5.
      **Test disposition:** no automated test — checklist-text staleness, not a behavior defect.
- [ ] **`dumps/parity-post-fix.json` doesn't exist in the repo** — Phase 4's box names a specific committed dump file that isn't there (`dumps/` has `parity-probe.csv`, `parity-snapshot.json`/`.csv`, `parity-ex555-phase3.json`/`.csv`, nothing named `parity-post-fix.json`). Either the file was a one-off scratch artifact never intended to be committed, or it was cleaned up since.
      **Needs human:** confirm whether this detector should be re-run and its output committed, or whether the box should point at `pnpm test:parity`'s live output instead of a frozen file.
      **Test disposition:** no automated test — `pnpm test:parity` already covers the underlying reconciliation; this box is about whether a specific artifact file should exist, a documentation/process question.
- [ ] **Phase 1 box 1, Phase 2 box 3/4, Phase 3 box 3 not reached** — time-boxed out of this pass (Phase 1/2's brutto-toggle boxes are additionally blocked on investment 31 being NET-mode today — see the stale-figures finding above; Phase 3 box 3 needs a GROSS-mode investment with a booked rabat, no such fixture was readily at hand).
      **Needs human:** none — re-run to close, ideally after resolving the stale-figures finding above so the boxes describe something checkable against live data.
      **Test disposition:** no automated test — not yet investigated, no disposition to give.

## kosztorys-importer (EX-417)

Setup: local app against the 5433 dev DB, logged in as OWNER or MANAGER, on an investment that has a
linked Google Sheet. **The Sheets credential in `.env` is live** — the importer only ever reads, but
pick an investment whose sheet you are happy to have read. Kosztorys rows are throwaway until
dogfooding merges to `main`, so replacing one is safe.

- [x] „Opcje" → „Pobierz z arkusza Google…" is present for every role that reaches the editor — OWNER/ADMIN **and MANAGER** (the importer sits at MANAGEMENT*ROLES like every other kosztorys mutation)
      \_Verified: staging, inw. 135, logged in as OWNER — „Opcje" menu renders an „Arkusz Google" group with both „Pobierz z arkusza Google…" and „Porównaj z arkuszem…" once `hasSheet` is true. MANAGER/ADMIN not separately exercised this pass (role gate is the same `MANAGEMENT_ROLES` check as every other mutation in this menu, already proven live for OWNER).*
- [ ] On an investment with no linked sheet the dialog opens and refuses with „Inwestycja nie ma kosztorysu." — the confirm button stays disabled
      **Does not match current code/UI — see Findings (Finding A).**
- [x] „Co wejdzie" counts match the sheet: sekcje, prace, etapy
      _Verified: staging, inw. 135 re-linked to the canonical sheet and re-imported 2026-08-26 (B19) —
      preview read „14 sekcji · 372 prac · 0 etapów"; SQL post-import confirmed `count(*) FROM
kosztorys_sections WHERE investment_id=135` = 14, `count(*) FROM kosztorys_items WHERE
investment_id=135` = 372, and `count(*) FROM kosztorys_stages WHERE investment_id=135` = 0 — all
      three match the preview exactly. **Correction:** an earlier pass of this same box (same
      investment/sheet) recorded „10 etapów" without a matching stage-count SQL check; that figure
      is wrong — `parse-labor-tab.ts:216` (`usedColumns.has(column) || isNamedStage(caption(column))`)
      only counts a stage column when it has recorded execution or a custom caption, and the canonical
      sheet has neither (see `import-etapy-z-arkusza` finding below), so 0 is the correct count. Not
      filing — self-corrected with SQL evidence this pass._
- [x] Rate auto-resolutions are listed one by one with the rejected side visible — never silently applied
      _Verified: staging, inw. 135 — preview showed „Stawki bez rozstrzygnięcia (2) — cenniki podają różne kwoty, wejdą puste" as an expandable fold (not silently applied); those 2 rates entered as empty/0 rather than picking one side._
- [x] Footer totals compare against the sheet's own „wartość netto" / „R netto - suma prac wykonannych"; a match is neutral, a real difference is amber. **This is the parse's own proof** — a green pair means every cena, rabat and ilość landed right
      _Verified: staging, inw. 135 — „Porównanie sum" table showed both rows (wartość netto / R netto - suma prac wykonannych) as „Arkusz Google 0,00 zł · Ta aplikacja 0,00 zł · zgadza się" (canonical sheet is a blank offer, so 0 zł is the correct expected total on both sides)._
- [x] „Zostaną zachowane" lists vanished prace and nothing is deleted
      _Verified: staging, inw. 135 — preview's „Prace, których nie ma w arkuszu Google" block listed „99 prac zniknie" with an expandable „Zobacz, które prace znikną (99)" fold showing every vanishing prace by section+description (one flagged „wpisane etapy"), plus the standing note that the pre-import state auto-saves to „Wersje" — nothing is destroyed, only replaced with an undo path. Label text is „Prace, których nie ma w arkuszu Google", not literally „Zostaną zachowane" — the preserved-state guarantee is the same, phrased differently; not filing, just noting the wording drift._
- [ ] During the write both „Pobierz i zastąp" and „Anuluj" are disabled and the button reads „Pobieram…"
      Not observed — the import against a small blank-offer sheet completed between one `browser_evaluate` call and the next poll (dialog was already closed), too fast to catch the in-flight state with synchronous DOM polling. Needs a slower dataset or network throttling to catch reliably.
- [x] After apply the grid **re-seeds without a manual reload** — the imported rozpiska is on screen
      _Verified: staging, inw. 135 — immediately after the dialog closed (no navigation/reload), the grid body already showed the imported sections/rows (e.g. „Prace dodatkowe (4 poz.)" instead of the pre-import content)._
- [x] „Wersje" shows a **named** entry „Przed importem z arkusza Google" at the top (among the manual versions, **not** buried in „Historia automatyczna"), and restoring it brings the previous kosztorys back — this is the undo for a bad import
      _Verified: staging, inw. 135 — SQL: `kosztorys_snapshots` row `id=24, kind='manual', label='Przed importem z arkusza Google'`, and „Wersje" dialog rendered it under „NAZWANE WERSJE" above „HISTORIA AUTOMATYCZNA". Clicked „Przywróć" → confirm dialog named the exact timestamp → confirmed → grid and SQL (`kosztorys_items`/`kosztorys_sections` counts back to 336/13, row 1 content back to the pre-import description) both reverted correctly._
- [ ] On a sheet whose cennik headers are unreadable the dialog **refuses** with „Nie odczytałem żadnego cennika…" and the confirm button stays disabled — no import of flat 0 zł stawki
      Not exercised this pass — the two sheets used (filled test sheet, canonical sheet) both had readable cennik headers. The filled test sheet instead hit a **different** refusal path (missing tab, see Finding D) and the canonical sheet hit the **column-mapping** refusal (see `sheet-column-mapping` section) — neither is this specific "cennik headers unreadable" case. Needs a sheet fixture with a genuinely broken cennik header row to close this box.
      **Test disposition:** no automated test needed for the box itself (it's a live-sheet fixture gap) — the underlying refusal behavior it describes should already be covered by a unit test on the parser's cennik-header-matching function; not verified this pass whether one exists.

### Findings — 2026-08-26

- [ ] **Finding A — "no linked sheet" refuses via a visible-but-disabled dialog per the checklist; the code hides the menu items entirely instead** — box 2 above assumes clicking „Pobierz z arkusza Google…" (or „Porównaj z arkuszem…") on a sheet-less investment opens a dialog that then refuses. Live on staging (inw. 135, before it had a linked sheet) the „Opcje" menu had **no „Arkusz Google" group at all** — confirmed via `browser_find` finding zero "arkusz" matches in the open menu. Code: `src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx:80-94` gates the whole group behind `{hasSheet && (...)}`, with an explicit comment: "Both entries can only answer „Inwestycja nie ma kosztorysu." without a linked sheet." — i.e. the refusal string (`src/lib/google/sheet-lookup.ts:9`, `MISSING_SHEET`) is real server-side but currently unreachable through the menu; there's no UI path left to trigger it. Same gate blocks the empty-kosztorys screen's own „Pobierz z arkusza Google…" CTA (`kosztorys-editor-body.tsx:297`, `!preview && hasSheet`).
      **Needs human:** decide whether the checklist text is stale (menu-hiding was a deliberate later change) or whether the disabled-dialog behavior is expected and the gate is a regression. If the gate is intentional, reword this box (and the matching box in `sheet-live-compare`) to describe "menu item absent", not "dialog opens and refuses".
      **Test disposition:** no automated test needed to _file_ — this is a docs/checklist-vs-code drift, not a functional bug (the hidden-menu behavior is deliberate per the code comment). If the human decides the checklist is simply stale, no test is owed; if they decide it's a regression, that becomes its own TDD-first finding.
- [x] **Finding D — filled test sheet's `kosztorys_robocizny` tab has been renamed, breaking AGENTS.md's documented sheet reference** — attempted to link investment 135 to the **filled test sheet** (`1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4`) per this task's Google Sheets preference rule, then open „Pobierz z arkusza Google…". The dialog refused: „Nie udało się odczytać arkusza Google — Arkusz nie ma zakładki „kosztorys*robocizny", a to z niej czytamy prace." `scripts/inspect-sheet.mjs` confirms the tab now exists as `"kosztorys_robocizny(dla inwestora) "` (renamed, trailing space) — `AGENTS.md`'s pointer still names the tab `kosztorys_robocizny`. The app's refusal itself is **correct behavior** (graceful, names the missing tab, doesn't half-import) — this exercises box 10 of `sheet-column-mapping` below. Re-ran the import against the **canonical** sheet instead (`1kEWaMv9KRRXVaSMu3AJRw_ptxucnF4oafLR74VWeRHg`, tab name unchanged), which unblocked the rest of this section.
      Fixed by re-pointing this pass's fixture at the canonical sheet rather than editing app code — this is a Google Sheets fixture drift, not a bug. Flagging so `AGENTS.md`'s Owner's Reference Sheet section gets corrected (either re-share/rename fix on the owner's side, or update the doc to the tab's current name) — left the box checked here since the \_app* behavior was verified correct; the open item is purely the doc pointer.
      **Needs human:** confirm whether the filled test sheet's tab should be renamed back to `kosztorys_robocizny` (owner's file) or `AGENTS.md` should be updated to the new name.
      **Test disposition:** no automated test — this is live spreadsheet content, not app code.

## EX-560 — ex-560-reload-from-preset

Setup: local app against the 5433 dev DB, logged in as OWNER, on an investment whose kosztorys has at
least one sekcja, an etap and some wpisane wykonanie, plus at least one zapisany szablon in the
library.

- [x] „Wczytaj szablon…" appears in „Opcje" and lists saved szablony
      _Verified: staging, inw. 135 — „Opcje" → „Wczytaj kosztorys z szablonu" opens a dialog listing the szablon library._
- [ ] The search box filters the szablon list by name — needs human, not exercised.
- [x] The dialog states how many sekcje and prace disappear and how many arrive
      _Verified: dialog showed „Zniknie:" / „Wejdzie:" preview counts matching the selected szablon's actual sekcje/prace counts._
- [x] Confirming replaces the rozpiska; the grid shows the new content without a manual refresh
      _Verified: clicked „Wczytaj i zastąp" — grid reloaded in place with the new content, no manual page refresh/navigation needed._
- [ ] VAT/coefficients unchanged, rabat globalny cleared, „do zapłaty" never negative — needs human, not exercised.
- [x] „Wczytaj" lists „Przed wczytaniem: «nazwa szablonu»" and restoring brings the original rozpiska back
      _Verified: a restore point named „Przed wczytaniem: <szablon nazwa>" was created automatically by the reload; opening „Wersje" and clicking „Przywróć" on it (through the confirm alertdialog) correctly reverted row 1's content back to what it was before the reload._
- [ ] Reloading an investment with an empty kosztorys works too — needs human, not exercised.

## EX-555 — robocizna + rabat z kosztorysu na liście inwestycji (write-switch)

**In review** — cała bramka zielona (tsc, eslint, `pnpm test` 2118, `pnpm test:integration` 99,
`pnpm test:parity` 3, nowy E2E `investments-listing-kosztorys`). Zmiana przepina **dwa wejścia**
figur (robocizna, rabat) z transakcji na kosztorys — bez fallbacku, bo **jest jedno właściwe
źródło**: pusty kosztorys to 0 zł, a nie zaglądanie do transakcji. Wybór źródła robi się jednym
ruchem: **v1 = transakcje, v2 = kosztorys**. Reszta figur (wpłaty, materiały, wypłaty) zostaje na
transakcjach po obu stronach.

Setup: aplikacja na **5435** (`DB_POSTGRES_URL_TEST`), zalogowany jako OWNER (kolumna „Marża" jest
dla ADMIN/OWNER). Po `pnpm db:import:test` uruchom `pnpm seed:kosztorys:test`, inaczej baza nie ma
ani jednego wiersza kosztorysu i cała gałąź kosztorysowa jest nieodwiedzana.

- [x] Inwestycja **bez kosztorysu**: „Bilans netto v2", „Bilans brutto v2", „Marża v2" i „Robocizna v2" pokazują „brak danych" (nie 0 zł), a przy „Robociźnie v2" nie ma ikony rozjazdu; „Bilans netto v1", „Marża v1" i „Robocizna v1" dalej pokazują liczby z transferów
      _Verified: staging, inw. 6 (bez kosztorysu, NET) — listing pokazuje „brak danych" na Bilans netto v2/Marża v2/Robocizna v2, brak ikony rozjazdu przy Robociźnie v2; v1 dalej liczby z transferów. Sub-case brutto: inw. 6 tymczasowo przestawiona na `settlement_mode='GROSS'` przez panel Payload (`/admin`), listing wtedy pokazał „brak danych" na Bilans brutto v2 i „nie dotyczy" na netto (flip potwierdzony), po czym przywrócona z powrotem na `NET` i zweryfikowana SQL-em (`settlement_mode='NET'`)._
      _Re-verified 2026-08-26 (B18) na fresh Preview (`2aa156ce`, po `f49de35b`): SQL potwierdza inw. 6 dalej ma 0 wierszy w `kosztorys_items` (fikstura nietknięta). Wiersz na żywo (`/inwestycje`, po odkryciu statusu „Zakończona" w filtrze — inw. 6 ma `status='completed'`, domyślnie ukryta): `Bilans netto v2: „brak danych"`, `Bilans brutto v2: „nie dotyczy"`, `Marża v2: „brak danych"`, `Robocizna v2: „brak danych"`; v1 dalej liczby (`Bilans netto v1: -94,57 zł`, `Marża v1: 39 471,00 zł`, `Robocizna v1: 110 871,00 zł`). Filtr Status przywrócony do stanu sprzed testu. Fix `f49de35b` nie naruszył tego zachowania._
- [x] Inwestycja **z kosztorysem**: „Bilans netto v2", „Bilans brutto v2" i „Marża v2" w wierszu listy zgadzają się co do grosza z „Podsumowaniem" tej samej inwestycji (v2). To jest defekt, który ta zmiana zamyka — przed nią te dwie powierzchnie pokazywały inne liczby.
      _Verified: dowód z wcześniejszej sesji (ta sama sekcja, powyżej) — inw. 135, panel kosztorysu „Marża rzeczywista" = 142,50 zł, listing „Marża v2" = 142,50 zł — identyczne. Ponownie potwierdzone w tej sesji po edycji etapu: 254,38 zł na obu powierzchniach jednocześnie._
- [x] Inwestycja **bez kosztorysu** liczy w v2 **0 zł robocizny i 0 zł rabatu**, nawet jeśli ma zaksięgowane `LABOR_COST` (np. inwestycja 31) — w v2 widać to jako zera, na liście jako „brak danych". Jej stare liczby widać po przełączeniu na **v1** — i tylko tam.
      _Verified: staging, inw. 31 (real data, read-only) — bez kosztorysu w v2 (`hasKosztorys=false`), listing pokazuje „brak danych" na wszystkich v2 kolumnach mimo zaksięgowanego `LABOR_COST`; po przełączeniu na v1 widać stare liczby z transferów._
- [ ] Inwestycja z kosztorysem sumującym się **do zera** wygląda identycznie jak ta bez kosztorysu. Nie da się ich odróżnić po liczbach i nie ma powodu, żeby dało się je odróżnić. — **patrz Findings, ten box jest nieaktualny względem kodu.**
- [x] Inwestycja z pustym kosztorysem, ale z zaksięgowaną robocizną w transakcjach — reconciliation **krzyczy** niezgodność. To jest sygnał „ta robota czeka na wprowadzenie do kosztorysu", nie fałszywy alarm.
      _Verified: staging, inw. 6 — brak kosztorysu, `LABOR_COST` zaksięgowany w transakcjach → strona inwestycji renderuje ikonę „Niezgodność z transakcjami" przy Robociźnie._
- [x] Zmiana ilości w kosztorysie rusza „Marżę" na liście **bez** klikania „Odśwież dane".
      _Verified: staging, inw. 135 — edycja Etap 2 (item_id=2366, stage_id=38) z 0→1 w edytorze, `stage_progress.id=407` potwierdzony SQL-em (qty_done=1), twarda nawigacja na `/inwestycje` (bez klikania „Odśwież dane") pokazała „Marża v2" 142,50 → 254,38 zł. Edycja cofnięta do 0 po zebraniu dowodu, potwierdzone SQL-em (qty_done=0)._
- [x] Zakładka **Marża** w v2 pokazuje tę samą robociznę i ten sam rabat co blok nad nią.
      _Verified: staging, inw. 135 — Podsumowanie: Robocizna 550,00 / Rabat -50,00; zakładka Marża rzeczywista: Robocizna 550,00 / Rabat -50,00 — identyczne._
- [ ] Okno „Nowa transakcja" (i **edycji** transakcji) nie oferuje już „Robocizny" ani „Rabatu"; stary wiersz `LABOR_COST`/`RABAT` dalej się renderuje w tabeli, daje się anulować i jedzie do arkusza. — **nieaktualne, patrz Findings.**
- [ ] Draft w sessionStorage: wybierz stary typ, przeładuj — formularz nie wraca do ukrytego typu. — **niemożliwe do przetestowania w obecnym stanie kodu, patrz Findings (zależne od boxa wyżej).**
- [x] Inwestycja z kosztorysem i **bez żadnej** transakcji `LABOR_COST`/`RABAT` **nie krzyczy** „Niezgodność z transakcjami" (ani w edytorze, ani na stronie inwestycji).
      _Verified: staging, inw. 135 — anulowano jedyną transakcję `LABOR_COST` (#4670, „Anulowanie transakcji" z podanym powodem), SQL potwierdza `cancelled=t` + audit-trail wiersz #4671 typu `CANCELLATION` z `cancelled_transaction_id=4670`. Strona inwestycji (Podsumowanie): `browser_find` na „Niezgodność" — brak wyniku. Edytor i strona inwestycji dzielą tę samą funkcję `buildKosztorysReconciliation` (src/lib/kosztorys/reconciliation.ts) — jedna weryfikacja pokrywa oba miejsca renderowania._
- [x] Inwestycja, która ma zaksięgowaną robociznę, ale **nie ma** rabatu — krzyk na rabacie **zostaje**. Wyciszenie jest per inwestycja, nie per figura.
      _Verified: staging, inw. 135 — zabukowano nowy `LABOR_COST` 550 zł (#4672, zgodny z kosztorysem), rabat pozostał bez żadnej transakcji (kosztorys mówi -50 zł). Podsumowanie: Robocizna 550,00 bez ikony, Rabat -50,00 z `img "Niezgodność z transakcjami"`. Zgadza się z `src/lib/kosztorys/reconciliation.ts:79-93` — `nothingBooked` wymaga ZAROWNO `laborCostsNetFromTransactions===0` I `discountNetFromTransactions===0` (AND, nie OR), więc jedna zaksięgowana figura nie wycisza drugiej._
- [x] Przełącznik **v1/v2** w panelu: v1 dalej pokazuje liczby z transakcji (celowo rozjeżdża się z listą — legacy do porównań).
      _Verified: staging, inw. 135 (po anulowaniu #4670) — v1 pokazał „Robocizna netto: 0,00 zł" (transakcje: zero aktywnych `LABOR_COST`), v2 dalej 550,00 zł (z kosztorysu) — świadomy rozjazd potwierdzony na żywym przykładzie._

### Findings — 2026-08-25

- [ ] **EX-555 box 4 nieaktualny względem kodu — kosztorys sumujący się do zera NIE wygląda jak brak kosztorysu** — `hasKosztorysReading()` w `src/components/tables/investments.tsx:~55-70` jest celowo oparte na `row.hasKosztorys` (obecność pozycji), a nie `totalLaborCosts !== 0` (suma) — komentarz w kodzie wprost tłumaczy, że to rozróżnienie jest zamierzone: świeży, w pełni wypełniony ale jeszcze nierozpoczęty kosztorys (suma = 0) MA pokazywać liczby (0 zł), nie „brak danych", właśnie żeby się nie mylił z brakiem kosztorysu. Box w rejestrze twierdzi coś przeciwnego.
      **Needs human:** zdecydować, czy to checklist jest przestarzały (najbardziej prawdopodobne — kod ma świadomy komentarz uzasadniający obecne zachowanie) i wymaga przepisania, czy to `hasKosztorysReading()` ma się zmienić.
      **Test disposition:** no automated test — to jest rozbieżność dokumentacji vs. kod, nie defekt; regresja `hasKosztorysReading` byłaby pokryta unit testem w `src/__tests__/components/tables/investments.test.ts` gdyby ktoś kiedyś odwrócił logikę bez świadomości komentarza.
- [ ] **EX-555 box 8 (i zależny box 9) nieaktualne — EX-649 przywrócił „Robociznę"/„Rabat" do okna transakcji** — `src/lib/constants/transfers.ts:280-299` (`TRANSACTION_TRANSFER_TYPES`) i AGENTS.md § Transfer Business Logic wprost dokumentują, że EX-649 odwrócił EX-555 „tymczasowo, do czasu EX-712" — dla KAŻDEJ inwestycji, bez wyjątków. Potwierdzone na żywo: okno „Nowy wydatek" na inw. 135 domyślnie miało „Typ wydatku" = „Koszty robocizny", zapis nowej transakcji `LABOR_COST` przeszedł bez blokady (#4672). Box 9 (draft w sessionStorage nie wraca do „ukrytego typu") jest w efekcie niemożliwy do przetestowania — nie istnieje obecnie żaden „ukryty typ" do wybrania.
      **Needs human:** przepisać oba boxy pod EX-649 (albo skreślić je jako „unieważnione przez EX-649, do przywrócenia po EX-712"), żeby rejestr nie kazał szukać nieistniejącego zachowania.
      **Test disposition:** no automated test — to jest stały, świadomy stan przejściowy (komentarz w kodzie: „TEMPORARY — EX-712 removes both entries again"), a nie defekt do pokrycia; EX-712 będzie właściwym momentem na test regresji ukrycia typów.
- [x] **Incydentalne: transakcja #4670 (inw. 135, throwaway QA) trwale anulowana + dobukowano #4672 (`LABOR_COST` 550 zł) jako fixture dla boxów 9-11** — stan transakcji tej inwestycji zmienił się na stałe w toku tego passu (celowo, budowano fixture przez UI zgodnie z instrukcją właściciela). Kolejny pass zobaczy: #4670 `cancelled=true`, #4671 `CANCELLATION`, #4672 `LABOR_COST` 550 zł aktywny.
      **Test disposition:** no automated test — to dane QA na inwestycji oznaczonej jako throwaway, nie defekt.

### Findings — 2026-08-26 (B18)

- [ ] **Box 3's referencyjna inwestycja 31 już nie jest bez kosztorysu w v2 — premisa boxa jest przestarzała.** Box 3 powyżej dowodzi na inw. 31, że „bez kosztorysu w v2 pokazuje brak danych mimo zaksięgowanego `LABOR_COST`" — ewidencja z wcześniejszej sesji notuje `hasKosztorys=false`. SQL na żywo w tej bramce (2026-08-26): `SELECT count(*) FROM kosztorys_items WHERE investment_id=31` → **336 wierszy**. Inwestycja 31 jest oznaczona jako real data / read-only dla tego gate'u, więc nie dało się jej ani zbadać dalej z mutacją, ani przywrócić do „bez kosztorysu" — ktoś spoza tej sesji rozpoczął wprowadzanie jej kosztorysu między poprzednim passem a tym. Box pozostaje `[x]` (był poprawnie zweryfikowany wtedy, kiedy premisa była prawdziwa), ale jako dowód na „inwestycja bez kosztorysu" jest teraz nieaktualny — potrzebna inna inwestycja real-data z zaksięgowaną robocizną i wciąż pustym kosztorysem, jeśli ktoś zechce odtworzyć ten dowód.
      **Needs human:** wskazać nową referencyjną inwestycję (real, z `LABOR_COST` w transakcjach i 0 wierszy w `kosztorys_items`) do przyszłych re-weryfikacji boxa 3, albo zaakceptować że dowód z poprzedniej sesji wystarcza i nie wymaga odświeżenia co gate.
      **Test disposition:** no automated test — to dryf danych referencyjnych na żywej, nie-QA inwestycji, nie defekt produktu; unit/integration coverage dla `hasKosztorysReading`/write-switch już istnieje niezależnie od tego, która inwestycja akurat służy za żywy przykład.

## EX-557 — wpłaty bez inwestycji („Inna wpłata" wraca, oba typy tracą inwestycję)

**In review** — cała bramka zielona (tsc, eslint, `pnpm test` 2131, `pnpm test:integration` 99,
`pnpm test:parity` 3). E2E okna wpłaty odroczone do **EX-679** (`e2e-backlog`).

Setup: aplikacja na dev DB (5433), potrzebne dwa konta — MANAGER i ADMIN/OWNER.

- [x] Jako MANAGER okno wpłaty oferuje „Inna wpłata" (wróciła) i „Wpłata od inwestora", ale **nie** „Zasilenie z konta firmowego" — _Verified przez kod, nie drugą sesję (harness ma jedną wspólną sesję OWNER, bez poświadczeń MANAGER): `src/components/forms/deposit-form/deposit-form.tsx` — `isAdminOrOwnerRole(role) ? DEPOSIT_UI_TYPES : DEPOSIT_UI_TYPES.filter((t) => t !== 'COMPANY_FUNDING')`, jedyny warunek gatingu, bez pośredniej logiki._
- [x] Jako ADMIN/OWNER lista typów ma wszystkie trzy, w kolejności alfabetycznej po polskiej etykiecie — _Verified: staging, dialog „Nowa wpłata" jako OWNER, `listbox`: „Inna wpłata", „Wpłata od inwestora", „Zasilenie z konta firmowego" — I/W/Z, alfabetycznie. Zgadza się z `DEPOSIT_UI_TYPES` w `src/lib/constants/transfers.ts`._
- [x] Wejście z `/inwestycje/<id>` → „Inna wpłata" → pole inwestycji znika, a zapisany wiersz ma w kolumnie Inwestycja „—", nie inwestycję, na której stałeś — _Verified: z `/inwestycje/135`, dialog „Nowa wpłata" → „Inna wpłata" → pole „Inwestycja" znika z formularza; zapisano 77 zł, SQL na cutover DB: `#4675 OTHER_DEPOSIT investment_id=NULL` (nie 135)._
- [x] To samo dla „Zasilenie z konta firmowego" — _Verified: ta sama ścieżka, „Zasilenie z konta firmowego" → pole „Inwestycja" znika; zapisano 88 zł, SQL: `#4676 COMPANY_FUNDING investment_id=NULL`._
- [x] Wybierz „Wpłata od inwestora", ustaw inwestycję i netto/brutto, przełącz typ na „Zasilenie" i zapisz — żadna z tych dwóch wartości nie ląduje na wierszu — _Verified: dialog otwarty z inwestycją 135 wstępnie wypełnioną (typ domyślny „Wpłata od inwestora"), wpisano Kwota=99, przełączono na „Zasilenie z konta firmowego" — pole Inwestycja zniknęło, Kwota wyczyściła się (nie „99"); wpisano nowe Kwota=66 i zapisano. SQL: `#4677 COMPANY_FUNDING investment_id=NULL net_amount=NULL vat_plane=NULL` — żadna z wcześniej wpisanych wartości nie przeciekła._
- [x] Edycja istniejącego wiersza `COMPANY_FUNDING` z tabeli transakcji nie oferuje pola inwestycji, a zapis niepowiązanego pola (opis) przechodzi bez błędu — _Verified: `/?id=4677` → „Edytuj transakcję" na #4677 — dialog edycji ma tylko Opis/Data/Faktura, brak pola Inwestycja; zmieniono opis i zapisano bez błędu. SQL po zapisie: `#4677` opis zaktualizowany na „B3 manual-check EX-557 box 6…", `investment_id` nadal `NULL`._

## EX-675 — strata obniża dług inwestora jak rabat

**In review** — cała bramka zielona (tsc, eslint, `pnpm test` 2153, `pnpm test:parity` 3). Strata
wchodzi teraz w bilans **nominalnie**: 1000 zł wchłonięte to dokładnie 1000 zł mniej długu na
netto i na brutto — inaczej niż rabat, który jest ustępstwem od ceny i gruntuje się o VAT. Marża
bez zmian. Inwestycja przy stracie stała się **wymagana**.

Setup: aplikacja na dev DB (5433), zalogowany jako OWNER (kafelek „Strata" i „Marża" są dla
ADMIN/OWNER). Inwestycja **62** jest wzorcem: 362,84 zł materiału pokryte stratą 362,84 zł.

- [x] Inwestycja 62: nagłówkowy bilans pokazuje **0 zł**, marża **−362,84 zł** — _Verified: staging `/inwestycje/62?widok=v1`, „Bilans inwestora: 0,00 zł" (materiał 222,88+139,96=362,84 zł pokryty stratą 362,84 zł); v2 „Marża" zakładka: Robocizna 0,00, Strata −362,84, Marża **−362,84**; SQL na cutover DB potwierdza `LOSS 362.84` = `INVESTMENT_EXPENSE 222.88 + 139.96`._
- [x] Kafelek „Strata" stoi w wierszu kredytów obok rabatu (nie w osobnym bloku), a suma kafelków po odznaczeniu/zaznaczeniu dowolnego z nich dalej zgadza się z nagłówkiem — _Verified: staging `/inwestycje/62?widok=v1`, kafelek „Strata: 362,84 zł" stoi w tym samym wierszu co „Wpłaty" (licznik „wybranych 6/6"); odznaczenie zmienia „Bilans inwestora" z 0,00 zł na **−362,84 zł** i licznik na 5/6, ponowne zaznaczenie wraca do 0,00 zł i 6/6 — czysto klientowy toggle, nie zapisuje się do DB._
- [x] Bilans brutto tej samej inwestycji nie „gruntuje" straty — przy stracie 1000 zł i VAT 23% dług spada o 1000 zł, nie o 1230 zł — _Verified z realną stawką VAT inwestycji (0.08, nie 23% z tekstu checklisty — zasada ta sama): tymczasowo przełączono inwestycję 6 (Apenińska, real data) na `settlement_mode=GROSS`, zaksięgowano `LOSS 1000 zł` (#4673) — „Pozostało do zapłaty" (brutto) spadło dokładnie o **1000,00 zł**, nie o 1080,00 zł. Potwierdza kod: `settlement-groups.ts` liczy stratę przez `faceValue(-lossAmount)` (ta sama wartość na obu planach, brak mostu VAT). Sprzątnięcie: transakcja #4673 anulowana przez UI (audit trail #4674 CANCELLATION), `settlement_mode` przywrócony na `NET` — SQL po sprzątnięciu: `settlement_mode=NET`, `#4673 cancelled=true`._
- [ ] Podsumowanie v2 inwestycji ze stratą: krok **„Strata"** stoi pod „Wpłatami", na minusie, spięty przez oba tory kwotowe; „Pozostało do zapłaty" schodzi o tę samą kwotę na netto i na brutto — **nieaktualne, patrz Findings** (kolejność Wpłaty→Strata→Pozostało potwierdzona na inwestycji 62 w torze netto; drugi tor „brutto" jednocześnie nie istnieje w obecnym kodzie — jeden panel renderuje zawsze dokładnie jedną oś)
- [x] Inwestycja **bez** straty nie pokazuje kroku „Strata" w ogóle (żadnego 0 zł) — _Verified: staging `/inwestycje/31` (real data, brak `LOSS` w SQL), zakładka „Podsumowanie": wiersze `Łącznie → Wpłaty → Pozostało do zapłaty`, bez wiersza „Strata". Kod: `settlement-groups.ts:44` — `if (lossAmount !== 0) rows.push(...)`, guard strukturalny._
- [ ] Tryb **mieszany**: „Strata" pojawia się raz, w torze netto (jak „Wpłaty netto"), a podpowiedź przy „Pozostało brutto" wymienia stratę wśród odjętych pozycji — **nieaktualne, patrz Findings** (pierwsza połowa zgadza się z kodem; „Pozostało brutto" nie istnieje w torze mieszanym w ogóle)
- [ ] Podgląd inwestora (link do kosztorysu) pokazuje ten sam obniżony dług — bez ujawniania marży i wypłat — **nie zweryfikowano, patrz Findings** (brak fikstury: inwestycja 62 ma stratę ale pusty kosztorys v2 — `/podglad-inwestora/62` renderuje „Kosztorys jest pusty"; inwestycja 31 ma pełny kosztorys ale zero strat)
- [x] Okno „Nowa transakcja" → „Strata": pole inwestycji jest **wymagane**, zapis bez niej odrzucony — _Verified strukturalnie: staging, dialog „Nowy wydatek" z Typ wydatku=Strata — pole „Inwestycja" to wymagany combobox z wyszukiwarką bez opcji „wyczyść"/pustego wyboru; „Wyczyść formularz" resetuje Kwotę/Opis, ale NIE Inwestycję (zostaje ostatnio wybrana). UI nie daje żadnej ścieżki do zapisania Straty bez inwestycji — pole efektywnie wymagane przez konstrukcję formularza, nie tylko przez walidację serwera._
- [ ] Do istniejącej straty da się dopiąć fakturę (edycja tylko tego pola) — zapis przechodzi, nie żąda ponownie inwestycji — **nie zweryfikowano** (budżet czasu — patrz Findings, tally B3)
- [ ] Wyczyszczenie inwestycji na istniejącej stracie (panel Payloada) jest **odrzucone** — wcześniej przechodziło po cichu, zostawiając stratę bez właściciela — **nie zweryfikowano** (budżet czasu — patrz Findings, tally B3)
- [ ] Krok „Strata" nie ma żadnej podpowiedzi pod kwotą — ani w panelu, ani w podglądzie inwestora — **nie zweryfikowano** (budżet czasu — patrz Findings, tally B3)

### Findings — 2026-08-25

- [ ] **Box 4/6 stale vs. axis-unification ruling** — checklist boxes 4 and 6 assume the Podsumowanie panel can render **two** simultaneous money tracks (netto + brutto) for a strata step. Current code never does: `src/lib/kosztorys/settlement-mode.ts` `settlementModeToMoneyAxis()` maps every `SettlementModeT` (including `MIXED`) to a single `MoneyAxisT` (`'net'` or `'gross'`, never `'both'`), and `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx:84-85` feeds that single axis straight into `buildSettlementGroups()` (`src/components/kosztorys/summary/settlement-groups.ts`), which renders exactly one axis's worth of rows. The code comment on `settlement-mode.ts:49-52` documents this as a deliberate 2026-08-20 reversal: "one projection... never two... reverses the 2026-08-07 ruling that both columns stand in every tryb." So there is no live UI state where box 4's "both tracks drop together" or box 6's "Pozostało brutto tooltip" can be observed — the underlying non-grossing property itself is independently confirmed (see ticked boxes 1/3), only the two-column framing is stale.
      **Needs human:** rewrite boxes 4 and 6 to describe the single-axis-per-tryb model, or confirm a two-column mode is still intended and file it as a regression against `settlement-mode.ts`.
      **Test disposition:** no automated test — this is a checklist-text/code disagreement, not a behavior defect; the underlying non-grossing property already has parity-test coverage per the EX-675 "In review" gate note at the top of this section.
- [ ] **Box 7 unverified — no fixture combines a populated kosztorys with a booked Strata** — investment 62 (has a `LOSS` transaction) has an **empty** kosztorys v2 (`/podglad-inwestora/62` → "Kosztorys jest pusty", "Schowaj podsumowanie" disabled); investment 31 (has a populated 435-item kosztorys) has **zero** `LOSS` transactions. Neither throwaway investment 135 has a populated kosztorys either. Building this fixture means either seeding a kosztorys onto investment 62 (`seed-kosztorys.ts`/`perf-seed-kosztorys.ts`, throwaway-safe) or temporarily booking+cancelling a `LOSS` on investment 31 (real data, read-only preferred) — both were judged out of the depth-over-coverage time budget for this pass.
      **Needs human:** none — just re-run with the seed script against investment 62's kosztorys, then re-check `/podglad-inwestora/62`.
      **Test disposition:** no automated test needed here — if the fixture is built, this should be a Playwright e2e spec (`e2e/`) asserting the public preview route shows the reduced "Pozostało" figure but never renders "Marża"/"Wypłaty" text nodes, since it is a multi-boundary (auth-bypass route + reconciliation figure) risk.
- [ ] **Boxes 9, 10, 11 not reached** — time-boxed out of this pass (see B3 tally in `context/changes/staging-to-main-gate/ledger.md`).
      **Needs human:** none — re-run to close.
      **Test disposition:** no automated test — not yet investigated, no disposition to give.
- [x] **Investment 6 (real data) fixture cleanup** — booked `LOSS 1000 zł` (#4673) and flipped `settlement_mode` to `GROSS` for box 3's test. Both reverted: #4673 cancelled via UI (audit trail #4674 CANCELLATION, reason recorded), `settlement_mode` restored to `NET` via Payload admin. SQL confirms both post-cleanup.
      **Test disposition:** no automated test — one-off manual-QA fixture cleanup, not a product behavior.

## EX-686 — rozjazd „Pomiar z natury" vs suma etapów po imporcie

**In review** — cała bramka zielona (tsc, eslint 0 błędów, `pnpm test` 2150,
`pnpm test:integration` 104). `pnpm build` przeszedł przez `next build --webpack`; turbopack nie
buduje w worktree z dowiązanym `node_modules` — ścieżkę turbopackową potwierdzić po scaleniu.
E2E odroczone (patrz bramka przeglądu).

Setup: dev DB (5433), zalogowany jako OWNER, inwestycja z zaimportowanym arkuszem, w którym
„Pomiar z natury" jest wpisany ręcznie (inwestycja 31 — 32 pozycje, 41 377 zł rozjazdu).

- [x] Najechanie na komórkę „Pomiar (razem etapy)" **nie** pokazuje żadnej podpowiedzi z rozbiciem arkusz/etapy — rozjazd czyta się wyłącznie z kolumny „Rozjazd między arkuszem Google a apką"
      _Verified via code — `stageQtySum` (title "Pomiar (razem etapy)") is built by `computedColumn('stageQtySum', …, (r) => totalQtyDone(r))` at `kosztorys-v2-columns.tsx:384` with no 4th `style` argument, so `tip` is `undefined`. `ComputedCell` (`cells/computed-cell.tsx`) only wraps its content in a `HintTooltip` when `tip?.(rowData)` is truthy — here it renders the plain `text`, no tooltip wrapper at all. Confirmed no other column definition for `stageQtySum` exists._
- [ ] Kolumna „Rozjazd między arkuszem Google a apką" stoi na pierwszym miejscu (zaraz za „Akcje", przed „Sekcją"), ma czerwony nagłówek i czerwone tło komórek, i pokazuje wprost ilość ze znakiem oraz kwotę — bez najeżdżania kursorem
      **Does not match current code — see Finding B (position AND styling both changed).**
- [x] Kolumna „Rozjazd między arkuszem Google a apką" pojawia się dopiero po wciśnięciu przycisku „z pomiarem do rozpisania na etapy" i znika po jego odciśnięciu; nie ma jej w liście „Kolumny" i nie da się jej stamtąd ani schować, ani wywołać
      _Verified via code — `kosztorys-v2-columns.tsx:369-380`: the `divergence` column array is `!opts.previewVisible && view === 'client' && opts.divergenceFilterEngaged ? [...] : []` — the column object literally doesn't exist in `dataColumns` unless the toolbar diagnostic (`divergenceFilterEngaged`) is on, so it cannot appear in a persisted-visibility "Kolumny" picker (which only lists columns that are always present and merely hidden/shown) — there is nothing to toggle there._
- [x] Przy wciśniętym przycisku kolumna zostaje po przełączeniu Praca ↔ Postęp, a sortowanie po jej nagłówku układa pozycje wg kwoty; po odciśnięciu przycisku sortowanie samo się czyści (nie zostaje kolejność bez nagłówka do wyłączenia)
      _Verified: staging, inw. 31. Engaged „Pozycje z pomiarem do rozpisania na etapy" (Problemy
      menu), switched „Warstwy" Praca→Postęp (Kolumny menu) — the divergence column stayed in the
      header. Clicked its header → „Sortuj rosnąco" (whole kosztorys): rows re-ordered flat by
      divergence amount ascending (1200/1500/1800/1800/4200/16000 zł, DOM-read). Disengaged the
      Problemy toggle → column disappeared and grid returned to natural row-number order within
      sections (1,2,3,4…), confirming the sort self-cleared._
- [x] Przycisk „z pomiarem do rozpisania na etapy" w pasku narzędzi pokazuje liczbę takich pozycji; kliknięcie zawęża siatkę tylko do nich
      _Verified: staging, inw. 31 — „Problemy" menu item read „Pozycje z pomiarem do rozpisania na
      etapy (6)"; clicking it left exactly 6 data rows in the grid (items 24, 71, 306, 311, 334, 336
      across 4 sections, DOM-read), all other sections' rows hidden. Section headers still show their
      full (unfiltered) poz. counts — cosmetic, doesn't affect the narrowing._
- [ ] Wpisanie brakującej ilości w etapie zdejmuje pozycję z listy i zmniejsza licznik — bez odświeżania strony
      **Needs human** — not exercised this pass. The only fixture with real sheet-driven divergence
      is inw. 31, which every other finding in this doc treats as real, read-only production data
      (mutation forbidden); no writable investment with an attached sheet and a live divergence was
      available.
- [ ] Gdy wszystkie rozjazdy zniknęły, przy włączonym warunku widać „Brak pozycji z pomiarem do rozpisania na etapy" z powrotem do pełnej listy, a sam przycisk znika
      **Needs human** — same reachability gap as the box above (depends on clearing inw. 31's
      divergences, which this pass will not do).
- [x] Sekcja zwinięta **chowa** swoje pozycje także przy włączonym warunku — zwinięcia zdejmuje wyłącznie szukanie (ptaszek i zwinięcie stoją w tym samym menu „Filtry")
      _Verified both halves: staging, inw. 31. With the divergence condition engaged, collapsing
      „Klimatyzacja" hid its one divergent row (24) and its Razem footer from the grid entirely — not
      just visually collapsed, the row left the DOM. Separately (condition off), collapsed the same
      section and typed a matching search term („montaż klimatyzacji") — the collapsed section's row
      reappeared, confirming search alone lifts a collapse. One drift from the parenthetical: the
      checkbox and the collapse toggle are **not** in the same „Filtry" menu today — the divergence
      condition lives in a separate „Problemy" button (see the `filtry-problemy` section elsewhere in
      this doc, which split them out); collapse is a per-section chevron, not a menu item at all.
      Behavior itself matches; only the menu-name aside is stale._
- [ ] Ponowny import tego samego arkusza nadpisuje odniesienie bieżącą treścią arkusza
      **Needs human** — not exercised: would require re-running the Google Sheets import against
      inw. 31 (real, read-only fixture) or another sheet-linked investment; out of scope to trigger a
      live Sheets write/read against real customer data this pass.
- [ ] Robocizna, marża i bilans nie drgnęły po imporcie — odniesienie nie wchodzi do żadnej kwoty
      **Needs human** — same reachability gap as the box above (needs an actual import event to
      capture a before/after).
- [x] Podgląd dla inwestora (link publiczny): brak czerwieni, brak podpowiedzi, brak kolumny „Rozjazd między arkuszem Google a apką", brak przycisku „z pomiarem do rozpisania na etapy" i pozycji w menu
      _Verified: staging, `/podglad-inwestora/31` — grid renders the standard investor columns
      (Opis prac/Przedmiar/Jednostka miary/Cena j.m. netto/Wartość przedmiaru netto/Pozostało netto…);
      no „Rozjazd między arkuszem Google a apką" column, no „Problemy"/„Opcje" toolbar at all (the
      investor route has no toolbar), so there is no menu to carry the divergence item and nothing red
      anywhere on the grid._
- [x] Kosztorys założony ręcznie (bez importu) nie pokazuje przycisku „z pomiarem do rozpisania na etapy" w ogóle
      _Verified 2026-08-26 (B19): inw. 133 and inw. 134 both carry a manually-built kosztorys (373
      items each) with `kosztoryses.google_sheet_id IS NULL` — never imported. SQL:
      `SELECT investment_id, count(*), count(sheet_measured_qty) FROM kosztorys_items WHERE
investment_id IN (133,134) GROUP BY investment_id` → 373/0 for both, i.e. `sheet_measured_qty`
      is NULL on every row, so the divergence calc structurally has nothing to compare. Live on inw.
      134's „Problemy" menu: only „Pozycje bez ceny j.m. (6)" and the two z/bez-narzędzi rate-gap
      items — no „Pozycje z pomiarem do rozpisania na etapy" entry at all._

### Findings — 2026-08-26

- [x] **Finding B — divergence column's position and styling both drifted from the checklist's description** — box 2 claims the „Rozjazd między arkuszem Google a apką" column sits "zaraz za „Akcje", przed „Sekcją"" (right after row-actions, before „Sekcja") with a red header and red cell backgrounds. Current code (`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:566-568`, `dataColumns = [...identity, ...divergence, ...przedmiar, ...]` where `identity = [sectionName, description]`) places it **after** both „Sekcja" and „Opis prac", not before „Sekcja" — matching the adjacent code comment ("Right behind „Opis prac" rather than beside „Pomiar""). Styling: the column's only class is `cellClassName: 'border-border border-r'` (a plain border) — no `bg-destructive`/`text-destructive` or any red utility anywhere in the column factory (`kosztorys-v2-columns.tsx:377`) or its cell component (`cells/divergence-cell.tsx`, which renders `ReadOnlyCellText emphasize`, a neutral emphasis style). Confirmed live via screenshot on inw. 31 in an earlier part of this pass: the divergence values render in the grid's default text color, no red anywhere.
      Confirmed as a genuine checklist/code drift, not a defect — not filing as a bug since red styling was apparently a deliberate design change at some point; recording as resolved since both discrepancies (position + styling) are now documented for whoever reconciles the checklist text.
      **Needs human:** rewrite box 2 to match current position/styling, or confirm red styling should be reinstated (in which case this becomes a real, separately-filed regression).
      **Test disposition:** no automated test — this is a checklist-text/code disagreement (visual styling), not a functional defect.

## EX-682 / EX-683 — sortowanie wewnątrz sekcji

**In review** — cała bramka zielona (tsc, eslint 0 błędów, `pnpm test` 2162,
`pnpm test:integration` 107, `next build --webpack`). E2E odroczone (patrz bramka przeglądu).

Zapis kolejności przeniesiony do menu nagłówka kolumny — sprawdza go sekcja EX-688 niżej;
punkty o utrwalaniu z menu wiersza wypadły razem z tamtym poleceniem.

Setup: aplikacja na 5435 (test DB) z zaseedowanym kosztorysem, zalogowany jako OWNER, zakładka
Kosztorys inwestycji.

- [x] Sortowanie po „Opis" układa pozycje alfabetycznie wewnątrz każdej sekcji, kolejność sekcji bez zmian
      _Verified: staging, inw. 135, „Opis prac" → „Sortuj rosnąco zachowując sekcje". „Prace dodatkowe" ułożyło się alfabetycznie z zachowanymi oryginalnymi numerami wiersza (15,12,16,13,17,11,10,8,14,4,2,7,3,1,5,6,9); „Wyburzenia i demontaże" posortowało się niezależnie; kolejność samych sekcji (Prace dodatkowe → Klimatyzacja → Wyburzenia…) bez zmian._
- [x] Pas nagłówka i pas podsumowania sekcji są widoczne przy aktywnym sortowaniu
      _Verified: przy aktywnym sortowaniu z powyższego zarówno pas „Prace dodatkowe (17 poz.) 357,50 zł netto" jak i stopka „Razem / Prace dodatkowe" (2,20/2,20) zostały widoczne._
- [ ] Zwijanie sekcji działa przy aktywnym sortowaniu; wyszukiwarka nadal chwilowo rozwija sekcje — **needs human**, nie sprawdzone w tym przebiegu (time-box).
- [ ] Sortowanie po kolumnie z „—" (np. „Pozostało") spycha te wiersze na koniec **swojej** sekcji — **needs human**, nie sprawdzone.
- [ ] Podgląd dla inwestora (link publiczny): grupa „Sekcja" w ogóle się nie pokazuje — **needs human**, nie sprawdzone.

## EX-688 — zakres sortowania kolumny + „Zapisz kolejność" w menu nagłówka

**In review** — tsc czysty, eslint bez błędów, specy sortowania i zapisu kolejności zielone.
E2E odroczone (patrz bramka przeglądu).

Setup: jak wyżej — aplikacja na 5435 (test DB) z zaseedowanym kosztorysem, zalogowany jako OWNER,
zakładka Kosztorys inwestycji.

- [x] Menu kolumny pokazuje cztery polecenia sortowania (dwa „zachowując sekcje", dwa przez cały kosztorys), „Zapisz kolejność" i „Wyczyść sortowanie"
      _Verified: staging, menu nagłówka „Opis prac" pokazało dokładnie: „Sortuj rosnąco zachowując sekcje", „Sortuj malejąco zachowując sekcje", separator, „Sortuj rosnąco", „Sortuj malejąco", separator, „Zapisz kolejność", „Wyczyść sortowanie" (wyszarzone, brak aktywnego sortowania). Po aktywowaniu sortowania „Wyczyść sortowanie" stało się klikalne, a lista poleceń sortowania skróciła się o użyty kierunek._
- [x] Sortowanie „w sekcjach" po „Opis" zachowuje pasy sekcji i kolejność samych sekcji
      _Verified: patrz dowód w EX-682/683 wyżej — ten sam przebieg._
- [x] Sortowanie „w całym kosztorysie" daje jedną płaską listę — pasy sekcji znikają
      _Verified (batch B12, 2026-08-26) — patrz dowód w EX-580 wyżej, ten sam przebieg (inw. 119, „Opis prac" → „Sortuj rosnąco" bez „zachowując sekcje")._
- [ ] „Zapisz kolejność" działa przy każdym sortowaniu — **needs human**, nie sprawdzone (kliknięto „Wyczyść sortowanie" bez uprzedniego „Zapisz kolejność").
- [ ] Sortowanie „w sekcjach" → „Zapisz kolejność" → wyczyszczenie → kolejność została w każdej sekcji, przeżywa odświeżenie — **needs human**, nie sprawdzone. „Wyczyść sortowanie" samo w sobie zostało potwierdzone: po kliknięciu grid wrócił do numeracji 1,2,3…17 w oryginalnej (nie alfabetycznej) kolejności w „Prace dodatkowe".
- [ ] Cmd+Z / Cmd+Shift+Z na utrwaleniu — **needs human**, nie sprawdzone.
- [ ] Utrwalenie przy wpisanej frazie porządkuje całe sekcje — **needs human**, nie sprawdzone.
- [ ] ▲▼ i „Wstaw" po utrwaleniu i wyczyszczeniu — **needs human**, nie sprawdzone.
- [ ] Menu wiersza bez utrwalania kolejności — **needs human**, nie sprawdzone.
- [ ] Zwinięta sekcja przy sortowaniu „w całym kosztorysie" — **needs human**, nie sprawdzone (zależy od pierwszego punktu wyżej).
- [ ] Sortowanie nie przeżywa odświeżenia strony — **needs human**, nie sprawdzone.
- [ ] Podgląd dla inwestora bez „Zapisz kolejność" w menu — **needs human**, nie sprawdzone.

## sheet-live-compare — „Porównaj z arkuszem Google" (EX-417)

**In review** — tsc czysty, eslint 0 błędów, spec odświeżania zielony na 5435.
`pnpm build` **nie przeszedł w worktree**: turbopack odmawia na dowiązanym `node_modules`
(„Symlink node_modules is invalid") — to ograniczenie środowiska, nie kodu; potwierdzić po scaleniu.
E2E odroczone do EX-687 (`e2e-backlog`).

Setup: dev DB (5433), zalogowany jako OWNER, inwestycja 31 (arkusz podpięty, 26 pozycji z Pomiarem
jako formułą `=N`).

Osobnej akcji „Zaciągnij pomiary z arkusza" **już nie ma** — zaciągnięcie jedzie razem z odczytem,
więc każdy punkt poniżej dotyczy jednego okna.

- [x] Opcje → „Porównaj z arkuszem Google…" otwiera okno, pokazuje „Czytam arkusz Google…", a potem cztery bloki: Kwoty, Prace, Stawki podwykonawców, Jak odczytaliśmy arkusz Google
      _Verified: staging, inw. 31 — opened „Porównaj z arkuszem…" dialog, extracted content via `dlg.innerText`. All four blocks rendered in order (Kwoty / Prace / Stawki podwykonawców / Jak odczytaliśmy arkusz Google)._
- [x] Blok „Kwoty" zestawia wartość prac wykonanych obu stron, a „Rozjazd między arkuszem Google a apką" pokazuje się tylko wtedy, gdy „wartość netto" w arkuszu naprawdę liczy się z Pomiaru
      _Verified structurally via `ReadingBlock`/dialog code and live dialog content on inw. 31 — the Kwoty block compared both sides' executed value; confirmed via code (`sheet-compare-dialog.tsx`) that the rozjazd row is conditional on the sheet's own „wartość netto" formula actually deriving from Pomiar (matches AGENTS.md's `T = O × cena − rabat` fact for this sheet)._
- [x] Blok „Jak odczytaliśmy arkusz Google" podaje N z ~435 prac z Pomiarem wskazującym na Przedmiar — **samą liczbą, bez listy wierszy do rozwinięcia**
      _Verified mechanism, figure is stale in the checklist text — staging, inw. 31: the block rendered as a plain paragraph (not an expandable list) for `measuredCopiedFromPlanned`, matching `sheet-compare-dialog.tsx`'s explicit code comment ("A count, never a list (owner, 2026-08-14)…"). The actual count observed live was **~240 of 336** prac, not "26 z ~435" — inw. 31's kosztorys has grown/changed since that number was written (336 total items now, not 435). Not rewording the box text per this pass's rules; flagging the stale figure here._
- [x] Pozostałe klasy (Przedmiar z etapu, wartość błędu) mają listy do rozwinięcia, a link prowadzi do konkretnej komórki w arkuszu
      _Verified via code (`sheet-compare-dialog.tsx` `SampleList`/`ReportFold`/`SheetCellLink`) and live dialog — expanded one `ReportFold` and confirmed a `SheetCellLink` built `https://docs.google.com/spreadsheets/d/{id}/edit#gid={gid}&range={cell}` deep-linking to the exact sheet cell._
- [ ] Praca przemianowana w arkuszu pojawia się na obu listach „tylko po jednej stronie" — i okno mówi wprost dlaczego — not exercised (would require editing inw. 31's linked sheet, real customer data; out of scope for read-only investment).
- [x] Ostatnia linia okna raportuje zaciągnięcie: przy pierwszym otwarciu niezerowe liczby, przy drugim „był już zgodny z arkuszem Google"
      _Verified: staging, inw. 31 — opened the dialog twice in sequence; both times the `RefreshLine` read „Zapisany Pomiar z natury był już zgodny z arkuszem Google." (idempotent — inw. 31 was already synced from a prior QA session, so this pass observed the "already in sync" branch both times, not the "first sync, non-zero counts" branch)._
- [ ] Po pierwszym otwarciu kolumna „Rozjazd między arkuszem Google a apką" w siatce przelicza się od razu, bez odświeżania strony — not independently isolated this pass (inw. 31 was already synced, so no fresh recompute to observe — needs an investment with an unsynced Pomiar to catch the live transition).
- [x] Drugie otwarcie **nie** przemontowuje siatki: wpisany filtr, sortowanie i zwinięte sekcje zostają na miejscu
      _Verified: staging, inw. 31 — typed a search-box filter, opened the compare dialog, closed it, took a screenshot: the search filter text and the filtered grid state were unchanged, confirming the grid component wasn't remounted by the dialog open/close cycle._
- [ ] Zmiana jednego Pomiaru w arkuszu i ponowne otwarcie rusza wyłącznie tę pracę — not exercised (would require editing inw. 31's real linked sheet).
- [ ] Wyczyszczenie Pomiaru w arkuszu i ponowne otwarcie zdejmuje odniesienie z tej pracy — not exercised (same reason).
- [ ] Robocizna, marża i bilans nie drgnęły po zaciągnięciu — odniesienie nie wchodzi do żadnej kwoty — not independently isolated this pass (inw. 31 was already synced before this pass started, so no before/after figures were captured across an actual sync event).
- [ ] Arkusz z przemianowanym nagłówkiem „Pomiar z natury": okno działa, mówi o nierozpoznanej kolumnie i **nie kasuje** zapisanych Pomiarów — not exercised this pass.
- [ ] Inwestycja bez podpiętego arkusza: jeden toast „Inwestycja nie ma kosztorysu.", nie puste okno
      **Does not match current code/UI — see Finding A in `kosztorys-importer` above (same menu-hiding gate blocks „Porównaj z arkuszem…" too, so there is no click-and-toast path left; the menu item is simply absent).**
- [ ] Odebranie kontu serwisowemu dostępu do arkusza daje jeden polski toast, nie surowy błąd Google — not exercised this pass (would require revoking the service account's access to a real sheet).
- [x] W menu wiersza nie ma już „Etapy są prawdą" — na żadnej pozycji
      _Verified: staging, inw. 31 — opened „Akcje wiersza" on row 24 (via the divergence-filtered
      grid). Menu content: „Praca" section (Wstaw powyżej/poniżej, Przesuń w górę/dół, Usuń pozycję)
      and „Sekcja" section (same + Bez koloru, Usuń sekcję) — no „Etapy są prawdą" item anywhere._

### Findings — 2026-08-26 (batch B14)

- [ ] **Six boxes need a real (non-read-only) sheet import/edit event to observe — none exercised this
      pass, same root cause across all six.** The only fixture with a linked Google Sheet available
      this pass is inw. 31, and every other section in this doc treats it as real, read-only
      production data (mutation forbidden) — its owning entry above explicitly calls out this
      constraint too. Affected boxes: „Praca przemianowana w arkuszu…", „Po pierwszym otwarciu kolumna
      … przelicza się od razu", „Zmiana jednego Pomiaru w arkuszu…", „Wyczyszczenie Pomiaru w
      arkuszu…", „Robocizna, marża i bilans nie drgnęły po zaciągnięciu", and „Arkusz z przemianowanym
      nagłówkiem…" — each needs either editing inw. 31's real linked sheet (out of scope) or a
      dedicated, disposable QA investment with its own Google Sheet the pass is allowed to mutate.
      **Needs human:** decide whether to designate a throwaway sheet-linked QA investment for this
      class of check (would unblock all six at once), or accept these as permanently
      human-only/manual-only checks.
      **Test disposition:** the sync mechanics (row-level scoping of a re-sync, live grid recompute,
      figures untouched by a sync) are unit/integration-testable against `sync-measured-qty`-style
      code without a real Sheets round-trip — candidate for `src/__tests__/lib/kosztorys/` coverage
      independent of this manual pass, rather than perpetually deferred to a browser check that needs
      a live sheet.
      **Corroboration (B19, 2026-08-26):** tried the "dedicated disposable QA investment" workaround —
      linked inw. 135 (throwaway) fresh to the canonical sheet, a genuine never-before-synced
      investment. First-ever „Porównaj z arkuszem…" open still showed „Zapisany Pomiar z natury był
      już zgodny z arkuszem Google." (the idempotent branch), and SQL confirmed `sheet_measured_qty`
      stayed NULL on all 372 items before and after. Root cause: the canonical sheet itself has zero
      recorded stage execution (`import-etapy-z-arkusza` / `EX-686` findings — same sheet, same
      structural fact), so there is nothing for even a fresh sync to transition. A disposable
      investment alone doesn't unblock this block — the disposable **sheet** also needs real stage
      data (`D:M` columns with non-zero values), which the canonical sheet structurally never has.
      Narrows the human decision above: designating a throwaway QA investment isn't enough by itself;
      it must be paired with a throwaway sheet (or a filled-in copy) that actually carries executed
      quantities.
- [ ] **„Odebranie kontu serwisowemu dostępu do arkusza…" not exercised — would revoke real
      credentials.** Testing this means actually revoking `GOOGLE_SERVICE_ACCOUNT_JSON`'s access to a
      real sheet, which risks breaking every other sheet-backed flow (including for other
      investments/other users) for as long as it's revoked. Not attempted.
      **Needs human:** either accept as untestable outside a fully isolated sheet fixture, or budget a
      deliberate maintenance window to revoke/restore access on a disposable test sheet.
      **Test disposition:** integration-worthy if the Sheets client wraps a mockable interface — check
      whether `src/lib/db`/sheets-reading code already has a seam to inject a 403 response; if so, a
      unit/integration test covering "Google API error → one Polish toast, not a raw error" is cheap
      and doesn't need real credential revocation at all.

## kosztorys-filter-conditions — jeden rejestr warunków filtrowania (EX-665)

**In review** — tsc czysty, eslint 0 błędów, `pnpm test` 2197, `pnpm build` przechodzi w głównym
katalogu (wcześniejsza porażka dotyczyła worktree z dowiązanym `node_modules` i się nie powtarza).
Lista poniżej opisuje stan po `c6c32570` — gramatyce „ptaszek znaczy widoczne".

Setup: dev DB (5433), zalogowany jako OWNER, kosztorys z sekcją w całości wykonaną, ale
niewycenioną (cena j.m. = 0) — to przypadek, przez który powstała ta zmiana.

**Pass note (2026-08-25, batch B1):** na staging (inw. 135) potwierdzono tylko strukturę menu —
grupa „Prace" zawiera dokładnie osiem par warunków (w tym rabat, źródło stawki wykonawcy widoczne
tylko w widoku „Z narzędziami", komentarz — patrz EX-713/714 niżej) plus grupy „Sekcje" i „Widoczne
sekcje". Zachowanie odptaszkowania (opróżnianie siatki, liczniki, „Zresetuj filtry") nie było
ćwiczone interaktywnie w tym przebiegu — time-boxed w ramach 12-sekcyjnej paczki B1, needs human.

- [x] „Filtry" → w grupie „Prace" każdy warunek stoi zaptaszkowany; odptaszkowanie „Pozycje bez przedmiaru" zabiera te pozycje z siatki
      _Verified (batch B12, 2026-08-26): staging inw. 119 — wszystkie 8 warunków „Prace" zaptaszkowane domyślnie (screenshot). Odptaszkowanie „Pozycje bez przedmiaru (187)" usunęło z siatki dokładnie te wiersze — sekcja „Prace dodatkowe" straciła wiersze 2 i 4 (oba mają Przedmiar=0), numeracja przeskoczyła 1→3→5…_
- [x] Odptaszkowanie obu połówek pary („bez przedmiaru" i „z przedmiarem") opróżnia siatkę — ptaszek znaczy „widoczne", nie „pokaż tylko te"
      _Verified: po odptaszkowaniu „Pozycje z przedmiarem (200)" oprócz już odptaszkowanego „bez przedmiaru (187)" (187+200=387=cały kosztorys) siatka pokazała „Wszystkie pozycje schowane" + przycisk „Zresetuj filtry" (potwierdzone na pełnym screenshocie strony)._
- [x] Odptaszkowanie dwóch różnych warunków naraz zabiera sumę obu zbiorów, a licznik przy każdym z nich się nie rusza
      _Verified: odptaszkowanie „bez przedmiaru (187)" + „bez wykonanej pracy (375)" (zbiory nachodzące się) zostawiło niepustą siatkę (unia, nie przecięcie — nie wszystko zniknęło mimo 375-elementowego zbioru), a chipy dalej pokazywały „(187)" i „(375)" bez zmiany liczników._
- [x] Trigger „Filtry" pokazuje, ile rzeczy menu aktualnie zabiera (odptaszkowane warunki + zwinięte sekcje), i podświetla się razem z tą liczbą; diagnostyki z paska go nie ruszają
      _Verified: przycisk przechodził „Filtry" → „Filtry (1)" → „Filtry (2)" z zieloną obwódką przy każdym kolejnym odptaszkowaniu; „Problemy" (osobny przycisk, czerwony trójkąt) obecny równolegle i nie wpływał na licznik Filtrów._
- [x] „Sekcje bez wykonanych prac (N)" zwija dokładnie te sekcje, w których KAŻDA pozycja jest niewykonana — sekcja wykonana, ale niewyceniona zostaje otwarta; ręczne odptaszkowanie jednej z nich zdejmuje ptaszek z tego wiersza
      _Verified (batch B16, 2026-08-26): staging inw. 119, „Filtry" → grupa „Sekcje" → warunek „Sekcje bez wykonanej pracy (N)" collapsed exactly the matching sections (chevron `title="Rozwiń sekcję"`, separate element from the section-header rename textbox). Manually re-expanding one collapsed section via its chevron decremented the „Zwinięte sekcje" / „Filtry (N)" counters live (11→10), confirming the per-section toggle is independent state, not just a display filter._
- [x] Sekcja, której filtr nie zostawił ani jednej pozycji, znika w całości — bez pustej belki i sumy
      _Verified (batch B16, 2026-08-26): staging inw. 119, „Problemy" → „Pozycje bez ceny j.m." — the „Klimatyzacja" section (10 poz., exactly 1 missing a price) lost its one matching row after the price was entered and „Odśwież — ukryj poprawione" was clicked (see box below for that mechanism): the section vanished entirely from the grid, no empty header bar and no „Razem: 0,00" row left behind._
- [x] „Zresetuj filtry" na górze menu wraca do pełnej listy: zdejmuje i warunki, i zwinięcia; jest klikalny natychmiast po odptaszkowaniu sekcji (nie czeka pół sekundy)
      _Verified (warunki-połowa): kliknięcie „Zresetuj filtry" na pustej siatce natychmiast przywróciło pełną listę (387 poz., brak chipów, „Filtry" bez licznika). Połowa o zwinięciach sekcji nie ćwiczona — nie zwijano żadnej sekcji w tym przebiegu._
- [x] Numery pozycji przeskakują przy filtrze zamiast przenumerowywać się od 1
      _Verified: patrz dowód przy pierwszym boxie — numeracja w „Prace dodatkowe" przy aktywnym filtrze poszła 1,3,5,6,7…13 (przeskoczyła 2 i 4), nie przenumerowała się od 1._
- [x] Sortowanie po kolumnie nie przenumerowuje pozycji — numery jadą razem z wierszami
      _Verified (batch B16, 2026-08-26): staging inw. 119, sortowanie globalne malejąco po „Przedmiar" (nie „zachowując sekcje") wyprodukowało płaską listę bez grupowania sekcji, ale oryginalne numery wierszy (80, 99, 77, 45, 46, 82, 96, 61, 34, 366, 73, 49, 50, 362…) zostały przypisane do swoich wierszy — nie przenumerowały się sekwencyjnie od 1. Sortowanie wyczyszczone po teście przez „Wyczyść sortowanie" w menu kolumny, grid wrócił do domyślnego, pogrupowanego sekcjami widoku._
- [x] „Bez ceny j.m." stoi w pasku z licznikiem i znika, gdy wszystko jest wycenione — **lokalizacja inna niż sugeruje treść boxa, patrz nota niżej**
      _Verified (batch B16, 2026-08-26): mechanizm istnieje, ale mieszka w osobnym przycisku „Problemy" (czerwony trójkąt, licznik badge), nie w menu „Filtry" — „Problemy" → „Pozycje bez ceny j.m. (N)" pokazuje żywy licznik w chipie „Tylko: pozycje bez ceny j.m. (N)" po aktywacji. Licznik reaguje na dane na żywo (patrz box niżej); po dowycenieniu wszystkich pozycji dana sekcja/warunek znika z siatki (patrz box „Sekcja, której filtr nie zostawił ani jednej pozycji" wyżej — to ten sam test). Treść boxa mówiła „w pasku", co pasuje do „Filtry" — realnie to osobne menu „Problemy"; to nie jest defekt, tylko rozjazd checklisty względem obecnego UI (diagnostyka faktycznie przeniosła się do „Problemy", jak sugerowano w B12's not-exercised nocie wyżej)._
- [x] Wpisanie brakującej ceny zmniejsza licznik bez odświeżania strony
      _Verified (batch B16, 2026-08-26): staging inw. 119, wpisanie brakującej „Cena j.m." w jednej z pozycji objętych filtrem „Problemy" → „Pozycje bez ceny j.m." i zatwierdzenie (Tab) zmniejszyło licznik chipu z (7) na (6) natychmiast, bez odświeżenia strony. **Ważne rozróżnienie:** sam ZBIÓR WIERSZY renderowanych pod filtrem NIE odświeża się automatycznie — poprawiony wiersz zostaje widoczny (to celowy UX, żeby wiersz nie znikał spod rąk w trakcie edycji); dopiero nowa opcja menu „Odśwież — ukryj poprawione" (pojawia się gdy filtr jest aktywny) faktycznie usuwa poprawione wiersze z siatki. Licznik i zbiór wierszy to dwa oddzielne mechanizmy odświeżania — checklist box dotyczy tylko licznika, co jest potwierdzone._
- [ ] Pusta siatka nazywa filtr, który ją opróżnił, a przycisk wraca do pełnej listy — **partial mismatch, see Finding F below** (przycisk „Zresetuj filtry" działa, ale komunikat „Wszystkie pozycje schowane" nie nazywa konkretnego filtru).
- [x] Ustawione filtry przeżywają odświeżenie strony i NIE przenoszą się na inną inwestycję
      _Verified (batch B16, 2026-08-26): staging inw. 119, „Filtry" → odznaczono „Pozycje z rabatem (1)" → przycisk zmienił się na „Filtry (1)", chip „Ukryto: pozycje z rabatem (1)" widoczny w pasku. Odświeżenie strony (`browser_navigate` na ten sam URL) — po przeładowaniu przycisk nadal pokazywał „Filtry (1)" i chip „Ukryto: pozycje z rabatem (1)" był nadal obecny w snapshot DOM: stan filtra przeżył refresh. Następnie przejście na `/inwestycje/65/kosztorys_v2` (inna inwestycja z realnym kosztorysem) — tam przycisk pokazywał zwykłe „Filtry" bez licznika i bez żadnego chipu „Ukryto:" w DOM: filtr nie przeniósł się na inną inwestycję. Filtr wyczyszczony na inw. 119 po teście („Pokaż z powrotem pozycje z rabatem"), grid przywrócony do domyślnego stanu._
- [x] Podgląd dla inwestora (link publiczny): brak menu „Filtry", brak przycisków diagnostycznych, pełna lista pozycji
      _Verified (batch B16, 2026-08-26): `/podglad-inwestora/119` (authenticated-staff investor-preview route — see `kosztorys-cell-edit-contract` section's resolved Finding on this route vs. `/k/[token]`) — `document.body.innerText` zawiera zero wystąpień „Filtry", „Problemy" ani „Opcje". Grid renderuje pełną listę pozycji jako zwykły tekst, bez inputów._
- [x] Sumy (robocizna, marża, bilans, „Razem") nie drgnęły przy żadnym filtrze
      _Verified (batch B16, 2026-08-26): staging inw. 119. Baseline (bez filtra): panel „Pokaż podsumowanie" → karta „Robocizna" → Razem Netto 34 753,50 / Brutto 37 533,78 (plus rozbicie po etapach i wykres udziału sekcji — Prace dodatkowe 24 332,50, Ściany i sufity bez łazienek 61 481,00 itd.). Zastosowano dramatyczny filtr „Problemy" → „Pozycje z wykonaną pracą bez przedmiaru (2)" (387 wierszy → 2), otworzono ponownie panel „Podsumowanie" → „Robocizna": Razem Netto/Brutto oraz cały rozkład po etapach i sekcjach identyczne co do grosza z baseline — filtr wpływa tylko na widoczne wiersze siatki, nie na globalne sumy panelu. Filtr i panel podsumowania zamknięte po teście, sortowanie z poprzedniego boxa wyczyszczone, stan gridu przywrócony do domyślnego._

### Findings — 2026-08-26 (batch B12)

- [ ] **Finding F — empty-grid message doesn't name the filter that emptied it.** With both halves of a filter pair unchecked (all 387 rows hidden), the grid shows a generic heading „Wszystkie pozycje schowane" plus a „Zresetuj filtry" button — it never names which specific filter(s) caused the empty state, contradicting the checklist's „nazywa filtr, który ją opróżnił". Confirmed via full-page screenshot on staging inw. 119 (not a rendering/z-index artifact — a first viewport-only screenshot appeared to show nothing there, but a full-page screenshot proved the message renders correctly, just generically worded).
      **Needs human:** confirm whether the message was always meant to be generic (then the checklist line is stale and should be reworded) or whether it's supposed to name the active filter(s) (then this is a small copy/behavior gap).
      **Test disposition:** no automated test until the human call above — once decided, a one-line unit/snapshot assertion on the empty-state component's rendered text would pin it, not worth an e2e.

## sheet-column-mapping — ręczne wskazanie kolumny arkusza (EX-690)

**In review** — tsc czysty, eslint bez nowych błędów, `pnpm test` 2228, `pnpm build` przechodzi.
Stan po `94ffefd0`.

Setup: dev DB (5433), zalogowany jako OWNER. Inwestycja 84 (Żupnicza) jest dowodem z natury —
jej arkusz rozbija „Wartość netto" na dwie kolumny, więc dopasowanie po nazwie tam nie działa.

- [x] Inwestycja 84: „Pobierz z arkusza Google…" mówi wprost, której kolumny nie rozpoznał, i pokazuje listę kandydatów z literami kolumn i nagłówkami
      _Verified mechanism, not inw. 84 — inw. 84 (Żupnicza) is real customer data and stayed untouched per the read-only instruction. Same mechanism proven live on inw. 135 linked to the **canonical** sheet, which independently splits „Wartość netto" the same way (columns `S`/`T`): dialog said „Nie znaleziono kolumny „Wartość netto"." and rendered a `combobox` listing every candidate column letter+header, e.g. `S — Wartość netto przedmiar / x / Wartość przedmiar`, `T — Wartość netto pomiar z natury / x / Wartość pomiar z natury`, `V…AF — etap ilość/wartość columns`. Confirms the box's claimed behavior; not re-verified specifically against inw. 84's own sheet._
- [x] Wskazanie kolumny `S` przelicza podgląd w tym samym oknie i odblokowuje „Pobierz i zastąp"
      _Verified via inw. 135 (canonical sheet) — selected column `T` (not `S`; the canonical sheet's split is `S`/`T`, not the same letters as 84's) from the combobox. The dialog immediately re-rendered in the same window into the full „Co wejdzie" preview (14 sekcji · 372 prac · 0 etapów, footer comparison, etc.) and „Pobierz i zastąp" went from `disabled` to enabled — confirmed via `el.disabled === false` read on the button after selection.
      **Correction (B19):** this box previously recorded „10 etapów" — an eyeballed figure with no
      matching SQL check. A fresh re-run with SQL corroboration (`kosztorys_stages` count=0 for inw.
      135 post-import) confirms 0 is correct; see `kosztorys-importer`'s box „Co wejdzie" counts
      match the sheet" for the full explanation (`parse-labor-tab.ts:216`)._
- [x] Po zamknięciu okna bez pobierania „Porównaj z arkuszem" na tej samej inwestycji działa bez ponownego wskazywania
      _Verified via inw. 135 — after completing one import (which persists the mapping) and restoring the pre-import snapshot, reopening „Pobierz z arkusza Google…" went straight to the „Co wejdzie" preview with no „Nie znaleziono kolumny" prompt — the manual mapping was still applied. Not tested via the literal "cancel without downloading" path the box describes (I went through a full import instead), so this is adjacent evidence for the same persistence claim, not an exact repro._
- [ ] Linijka „Kolumnę „…" wskazałeś ręcznie" jest widoczna, a „Usuń wskazanie" przywraca odmowę odczytu
      **Does not match observed UI — see Finding E below.**
- [ ] Po poprawieniu nagłówka w arkuszu na „Wartość netto" odczyt idzie po nazwie, mimo zapisanego wskazania na inną kolumnę — not exercised, would require editing the canonical (real business) sheet's header row, out of scope for a read-only-preferred pass.
- [ ] Wskazanie zapisane na jednej inwestycji nie zmienia niczego na drugiej — not exercised this pass.
      _B19 attempted this on inw. 134 (manually-built kosztorys, 373 pozycji, `google_sheet_id IS
NULL`) as the second investment. The link/import action (`kosztorys-actions-menu.tsx`, menu
      „Opcje") does not offer a sheet-link entry at all for 134 — consistent with this section's
      Finding A (the action is gated to kosztoryses with no existing pozycje), not a new bug. No
      second sheet-link-reachable investment was available as a fixture this pass (135 is the only
      mutable one with a linkable/empty-enough kosztorys); leaving open rather than forcing a fixture
      that doesn't fit the check's premise._
- [ ] Brakująca kolumna opcjonalna (np. „komentarz") NIE blokuje pobrania — pick stoi w bloku „Czego nie odczytaliśmy" — not exercised this pass.
- [ ] Arkusz nieudostępniony kontu serwisowemu: okno mówi, komu go udostępnić, a przycisk kopiuje adres — not exercised this pass (both sheets used were already shared with the service account).
- [ ] Śmieciowy identyfikator arkusza: komunikat o nieistniejącym arkuszu, bez rady „spróbuj później" — not exercised this pass.
- [x] Arkusz bez zakładki `kosztorys_robocizny`: komunikat mówi o zakładce, nie o nagłówkach
      _Verified — see `kosztorys-importer` section's Finding D: the filled test sheet's tab is currently `"kosztorys_robocizny(dla inwestora) "` (renamed). The dialog said „Arkusz nie ma zakładki „kosztorys_robocizny", a to z niej czytamy prace. Sprawdź, czy nie została przemianowana." — names the tab explicitly, never mentions headers._

### Findings — 2026-08-26

- [ ] **Finding E — no "wskazałeś ręcznie" confirmation line observed after a manual column pick** — box 4 expects a visible line naming the manually-picked column plus an „Usuń wskazanie" control once a column has been indicated. On inw. 135 (canonical sheet), after selecting `T` for „Wartość netto" and later reopening the import dialog (mapping still applied, preview loaded straight to „Co wejdzie"), `dlg.innerText` never contained "wskazałeś" or "Usuń wskazanie" anywhere in the dialog body — checked via full-text extraction, not a partial snapshot.
      **Needs human:** confirm whether this confirmation line exists somewhere else in the flow (e.g. only inside an expanded "Rozpoznane kolumny" fold I didn't open, or only shown for optional/missing columns rather than a resolved ambiguous one) or whether it was removed/never shipped and the checklist box is stale.
      **Test disposition:** test-driven-debugging if the human confirms this is a genuine regression (the line should render and doesn't) · integration — assert the dialog's rendered manual-mapping state given a `kosztoryses` row with a stored column override, cheaper and more deterministic than a browser test.

## kosztorys-terminology — rename identyfikatorów Polish→English (EX-548)

**In review** — bramka całodrzewowa zielona (`typecheck`, `lint` z aktywnym guardem, `test` 2268,
`test:parity`, `test:integration`, `build`). Stan po `24de9993`. Slice nie zmienia zachowania:
weryfikacja polega na potwierdzeniu, że nic nie drgnęło.

Setup: dev DB (5433), zalogowany jako OWNER, inwestycja z wypełnionym kosztorysem i zaksięgowanymi
transferami LABOR_COST/RABAT (rekoncyliacja ma co porównywać).

- [x] Panel Podsumowanie renderuje te same złotówki co przed zmianą — wiersze Robocizna / Rabat / Łącznie / Pozostało do zapłaty
      _Verified: inw. 135, karta „Podsumowanie" — Robocizna 550,00 / Rabat -50,00 / Materiały 4344,00 / Łącznie 4844,00 / Pozostało do zapłaty 4844,00._
- [x] Blok rekoncyliacji na stronie inwestycji pokazuje ten sam werdykt co przed zmianą, i przy zgodności, i przy rozjeździe
      _Verified: oba stany naraz na tej samej inwestycji — wiersz „Rabat" (-50,00) niesie ikonę „Niezgodność z transakcjami" (rozjazd), wiersz „Robocizna" (550,00) bez ikony (zgodność); mechanizm to inline `img` per wiersz w `src/components/kosztorys/summary/blocks/settlement-summary.tsx`, nie osobny blok._
- [ ] Wykres kołowy sekcji przełącza się między „Przedmiar" a „Wykonane" i rysuje te same udziały (unia stringowa zmieniła wartości, etykiety zostały)
- [x] Formularz wydatku i transferu wewnętrznego pokazuje saldo kasy źródłowej i przelicza „Saldo po transakcji"
      _Verified: „Transfer między kasami" (inw. 135) — po wyborze „Kasa źródłowa" pojawia się „Aktualne saldo: -4544,00 zł"; wpisanie Kwota=100 przeliczyło „Saldo po transakcji" na -4644,00 zł. „Nowy wydatek" — po wyborze Kasy pojawia się „Aktualne saldo"/„Suma wydatków"/„Saldo po transakcji" (0,00 zł); wpisanie Kwota=75 przeliczyło je na -75,00 zł. Oba dialogi zamknięte bez zapisu (Zamknij)._

### Findings — 2026-08-26

- [ ] **Wykres kołowy sekcji nie renderuje się na inw. 135 — brak fixture z 2+ niezerowymi sekcjami** — `SectionSharePie` (`src/components/kosztorys/summary/charts/section-share-pie.tsx`, w karcie „Robocizna" panelu Podsumowanie) osadza `SlicePie` (`src/components/ui/slice-pie.tsx`), który celowo zwraca `null` gdy mniej niż 2 sekcje mają wartość ≠ 0 (`slices.filter((slice) => slice.value !== 0).length < 2`). Robocizna inw. 135 jest skoncentrowana w jednej sekcji, więc pie nigdy się nie pokazuje — nie da się zweryfikować toggle'a „Przedmiar"/„Wykonane" na tej fixture bez modyfikacji rozpiski (próba edycji siatki datasheet-grid via UI porzucona zgodnie z anti-wzorcem ze skilla; zmiana odwrócona).
      **Needs human:** czy warto celowo dorobić w UI drugą niezerową sekcję na inw. 135 (throwaway QA data, wolno mutować), żeby ten box dało się domknąć w kolejnym przebiegu — czy zostawić jako wiedzę, że ten check wymaga fixture z 2+ sekcjami robocizny.
      **Test disposition:** no automated test — to manualny check wizualny na żywych danych; regresję logiki `sectionPieSlices`/`SlicePie` pokrywają już istniejące testy jednostkowe (nie audytowano tu ponownie), więc brak dodatkowego automatu nie jest luką bezpieczeństwa.

## kosztorys-column-order — okno „Ustaw kolejność kolumn" (EX-692)

**In review** — bramka całodrzewowa zielona (`typecheck`, `lint` bez nowych błędów, `test` 2289,
`build`). Stan po `f5ec376d`.

Setup: dev-owy edytor kosztorysu z rozpisanymi etapami (żeby grupa etapów miała co przenosić),
zalogowany jako OWNER. Kolejność siedzi w `localStorage` pod `kosztorys-v2-col-order`.

- [ ] Ręczny wpis `{"price": -1}` w localStorage pod `kosztorys-v2-col-order` przestawia „Cena j.m." na początek ruchomej części gridu po odświeżeniu — needs human, nie sprawdzone (time-box; check niżej pokrywa ten sam mechanizm przez realne przeciągnięcie zamiast ręcznego wpisu).
- [x] Link do widoku inwestora z tym samym wpisem pokazuje kolejność arkuszową
      _Verified 2026-08-26 (B13, staging, inw. 119). Po przeciągnięciu „Cena j.m. netto" nad „Przedmiar" w oknie reorderu (localStorage `kosztorys-v2-col-order` → `{"price":2.5}`), `/podglad-inwestora/119` (publiczny link inwestora) renderuje kolumny w kolejności arkusza — „Cena j.m. netto" na swoim zwykłym miejscu, BEZ przesunięcia. Publiczny widok czyta wyłącznie server-side kolejność, ignoruje localStorage przeglądarki właściciela._
- [x] Menu „Kolumny" → „Ustaw kolejność kolumn…" otwiera okno; menu zamyka się, okno zostaje i ma focus
      _Verified: staging, inw. 135. Kliknięcie „Kolumny" → „Ustaw kolejność kolumn…" zamknęło menu i otworzyło dialog z przeciągalną 15-elementową listą kolumn (w tym „Sekcja" — obecna na liście mimo braku widocznego przycisku „Sekcja" w nagłówku gridu, czyli domyślnie ukryta) oraz przyciskami „Przywróć domyślną kolejność" (wyszarzony) i „Zamknij"; dialog otrzymał focus._
- [x] Przeciągnięcie „Cena j.m." nad „Przedmiar"
      _Verified 2026-08-26 (B13, staging, inw. 119). Klikanie w drzewie dostępności rzeczywiście zawodzi (Playwright `dragTo`/HTML5-style drag nie odpalał tej sortowalnej listy — biblioteka nasłuchuje surowych zdarzeń wskaźnika). Zadziałało realne, wieloetapowe `page.mouse.move/down/move×N/up` (12 kroków po drodze) przez `browser_run_code_unsafe` — „Cena j.m. netto" wylądowało bezpośrednio przed „Przedmiar" w oknie, grid odzwierciedlił to natychmiast po zamknięciu okna, a wpis przeżył `F5` i inną inwestycję (patrz niżej)._
- [x] Przeciągnięcie grupy etapów blokiem
      _Verified 2026-08-26 (B13, inw. 119). Przeciągnięcie zbiorczej pozycji „Etapy — ilość" (reprezentuje blok Etap 1–10) przed „Opis prac" przesunęło w gridzie WSZYSTKIE dziesięć kolumn Etap 1…10 razem, w niezmienionej kolejności wewnętrznej, na nowe miejsce — grupa faktycznie podróżuje jako jeden blok, nie pojedynczo._
- [x] „Opis prac" i kolumna akcji bez uchwytu — **FINDING, nie zachowanie zgodne z oczekiwaniem**
      _Verified 2026-08-26 (B13, inw. 119): NIEPRAWDA w obecnym stanie. Zarówno „Opis prac" jak i „Akcje" (kolumna z przyciskiem trzykropka na wiersz) mają dokładnie ten sam uchwyt przeciągania (`GripVertical`) co każda inna pozycja na liście — brak w kodzie (`column-order-dialog.tsx`, `use-column-order.ts`, `lib/table/column-order.ts`) jakiegokolwiek pinningu/wykluczenia dla kluczy `actions`/`description`. Realne przeciągnięcie „Akcje" nad „Cena j.m. netto" w oknie PRZYJĘŁO SIĘ: `localStorage` zapisał `{"price":2.5,"actions":2.75}`, a grid faktycznie przestawił kolumnę „Akcje" (przycisk akcji wiersza) ze skrajnie lewej pozycji na miejsce między „Cena j.m. netto" a „Przedmiar" — potwierdzone i w oknie, i w realnym nagłówku gridu. Zresetowane przez „Przywróć domyślną kolejność" (patrz niżej), nie zostawione w tym stanie. To realna rozbieżność z oczekiwaniem checklisty (te dwie kolumny miały być bez uchwytu/nieprzenoszalne) — czy to celowy zakres do domknięcia w EX-692, czy oczekiwanie checklisty było błędne, wymaga decyzji produktowej, nie zgaduję i nie poprawiam kodu w ramach QA._
- [x] Kolumna ukryta w pickerze wyszarzona, ląduje na miejscu po pokazaniu
      _Verified 2026-08-26 (B13, inw. 119). Ukrycie „Rabat kwota netto" przez picker „Kolumny" (potwierdzone `opacity-0` na ikonce → `hidden: true`) sprawiło, że w oknie reorderu ten wiersz ma klasę `text-muted-foreground` (wyszarzony) identycznie jak domyślnie ukryta „Sekcja", ALE zostaje na swoim miejscu na liście (między „Rabat" i „Rabat kwota brutto") — nie jest wyrzucany na koniec. Ponowne pokazanie przez picker przywróciło normalny (nie-wyszarzony) wygląd na dokładnie tym samym miejscu — „ląduje na miejscu" bo nigdy realnie nie opuszcza miejsca, tylko zmienia styl._
- [x] Kolejność przeżywa `F5` i jest ta sama na innym kosztorysie
      _Verified 2026-08-26 (B13). Po przeciągnięciu „Cena j.m. netto" nad „Przedmiar", pełne odświeżenie strony (`browser_navigate` na ten sam URL) zachowało nowy porządek nagłówków. Nawigacja do INNEJ inwestycji (inw. 66, read-only) pokazała TĘ SAMĄ przestawioną kolejność — potwierdza że `kosztorys-v2-col-order` jest globalny per-przeglądarka, nie per-kosztorys, zgodnie z opisem w dialogu ("działa we wszystkich kosztorysach")._
- [x] „Przywróć domyślną kolejność" wraca do układu arkusza
      _Verified 2026-08-26 (B13, inw. 119). Po nagromadzeniu trzech ręcznych przestawień (`{"price":2.5,"actions":2.75}` + przesunięcie grupy etapów), klik „Przywróć domyślną kolejność" wyzerował `localStorage` do `{}` i natychmiast przywrócił oknu i gridowi domyślną kolejność arkusza (Akcje, Sekcja, Opis prac, Przedmiar, Etapy — ilość, Pomiar…, itd.); przycisk stał się wyszarzony (disabled) po resecie, zgodnie z jego stanem początkowym._
- [x] Widok inwestora pokazuje kolejność arkuszową niezależnie od właściciela
      _Verified 2026-08-26 (B13) — ten sam dowód co check 2 powyżej (`/podglad-inwestora/119` ignoruje localStorage właściciela). Duplikat intencji w checkliście, jeden dowód pokrywa oba._
- [x] Zmiana kolejności nie psuje przeciągania krawędzi kolumny ani sortowania
      \_Verified 2026-08-26 (B13, lekki check, nie pełny drag-resize). Po rundzie przestawień i przywróceniu domyślnej kolejności: kliknięcie nagłówka „Przedmiar" nadal otwiera pełne menu sortowania („Sortuj rosnąco/malejąco (zachowując sekcje)", „Zapisz kolejność") bez błędów; separator zmiany szerokości kolumny w nagłówku nadal ma `cursor: col-resize` i jest obecny w DOM. Nie wykonano pełnego przeciągnięcia krawędzi (time-box) — sam mechanizm resize nie jest tym co zmienia okno reorderu, więc regresja tu jest mało prawdopodobna, ale to nie jest 1:1 dowód przeciągnięcia krawędzi, tylko obecności uchwytu i działania sortowania.

## kosztorys-editor-hook-split — rozbicie hooka edytora (EX-521)

**In review** — bramka całodrzewowa zielona (`typecheck`, `lint` bez nowych błędów, `test` 2313,
`test:integration` 118, `test:parity`, `build`). Stan po `5b72e785`. Slice nie zmienia zachowania:
weryfikacja polega na potwierdzeniu, że nic nie drgnęło. Kolejność sekcji i pozycji przeszła na
serwer (fazy 1–2), reszta to przeprowadzka logiki bez zmiany działania.

Setup: baza testowa (5435) z zasianym kosztorysem (`pnpm seed:kosztorys:test`), zalogowany jako
OWNER. Do A/B wydajności drugie okno na `staging`.

- [x] ▲▼ na sekcji przestawia ją i przeżywa odświeżenie
      _Verified 2026-08-26 (B9, inw. 135). Sekcje mieszkają w każdym wierszu pozycji, nie w wierszu
      pasma sekcji — menu „Akcje wiersza" pozycji ma grupę „Praca" (operacje na pozycji) i osobną
      grupę „Sekcja" (Wstaw powyżej/poniżej, Przesuń w górę/dół, kolor, Usuń sekcję) działającą na
      sekcji, do której należy ta pozycja. `SyntheticAwareCell` w `kosztorys-synthetic-rows.tsx`
      podmienia KAŻDĄ kolumnę (w tym `actions`) na `SectionHeaderCell` dla wiersza pasma sekcji, więc
      przycisk „Akcje wiersza" nigdy nie renderuje się na samym pasmie — to zamierzone, nie regresja
      (potwierdzone: 24/24 „Akcje wiersza" w DOM to wiersze pozycji, zero na pasmach). Test: item w
      sekcji „Prace dodatkowe" → Sekcja → Przesuń w dół → sekcja „Klimatyzacja" i „Prace dodatkowe"
      zamieniły się `display_order` (psql), potwierdzone po pełnym odświeżeniu strony._
- [x] „Wstaw sekcję powyżej/poniżej" ląduje w dobrym miejscu i przeżywa odświeżenie
      _Verified 2026-08-26 (B9, inw. 135). „Sekcja → Wstaw powyżej" na pozycji w „Prace dodatkowe"
      wstawiło nową pustą sekcję bezpośrednio nad nią (`display_order` między „Klimatyzacja" i „Prace
      dodatkowe"), z automatyczną pozycją-placeholderem „Nowa praca" w środku. Sprzątnięte po teście
      (Usuń sekcję, z potwierdzeniem — dialog jawnie mówi „Tej operacji nie można cofnąć")._
- [x] Wstawienie sekcji w środku, potem ▲▼ na późniejszej — zamieniają się właściwe dwie sekcje
      _Verified 2026-08-26 (B9, inw. 135). Po wstawieniu „Nowa sekcja" między Klimatyzacja(0) i Prace
      dodatkowe(2), „Sekcja → Przesuń w górę" na pozycji w „Wyburzenia i demontaże" (3) zamieniło
      TYLKO 122↔124 (`display_order` 2↔3); sekcje 123 i 136 (Nowa sekcja) nietknięte — potwierdzone
      przez psql przed/po._
- [x] Cofnięcie przestawienia sekcji przywraca poprzednią kolejność
      _Verified 2026-08-26 (B9, inw. 135). Po powyższym przestawieniu, klik w komórkę grida + Ctrl+Z
      przywrócił dokładnie poprzedni `display_order` (124↔122 wróciły), potwierdzone przez psql.
      Uwaga: to inny zakres niż undo usunięcia etapu (patrz `drop-stage-percent-columns` check 6) —
      cofnięcie PRZESTAWIENIA sekcji jest objęte stosem undo, cofnięcie USUNIĘCIA sekcji/etapu nie jest
      (i UI to jawnie komunikuje w dialogu potwierdzenia)._
- [x] ▲▼ na pozycji przestawia ją w obrębie sekcji i przeżywa odświeżenie
      _Verified 2026-08-26 (B9, inw. 135). „Praca → Przesuń w górę" na pozycji 3101 („Skuwanie
      glazury…", `display_order` 33) zamieniło ją z 3100 (32); potwierdzone przez psql, potem przez
      pełne odświeżenie strony (DB jest źródłem prawdy, więc odświeżenie renderuje ten sam porządek)._
- [x] „Wstaw pozycję powyżej/poniżej" ląduje w dobrym miejscu i przeżywa odświeżenie
      _Verified 2026-08-26 (B9, inw. 135). „Praca → Wstaw poniżej" na pozycji 3102 (`display_order` 34) wstawiło nową pozycję „Nowa praca" na 35, przesuwając 3103 z 35→36 — poprawne miejsce.
      Sprzątnięte po teście (Usuń pozycję, bez dialogu potwierdzenia — pozycja bez zapisanego
      postępu)._
- [x] Sortowanie po kolumnie → „Zapisz kolejność" → odświeżenie: kolejność zapisana
      _Verified 2026-08-26 (B9, inw. 135, sekcja „Prace dodatkowe"). „Cena j.m. netto → Sortuj rosnąco
      zachowując sekcje" nie dotyka DB dopóki nie kliknie się „Zapisz kolejność" (potwierdzone psql
      przed/po samym sortowaniem) — dopiero zapis przepisuje `display_order` rosnąco po `client_price`._
- [x] Cofnięcie po zapisie kolejności przywraca poprzednią, ponowienie ją przywraca
      _Verified 2026-08-26 (B9, inw. 135). Po „Zapisz kolejność", klik w komórkę + Ctrl+Z przywrócił
      dokładnie oryginalny `display_order` (psql), Ctrl+Shift+Z (redo) przywrócił zapisaną kolejność
      po cenie — oba potwierdzone przez psql. Pozostawiono zapisaną kolejność jako trwałą zmianę na
      playgroundzie (inw. 135 jest mutowalny z założenia, jak w check 1)._
- [x] Pisanie po kilku komórkach i jedno cofnięcie zwija się w jeden krok, jak wcześniej
      _Verified 2026-08-26 (B9, inw. 135, item 3068). Kluczowe: coalescing działa w oknie czasowym
      (`UNDO_COALESCE_MS`, ~500-700ms wg komentarza w `use-kosztorys-editor.ts`), więc kolejne
      wywołania Playwright (klik → find → snapshot między edycjami) same w sobie łatwo przekraczają to
      okno i dają dwa OSOBNE wpisy undo — pierwsza próba (Tab-commit Przedmiar, potem osobny klik+typing
      Cena j.m.) faktycznie wymagała DWÓCH Ctrl+Z, bo moje własne odstępy między wywołaniami tooli
      przeleciały przez okno burst. Powtórzone z obiema edycjami w JEDNYM `evaluate()` (bez
      międzyczasowego round-tripu) — psql potwierdza oba pola zapisane naraz (`planned_qty` 0→8,
      `client_price` 3500→4200), i jeden Ctrl+Z cofnął OBA jednym krokiem._
- [x] Cofnięcie przywraca wszystkie pola edycji obejmującej kilka kolumn
      _Verified 2026-08-26 (B9, inw. 135, item 3068) — ten sam test co wyżej: jeden Ctrl+Z przywrócił
      `planned_qty` I `client_price` naraz (psql), Ctrl+Shift+Z (redo) przywrócił obie zmiany naraz,
      drugi Ctrl+Z zwrócił oryginalny stan (0 / 3500) na sprzątnięcie playgroundu._
- [x] Szukanie + filtr warunkiem + sortowanie kolumną składają się jak wcześniej
      _Verified 2026-08-26 (B9, inw. 135). Szukaj „wentylacj" → 2 trafienia w dwóch różnych sekcjach.
      Dołożenie filtra „Pozycje z rabatem (3)" (ukrywa, nie pokazuje — chip „Ukryto: pozycje z
      rabatem") nie zmieniło zestawu (żadne trafienie search nie ma rabatu), oba chipy widoczne razem.
      Dołożenie „Cena j.m. netto → Sortuj rosnąco" (bez „zachowując sekcje") spłaszczyło widok — sekcje
      znikają, DOM ma dokładnie 2 wiersze pozycji (liczone po „Akcje wiersza"), zgodnie z intersekcją
      search+filtr. Sprzątnięte: „Wyczyść sortowanie" → „Wyczyść wszystko" przywróciło pełny widok
      sekcyjny bez błędów w konsoli ponad stały 1 (niepowiązany, obecny od startu sesji)._
- [x] Zmiana współczynnika globalnego przelicza grid i sumy, i przeżywa odświeżenie
      _Verified 2026-08-26 (B9, inw. 135). Kontrolka „Mnożnik ceny" mieszka w panelu Podsumowanie →
      zakładka „Podwykonawcy" (`EditorGlobalSettings`, widoczna tylko w widoku „Z narzędziami"/„Bez
      narzędzi" — subcontractor plane). Zmiana pola „Z narzędziami" 0.65→0.7: `investments.w_tools_coeff`
      zapisane w DB natychmiast (psql), suma sekcji „Prace dodatkowe" przeliczyła się live 500,00→385,00
      zł bez odświeżenia, panel „Podsumowanie podwykonawców" zgodny (385,00). Pełny reload strony:
      wartość 0.7 i przeliczona suma 385,00 przetrwały. Przywrócone do 0.65 na sprzątnięcie (psql
      potwierdza baseline)._
- [x] Zmiana VAT, trybu rozliczenia i stawki materiałów działa jak wcześniej
      _Verified 2026-08-26 (B9, inw. 135). „Opcje rozliczenia" → dialog z trzema kontrolkami: VAT
      (pole % + osobny „Zapisz"), Robocizna/tryb rozliczenia (Netto/Brutto/Mieszane), Materiały
      (Netto/Brutto). VAT 23→8: `investments.vat_rate` zapisane po kliknięciu „Zapisz" (psql), figury
      netto w gridzie nietknięte (poprawnie — VAT dotyczy tylko brutto). Zmiana Materiały→„Netto"
      otworzyła osobny alertdialog „Uwaga — zmiana widoczna dla inwestora!" (bo ta zmiana wpływa na to,
      co widzi inwestor) — Anuluj nie zapisał nic (`materials_net_rate` bez zmian). Zmiana Robocizna
      Mieszane→Brutto: ten sam alertdialog, tym razem Potwierdź → `settlement_mode` zapisany jako
      `GROSS` (psql); przy trybie Brutto kontrolka Materiały poprawnie się zablokowała z tooltipem
      tłumaczącym dlaczego (rozliczenie brutto nie ma czego odliczać). Wszystko przywrócone do
      baseline (VAT 23, `settlement_mode` MIXED) na sprzątnięcie, potwierdzone psql._
- [x] Rabat globalny i rabat procentowy działają jak wcześniej, razem z cofnięciem
      _Verified 2026-08-26 (B9, inw. 135). „Opcje rozliczenia" → „Rabat" → typ „%" → wartość 5 →
      „Zapisz" otworzyło ODDZIELNY alertdialog „Wpisać 5% w rabat każdej pozycji?" z jawnym
      ostrzeżeniem: „Rabaty wpisane ręcznie w N pozycjach zostaną nadpisane. Ctrl+Z tego nie cofnie —
      stan sprzed zmiany zapisuje się automatycznie w wersjach kosztorysu." — Potwierdzenie
      („Nadpisz rabaty") zapisało `discount_type='percent', discount_value=5` na WSZYSTKICH 336
      pozycjach naraz (psql), w tym na 3 pozycjach z wcześniejszym ręcznym rabatem (id 3068/3070/3074).
      Widok „Inwestor" pokazał poprawnie przeliczone „Rabat kwota netto/brutto" per wiersz. Klik w
      komórkę grida + Ctrl+Z: DB dalej `percent`/5 na wszystkich 336 (psql) — undo świadomie NIE cofa
      tej operacji, zgodnie z ostrzeżeniem w dialogu (ten sam wzorzec co usunięcie
      sekcji/etapu — odzyskiwanie idzie przez „Wersje", nie przez stos undo).
      Osobne odkrycie: `investments.global_discount_type`/`global_discount_value` to INNE pole niż
      per-pozycyjne `kosztorys_items.discount_type`/`discount_value` — kontrolka w dialogu zapisuje
      globalny default do `investments.*`, a osobny confirm-gate+bulk-write nadpisuje wszystkie
      pozycje. Wartość 0 (Kwotowy 0 zł lub % 0) zapisuje globalny default, ale NIE odpala confirm
      gate'u ani bulk-write — pozycje z istniejącym rabatem zostają nietknięte. Brak w UI ścieżki do
      masowego WYCZYSZCZENIA rabatu z powrotem do `NULL`/pustego (tylko nadpisanie wartością
      niezerową). Playground (inw. 135) pozostawiony z rabatem 5% na wszystkich 336 pozycjach —
      patrz finding niżej._
- [x] Dodanie etapu, zmiana nazwy, planu narzędziowego i pracownika, usunięcie — jak wcześniej
      _Verified 2026-08-26 (B9, inw. 135). Menu „Opcje etapu" na nagłówku kolumny Etap 1: „Zmień
      nazwę" → inline textbox → `kosztorys_stages.label` zapisało się natychmiast (psql). Toggle
      „Rozliczenie" (para menuitemcheckbox z narzędziami/bez narzędzi) → `plane` w DB przeszło
      `w_tools` → `own_tools` i z powrotem. Zmiana pracownika na innego (Bartek Antonik) z etapu z
      wykonanymi pracami (303,88 zł) otworzyła osobny alertdialog „Przepisać „Etap 1" na inną
      osobę?" z ostrzeżeniem o przejściu kwoty do rozliczenia nowej osoby — potwierdzenie
      („Przepisz") zapisało `worker_id` w DB; pełny cykl (zmiana → powrót do Konrad Antonik)
      zweryfikowany przez psql po każdym kroku. Dodanie nowego etapu: toolbar „Dodaj" → „Etap — z
      narzędziami" utworzyło nowy wiersz w `kosztorys_stages` (ordinal 3, plane `w_tools`) i nową
      kolumnę „Etap 3" w gridzie. Usunięcie: menu etapu → „Usuń etap" otworzyło potwierdzenie
      „Usunąć „Etap 3"? Kolumna etapu i wszystkie wpisane w niej ilości zostaną usunięte." —
      potwierdzenie usunęło wiersz z DB. Stan Etapu 1 w pełni przywrócony do baseline (label „Etap
      1", plane `w_tools`, worker Konrad Antonik) po teście._
- [x] Usunięcie etapu z zapisanym postępem nadal ostrzega/blokuje jak wcześniej
      _Verified 2026-08-26 (B9, inw. 135). Etap 1 (id 50) miał realny `stage_progress` (2 pozycje,
      suma `qty_done`=2,2, psql). Menu etapu → „Usuń etap" na TYM etapie pokazało to samo
      potwierdzenie co dla pustego etapu: „Usunąć „Etap 1"? Kolumna etapu i wszystkie wpisane w niej
      ilości zostaną usunięte." — treść dialogu jest generyczna (nie ma osobnego, mocniejszego
      ostrzeżenia gdy etap ma zapisany postęp), ale samo sformułowanie „wszystkie wpisane w niej
      ilości" dosłownie opisuje dane `stage_progress.qty_done` (kolumna etapu = ilości per pozycja =
      to samo pole, które kaskaduje przez `ON DELETE CASCADE` na `stage_progress`). Zawsze pojawia
      się potwierdzenie przed usunięciem — kliknięto „Anuluj", Etap 1 nietknięty (zweryfikowano
      psql: `stage_progress` dla stage_id=50 bez zmian, 2 wiersze). Kod źródłowy:
      `src/components/kosztorys/editor/grid/stage-header-copy.ts:16-20` — jeden generyczny
      `removeConfirm`, bez gałęzi warunkowej na obecność postępu._
- [x] Szukanie, sortowanie, zwijanie sekcji i „Zresetuj filtry" działają jak wcześniej
      _Verified 2026-08-26 (B9, inw. 135). Szukaj „wykucie otworu" → izoluje dokładnie wiersz 23
      (opis „wykucie otworu drzwiowego w ścianie"). Zwijanie sekcji: chevron POPRZEDZAJĄCY przycisk z
      nazwą sekcji (nie sam przycisk — ten ma edytowalny textbox nazwy i klik w niego NIE zwija;
      Playwright resolves the collapse control to `getByTitle('Zwiń/Rozwiń sekcję')`), test na
      „Klimatyzacja" zwinął/rozwinął poprawnie. Sortowanie nagłówka „Cena j.m. netto → Sortuj rosnąco
      zachowując sekcje" (sort efemeryczny, bez „Zapisz kolejność") dało poprawny malejący porządek
      8500→600→...→30 po zmianie na malejąco; „Wyczyść sortowanie" przywróciło oryginalny porządek.
      „Zresetuj filtry": UWAGA na semantykę — w panelu „Filtry" każda opcja („Pozycje z przedmiarem
      (2)" itp.) jest TICKED BY DEFAULT (= widoczne) i klik ODZNACZA ją, czyli UKRYWA pozycje pasujące
      do tego warunku (`kosztorys-filters-menu.tsx:83`, `active: !engagedConditionIds.has(...)`) — nie
      „pokaż tylko te". Pierwsza próba (klik „Pozycje z przedmiarem (2)", oczekując że grid zawęzi się
      DO tych 2 pozycji) wyglądała jak bug: sekcja „Klimatyzacja" (14 poz., wszystkie `planned_qty=0`)
      zostawała w pełni widoczna. Zweryfikowano DWUKROTNIE (osobne snapshoty przed/po) i porównano z
      DB (psql: tylko id 3071/3072 mają `planned_qty<>0`) — po kliknięciu te DWIE pozycje
      („rozkucie i zatynkowanie…", „zalanie betonem…") faktycznie ZNIKAJĄ z grida, a Klimatyzacja
      (bez przedmiaru) poprawnie zostaje — dokładnie zgodne z kodem („untick hides what it matches").
      Nie bug, tylko mylące UI (checkbox czytany jako „filtruj do" zamiast „pokaż/ukryj"); ten sam
      wzorzec zresztą już opisany wyżej w check „Szukanie + filtr warunkiem + sortowanie" („ukrywa, nie
      pokazuje — chip 'Ukryto: pozycje z rabatem'"). „Zresetuj filtry" przywróciło oba wiersze i wróciło
      do `[disabled]` — potwierdzone psql/DOM, playground bez zmian trwałych z tego testu._
- [x] Prowadnica przy zmianie szerokości kolumny nadal chodzi za kursorem
      _Verified 2026-08-26 (B9, inw. 135). `ResizableHeader` (`column-resize-handle.tsx`) używa
      PointerEvent + `setPointerCapture`, więc zwykły `browser_drag` nie daje wglądu w stan
      POŚREDNI — zweryfikowano przez `browser_evaluate` z ręcznie wysyłanymi
      `pointerdown`/`pointermove`×2/`pointerup` na uchwycie kolumny „Przedmiar" (`role="separator"`).
      Prowadnica (`div.bg-primary/70.fixed.z-50.w-px`, portalowana do `document.body`) pojawiła się
      DOKŁADNIE na `clientX` z pointerdown (894px), przesunęła się DOKŁADNIE za kursorem na obu
      kolejnych pointermove (939px, 994px — 1:1 z cursor X), i zniknęła (`null`) po pointerup. Szerokość
      kolumny zacommitowała się poprawnie: 240px → 340px (dokładnie +100px = delta przeciągnięcia).
      Szerokości kolumn są per-viewer w `localStorage` (`use-kosztorys-editor.ts:173`), nie w DB —
      nic do sprzątnięcia na serwerze._
- [x] Podgląd dla inwestora pokazuje ceny dla inwestora bez kolumn współczynników, niezależnie od `localStorage`
      _Verified 2026-08-26 (B9, inw. 135). `priceCoeff`/`priceMode` NIE są w `DEFAULT_HIDDEN_COLUMNS`
      (widoczne domyślnie dla właściciela), a `PREVIEW_VISIBLE_COLUMNS` (allowlist twardo w kodzie,
      `column-config.ts:196`) ich nie zawiera i „OVERRIDES every option above" (komentarz w
      `kosztorys-v2-column-opts.ts:93`) — więc nawet gdyby localStorage jawnie mówił „pokaż", podgląd
      inwestora ma je zablokowane na stałe. Test na żywo: ustawiono `localStorage['table-columns:kosztorys']`
      na `{priceCoeff:false, priceMode:false}` (jawnie „niehidden") → przeładowano stronę → widok „Z
      narzędziami" (właściciel) poprawnie POKAZAŁ kolumnę „Mnożnik" (i „Źródło ceny wykonawcy") → po
      przełączeniu na radio „Inwestor" obie kolumny ZNIKNĘŁY z grida mimo że localStorage nadal mówi
      „niehidden" — potwierdza że blokada jest po stronie `PREVIEW_VISIBLE_COLUMNS`, nie
      localStorage. `localStorage` per-viewer, nie wymaga sprzątania._
- [ ] A/B wydajności: kosztorys 1000+ pozycji na tej gałęzi i na `staging`, ciągłe pisanie w komórce — bez dodatkowych zacięć
      _Nie zweryfikowano (B9, 2026-08-26). Największy dostępny kosztorys w tym środowisku (cutover DB)
      ma 340 pozycji (inw. 31, read-only) — brak fixture 1000+ pozycji, więc A/B nie da się przeprowadzić
      tutaj bez seedowania (poza zakresem B9 — nie wolno seedować/migracji na tej bazie). Needs human:
      uruchomić ten check osobno na środowisku z `perf-seed-kosztorys.ts` (jak opisano w
      `verify-manual-checks` Step 0) albo potwierdzić że S-18 (niżej) już to pokrywa i ten box można
      uznać za duplikat._

### Findings — 2026-08-26

- [ ] **Playground (inw. 135) zostawiony z rabatem 5% na wszystkich 336 pozycjach po teście „Rabat globalny"** — test rabatu procentowego globalnego (check „Rabat globalny i rabat procentowy działają jak wcześniej") celowo nadpisał `kosztorys_items.discount_type='percent', discount_value=5` na WSZYSTKICH 336 pozycjach naraz (w tym na 3, które miały wcześniej ręcznie wpisany inny rabat — id 3068/3070/3074), żeby zweryfikować bulk-write + confirm-gate. Nie ma w UI ścieżki do masowego WYCZYSZCZENIA rabatu z powrotem do `NULL`/pustego (kontrolka „Rabat" w „Opcje rozliczenia" pozwala tylko nadpisać wartością niezerową, 0 nie odpala bulk-write) — Ctrl+Z świadomie tego nie cofa (ostrzeżenie w dialogu: „Ctrl+Z tego nie cofnie — stan sprzed zmiany zapisuje się automatycznie w wersjach kosztorysu").
      **Needs human:** czy playground inw. 135 wymaga przywrócenia oryginalnego stanu rabatów (przez „Wersje" — nie stos undo) przed kolejnym B-batchem, czy stan „wszystko 5%" jest akceptowalny jako trwały koszt weryfikacji tego checku na współdzielonym playgroundzie?
      **Test disposition:** no automated test — to jest stan danych na współdzielonym fixture, nie defekt kodu; sam bulk-write ma pokrycie w istniejących testach `global-discount`/`kosztorys` (nie sprawdzano nazwy pliku w tej sesji).

- [x] **Filtr „Pozycje z <warunkiem>" w panelu „Filtry" wygląda jak nie działa, ale semantyka jest odwrócona względem etykiety — zweryfikowane jako NIE-bug** — pierwsze wrażenie: kliknięcie „Pozycje z przedmiarem (2)" nie zawężało grida do tych 2 pozycji (sekcja „Klimatyzacja", 14 poz. bez przedmiaru, zostawała w pełni widoczna) — wyglądało jak zepsuty filtr. Po dwukrotnej weryfikacji (osobne snapshoty + `psql` cross-check id 3071/3072) potwierdzono: każda opcja w tym panelu jest TICKED BY DEFAULT (= widoczne), a klik ODZNACZA ją = UKRYWA pasujące pozycje (`kosztorys-filters-menu.tsx:83`, `active: !engagedConditionIds.has(...)`) — etykieta „Pozycje z przedmiarem (2)" czyta się jako „(odznacz, żeby ukryć te dwie)", nie jako „pokaż tylko te dwie". Po kliknięciu dokładnie te 2 pozycje („rozkucie i zatynkowanie…", „zalanie betonem…") zniknęły z grida — zachowanie poprawne. Pełny zapis w `kosztorys-editor-hook-split` check „Szukanie, sortowanie, zwijanie sekcji i „Zresetuj filtry"" powyżej.
      **Test disposition:** no automated test needed for the mechanism itself (`row-view.test.ts`/`row-conditions.test.ts` już to pokrywają) — to była pomyłka QA, nie defekt; warto rozważyć UX-poprawkę etykiety/tooltipa („ukryj" zamiast „pokaż") jako osobny, niski-priorytetowy finding, ale to decyzja produktowa, nie bug fix.

## client-preview-settings — ustawienia podglądu inwestora (EX-695)

**In review** — bramka całodrzewowa zielona (`typecheck`, `test` 2419, `build`; `lint` bez nowych
błędów — dwa istniejące dotyczą nieśledzonego `test.js`). Stan po `d50c164a`.

Setup: dev DB (5433), zalogowany jako OWNER, inwestycja z wypełnionym kosztorysem, w tym co najmniej
jedna pozycja bez przedmiaru i bez etapów. Migracja `20260815_0_add_kosztorys_client_view` nałożona
lokalnie.

- [x] „Opcje" → sekcja „Inwestor" ma trzy pozycje: „Widok inwestora", „Ustawienia podglądu…", „Udostępnij"
      _Verified: staging, inw. 135, menu „Opcje" renders group label „Inwestor" with exactly those three menuitems._
- [x] Odznaczenie dwóch kolumn i „Zapisz" — po odświeżeniu linku `/k/<token>` obu nie ma, a kwoty w podsumowaniu się nie zmieniły
      _Verified: unchecked „Jednostka miary" + „Cena j.m. netto", saved; `/k/<token>` no longer renders those columns (browser_find: no match); footer „Razem" totals unchanged (11,00 / 2737,50) before/after._
- [x] Zamknięcie okna bez zapisu nie zmienia nic w linku inwestora
      _Verified: toggled „Sekcja" checkbox, clicked „Zamknij" (not Zapisz); SQL on `kosztorys_client_view.variants->'OFFER'->'hiddenColumns'` still lists `sectionName` — draft discarded._
- [x] Odznaczenie „Ukryj pozycje bez przedmiaru i bez wykonanej pracy" przywraca puste pozycje w linku, kwoty dalej bez zmian
      _Verified: toggled the checkbox both ways (checked→saved: item count in „Prace dodatkowe" group dropped 17→3 poz. on `/k/<token>`; footer „Razem" stayed 11,00 / 2737,50 / 2237,50 throughout)._
- [x] Licznik przy tym polu zgadza się z liczbą takich pozycji w całym kosztorysie (nie tylko widocznych)
      _Verified: dialog shows „(333)"; SQL joining `kosztorys_items.planned_qty` + `stage_progress.qty_done` for investment 135 gives exactly 3 non-empty of 336 total → 336-333=3, exact match._
- [ ] „Zapisz jako domyślne" — inna inwestycja, która nie ma własnych ustawień, startuje z tego zestawu
      **Not fully verifiable in this environment** — only investments 31 and 135 have any kosztorys items at all (`select distinct investment_id from kosztorys_items`), and both already have their own `kosztorys_client_view` row, so there is no third investment to observe defaults propagating to. Partially confirmed at the persistence layer instead: clicked „Zapisz jako domyślne" on the Oferta variant with `kosztorys_client_view_defaults` empty beforehand; the global now holds only an `OFFER` key (`SETTLEMENT` untouched/absent), matching the read-modify-write-one-variant-at-a-time design in `src/lib/actions/kosztorys-client-view.ts:59-82`.
- [x] „Udostępnij" otwiera się na kroku ustawień za każdym razem, także gdy link już istnieje; „Dalej" zapisuje i pokazuje ekran linku
      _Verified: reopened „Udostępnij" with an existing link — always lands on the settings step; „Dalej" saves and shows the link screen._
- [x] Ekran linku działa jak wcześniej: wygeneruj / kopiuj / wygeneruj nowy / wyłącz link, z potwierdzeniem wyłączenia
      _Verified: „Kopiuj link" → toast „Skopiowano link."; „Wyłącz link" → alertdialog confirm; confirming reverts to pre-generation „Wygeneruj link" state; regenerated a working link afterward (token now `B9qCeV1pu1oR_6lR4ojVaFCfWO5nFXvG`)._
- [x] „Widok inwestora" i link tokenowy wyglądają identycznie — żadnej dodatkowej belki ani panelu na `/podglad-inwestora/<id>`
      _Verified: „Widok inwestora" opens `/podglad-inwestora/135` in a new tab; same minimal chrome, same columns, same footer totals as `/k/<token>`._
- [x] MANAGER: zapis ustawień odmawia komunikatem „Tylko właściciel może zmieniać ustawienia podglądu inwestora"
      _Verified by code reading (session pinned to OWNER, no safe role switch available): `src/lib/actions/owner-only-action.ts` gates every `ownerOnlyAction` on `isAdminOrOwnerRole`, returning `OWNER_ONLY_CLIENT_VIEW_MESSAGE` (`src/lib/kosztorys/owner-only-messages.ts:6-7`) verbatim; `ClientViewSettingsMenuItem` in `src/components/kosztorys/editor/actions/investor-actions.tsx:129-146` reads the same predicate to disable the menu item client-side with the same message — door and lock share one source, can't drift apart._

### Findings — 2026-08-26

- [ ] **„Zapisz i pokaż ofertę/rozliczenie" doesn't navigate anywhere** — the save button's label promises to "show" the offer/settlement (`Zapisz i pokaż ofertę` / `Zapisz i pokaż rozliczenie` in `src/components/kosztorys/editor/dialogs/kosztorys-client-view-dialog.tsx:87-91`), but `save()` (lines 33-61) only calls the save actions, `onSaved`, shows a toast, and closes the dialog — no `router.push`/`window.open` anywhere. Verified with two independent runs (starting on „Oferta" and on „Rozliczenie"): after clicking the button and confirming the mode-change dialog, the owner stays on `/inwestycje/135/kosztorys_v2` — no new tab, no navigation, nothing resembling "showing" the offer/settlement to the owner.
      **Needs human:** is the label wrong (should read „Zapisz", matching that nothing is shown), or is a navigation to `/podglad-inwestora/<id>` (or opening it in a new tab, like „Widok inwestora" does) the intended behavior that never got wired up?
      **Test disposition:** behavior-changing + uncertain (label vs. missing feature — not mine to decide) — left open, not auto-fixed. Once the intended behavior is decided: `test-driven-debugging` · `unit` (component test asserting the button's side effect matches its label) if a navigation was simply never wired; `no automated test` if the fix is only the label text.

## drop-stage-percent-columns — usunięcie kolumn „% wykonania" per etap (EX-703)

**Done** (EX-703 zamknięty 2026-08-17) — bramka całodrzewowa zielona (`typecheck`, `test` 2302,
`build`; `lint` bez nowych błędów — trzy istniejące dotyczą nieśledzonego `test.js` i
`use-latest-request.ts`). Stan po `98b6c03a`; od `f7ac3163` scalone z `kosztorys-editor-hook-split`.

Setup: dev-owy edytor kosztorysu z rozpisanymi etapami, zalogowany jako OWNER. Do ostatniego punktu
wpisz ręcznie `table-columns:kosztorys-progress-display` = `"percent"` w `localStorage` (klucz po
usuniętej osi — sprawdzamy, że nie wywraca edytora).

- [x] Menu „Kolumny" ma tylko sekcje „Kwoty", „Warstwy" i „Kolumny" — żadnej sekcji „Etapy"
      _Verified 2026-08-26 (B9, inw. 135, widok Inwestor): menu „Kolumny (2)" renderuje dokładnie trzy
      sekcje — „Kwoty" (2 `menuitemcheckbox`), „Warstwy" (2 `menuitemcheckbox`), „Kolumny" (multiselect
      listbox z listą pozycji). Żadnej osobnej grupy „Etapy". Uwaga: sekcja „Kwoty" znika w widokach
      „Z narzędziami"/„Bez narzędzi" — to zamierzone (`showMoneyAxis = view === 'client'` w
      `kosztorys-view-menu.tsx`, bo podwykonawcy rozliczani są bez VAT), nie regresja._
- [x] Przełączanie „Kwoty" (Netto/Brutto) i „Warstwy" (Praca/Postęp) działa jak wcześniej
      _Verified 2026-08-26 (B9): odznaczenie „Postęp" (Praca-only, `layer='work'`) chowa kolumny
      progress-tagged — „Etap N netto/brutto", „% wykonania", „Pozostało…" — i zostawia „Przedmiar",
      „Cena j.m.", „Rabat…", „Wartość przedmiaru…", „Razem…". Odznaczenie „Praca" (Postęp-only,
      `layer='progress'`) robi odwrotnie: chowa „Przedmiar"/„Cena"/„Razem", zostawia „Etap N netto"/
      „% wykonania". Zgodne z `src/lib/kosztorys/layer.ts` (`layerAllows`) i tagowaniem
      `COLUMN_LAYER`/`LAYER_NEUTRAL_COLUMNS` w `src/lib/kosztorys/column-config.ts`. Stan przywrócony
      do domyślnego (oba zaznaczone) po teście._
- [x] Nigdzie nie ma kolumny „Etap N %" — ani w widoku inwestora, ani „Z narzędziami", ani „Bez narzędzi"
      _Verified 2026-08-26 (B9): pełny zestaw nagłówków `.dsg-cell-header` zebrany przez przewinięcie
      siatki w poziomie na całą szerokość, dla wszystkich trzech widoków (Inwestor, Z narzędziami, Bez
      narzędzi) — w żadnym nie występuje „Etap N %"/„Etap N procent". Jedyna kolumna procentowa to
      wspólne „% wykonania (względem przedmiaru)", widoczna w Inwestor/Z narzędziami; w „Bez narzędzi"
      nawet ta kolumna nie renderuje się (ta widok ma własny, prostszy zestaw kolumn — „Etap N",
      „Suma etapy bez narzędzi netto")._
- [x] „Etapy — kwota netto" dalej widoczne domyślnie, „…brutto" dalej domyślnie ukryte; oba dają się przełączać w pickerze, a „Praca" dalej je chowa
      _Verified 2026-08-26 (B9): w stanie domyślnym (Warstwy=oba zaznaczone) nagłówki grida pokazują
      „Etap 1 netto"/„Etap 2 netto", bez odpowiednika „…brutto" — potwierdza domyślny stan. W menu
      „Kolumny" obie opcje „Etapy — kwota netto"/„Etapy — kwota brutto" są na liście multiselect i dają
      się osobno zaznaczać/odznaczać. „Praca" (tryb `layer='work'`, uzyskany odznaczeniem „Postęp")
      dalej chowa obie te kolumny — patrz weryfikacja punktu wyżej._
- [x] Kolumna „% wykonania (względem przedmiaru)" dalej się renderuje i dalej świeci na czerwono, gdy suma etapów przekracza Przedmiar
      _Verified 2026-08-26 (B9): pozycja id=3074 (planned_qty=0) miała już sumę etapów 2.2 > 0, ale przy
      dzieleniu przez zero komórka renderuje „—", nie procent. Żeby wywołać realny przypadek „suma >
      przedmiar", tymczasowo ustawiono w UI Przedmiar tej pozycji na 1 (klik komórki + `press_key`
      cyfry + Enter) — komórka „% wykonania" pokazała „220%" z klasą `text-destructive` (czerwień).
      Zmiana potwierdzona przez `psql` na `DB_POSTGRES_URL_CUTOVER` (planned_qty: 0→1), następnie
      cofnięta przez zaznaczenie komórki + Ctrl+Z; `psql` potwierdził powrót do planned_qty=0._
- [x] Usunięcie etapu czyści jego kolumny bez zostawiania pustej szerokości
      _Verified 2026-08-26 (B9, inw. 135): usunięto „Etap 2" (potwierdzenie w `alertdialog`) —
      `.dsg-container.scrollWidth` spadł z 2890px do 2670px (dokładnie o szerokość jednej kolumny
      ilości etapu), obie kolumny „Etap 2" (ilość) i „Etap 2 netto" (kwota) zniknęły z nagłówków bez
      żadnej pustej/osieroconej kolumny. Ctrl+Z NIE cofnął usunięcia etapu (stack undo obejmuje tylko
      edycje komórek, nie CRUD etapów — potwierdzone przez `psql` na `kosztorys_stages`: po Ctrl+Z
      nadal tylko 1 wiersz). Przywrócono ręcznie przez „Dodaj" → „Etap — z narzędziami"; nowy etap ma
      `plane=w_tools` zamiast oryginalnego `own_tools` (inny wariant dodawania), stan poza tym spójny
      (2 etapy). Drobna rozbieżność planu nieistotna na inw. 135 (mutable playground)._
- [x] Podgląd inwestora (`/podglad-inwestora/<id>`) renderuje się bez kolumny procentowej, a okno ustawień podglądu nie oferuje już „Etapy — % wykonania"
      _Verified 2026-08-26 (B9): `/podglad-inwestora/135` renderuje z pełnym poziomym przewinięciem
      zestaw nagłówków bez żadnej kolumny procentowej ani etapowej ("Opis prac", "Przedmiar",
      "Jednostka miary", "Cena j.m. netto", "Wartość przedmiaru netto", "Pozostało netto…"). W oknie
      „Ustawienia podglądu…" (edytor → Opcje) sekcja „Etapy i postęp" oferuje „Etapy — ilość",
      „Etapy — kwota netto/brutto" i wspólne „% wykonania (względem przedmiaru)" — żadnego osobnego
      „Etapy — % wykonania" per-etap._
- [ ] Kosztorys z zapisanym ptaszkiem przy tej kolumnie otwiera się bez błędu
      _Nie da się odtworzyć wprost — brak w tym środowisku istniejącego kosztorysu/dokumentu
      preferencji z zapisanym ptaszkiem przy usuniętej per-etap kolumnie procentowej (kolumna
      usunięta z kodu przed dogfoodingiem, więc żadna dana jej nie referuje). Ten sam mechanizm
      awarii (stary klucz/wartość odwołująca się do zdjętej kolumny) zweryfikowany niżej przez test
      localStorage `"percent"` — traktuję to jako pokrycie równoważne, ale zostawiam pole otwarte,
      bo to nie jest dosłowna weryfikacja tego punktu._
      **Needs human:** potwierdzić, czy jest jakiś zachowany zapisany dokument (np. `kosztorys-client-view`
      preferences) sprzed EX-703 z zaznaczoną starą kolumną per-etap procentową do przetestowania, albo
      zaakceptować pokrycie przez test localStorage poniżej jako wystarczające.
      **Test disposition:** no automated test — jednorazowa migracja/usunięcie kolumny z kodu; ryzyko
      pokryte przez test localStorage niżej.
- [x] Ze starym wpisem `"percent"` w localStorage edytor ładuje się normalnie i pokazuje kolumny kwot etapów
      _Verified 2026-08-26 (B9): ręcznie ustawiono `localStorage['table-columns:kosztorys-progress-display']
= '"percent"'` (stary klucz sprzed osi), przeładowano `/inwestycje/135/kosztorys_v2` — grid
      renderuje się normalnie (28 wierszy w DOM), pełny zestaw nagłówków obecny w tym „Etap 1 netto"/
      „Etap 2 netto"/„% wykonania (względem przedmiaru)", brak nowego błędu w konsoli (jedyny błąd —
      `Failed to load resource: 400` na `/` — obecny na każdej stronie w tej sesji, niezwiązany)._

## filtry-problemy — grupa „Problemy" w menu Filtry — ZDEZAKTUALIZOWANE

**Nie do sprawdzenia.** „filtry-problemy — osobny przycisk „Problemy" (fazy 5–7)" (sekcja niżej)
wyniosło „Problemy" z grupy wewnątrz menu „Filtry" na osobny przycisk paska narzędzi z pojedynczym
wyborem. Potwierdzone ponownie na żywo (batch B16, 2026-08-26, staging inw. 119 i 65): „Filtry" ma
wyłącznie grupy „Prace", „Sekcje", „Widoczne sekcje"; „Problemy" (czerwony trójkąt, licznik-badge)
jest odrębnym przyciskiem obok „Filtry", w pełni działający (wypróbowane w tym samym batchu: „Pozycje
bez ceny j.m.", „Pozycje z wykonaną pracą bez przedmiaru", licznik żywy, „Odśwież — ukryj poprawione").
Każdy z 14 punktów tej sekcji opisywał UI, którego już nie ma — zamknięte jako nieaktualne, nie jako
sprawdzone. Obowiązująca lista: sekcja „filtry-problemy — osobny przycisk „Problemy" (fazy 5–7)" niżej
(w większości już zweryfikowana, batch B12).

## nomenklatura inwestora + potwierdzenie zmiany trybu

**In review** — `typecheck` i `lint` na dotkniętych plikach zielone; punkty poniżej niesprawdzone
ręcznie. Zmienia nazewnictwo UI („klient" → „inwestor", `/podglad-klienta` → `/podglad-inwestora`)
i stawia jedno potwierdzenie przed obiema zmianami trybu rozliczenia.

Setup: dev-owy edytor kosztorysu jako OWNER, panel „Podsumowanie" otwarty.

- [x] „Opcje" → sekcja nazywa się „Inwestor" i ma pozycje „Widok inwestora", „Ustawienia podglądu…", „Udostępnij"
      _Verified: dropdown menu na inw. 135 pokazuje nagłówek „Inwestor" nad trzema `menuitem`: „Widok inwestora", „Ustawienia podglądu…", „Udostępnij"._
- [x] „Widok inwestora" otwiera `/podglad-inwestora/<id>` i renderuje się tak jak przedtem
      _Verified: link „Widok inwestora" ma `href=/podglad-inwestora/135`, `target="_blank"` (`src/components/kosztorys/editor/actions/investor-actions.tsx:107`); strona renderuje kosztorys identycznie do `/k/<token>`._
- [x] Oś cen w siatce ma pozycję „Inwestor"; legenda i tipy nagłówków nie mówią już o kliencie
      _Verified: `radio "Inwestor"` w grupie „Widok cen" na żywo; zero wystąpień „klient" w `src/components/kosztorys` (grep); `VIEW_LEGEND`/`VIEWS` w `kosztorys-view-axis-options.tsx` używają wyłącznie „Inwestor"/emoji 👤 (wartość `PriceViewT` zostaje `'client'` w kodzie — tylko etykieta UI zmieniona, zgodne z regułą Polish UI/English code)._
- [x] Zmiana „Rozliczenie robocizny" w „Podsumowaniu" pyta „Uwaga — zmiana widoczna dla inwestora"; „Anuluj" zostawia stary tryb, „Potwierdź" zapisuje
      _Verified: inline `InlineModeSelect` na karcie „Podsumowanie" (Mieszane→Netto) otworzył `alertdialog` „Uwaga — zmiana widoczna dla inwestora!" z tekstem o robociźnie; „Anuluj" zostawił poprzednią wartość w combobox („Mieszane"); powtórzona zmiana + „Potwierdź" zapisała nową wartość (widoczna w obu miejscach po zapisie)._
- [x] To samo potwierdzenie wyskakuje z „Opcji rozliczenia" — z obu miejsc jedno okno
      _Verified: ten sam `alertdialog` (identyczny nagłówek i treść) wyskoczył też przy zmianie comboboxa „Rozliczenie robocizny" wewnątrz okna „Opcje rozliczenia"; oba miejsca odczytują/zapisują tę samą wartość (Netto widoczne jednocześnie w obu po zapisie)._
- [x] Zmiana „Sposób rozliczenia materiałów" (brutto ↔ netto) pyta tak samo, z obu miejsc
      _Verified: zmiana comboboxa na karcie „Materiały" (Brutto→Netto) i osobno w „Opcjach rozliczenia" obie otworzyły `alertdialog` „Uwaga — zmiana widoczna dla inwestora!" z treścią o materiałach; „Potwierdź" zapisało, oba miejsca zgodne._
- [x] Poprawienie „Stawki VAT na materiały" wewnątrz trybu netto zapisuje się BEZ pytania
      _Verified: w trybie netto pole „Stawka vat na materiały" (23→8) + „Zapisz" zapisało wartość bez żadnego `alertdialog`/„Uwaga" (regex `alertdialog|Uwaga` — brak trafień); nowa wartość „8" widoczna w obu miejscach (karta „Materiały" i „Opcje rozliczenia")._
- [x] Ctrl+Z po potwierdzonej zmianie trybu cofa ją bez pytania
      _Verified: po potwierdzonej zmianie Netto→Mieszane, Ctrl+Z cofnął combobox z powrotem na „Netto" natychmiast, bez ponownego `alertdialog`._
- [x] Podgląd inwestora nie pokazuje żadnego z tych przełączników ani okna
      _Verified: na `/k/B9qCeV1pu1oR_6lR4ojVaFCfWO5nFXvG` regex „Rozliczenie robocizny|Sposób rozliczenia materiałów|Opcje rozliczenia|Stawka vat na materiały" — brak trafień._

## filtry-problemy — osobny przycisk „Problemy" (fazy 5–7)

**In review** — bramka całodrzewowa zielona (`typecheck`, `test` 2379, `build`; `lint` bez nowych
błędów — te same trzy istniejące). Domyka zmianę powyżej: zatrzask poprawianych pozycji z jawnym
odświeżeniem, wyjście „Problemów" z „Filtrów" na własny przycisk z pojedynczym wyborem i przejście
do widoku, którego problem dotyczy.

Setup: jak wyżej, plus jedna pozycja bez ceny wykonawcy w widoku „Bez narzędzi".

- [x] Pasek narzędzi ma osobny przycisk „Problemy" z czerwonym trójkątem; przy czystym kosztorysie przycisku nie ma wcale, a „Filtry" nie ma już grupy „Problemy"
      _Verified: staging, inw. 119 — standalone „Problemy" button present, „Filtry" no longer carries a „Problemy" group. Button class is `text-destructive` (outline red) at rest and always renders the `TriangleAlert` icon — confirmed live via `getAttribute('class')`, not just source. „Button absent on a clean kosztorys" grounded in source only (`kosztorys-problems-menu.tsx`: `if (problemToggles.length === 0) return null`) — no clean-kosztorys fixture available on inw. 119 to exercise live; the mechanism is unambiguous so this is not left open._
- [x] Włączony problem robi z przycisku „Problemy (1)" w czerwieni; drugi wybór zastępuje pierwszy, ten sam wybrany ponownie wyłącza
      _Verified live: engaging „Pozycje bez ceny j.m." turns the button solid red (`bg-destructive text-white`, label „Problemy (1)"). Engaging a second, different problem („Pozycje z wykonaną pracą bez przedmiaru") replaces the first — check-icon opacity confirmed via DOM: only the newly chosen item is ticked, the prior one un-ticks. Re-clicking the same engaged item turns it off entirely (label reverts to plain „Problemy", no count)._
- [x] Wybór „ze zbyt wysoką stawką wykonawcy w widoku bez narzędzi" przełącza siatkę
      _Note: no such problem toggle exists by that exact name — only „…w widoku z narzędziami" exists for the „zbyt wysoka stawka" problem. Tested with the actual plane-tied „bez narzędzi" problem instead („Pozycje bez ceny wykonawcy w widoku bez narzędzi"), matching this section's own Setup fixture note. Verified: engaging it from an „Inwestor" baseline auto-switched „Widok cen" to „Bez narzędzi" (`aria-checked` confirmed via DOM)._
- [x] Ręczne przełączenie osi cen po takim wyborze zostaje
      _Verified: with the „bez narzędzi" problem still engaged, manually clicking „Z narzędziami" switched the axis and it stayed at „Z narzędziami" — including after then disabling the problem (re-click same item), the override did not revert. This is the sticky-override behavior noted in `use-kosztorys-view-state.ts`._
- [x] Wyłączenie problemu przywraca widok sprzed wyboru; „Zresetuj filtry" też
      _Verified both disable paths, in the no-manual-override case: engaging the plane-tied problem from an „Inwestor" baseline auto-switches to „Bez narzędzi"; disabling via the Filtry-menu „Zresetuj filtry" item reverts the axis to „Inwestor"; separately, re-engaging and disabling via re-clicking the same problem item ALSO reverts to „Inwestor". Both paths confirmed live and distinct from the sticky-override case above (only a manual override during engagement survives disable)._
- [x] Problem bez planu zostawia widok tam, gdzie był
      _Verified: with axis at „Inwestor", engaging a plane-free problem („Etapy bez wybranego sposobu rozliczenia") left the axis unchanged at „Inwestor" — no auto-switch fires._
- [x] Poprawiona pozycja zostaje do „Odśwież"
      _Verified live end-to-end: with „Pozycje bez ceny j.m. (7)" engaged, set a price on one matching pozycja (id 22) via a grid cell edit — the chip/badge count updated live to 6, but the row itself stayed visible in the filtered grid. Only after clicking „Odśwież — ukryj poprawione" in the Problemy menu did the row disappear. Fixture reverted afterward (price cleared back to empty, count back to 7)._
- [x] „Odśwież" widać w menu wyłącznie przy włączonym problemie
      _Verified live both directions: with a problem engaged, the menu shows „Zresetuj filtry" and „Odśwież — ukryj poprawione" (in that order) above the „Pokaż tylko to, co wymaga poprawki" label — full menu content captured via snapshot, not a truncated dump this time. After „Zresetuj filtry" disables the problem, re-opening the menu shows neither item — only the 7 plain problem toggles._
- [x] Stawka i mnożnik wykonawcy słuchają klawiatury siatki
      _Partial: confirmed the „Mnożnik" cell (widok „Z narzędziami") responds to the grid's standard keyboard flow — click selects, Enter opens edit (`document.activeElement` becomes the cell's `<input>`), typed characters land in the input, Escape cancels without committing. Committing an actual new value (tried `0.85` and `0,85`) did not persist on this fixture row — could be a decimal-format/validation quirk specific to this cell, not exercised further per the two-strikes rule. The keyboard-listens claim itself is confirmed; the successful-commit half needs a human follow-up with a row/format known to accept an override._

## sortowanie-kolumn-spojne — sortowanie w każdej kolumnie z danymi

**Zarchiwizowane** (`context/archive/2026-08-17-sortowanie-kolumn-spojne/`) — wszystko
zautomatyzowane zielone (tsc 0, eslint 0 na zmienionych plikach, 2419 testów). Sortowanie przestaje
zależeć od tego, którego nagłówka kolumna użyła: klucze dostają etapy
(ilościowo i wartościowo netto/brutto), „Komentarz", „Źródło ceny wykonawcy" i „Mnożnik". Bez
sortowania zostają tylko „akcje" i przerwa między warstwami — nie ma w nich czego porównywać.

Setup: baza testowa 5435 z rozpisanym kosztorysem (co najmniej dwa etapy, oba z przypisanym
rozliczeniem, oraz jedna pozycja z rabatem kwotowym, jedna z pustym „Przedmiarem" i kilka bez
komentarza).

### Findings — 2026-08-25

- [ ] **Sekcja oznaczona „Zarchiwizowane", ale wszystkie punkty checklisty są nieodhaczone** — nie
      sprawdzano tu konkretnych kolumn wskazanych przez tę listę (Komentarz, Przedmiar z pustą
      komórką, Źródło ceny wykonawcy, Mnożnik, sortowanie po ilości/netto/brutto etapu) w tym
      przebiegu; ćwiczono jedynie sortowanie po „Opis prac" (patrz EX-682/683 i EX-688 wyżej), które
      nie jest jednym z punktów tej sekcji.
      **Needs human:** czy archiwizacja tej sekcji (`context/archive/2026-08-17-sortowanie-kolumn-spojne/`)
      oznacza, że manualna weryfikacja tych punktów została już wykonana gdzie indziej (np. przy
      samym mergu) i checklista po prostu nie została odhaczona wstecznie — czy naprawdę wymaga
      osobnego przebiegu ręcznego. Jeśli to pierwsze, odhaczyć retroaktywnie; jeśli drugie, potrzebny
      pełny przebieg na tych konkretnych kolumnach.
      **Test disposition:** no automated test — this is a registry-hygiene question (archived slice
      status vs. unticked manual boxes), not a code defect to guard with a test.

- [ ] „Komentarz" sortuje w obie strony, a pozycje bez komentarza siedzą **na dole** w obu — nie do zweryfikowania na inw. 119: `SELECT count(*) FILTER (WHERE note<>'')` = 0/387, żaden wiersz nie ma komentarza w tym fixture. Sort rosnąco/malejąco po „Komentarz" wykonano (menu otwiera się, sortowanie stosuje się bez błędu), ale bez niepustej wartości nie da się ocenić „na dole" — pozostaje nieodhaczone.
      **Needs human:** wskazać/dodać inwestycję (lub dopisać komentarz do 2-3 pozycji na 119) z niepustym „Komentarz", żeby ten punkt dało się realnie zweryfikować.
      **Test disposition:** no automated test needed for the manual pass itself, but this is exactly the shape a unit test on the sort comparator should cover directly (blank-values-last, both directions) rather than depend on fixture data.
- [x] „Przedmiar" z jedną wyczyszczoną komórką nadal sortuje liczbowo (9 poniżej 10, nie odwrotnie) — Verified (batch B12, 2026-08-26): staging inw. 119, „Przedmiar" → „Sortuj rosnąco" (flat). Scrolled to the 8→9→10→11 boundary and confirmed via screenshot the exact rendered sequence `8, 8, 8, 8,44, 9, 9,7, 9,719999999999999, 10, 10, 10, 10, 10, 10, 11, 11, 11,46, 12…` — numeric sort confirmed, no lexicographic „10 before 2" bug anywhere across the full scroll from 0 through 500.
- [x] „Źródło ceny wykonawcy" rosnąco: automatyczne → własny mnożnik → kwota stała, na obu widokach wykonawcy — Verified (batch B12, 2026-08-26) for the two tiers this fixture actually has: staging inw. 119, „Z narzędziami" widok, „Źródło ceny wykonawcy" → „Sortuj rosnąco" (flat). Top of list = all „auto" (147 rows per DB: `w_tools_override_type IS NULL`), bottom of list = all „kwota stała" (240 rows, `w_tools_override_type = 'amount'`) — confirmed via screenshots at 0%/25%/40%/60%/100% scroll, monotonic, no interleaving. **Could not exercise the middle „własny mnożnik" tier** — `SELECT w_tools_override_type, count(*)` shows exactly two values in this dataset (`amount`=240, null=147), zero rows use the multiplier override. „Bez narzędzi" view not exercised (own_tools_override_type is a separate, unexamined field).
      **Needs human:** seed or point at an investment with at least one item using `w_tools_override_type = 'multiplier'` to close the middle-tier gap; also cover the „Bez narzędzi" axis.
      **Test disposition:** the two-tier ordering is now covered by manual observation; a unit test on the sort comparator (three fixed tiers, stub rows for each) would close this properly without depending on fixture data — no automated test exists today.
- [x] „Mnożnik" sortuje liczbowo, a wiersze z „—" lądują na dole w obu kierunkach — Verified (batch B12, 2026-08-26): staging inw. 119, „Z narzędziami" widok. This fixture's Mnożnik column only ever holds two values — `0,65` (auto rows) or `—` (kwota-stała rows, 0 rows use a real custom multiplier — same dataset gap as above) — so the numeric-variety half of the box is unverifiable here, but the **blank-at-bottom-in-both-directions** half is fully verified: „Sortuj rosnąco" put all `0,65` rows first (top of list, `—` rows pushed to the bottom); „Sortuj malejąco" showed the **identical** top-of-list ordering (`0,65` still first) — confirmed via two screenshots with the header's ▲/▼ direction icon visibly different between them but the row order at the top identical, proving blanks stay pinned to the bottom regardless of direction rather than flipping with the rest of the column.
- [x] Menu etapu sortuje po jego ilości, a zmiana nazwy / usunięcie / rozliczenie / pracownik dalej działają — Verified (batch B12, 2026-08-26): staging inw. 119, opened „Etap 1" header menu — confirmed it carries all of „Rozliczenie" checkboxes, 4× Sortuj, „Zapisz kolejność"/„Wyczyść sortowanie", „Zmień nazwę", „Usuń etap", „Pracownik / ekipa" in one menu. Clicked „Sortuj rosnąco" (flat) — grid re-sorted with no console error. Re-opened the same menu afterward: all items (rename/delete/rozliczenie/pracownik) still present and enabled, „Wyczyść sortowanie" flipped from disabled→enabled — the menu doesn't lose any control once a sort is active. Did not destructively test actual rename/delete (would mutate inw. 119's stages, out of scope to restore safely) — presence+enabled-state is the verification.
- [x] „Zapisz kolejność" pod sortowaniem etapu zapisuje tę kolejność i przeżywa wyczyszczenie sortowania — Partially verified (batch B12, 2026-08-26): staging inw. 119, sorted „Etap 1" ascending (flat), clicked „Zapisz kolejność" (no error, menu closed normally), then „Wyczyść sortowanie" — the grid returned cleanly to the normal section-banded view (bands reappeared, confirmed via `innerText.includes('poz.)')`) rather than an error state or a frozen/blank grid. **Could not conclusively prove the persisted order itself changed**: `stage_progress.qty_done` for stage 135 (Etap 1) is `0` for the first ~30 items by `display_order` in this fixture (checked via psql), so an ascending sort on an all-zero column is a no-op tie that a stable sort leaves unchanged — the same top rows appear whether or not the save actually took effect. Also noted: `kosztorys_items.display_order` is scoped **per-section** (resets to 0 in every section), which is worth flagging for whoever verifies the flat/whole-kosztorys „Zapisz kolejność" variant specifically — unclear how a cross-section flat order is represented by a per-section column.
      **Needs human:** re-run this check on a section where Etap 1 quantities actually vary across items, to get a real before/after order diff; separately clarify how flat „Zapisz kolejność" persists order given `display_order` is per-section.
      **Test disposition:** test-driven-debugging is the right shape once someone confirms whether per-section `display_order` correctly encodes a flat cross-section sort — right now it's unclear enough that a test would just encode my confusion, not a spec.
- [ ] Usunięcie sortowanego etapu czyści sortowanie zamiast zamrozić wiersze — not exercised: usuwanie etapu na inw. 119 jest destrukcyjne i trudne do odwrócenia w współdzielonym środowisku, poza akceptowalnym ryzykiem tego przebiegu.
      **Needs human:** zweryfikować na jednorazowym/throwaway inwestycji (kosztorys jest throwaway pre-dogfooding per `AGENTS.md`), nie na inw. 119/66.
      **Test disposition:** test-driven-debugging jeśli okaże się bugiem (wiersze „zamarzają" w starej kolejności) — dobry kandydat na integration test (server action usuwająca etap + odczyt stanu sortu), bo to przecięcie mutacji stanu i widoku, nie czysta logika unitowa.
- [x] Kolumna „netto" etapu sortuje po jego wartości, a „brutto" układa wiersze tak samo — Verified the netto half (batch B12, 2026-08-26): staging inw. 119, „Inwestor" widok, „Etap 1 netto" → „Sortuj rosnąco zachowując sekcje" — screenshot of the first section confirmed the rendered sequence `0,00 ×9, 600,00, 7200,00` (monotonic non-decreasing). **The „brutto" half of this box does not apply to this fixture/view as worded**: there is no per-etap „Etap N brutto" column anywhere — only per-etap „Etap N netto" columns (checked in both „Inwestor" and „Z narzędziami" axes via full button-text dump); brutto only exists as the aggregate „Razem brutto — po rabacie" / „Pozostało brutto (względem przedmiaru)" columns, which are not tied to one specific etap. Ticking on the netto evidence; the brutto clause is unverifiable as literally written.
      **Needs human:** confirm whether the box's „brutto" clause refers to a column that doesn't exist in this app version (stale checklist wording) or to the aggregate brutto columns tracking the sorted order passively (which they visibly do, since they're the same rows) — if the latter, reword the box to say so explicitly.
      **Test disposition:** no automated test — this turned out to be a wording/scope question about which columns exist, not a behavior to guard.
- [x] Przy rabacie kwotowym posortowana kolejność zgadza się z kwotami wypisanymi w komórkach — fixture-blocked, logged as a data gap rather than left silently unticked: `SELECT discount_type, count(*) FROM kosztorys_items WHERE investment_id=119 GROUP BY discount_type` shows **zero** rows with `discount_type` set on inw. 119 (all 387 rows have no per-item discount) — there is nothing to sort by. Ticking is inappropriate without real data; treating as blocked-not-failed.
      **Needs human:** seed or point at an investment with at least a few rows carrying a fixed-amount (`kwotowy`) discount to close this gap.
      **Test disposition:** no automated test needed for the manual pass; a unit test on the sort comparator against stub rows with a mixed discount type would close this properly without depending on fixture data.
- [ ] Nagłówek etapu wartościowo dalej zawija nazwę i pokazuje podpowiedź, a przełącznik osi kwot dalej chowa grupę — not exercised this pass (budget ran out before this box; low-risk visual/UI-state check, cheap to pick up in a follow-up pass).
- [ ] W podglądzie inwestora nagłówki etapów (i wartości etapów) to zwykłe etykiety, bez menu — not exercised this pass: needs a share/preview link for inw. 119, which was not generated this pass; deferred to the same follow-up as the EX-682/683 investor-preview boxes below (several of those also need the same link — worth generating once and reusing).

### Findings — 2026-08-26 (batch B12)

- [ ] **`planned_qty` (Przedmiar) carries raw floating-point drift values in the DB, e.g. `9.719999999999999` and `13.219999999999999` (inw. 119, item ids 5378/5379-ish, „fugowanie ścian i podłóg" / „Położenie folii w płynie (izolacji)").** Confirmed via `psql`: the value is stored exactly this way in `kosztorys_items.planned_qty` — not a rendering artifact. `src/lib/utils/decimal-text.ts`'s `decimalText()` renders it with `String(value)` **by design** (its own doc comment: deliberately not rounding, so the cell's displayed text round-trips back to the same number when re-parsed for editing) — so the fix isn't in the display helper. The drift must come from whatever wrote `planned_qty` (a JS float sum done before the value reached Postgres — e.g. summing several stage quantities in floating point without a decimal-safe library). Did not chase the write path (out of this pass's scope and risk — kosztorys data is throwaway per `AGENTS.md`, but the write-path bug itself may not be).
      **Needs human:** decide whether this is worth a fix now (likely a decimal-safe sum, or a `Math.round(x * 100) / 100` at the write boundary) given kosztorys data is throwaway pre-dogfooding, or worth tracking as a Linear item for before dogfooding ships.
      **Test disposition:** test-driven-debugging once the write path is found — unit test asserting the write boundary never persists more than 2 decimal places for a qty column; until then, no automated test (root cause not yet located).

## EX-713 / EX-714 — pasek aktywnych filtrów i trzy nowe pary warunków

**In review** — automaty zielone (tsc 0, eslint 0 na zmienionych plikach, `pnpm test` bez nowych
błędów: dwa istniejące pady dotyczą `LABOR_COST` / `RABAT` w dialogu transferów i są sprzed tej
zmiany). Wszystko, co skraca siatkę, dostaje swój chip pod paskiem narzędzi; rejestr rośnie o rabat,
źródło stawki wykonawcy i komentarz.

Setup: baza testowa 5435 z rozpisanym kosztorysem (`pnpm seed:kosztorys:test`), w nim co najmniej
jedna pozycja z rabatem, jedna z ręczną stawką wykonawcy, jedna z komentarzem i kilka bez.
Zalogowany jako OWNER.

- [x] Przy czystym kosztorysie paska chipów nie ma wcale; odznaczenie czegokolwiek w „Filtrach" wywołuje go pod paskiem narzędzi
      _Verified: staging, inw. 119 — clean kosztorys (all filters/search cleared) showed no chip bar at all (no „Ukryto"/„Zwinięte" text anywhere); unchecking „Pozycje z rabatem (1)" in „Filtrach" immediately produced the chip bar with „Ukryto: pozycje z rabatem (1)" and its restore button._
- [x] Chip filtra mówi „Ukryto: …", chip problemu „Tylko: …", a X przy każdym zdejmuje dokładnie jego
      _Verified: staging, inw. 135 — enabling the „pozycje bez ceny j.m." problem produced a chip reading exactly „Tylko: pozycje bez ceny j.m. (7)" with its own X._
- [x] Zwinięte sekcje to jeden chip z liczbą
      _Verified: staging, inw. 119 — collapsing the „Klimatyzacja" section (no work filter engaged) produced exactly one aggregate chip „Zwinięte sekcje (1)" with a „Rozwiń wszystkie sekcje" button, not one chip per section._
- [x] Wpisana fraza ma swój chip; jego X czyści też pole „Szukaj"
      _Verified: typing „test" into the search box produced a chip reading „Szukaj: „test"" with its own X; clicking that X cleared the search field._
- [x] „Wyczyść wszystko" pojawia się od dwóch chipów i zdejmuje wszystko naraz — łącznie z frazą
      _Verified: with both the problem chip and the search-phrase chip active, „Wyczyść wszystko" appeared and clicking it cleared both in one action (grid returned to its unfiltered state)._
- [x] Filtry ustawione wczoraj wracają po przeładowaniu
      _Verified: staging, inw. 119 — engaged „Pozycje z rabatem (1)", then reloaded the page; both the „Filtry (1)" badge and the „Ukryto: pozycje z rabatem" chip survived the reload unchanged. Note: this persistence is specific to the „Filtry" work-condition selections (per-investment, `useEngagedConditions`) — section folds are separate, deliberately session-only state and do NOT survive a reload; see the „Link dla inwestora" finding below._
- [x] Przy kilkunastu chipach pasek zawija się na kolejne linie
      _Verified: staging, inw. 119 — with 4 work-filter chips engaged simultaneously (`Pozycje bez przedmiaru`, `Pozycje bez wykonanej pracy`, `Pozycje z rabatem`, `Pozycje bez komentarza`) the bar sits on one line at 1280px width and wraps cleanly to two lines at 700px, with „Wyczyść wszystko" trailing onto its own row. Only 4 independent work-filter pairs exist to engage at once on this fixture (each pair's members are mutually exclusive), so a literal dozen-plus wasn't reached with real chips — the wrap mechanism itself is confirmed working._
- [x] Przy włączonym filtrze zwinięta sekcja rozwija się sama
      _Verified: staging, inw. 119 — manually collapsed „Klimatyzacja" (no filter engaged, fold visibly took effect), then engaged „Pozycje z komentarzem (1)"; „Klimatyzacja" flipped back to expanded automatically the instant the filter engaged. Root cause in code: `isFoldSuppressed()` (`src/lib/kosztorys/row-conditions.ts`) forces `collapsedSectionIds` empty whenever any work-filter condition is engaged or search is non-empty — deliberate, documented behavior, not a bug._
- [x] „Filtry" mają nowe pary: rabat, źródło stawki wykonawcy, komentarz — każda po dwie pozycje
      _Verified: „Filtry" → „Prace" group listed pairs for rabat, źródło stawki wykonawcy (only visible in the „Z narzędziami" view), and komentarz alongside the pre-existing conditions — confirms the three pairs exist. Uncheck/re-check behavior for each pair not separately exercised._
- [x] Para rabatowa znika z menu po włączeniu rabatu globalnego
      _Verified: staging, inw. 119 — set global discount to Kwotowy/100 zł via „Pokaż podsumowanie" → „Opcje rozliczenia"; reopened „Filtry" and confirmed BOTH the „Prace" pair (`Pozycje z rabatem`/`Pozycje bez rabatu`) and the „Sekcje" pair (`Sekcje z rabatem`/`Sekcje bez rabatu`) vanished entirely from the menu. Reverted global discount to „Wyłączony" afterward._
- [x] Pary o stawce wykonawcy widać tylko na widoku, którego dotyczą; przełączenie osi cen nie zabiera filtra
      _Verified: staging, inw. 119 — switched „Widok cen" to „Z narzędziami"; the rate-source pair „Pozycje ze stawką wykonawcy wpisaną ręcznie/z formuły w widoku z narzędziami" appeared only there (absent on „Inwestor"). Engaged the „wpisaną ręcznie" condition, switched back to „Inwestor": the „Filtry (1)" badge and its chip persisted, and the engaged option stayed listed in the menu on „Inwestor" while its unengaged pair-mate correctly disappeared (plane-gate „never strand an engaged condition" rule in `kosztorys-filters-menu.tsx`). Reverted „Widok cen" to „Inwestor" afterward._
- [ ] „Sekcje z rabatem" / „bez rabatu"
      _Partial: staging, inw. 119 — this pair is not a pozycje-hiding filter like the „Prace" pairs; it's a bulk section-fold toggle (`sectionToggles` in `kosztorys-filters-menu.tsx`) that collapses every section fully matching the condition. „Sekcje bez rabatu (13)" bulk-collapsed all 13 sections in one click (`Filtry (13)`, chip „Zwinięte sekcje (13)" appeared). „Sekcje z rabatem" reads `(0)` on this fixture (no section is entirely rabat-covered), so it correctly no-ops rather than being untestable — a section fully covered by a rabat row would be needed to see this specific pair member actually fold something._
- [x] Pojawienie się paska spycha siatkę w dół
      _Verified: staging, inw. 119 — screenshot comparison shows the grid's column header row sits directly below the chip bar whenever chips are present, at both the 1-line 4-chip layout (1280px) and the wrapped 2-line layout (700px)._
- [x] Przycisk „Kolumny” licznik ukrytych kolumn
      _Verified: staging, inw. 119 — opened „Kolumny" popover, read every option's check-icon state programmatically: exactly 1 hidden column („Sekcja"), matching the „Kolumny (1)" badge exactly._
- [ ] Link dla inwestora — sekcje zwinięte przychodzą zwinięte
      _Finding, not a pass: staging, inw. 119 — collapsed „Podłogi" in the editor, then loaded `/podglad-inwestora/119`: the section rendered expanded there — folds do NOT carry to the investor link. Deliberate per code: `storedCollapsedSectionIds` in `use-kosztorys-view-state.ts` is plain `useState` with an explicit comment ("Deliberately NOT persisted: a fold is a reading gesture for the current session, and a remembered one would greet the next visit with rows the user can't see and doesn't remember hiding") — it doesn't even survive the OWNER's own reload, let alone reach a separate investor session. This checklist item's literal expectation doesn't hold under the current design — needs a human call on whether the box is simply wrong, or whether investor-facing collapse should become a separate, server-persisted setting (`kosztorys-client-view` has no such field today)._

## EX-711 — moduł floty: przeglądy pojazdów i przypomnienia mailowe

**In review** — automaty zielone (tsc 0, `pnpm test` 2514/2514, build OK; jeden błąd eslint w
`src/hooks/use-latest-request.ts` jest sprzed tej zmiany). Migracja zastosowana lokalnie.

Setup: baza testowa 5435, zalogowany jako OWNER. Dodaj dwa pojazdy — jeden `W użyciu`, jeden
`Wycofany` — i wpisy przeglądów o terminach 45 / 30 / 7 / 1 / −3 dni od dziś.

- [x] „Flota" jest w bocznym menu; jako EMPLOYEE nie ma jej wcale, a wejście na `/flota` wyrzuca na stronę główną
      _Verified by code (B3 precedent — no live EMPLOYEE login in the shared session, to avoid disrupting concurrent batches): `src/components/nav/sidebar.tsx` gates the „Flota" link behind `isManagementRole(user.role)`; `src/app/(frontend)/flota/page.tsx` and `flota/[id]/page.tsx` call `requireAuth(MANAGEMENT_ROLES)` and `redirect('/')` on failure. `MANAGEMENT_ROLES = ['ADMIN','OWNER','MANAGER']` (`src/lib/auth/roles.ts`) excludes EMPLOYEE._
- [x] Dodanie pojazdu, a potem przeglądu każdego z pięciu typów, daje na liście pięć wypełnionych kolumn terminów
      _Verified: /flota list for QA B7 001 shows all five term columns filled — Przegląd techniczny 25.09.2026, OC 10.10.2026, Wymiana oleju 02.09.2026, Przegląd gwarancyjny 27.08.2026, Wymiana opon 23.08.2026._
- [x] Wybór „Przegląd techniczny" podpowiada termin 12 miesięcy do przodu, „Wymiana opon" nie podpowiada nic
      _Verified: „Nowy przegląd" dialog for QA B7 001 defaults to Rodzaj=„Przegląd techniczny" with Data wykonania 26 sie 2026 and Następny termin auto-filled 26 sie 2027 (exactly +12 months). Switching Rodzaj to „Wymiana opon" clears the field to placeholder „Wybierz datę" — no suggestion at all._
- [x] Nadpisanie podpowiedzianej daty, a potem zmiana typu, **nie** kasuje wpisanej daty
      _Verified: fresh „Nowy przegląd" dialog, Rodzaj=Przegląd techniczny defaults Termin to 26 sie 2027; manually picked 15 sie 2027 instead; switching Rodzaj to OC left Termin at „15 sie 2027" — not reset to OC's own +12-month suggestion. Dialog closed without saving._
- [x] Pole „Następna wymiana przy (km)" widać wyłącznie przy typie „Wymiana oleju"
      _Verified: „Nowy przegląd" dialog for QA B7 001 shows „Następna wymiana przy (km)" only when Rodzaj=„Wymiana oleju" (placeholder 135000); confirmed absent for Przegląd techniczny, OC (via schema default), Przegląd gwarancyjny, Wymiana opon, Serwis dialogs._
- [x] Pojazd bez wpisu wymiany oleju ma w tej kolumnie szare „brak danych", a nie fałszywy zielony termin
      _Verified: QA B7 002 (0 inspections) shows grey „brak danych" across all five term columns on /flota list, never a fabricated date._
- [x] Pojazd z wpisem bez terminu ma „bez terminu" — to inny stan niż „brak danych"
      _Verified: QA B7 002, saved a Wymiana opon entry (890 zł) with Termin left empty (TYRES gives no suggestion). /flota row: „Wymiana opon" column reads „bez terminu" while the other four term columns (no entries at all) still read „brak danych" — visibly distinct states._
- [x] Wycofany pojazd jest wizualnie odsunięty i nie ma kolorowania pilności
      _Verified: QA B7 002 (status RETIRED in DB) renders in muted grey text throughout the /flota row, „Wycofany" shown as plain text (vs. QA B7 001's green „W użyciu" pill), no urgency colors on any column._
- [x] Strona pojazdu pokazuje historię pogrupowaną po typie, najnowsze u góry, z przebiegiem od poprzedniego wpisu
      _Verified: history is grouped under one heading per type (Przegląd techniczny/OC/Wymiana oleju/…). Two Przegląd techniczny entries (26.08.2026 and 25.08.2026) render newest-first. „Od poprzedniego" column present, showing „—" where no prior same-type odometer reading exists to diff against._
- [x] Wpis bez odczytu przebiegu nie pokazuje różnicy km (a nie „+0 km")
      _Verified: OC/Przegląd gwarancyjny/Wymiana opon/Przegląd techniczny rows for QA B7 001 (no przebieg entered) show „—" in Przebieg and Od poprzedniego columns, never „+0 km"._
- [x] Załącznik dodany do przeglądu liczy się na liście historii (ikona spinacza)
      _Verified: attached a PNG to a Przegląd techniczny entry; vehicle detail history table gained a „Załączniki" column showing „📎 1" for that row and „—" for rows without an attachment._
- [ ] Ręczne wywołanie `/api/cron/fleet-reminders` przy terminach 45 / 30 / 7 / 1 / −3 wysyła jeden mail zawierający dokładnie trzy ostatnie (30 dni nie mailuje), w odpowiednich sekcjach
- [ ] Mail przychodzi na oba adresy z listy „Powiadomienia o terminach" na `/flota` jako jedna wiadomość
- [ ] Ponowne wywołanie tuż po tym nie wysyła nic
- [ ] Termin po czasie odzywa się ponownie dopiero po tygodniu, nie codziennie
- [ ] Wpisanie przeglądu, o który mail się upominał, ucisza go przy kolejnym uruchomieniu
- [ ] Wpis wymiany oleju z celem km, a potem przegląd z odczytem 500 km przed celem, daje w mailu linijkę z celem i ostatnim odczytem
- [ ] Pojazd, który wjechał w okno 30 dni, podbija plakietkę przy „Flota"; wejście na `/flota` ją zeruje
- [ ] Plakietka przy „Zgłoszenia" zachowuje się dokładnie jak dotąd
- [x] Dialog „Przegląd" otwiera się z dzisiejszą datą w polu „Data wykonania"
      _Verified: every „Nowy przegląd" dialog opened for QA B7 001 (6 times) defaulted Data wykonania to 26 sie 2026 — today's date at time of testing._
- [x] Wpisanie przebiegu niższego niż ostatni zapisany dla tego pojazdu pokazuje pod polem ostrzeżenie, ale nie blokuje zapisu
      _Verified: entering 50 000 km (last saved was 134 500 km) shows paragraph „Ostatni zapisany przebieg to 134 500 km — wpisany odczyt jest niższy." under Przebieg field; save still succeeded (new Przegląd techniczny row with 50 000 km persisted)._
- [x] Pojazd z wymianą oleju przy 100 000 km i późniejszym odczytem 115 000 km ma plakietkę „Olej" w tabelce floty i w szczegółach pojazdu
      _Verified (analogous fixture: oil change at 120 000 km, later reading 134 500 km = 14 500 km since change): /flota table shows red „⚠ Olej +4500 km" badge (`OilIntervalBadge`, fixed `OIL_CHANGE_INTERVAL_KM=10_000` in `src/lib/fleet/thresholds.ts`, independent of the manually-entered „Wymiana przy" target). Vehicle detail page surfaces the same overdue state via a distinct element — „Od wymiany oleju do ostatniego odczytu przejechano: ⚠ 14 500 km" with a warning icon — not a duplicate „Olej +N" badge; a code comment in `oil-interval-badge.tsx` confirms this is deliberate (avoids repeating the same figure twice on the detail page). Functionally equivalent, not a defect._
- [ ] Ten sam pojazd trafia do mailowej sekcji „Wymiana oleju — limit kilometrów" z informacją o przekroczeniu, mimo że nikt nie wpisał celu km
- [x] Sekcja „Koszty" na stronie pojazdu sumuje wpisy per rodzaj i w wierszu „Razem", a „Szczegóły" listują te same wpisy od najnowszego
      _Verified: QA B7 001 (7 wpisów: Przegląd techniczny 2/549 zł, OC 1/350 zł, Wymiana oleju 1/280 zł, Przegląd gwarancyjny 1/890 zł, Wymiana opon 1/1200 zł, Serwis 1/150 zł). „Razem" row = 7 / 3419,00 zł, matches 450+99+350+280+890+1200+150. „Szczegóły" table lists all 7 rows newest-first: 27.08 Serwis, 26.08 (4 rows), 25.08 Przegląd techniczny — same entries, no discrepancy._
- [x] Strona pojazdu otwiera się na „Przeglądy"; przełącznik „Koszty" pokazuje podsumowanie i szczegóły, a powrót na „Przeglądy" działa
      _Verified: /flota/2 loads with „Przeglądy" radio checked and grouped history visible; clicking „Koszty" swaps in Podsumowanie+Szczegóły; clicking „Przeglądy" again correctly re-renders the grouped history table (heading „Przegląd techniczny" / Data / Następny termin columns back)._

### Findings — 2026-08-26

- [ ] **7 boxes unreachable — mail delivery/content requires inbox access, and `/api/cron/fleet-reminders` sits behind Vercel Preview SSO** — the 6 mail-content boxes (jeden mail, dwa adresy, brak powtórki, tygodniowy re-alert, uciszenie po wpisie, linijka wymiany oleju z celem km) plus the oil-change-mail box need an actual inbox to confirm delivery/content, which this pass has no access to. Independently, `CRON_SECRET` from local `.env` (`Bearer` header) does **not** reach the route handler on this deployment — `curl` gets a 302 to `vercel.com/sso-api`, i.e. Vercel's Preview deployment-protection layer intercepts the request before Next.js routing runs; no bypass token (`VERCEL_AUTOMATION_BYPASS_SECRET` or similar) is present in `.env` to get past it. The route itself (`src/app/(payload)/api/cron/fleet-reminders/route.ts`) does return a useful `{ok, sent, sections: {overdue, within7, odometer}}` body that could partially verify the sweep logic (section counts) without needing the inbox — but only once something can reach it.
      **Needs human:** either run this pass locally (`pnpm dev`, real `.env`, no Vercel SSO in front) with a real or logged mail transport, or supply a Vercel deployment-protection bypass token for this preview so the cron route is reachable from outside the browser session.
      **Test disposition:** no automated test — these are live-mail/live-cron content checks; the underlying digest-building logic (`buildFleetDigest`, `isEmptyDigest`) is a separate concern from delivery and was not audited for unit coverage in this pass.
- [ ] **2 boxes (Flota badge bump + reset) — structurally unobservable through the UI alone in one sitting** — `countUnreadFleetDeadlines` (`src/lib/db/notifications.ts`) counts inspections whose `GREATEST(next_due_at - 30 days, created_at) > seen_at`, and `markSeen(stream='fleet')` fires on **every** load of both `/flota` and `/flota/[id]` (both call it in their RSC loader). Since the only UI path to create a fixture inspection _is_ the vehicle detail page, and that page's own load just re-marked the stream seen, any fixture created there is dated with a `created_at`/window-entry that (in the common case) lands at or before the very next markSeen call, never surfacing as unread. Confirmed via SQL: `notification_reads` cursor for user 63/stream fleet sat at `03:40:09`, and no live badge digit ever appeared next to „Flota" in the sidebar (`<a href="/flota">` inner HTML has no counter element) across this whole session's fixture-building. This isn't inconclusive noise — it's the mechanism itself preventing observation.
      **Needs human:** either a raw SQL insert with a controlled `created_at`/`next_due_at` (currently disallowed — UI-only fixtures per this batch's rules) or waiting for real calendar time to carry a due-date into the 30-day window without touching a fleet page in between. The „Zgłoszenia" badge box is unaffected by this — that stream's page/creation paths are separate and untouched this session.
      **Test disposition:** no automated test attempted here; the SQL/cursor mechanism read from code looks correct (`GREATEST` covers the same-day-entry edge case per its own comment) — this is a coverage gap in _manual_ verification, not a suspected regression.
- [ ] **Cross-vehicle/cross-navigation draft leakage in „Nowy przegląd" (no checklist box names this directly — logged as its own finding)** — closed the dialog on QA B7 001 (id 2) without saving after manually overriding Rodzaj→OC and Termin→15 sie 2027, then navigated to a completely different vehicle (QA B7 002, id 3) and opened a fresh „Przegląd" dialog there: Rodzaj and Termin both still showed the abandoned OC/15-sie-2027 values from the other vehicle, while „Pojazd" correctly re-initialized to QA B7 002. So the unsaved-draft store is scoped per form-type globally, not per-vehicle, and survives a full page navigation — an inconsistent mix (Pojazd resets, everything else doesn't).
      **Needs human:** confirm whether this is the intended behavior of the draft-persistence feature (convenience for repeat data entry) or a scoping bug — Section 2 of this file (`## EX-711 — flota: ręczne znaczniki…`) may already own a related check; if not, this is new.
      **Test disposition:** no automated test — no repro attempted at the unit/integration level in this pass; if confirmed a bug, the fix is small enough (scope the draft key by vehicle id) that a regression test should accompany the fix directly rather than being filed separately.

## blob-store-isolation — lokalny dev na preview Blob store

### Faza 1: Przepięcie non-prod na preview store

- [ ] `pnpm dev` wstaje i istniejąca faktura się renderuje (bajty serwuje teraz preview store)
- [ ] Upload nowej faktury lokalnie kończy się sukcesem, a plik pojawia się w `wykonczymy-blob-preview`, nie w `wykonczymy-blob`
- [ ] `vercel env pull` do pliku roboczego daje dla Development token preview, nie produkcyjny

### Faza 2: Odrzucenie produkcyjnego tokenu Blob poza produkcją

- [ ] Wklejenie produkcyjnego tokenu do `.env` (i `.env.local`) → `pnpm dev` **wstaje** (Next kompiluje trasy leniwie), ale pierwsze wejście na dowolną stronę `(frontend)` rzuca błędem nazywającym `BLOB_READ_WRITE_TOKEN`
- [ ] Przy tym samym tokenie wejście **prosto na `/admin/collections/media`**, bez odwiedzania `(frontend)`, też rzuca błędem — to strażnik z `payload.config.ts`, na ścieżce która faktycznie kasuje
- [ ] `pnpm build` z produkcyjnym tokenem kończy się niepowodzeniem (bramka builda)
- [ ] Odwrotny kierunek: `VERCEL_ENV=production pnpm build` przy zwykłym (preview) tokenie w `.env` **też** kończy się niepowodzeniem — komunikat nazywa store preview. Bez tej zmiennej ten sam build przechodzi, co potwierdza, że strażnik trzyma się `VERCEL_ENV`, a nie `NODE_ENV`

### Faza 3: Komenda odświeżająca + blokada zapisu do proda

- [ ] `pnpm blob:refresh:preview` kończy się i raportuje deltę, którą wgrał (0 tuż po świeżym restore)
- [ ] Po `pnpm db:import` ze świeższego dumpa ta sama komenda sprawia, że wcześniej 404-ujące faktury renderują się lokalnie

### Faza 4: Dokumentacja

- [ ] Czytając samo `AGENTS.md` da się powiedzieć, które środowisko używa którego store'a i jak świadomie sięgnąć po produkcyjny

### Dodatkowo (kasowanie — sedno zmiany)

- [ ] Usunięcie testowego wydatku z lokalnym uploadem kasuje blob z **preview** store, a licznik plików w `wykonczymy-blob` (prod) pozostaje bez zmian

## import-zastepuje-w-calosci — import zastępuje całą rozpiskę

### Faza 1: Klucz kojarzenia prac odporny na literówki

- [ ] Na inwestycji 90: „Popraw literówki w opisie prac", potem „Porównaj z arkuszem Google" — różnica nie rośnie (przed zmianą: 83 → 137 po jednym przebiegu poprawiania)

### Faza 2: Import zastępuje

- [ ] Import na inwestycję z jedną pracą, której arkusz nie ma: po imporcie pracy nie ma, a „Wersje" trzyma opisaną wersję sprzed importu, która ją przywraca

### Faza 3: Podgląd mówi, co zniknie

- [ ] Podgląd importu na inwestycji z pracami spoza arkusza, w tym jedną z wpisanymi etapami: liczba, treść i znacznik „wpisane etapy" zgadzają się jeszcze przed zapisem

### Faza 4: „Wyczyść kosztorys"

- [ ] Wyczyszczenie zasianej inwestycji: siatka pustoszeje bez przeładowania, „Wersje" trzymają „Przed wyczyszczeniem", przywrócenie wraca z całą rozpiską (razem z etapami i wykonaniem), a stawka VAT i współczynniki są nietknięte

### Faza 5: Wymiecenie inwestycji 90

- [ ] „Porównaj z arkuszem Google" pokazuje zerową różnicę, a siatka ma 373 wiersze, nie 456

### Findings — 2026-08-26

- [ ] **Sekcja nie napędzona — inwestycja 90 nazwana „kosztorys wzór. nic nie dodajemy" i obecnie ma 0 pozycji** — SQL na `DB_POSTGRES_URL_CUTOVER` potwierdza inw. 90 istnieje (`kosztoryses.id=36`, `google_sheet_id=1RpR_i4NKaoGhaUaG6o7USzfpX31UPGhQZIMUJr-oSCI`, `kosztorys_items` count=0), więc żadna z historycznych liczb w checkliście (83→137 literówek, 373 vs 456 wierszy) nie odpowiada bieżącemu stanowi — cały ciąg faz zakłada konkretny, wcześniej zasiany stan tej inwestycji, którego nie ma. Nazwa inwestycji („nic nie dodajemy") czyta się jako świadome ostrzeżenie właściciela przed jej modyfikacją, więc nie zasiałem/importowałem do niej niczego bez wyraźnej zgody — zwłaszcza że Faza 5 wprost każe „wymieść" (wyczyścić) tę inwestycję, co jest nieodwracalne bez wcześniej zapisanej „Wersji".
      **Needs human:** czy inwestycja 90 nadal jest właściwą fixture dla tej sekcji (i wolno ją zasiać/wymieść w ramach tego przebiegu), czy sekcja wymaga przepisania na inwestycję 135 (throwaway QA data) z odtworzeniem analogicznego scenariusza (literówki w opisach, prace spoza arkusza, wpisane etapy).
      **Test disposition:** no automated test — to end-to-end scenariusz manualny na żywych danych arkusza Google; nie audytowano tu pokrycia jednostkowego/integracyjnego importu/porównania (poza zakresem tego przebiegu).

## kosztorys-client-view-offer-settlement-variants — warianty „Oferta / Rozliczenie"

> Migracja weszła na 5433 i 5435 — dev server uruchomiony przed nią serwuje `column does not exist`
> mimo poprawnej bazy. Zrestartuj go przed pierwszym kliknięciem.

- [x] W `/admin` wiersz „Ustawienia podglądu inwestora" pokazuje pole trybu z etykietami „Oferta" / „Rozliczenie"
      _Verified: `/admin/collections/kosztorys-client-view/2` — „Mode" field is a select showing „Oferta"; opening the dropdown lists both options „Oferta" and „Rozliczenie"._
- [x] Przełączenie „Oferta ⟷ Rozliczenie" w oknie ustawień zmienia zestaw ticków i nic nie zapisuje do kliknięcia zapisu; kolumny odklikane w ofercie są nietknięte po powrocie
      _Verified: switching the radio in the settings dialog immediately changed the checked-columns set (e.g. „Pomiar (razem etapy)"/„Jednostka miary"/„Cena j.m. netto" go from unchecked→checked); switching back to Oferta showed „Jednostka miary" unchecked again, exactly as left — no save clicked between switches._
- [x] Zapis po zmianie wariantu podnosi okienko „Uwaga — zmiana widoczna dla inwestora!" (jak przy zmianie rozliczenia materiałów); „Anuluj" nic nie zapisuje, a zapis bez zmiany wariantu nie pyta o nic; etykieta przycisku nazywa wariant, który zobaczy inwestor
      _Verified: button label reads „Zapisz i pokaż rozliczenie" once Rozliczenie is selected (and „…ofertę" for Oferta); clicking it raises the alertdialog „Uwaga — zmiana widoczna dla inwestora!" with variant-aware body text both directions; „Anuluj" → SQL confirms `mode` unchanged (`OFFER`); „Potwierdź" → SQL confirms `mode` flips to `SETTLEMENT`/back to `OFFER`; a save with no variant change (still Oferta) triggered no confirm dialog at all._
- [x] Link `/k/<token>` w trybie `OFFER` pokazuje kolumny ofertowe; po przestawieniu na `SETTLEMENT` ten sam link pokazuje kolumny rozliczeniowe
      _Verified: same token, `mode=OFFER` → no „Jednostka miary" column; after confirming the switch to `SETTLEMENT`, same token → „Pomiar (razem etapy)", „Jednostka miary", „Cena j.m. netto" all render._
- [x] „Zapisz jako domyślne" na wariancie ofertowym nie rusza domyślnych rozliczenia (sprawdzalne przez drugą inwestycję bez własnego wiersza)
      _Same fixture gap as the Section-1 „Zapisz jako domyślne" box (no third investment to observe). Verified at the persistence layer: `kosztorys_client_view_defaults.variants` was empty; clicking „Zapisz jako domyślne" on Oferta wrote only an `OFFER` key, no `SETTLEMENT` key — matches the mode-scoped read-modify-write in `src/lib/actions/kosztorys-client-view.ts:59-82`._
- [x] Okno „Udostępnij" ma ten sam przełącznik i to samo okienko potwierdzenia na „Dalej"; „Dalej" bez żadnej zmiany nie tworzy wiersza dla inwestycji, która go nie miała
      _Verified the shared switcher + confirm: „Udostępnij" dialog has the same „Oferta"/„Rozliczenie" radio group; switching to Rozliczenie and clicking „Dalej" raised the same „Uwaga — zmiana widoczna dla inwestora!" alertdialog; „Anuluj" left `mode` unchanged in DB. **Not verified:** the „doesn't create a row for an investment that didn't have one" half — same fixture gap, investment 135 already has a `kosztorys_client_view` row so no no-row case exists to observe here._

## sheet-measured-qty-from-formula — „Pomiar z natury" z formuły

### Faza 2: Zawężenie reguły odczytu

- [ ] „Porównaj z arkuszem…" na inwestycji 65 raportuje prace, których Pomiar był wcześniej odrzucany, a menu „Problemy" pokazuje niezerowe „z pomiarem do rozpisania na etapy"

### Faza 3: Komentarze i zapis

### Findings — 2026-08-26

- [ ] **Faza 2, box 1 nie napędzony — inwestycja 65 „Okocimska 9" ma obecnie 0 pozycji kosztorysu** — SQL na `DB_POSTGRES_URL_CUTOVER` potwierdza inw. 65 istnieje (`kosztoryses.id=23`, `google_sheet_id=1TGmDipiBgGoZKarDXHr9N_QM5uPuZ61iYfMxLgZgjIo`), ale `kosztorys_items` count=0 — więc nie ma na niej obecnie prac „których Pomiar był wcześniej odrzucany" do zaraportowania. W przeciwieństwie do inw. 90 nazwa nie ostrzega wprost przed modyfikacją, ale to prawdopodobnie realna inwestycja klienta (adres w nazwie), nie throwaway QA jak inw. 135 — nie importowałem/zasiewałem do niej danych bez wyraźnej zgody.
      **Needs human:** czy inwestycja 65 nadal jest właściwą fixture dla tego boxa (i wolno na niej odpalić „Pobierz z arkusza Google", by odtworzyć historyczny stan), czy box wymaga innej inwestycji.
      **Test disposition:** no automated test — scenariusz manualny na żywym arkuszu Google specyficznym dla inw. 65; logika `readMeasuredQty`/`measureDiscrepancy` ma już pokrycie jednostkowe (nie audytowano ponownie w tym przebiegu).

## mixed-settlement-both-planes — wpłaty na obu planach, jeden bilans na tryb

Setup: baza testowa 5435 (`DB_POSTGRES_URL_TEST`) z rozpisanym kosztorysem
(`pnpm db:import:test` + `pnpm seed:kosztorys:test`), zalogowany jako OWNER. Potrzebna inwestycja
z zaksięgowanymi wpłatami od inwestora **obu form** (gotówka i przelew) oraz możliwość przestawienia
jej trybu rozliczenia.

- [x] Na `/inwestycje` bilans v2 inwestycji z wpłatami równa się „Pozostało do zapłaty" z panelu Podsumowania tej samej inwestycji, ze znakiem przeciwnym
      _Verified: staging inw. 135 (tryb NET), zaksięgowano 2 wpłaty od inwestora (#4599 gotówka 1000 zł netto, #4600 przelew 2460 zł brutto/2277,78 zł netto z faktury). `/inwestycje` wiersz: „Bilans netto v2" = **-1722,22 zł**. `/inwestycje/135?widok=v2`: „Pozostało do zapłaty" = **1722,22** (robocizna netto 5000,00 − wpłaty netto 3277,78). Znak przeciwny potwierdzony liczbowo._
- [x] Inwestycja rozliczana netto pokazuje „nie dotyczy" w kolumnie bilansu brutto i odwrotnie; mieszana pokazuje netto
      _Verified na żywo na inw. 135, przełączając „Opcje rozliczenia" → „Rozliczenie robocizny" (z potwierdzeniem ostrzeżenia „zmiana widoczna dla inwestora"), za każdym razem sprawdzone SQL-em (`settlement_mode`) i odczytem wiersza `/inwestycje`:_ - _NET: „Bilans netto v2" = -1722,22 zł, „Bilans brutto v2" = **nie dotyczy**_ - _GROSS: „Bilans netto v2" = **nie dotyczy**, „Bilans brutto v2" = -2940,00 zł_ - _MIXED: „Bilans netto v2" = -1722,22 zł (ta sama wartość co NET), „Bilans brutto v2" = **nie dotyczy**_
      _Zgodne z kodem: `MONEY_AXIS_BY_MODE` w `src/lib/kosztorys/settlement-mode.ts` mapuje `MIXED → 'net'`. Inwestycja przywrócona na NET po teście._
- [x] Dialog edycji wpłaty nie ma pola formy wpłaty i zapis edycji nie zmienia tagu
      _Verified: „Edytuj transakcję" na #4599 (gotówka, `vat_plane=NET`) — dialog ma tylko Opis/Data/Inwestycja/Kategoria/Notatka/faktury, **brak** pola Metoda płatności/Forma wpłaty. Zmieniono Opis na „QA edit test", zapisano — SQL po zapisie: `payment_method=CASH`, `vat_plane=NET` bez zmian._
- [x] W panelu admina pole „Rozliczenie netto/brutto" na zaksięgowanej wpłacie jest tylko do odczytu
      _Verified: `/admin/collections/transactions/4599` → sekcja „Rozliczenie netto/brutto" renderuje wartość „Netto" jako tekst obok `button [disabled]` — pole nieedytowalne._
- [x] Zaksięgowanie wydatku (nie wpłaty) zostawia tag pusty, także po edycji
      _Verified: dodano wydatek inwestycyjny #4601 (100 zł, Materiały budowlane, gotówka) — SQL: `type=INVESTMENT_EXPENSE`, `payment_method=CASH`, `vat_plane` puste (NULL). Kolumna „Forma wpłaty" w tabeli transferów renderuje „—". Edytowano Opis (edit dialog nie ma pola formy wpłaty, tak jak przy wpłacie), zapisano — `vat_plane` po edycji nadal puste._
- [x] Kolumna na `/transfery` mówi „Forma wpłaty" i pokazuje „Gotówka" / „Przelew"
      _Verified: trasa główna transakcji (`/`, ten sam komponent `src/components/tables/transfers.tsx` co inwestycyjna tabela transferów — projekt nie ma osobnej trasy `/transfery`, nawigacja „Transakcje" wskazuje `/`) — nagłówek „Forma wpłaty" obecny, wiersze #4599/#4600/#4601 pokazują „Gotówka" / „Przelew" / „—" odpowiednio._
- [x] Formularz wpłaty gotówką ma jedno pole kwoty bez słowa „netto" w etykiecie
      _Verified w kodzie i UI: `PlaneAmountField` (`plane-amount-field.tsx:43-56`) renderuje dla NET jedno pole „Kwota (PLN)" (bez „netto"); przy GROSS pokazuje dwa pola „Kwota brutto (PLN)" + „Kwota netto z faktury (PLN)". Potwierdzone na żywo przy zapisie wpłaty #4599 (Gotówka netto → jedno pole „Kwota (PLN)")._

## EX-720 — nadmiarowe odczyty na trasach kosztorysu

Setup: baza testowa 5435 — pełny reset to trzy kroki (`pnpm db:import:test`, `pnpm seed:kosztorys:test`,
`pnpm seed:deposits:test`). Potrzebne trzy sesje
(OWNER, MANAGER, EMPLOYEE), inwestycja z podpiętym arkuszem Google i druga bez, inwestycja
z wypłatami dla podwykonawców (w tym jedną bez przypisanego pracownika) oraz inwestycja, której
jedyne wydatki na materiał są typu „rozliczone R+M".

- [ ] „Podsumowanie podwykonawców" pokazuje te same sumy per pracownik co przed zmianą — **nie zweryfikowano** (budżet czasu — patrz Findings)
- [ ] Wypłata bez pracownika dalej figuruje jako „Bez przypisanego pracownika" i wlicza się w „Pozostało do wypłaty" — **nie zweryfikowano** (budżet czasu — patrz Findings)
- [ ] Pracownik z przypisanymi etapami i bez wypłaty dalej dostaje swój wiersz — **nie zweryfikowano** (budżet czasu — patrz Findings)
- [ ] „Lista wpłat" pod blokiem wymienia każdą wypłatę z właściwym nazwiskiem — **nie zweryfikowano** (budżet czasu — patrz Findings)
- [ ] Inwestycja z samymi rozliczonymi materiałami: brak komunikatu „Brak wydatków", tabela „rozliczone R+M" widoczna, lista pokazuje te wiersze — i **nie ma wykresu kołowego samych zer** — **nie zweryfikowano** (budżet czasu — patrz Findings)
- [ ] Inwestycja bez materiałów w ogóle: „Brak wydatków inwestycyjnych na materiały." i żadnych pustych tabel pod spodem — **nie zweryfikowano** (budżet czasu — patrz Findings)
- [ ] Inwestycja ze zwykłymi wydatkami: tabela podziału, wykres i „Lista wydatków" obecne, a „Razem" listy zgadza się z podziałem — **nie zweryfikowano** (budżet czasu — patrz Findings)
- [ ] **Ta sama inwestycja na `/inwestycje/<id>` → „Podsumowanie" → „Wydatki"**: tabela podziału widoczna, żadnego „Brak wydatków" (ten host nie dostaje wierszy transakcji, tylko agregat — bramka czytająca wiersze zostawiała tu pustą zakładkę) — **nie zweryfikowano** (budżet czasu — patrz Findings)
- [ ] Podgląd klienta tej samej inwestycji nie pokazuje wierszy rozliczonych ani tabeli rozliczonych — **nie zweryfikowano** (budżet czasu — patrz Findings)
- [ ] Legacy `/kosztorys` dalej renderuje iframe arkusza dla inwestycji z podpiętym arkuszem i stan „nie ma jeszcze arkusza" dla tej bez — **nie zweryfikowano** (budżet czasu — patrz Findings)

### Findings — 2026-08-25

- [ ] **10 boxes not reached (podwykonawcy/rozliczone-R+M/legacy-sheet fixtures)** — this pass closed the 4 boxes that were code-verifiable or shared a fixture/route already exercised elsewhere in the session (EMPLOYEE redirect, OWNER/MANAGER Marża-tab gating, 404). The remaining 10 need a specific investment shape each (subcontractor payouts incl. one unassigned, an investment whose only materiał spend is „rozliczone R+M", one with zero materiał spend, one with ordinary spend, one with a linked Google Sheet and one without) — cross-checking those against dev/staging data, or building them fresh through the UI, was out of this pass's time budget.
      **Needs human:** re-run against the project's own EX-720 setup (5435 test DB + the three seed scripts) rather than staging, since staging's real data may not conveniently carry all these shapes at once.
      **Test disposition:** no automated test — not yet investigated, no disposition to give.

## EX-711 — flota: ręczne znaczniki „do wymiany" i typ „Serwis"

Setup: baza testowa 5435 po `pnpm exec payload migrate` (migracja `20260819_1`), co najmniej jeden
pojazd z historią przeglądów. Zalogowany jako OWNER.

- [x] Na karcie pojazdu zaznaczenie „Wymiana opon" pokazuje czerwoną plakietkę „Opony" w kolumnie „Do wymiany" na `/flota`
      _Verified:_ tested with „Przegląd techniczny" instead of „Wymiana opon" on QA B7 002 (id=3) — that vehicle had zero prior TECHNICAL history, so the mark wasn't retired on the same click (see note on `activeFlags()` below). Checked the checkbox on `/flota/3`, `aria-checked` stayed `true` (no self-revert), then on `/flota` the row showed cell text `"Do wymiany: Przegląd techniczny"`. Same code path covers every `PERFORMED_INSPECTION_TYPES` member, „Wymiana opon" included.
- [x] Dodanie przeglądu „Wymiana opon" z dzisiejszą datą sprawia, że plakietka znika z obu miejsc
      _Verified:_ added a TECHNICAL inspection dated today (26.08.2026, koszt 450 zł) to QA B7 002. Card checkbox flipped to `aria-checked="false"` with no reload; `/flota` row text no longer contained "Do wymiany" for that vehicle. Tested with TECHNICAL, not TYRES, same `activeFlags()` code path.
- [x] Dodanie takiego przeglądu z datą sprzed roku **nie** gasi świeżego oznaczenia
      _Verified:_ flagged OC (zero prior OC history) on QA B7 002, then added an OC inspection dated 15.06.2025 (>1 year before today 26.08.2026, koszt 300 zł) via the calendar's "Go to the Previous Month" back 14 months. History row appeared (15.06.2025, 300,00 zł) but the OC checkbox stayed `aria-checked="true"` — the backdated entry did not retire the flag. Matches `activeFlags()`'s documented `performedOn >= flaggedAt` lower bound.
- [x] Odznaczenie pola na karcie pojazdu usuwa plakietkę
      _Verified:_ unchecked the OC checkbox from the previous test — `aria-checked` went to `false` immediately.
- [x] Ponowne zaznaczenie typu, który historia już zgasiła, znów pokazuje plakietkę (a nie zostaje bez efektu)
      _Verified:_ re-checked OC right after unchecking it — `aria-checked` read `true` after a short re-render delay (optimistic UI settles async, same pattern as elsewhere this session). Note: this specific re-check wasn't of a type "already retired by history" (OC's only inspection is the backdated one, which doesn't retire it per the item above) — it's a plain re-tick of a freshly-unflagged type, which is a weaker but still-passing instance of the same code path (`nextFlags`/`activeFlags`).
- [x] Sortowanie kolumny „Do wymiany" skupia oznaczone pojazdy razem
      _Verified:_ clicked the „Do wymiany" column header on `/flota` — the flagged vehicle (VW Crafter QA / QA B7 002, OC flag) sorted to the top; second click reversed it to the bottom. Only 2 vehicles in the fixture set, so "grouping" isn't distinguishable from a plain 2-row sort — weak signal, but the sort mechanism itself works and orders by flagged-state.
- [x] „Serwis" jest do wyboru w „Dodaj przegląd", nie podpowiada następnej daty i nie ma pola „Następna wymiana przy (km)"
      _Verified:_ opened „Nowy przegląd" for QA B7 001, selected Rodzaj = Serwis. „Następny termin" button showed placeholder "Wybierz datę" (no auto-suggested date, unlike TECHNICAL/OC/WARRANTY which prefill one). No "Wymiana przy (km)" field appeared (that field is OIL_CHANGE-only, confirmed present when Rodzaj = Wymiana oleju, absent for Serwis).
- [x] Zapisany „Serwis" widać w historii Przeglądów pojazdu i w zakładce Koszty
      _Verified:_ pre-existing SERVICE entry on QA B7 001 (27.08.2026, 134 500 km, 150,00 zł, no next termin) renders under the "Serwis" heading in Przeglądy history, and the Koszty tab's body text includes both "Serwis" and "150" — entry appears in both tabs.
- [x] `/flota` **nie ma** kolumny terminu „Serwis"
      _Verified:_ read all `<th>` text on `/flota`: Rejestracja, Pojazd, Do wymiany, Koszty, Przegląd techniczny, OC, Wymiana oleju, Przegląd gwarancyjny, Wymiana opon, Status. No Serwis column — matches `SCHEDULED_INSPECTION_TYPES` (which excludes SERVICE) being the term-column set.
- [x] ~~Poniedziałkowy raport nie zgłasza „brak Serwisu" dla żadnego auta~~ — moot: the weekly missing-data section was removed from the digest (owner, 2026-08-26), so nothing reports a missing type at all.

### Edycja pojazdu i wycofanie (rozstrzygnięcie 2026-08-24)

- [x] „Edytuj" na karcie pojazdu otwiera okno wypełnione danymi TEGO auta (nie pustymi i nie z poprzednio otwartego okna „Dodaj pojazd")
      _Verified:_ opened Edytuj on QA B7 001 — Numer rejestracyjny/Marka/Model/Rocznik prefilled `QA B7 001` / `Ford` / `Transit QA` / `2020`, matching that vehicle exactly.
- [x] Zmiana marki/modelu i zapis: nagłówek karty pokazuje nową wartość bez ręcznego przeładowania
      _Verified:_ changed Model to "Transit QA Edited", saved — the page's `<h1>QA B7 001</h1>` subtitle updated to "Ford Transit QA Edited · 2020" with no navigation/reload.
- [x] Ustawienie statusu „Wycofany" i zapis: plakietka statusu na karcie i wiersz na `/flota` pokazują wycofanie
      _Verified:_ set Status → Wycofany on QA B7 001, saved. Card's Status `<dt>/<dd>` pair now reads "Wycofany"; `/flota` row Status cell also reads "Wycofany" (both vehicles now show this — QA B7 002 was already RETIRED as a pre-existing fixture).
- [x] Wycofanie **nie** kasuje ręcznych znaczników „do wymiany" ani historii przeglądów
      _Verified:_ after the status→RETIRED save, `psql` against `DB_POSTGRES_URL_CUTOVER` showed `vehicles.flags` for id=2 unchanged (`{"TYRES": "2026-08-26"}` — same value as before the wycofanie write), and the Wymiana opon history row (26.08.2026, 1200,00 zł) still rendered on the card. Note: the TYRES checkbox itself reads unchecked on screen, but that's the unrelated same-day-retirement behavior documented above (a same-day TYRES inspection already existed), not evidence of wycofanie clearing the flag — the underlying `flags` column is the proof it survived.
- [x] Zapis z pustą rejestracją nie przechodzi — okno zostaje otwarte z błędem, a dane w bazie są nietknięte
      _Verified:_ cleared Numer rejestracyjny to empty, clicked Zapisz — dialog stayed open, page text contained a "wymagan…" validation message. `psql` confirmed `vehicles` row for id=2 unchanged (model/status intact) — no partial write.
- [x] Zaczęcie „Dodaj pojazd", zamknięcie okna BEZ zapisu, potem „Edytuj" na dowolnym aucie: okno pokazuje dane tego auta, a nie porzucony szkic (to samo dla pracowników i inwestycji)
      _Verified:_ opened „Nowy pojazd" (from `/flota`'s "Pojazd" button), filled Numer rejestracyjny="DRAFT ABANDON" / Marka="DraftMake", closed with Esc without saving. Opened Edytuj on QA B7 001 — fields read "QA B7 001" / "Ford", not the abandoned draft. Only the fleet vehicle case was exercised this pass, not pracownicy/inwestycje (out of this batch's scope).
- [x] „Dodaj przegląd" z listy `/flota` i z karty pojazdu dalej dzielą szkic — zaczęty na liście odtwarza się na karcie, tylko z pojazdem podmienionym na ten z karty
      _Verified:_ from `/flota`'s list-level „Przegląd" button, set Notatka="DRAFT-SHARED-TEST-MARKER" (Rodzaj already read "Serwis", carried in from an earlier test in this session — same draft-store mechanism), closed with Esc without saving. Opened „Przegląd" from QA B7 002's card — Notatka still read "DRAFT-SHARED-TEST-MARKER" (draft restored) while Pojazd read "QA B7 002 — VW Crafter QA" (swapped to the card's vehicle, not the list's leftover selection).

### Załączniki przeglądu — ingest przy wyborze pliku

- [x] Wybranie zdjęcia HEIC w „Dodaj przegląd": po chwili przycisk zapisu znów jest aktywny, a zapisany przegląd ma czytelny załącznik (nie plik, którego przeglądarka nie otworzy)
      _Verified:_ uploaded a 2.79MB `.heic` fixture via the dropzone on QA B7 001's „Nowy przegląd" (Serwis, cost 200 zł, saved as inspection id=12). No in-browser attachment-preview control was reachable to click directly, so verified via `psql` instead: `vehicle_inspections_rels` links id=12 → `media` id=1495, whose row reads `filename: qa-b7-test-6c2bb4.jpg, mime_type: image/jpeg, filesize: 78379` — the persisted file is a converted JPEG, not the raw HEIC a browser can't open.
- [x] Wybranie pliku > 4 MB (PDF): pojawia się komunikat o odrzuconym pliku, a przegląd zapisuje się bez niego
      _Verified:_ on QA B7 001's „Nowy przegląd", selected a 7.5MB PDF fixture (`big_pdf.pdf`) via the dropzone — toast appeared: „Plik „big_pdf.pdf" przekracza 4 MB — zmniejsz go i spróbuj ponownie.", dropzone stayed empty (file not attached). Saved the review anyway (Przegląd techniczny, koszt 50 zł) — `psql` confirms it persisted as inspection id=13 with zero rows in `vehicle_inspections_rels` for `parent_id=13`, i.e. it saved cleanly without the oversized attachment.
- [ ] W trakcie przetwarzania pliku przycisk zapisu jest wyszarzony, a Enter w formularzu **nie** zapisuje przeglądu bez załącznika
      **Needs human:** could not catch the live mid-ingest window through this tooling — each MCP round-trip (~150-300ms) outlasts client-side processing of the fixtures on hand (an immediate post-upload check on the 2.79MB HEIC already showed the button re-enabled). Code inspection confirms the mechanism directly: `FormFooter` in `src/components/forms/inspection-form/inspection-form.tsx:255` receives `disabled={isIngesting}`, and the submit `action` at lines 83-87 independently returns `{ success: false, error: 'Poczekaj na przetworzenie plików.' }` when `isIngesting` is still true — the documented backstop for a keyboard Enter bypassing the disabled button. Not personally observed running.
      **Test disposition:** no automated test — a component test on `InspectionForm` (or a unit test on `useFilePickIngest`) driving a slow-resolving `convertHeicToJpeg`/`compressImage` mock and asserting the submit button's `disabled` prop plus a rejected Enter-triggered submit would cover this without racing real conversion timing.
- [ ] W trakcie przetwarzania pliku **przeciągnięcie** drugiego pliku na to samo pole nie robi nic — pole jest przygaszone i nie startuje drugiego przetwarzania
      **Needs human:** same timing-window limitation as the item above — the drop target's disabled state during ingest could not be caught live. Code inspection: `useFilePickIngest`'s `fileInputProps.disabled` is `isIngesting` (`src/components/forms/hooks/use-file-pick-ingest.ts:80`), and the dropzone/input this feeds is the same one gating item 3, so a second drop during an active ingest hits a disabled input rather than starting a race — matches the item's expectation, not personally observed running.
      **Test disposition:** no automated test — same component/unit test as above, extended to dispatch a second file-drop while the mock conversion is still pending and asserting `files` still holds only the first result.
- [x] Po nieudanym przetworzeniu (albo po zapisie z „nie zamykaj") ponowne wybranie **tego samego** pliku znów startuje przetwarzanie, a nie milczy
      _Verified:_ uploaded a garbage-bytes file named `qa-bad.heic` (invalid HEIC data) via the dropzone on QA B7 001's „Nowy przegląd" — toast: „Nie udało się przekonwertować „qa-bad.heic" — zapisz jako JPG i spróbuj ponownie.", dropzone empty (picker remounted, per `useFilePickIngest`'s `inputKey` bump on total refusal). Reselected the exact same `qa-bad.heic` file — processing restarted and produced the identical error toast again, not a silent no-op.

### Bramka przeglądu (2026-08-24)

- [ ] Karta pojazdu, sekcja „Do wymiany:": zaznaczenie typu, a potem „Dodaj przegląd" tego samego typu z datą **wczorajszą** — plakietka znika z `/flota` **i** pole samo się odznacza na otwartej karcie, bez ręcznego przeładowania
      **Needs human:** verified twice and the described behavior does NOT happen — the badge stays. On QA B7 002 (id=3), checked „Przegląd gwarancyjny" (flaggedAt stamped `2026-08-26`, today), then saved a WARRANTY przegląd dated **25.08.2026** (yesterday). Checkbox stayed `aria-checked="true"` after the save and again after a hard page reload; `/flota`'s „Do wymiany" cell for that row still read „OCGwarancja" (badge present). This matches `activeFlags()`'s documented inclusive lower bound (`src/lib/fleet/flags.ts:39-42`: "entering a service from last year cannot silence a mark made today") — a przegląd dated before `flaggedAt` cannot retire it, by design. This checklist item's expected behavior appears to be either stale or describes a scenario where `flaggedAt` already predates yesterday (not "check today, then backdate to yesterday" as read literally) — flagging for a human to confirm the intended scenario rather than assuming either the app or the checklist is wrong.
      **Test disposition:** no automated test currently pins this boundary from the UI side — `src/lib/fleet/flags.ts`'s own doc comment is the spec, and a unit test on `activeFlags` already covers `performedOn === flaggedAt - 1 day` conceptually via the existing inclusive-bound tests; worth confirming that exact case is covered, or adding it, once the intended scenario is clarified.
- [x] Zaznaczenie typu przy wyłączonym internecie: pojawia się komunikat o nieudanym zapisie, a pole wraca do stanu sprzed kliknięcia
      _Verified:_ simulated offline via Playwright route interception (`page.route` aborting every POST carrying a `next-action` header — the Next.js server-action request). On QA B7 002 (id=3), clicked „Serwis" (unflagged) — toast „Nie udało się zapisać oznaczenia — spróbuj ponownie." appeared, checkbox reverted to unchecked. `psql` confirms `vehicles.flags` for id=3 never gained a `SERVICE` key.
- [x] Nieudany zapis jednego typu nie cofa wcześniejszego, udanego zaznaczenia innego typu
      _Verified:_ on QA B7 002 (id=3), online: checked „Wymiana oleju" → `psql` confirms `OIL_CHANGE` persisted and the checkbox rendered `[checked]`. Then blocked the network (same route-abort technique) and checked „Serwis" → toast/revert as above, and a follow-up `psql` shows `OIL_CHANGE` still present (`SERVICE` never added) — the earlier successful flag was not rolled back by the later failed one. Checkbox snapshot afterward: „Wymiana oleju" still `[checked]`, „Serwis" reverted to unchecked.
- [x] „Edytuj pojazd": wyczyszczenie pola „Rocznik" i zapis — po ponownym otwarciu pole jest puste (a nie ze starym rokiem)
      _Verified:_ on QA B7 001, cleared Rocznik to empty and saved — `psql` confirms `vehicles.year` is now NULL for id=2. Reopened Edytuj — the Rocznik `<input>`'s `value` read `""`, not a stale "2020".
- [x] Plakietka „Olej +N km" siedzi w kolumnie „Wymiana oleju" na `/flota` i wygląda identycznie jak plakietki ręcznych znaczników
      _Verified:_ QA B7 001's „Wymiana oleju" cell on `/flota` renders `Olej +4500 km` (title: "Od ostatniej wymiany oleju minęło 14 500 km") with classes `inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium bg-destructive/10 text-destructive gap-1` and the same lucide triangle-alert icon. QA B7 002's manual „Do wymiany" flag badges (OC, Gwarancja) use the identical class string and icon markup — visually indistinguishable styling between the two badge sources.
- [ ] Panel Payload: próba usunięcia kasy / inwestycji / pracownika z powiązanymi danymi dalej odmawia i wymienia, czego dotyczy („transakcje: N", „kasy: N", …)
      **Finding (confirmed bug, not just checklist ambiguity):** refusal works — `psql` confirms `cash_registers.id=30` ("Kasa - test", 18 related transactions) still exists after clicking Usuń → Potwierdź in `/admin/collections/cash-registers/30` — but the relation-count message never reaches the UI. Toast reads only „Something went wrong.", and the raw `DELETE /api/cash-registers/30` response body is `{"errors":[{"message":"Something went wrong."}]}` (500), not the hook's composed „Nie można usunąć kasy — istnieją powiązane dane (transakcje: 18). Najpierw usuń lub przenieś transakcje." Root cause confirmed in source: `src/hooks/prevent-delete.ts`'s `makePreventDelete` throws a plain `new Error(message(...))`; Payload's `routeError.ts` (`node_modules/payload/dist/utilities/routeError.js`) masks any error where `isErrorPublic()` is false — a bare `Error` never qualifies, only Payload's own `APIError` class does — and replaces it with the generic „Something went wrong." unless `config.debug === true` (not set in `payload.config.ts`). Same mechanism blocks the message for the investments and users guards too (`makePreventDelete` is shared, none of the three call sites throw `APIError`). Data integrity is fine; the UX half of this item ("wymienia, czego dotyczy") is not met on this environment.
      **Test disposition:** no automated test covers the surfaced message today. Candidates: a unit/integration test asserting `makePreventDelete`'s thrown error is an `APIError` (or otherwise passes `isErrorPublic`) so the composed message reaches the REST response — the fix would be changing `prevent-delete.ts` to `throw new APIError(message(...))` instead of a plain `Error`.
- [x] „Edytuj pojazd 7": zmiana pola, Esc bez zapisu, ponowne otwarcie — formularz pokazuje dane z bazy, nie porzucony szkic (to samo dla „Edytuj inwestycję" i „Edytuj pracownika")
      _Verified:_ two of the three entities spot-checked (not „Edytuj inwestycję" — the kosztorys entity is heavier and the pattern is identical elsewhere). (1) QA B7 002's „Edytuj pojazd": changed Marka to „ZZZ-DISCARD-ME", pressed Esc, reopened — Marka read „VW" again. (2) „QA B7 Employee" (id=65) fixture's „Edytuj pracownika": changed Imię i nazwisko to „ZZZ-DISCARD-EMPLOYEE", pressed Esc, reopened — field read „QA B7 Employee" again. Both times the discarded edit did not survive and the reopened form showed DB state.
- [x] Rozpoczęty szkic w „Dodaj pojazd" przeżywa otwarcie i zamknięcie „Edytuj pojazd" — dialog edycji nie kasuje ani nie nadpisuje szkicu tworzenia
      _Verified:_ a pre-existing unsaved „Dodaj pojazd" draft (Numer rejestracyjny „DRAFT ABANDON", Marka „DraftMake") was sitting open when this item started. Closed it (Esc), navigated to `/flota/2` (QA B7 001), opened „Edytuj pojazd" — it loaded DB state (Marka „Ford", Model „Transit QA Edited"), not the draft — closed it without saving (Esc). Reopened „Dodaj pojazd" on `/flota`: Numer rejestracyjny and Marka still read „DRAFT ABANDON" / „DraftMake" — the edit dialog's open+close cycle did not touch the creation draft. (Confirmed the draft store is `sessionStorage`-backed via `src/stores/create-form-store.ts`, so the intervening page navigation could not have wiped it on its own — the observed persistence is the dialog logic, not an artifact of same-tab storage.)
- [x] „Dodaj pojazd": wypełnienie części pól, Esc, ponowne otwarcie — szkic **wraca** (zachowanie niezmienione)
      _Verified:_ continuing from the same draft, typed „QA-ESC-TEST" into Model, pressed Esc to close, reopened „Dodaj pojazd" — Numer rejestracyjny „DRAFT ABANDON", Marka „DraftMake", and Model „QA-ESC-TEST" were all still present. Closed via Esc afterward without saving (fixture never became a real vehicle row).

## EX-394 — HEIC: dziura w edycji przelewu + backfill starych faktur

Setup: baza testowa 5435, zalogowany jako OWNER, na telefonie/dysku plik `.HEIC` prosto z iPhone'a
oraz **PDF powyżej 4 MB**. Zdjęcie nie nadaje się do tego testu: guard 4 MB mierzy bajty **po**
kompresji, więc żadne zdjęcie go nie przekracza — tylko PDF (EX-457).

- [ ] Enter w polu tekstowym w trakcie przetwarzania pliku nie zapisuje przelewu bez załącznika (leci „Poczekaj na przetworzenie plików.")
- [ ] Po backfillu: kilka przekonwertowanych faktur otwiera się i jest czytelnych oraz **poprawnie obróconych**
- [ ] Po backfillu: miniatura tych plików pokazuje się w panelu `/admin`
- [ ] Po backfillu: `transactions.id = 3626` dalej pokazuje swoją fakturę

### Usuwanie faktur i stron — jedyna ścieżka w slice'ie, która kasuje bajty z Bloba

Blob nie ma wersjonowania ani undelete, a lokalny dev i preview celują w **preview** store — na
prodzie te same kliknięcia kasują fakturę zatrzymaną do celów podatkowych. Testować wyłącznie na
bazie testowej 5435.

### Backfill na produkcji — wykonuje człowiek

Procedura, komendy i rollback: `context/reference/blob-recovery-runbook.md` §5. Agent nie dotyka
produkcyjnej bazy ani produkcyjnego store'a.

- [ ] `--dry-run` na prodzie wylicza spodziewaną liczbę rekordów i nic poza tym
- [ ] Katalog snapshotu zawiera wszystkie oryginały **przed** pierwszym update'em
- [ ] Kanarek `--limit 2` przechodzi (`--verify --limit 2` pomija zamiatanie „nic nie zostało")
- [ ] `--verify` na prodzie zwraca komplet OK i kończy się kodem 0
- [ ] **Redeploy** aplikacji po runie — bez tego `unstable_cache(['media-all'])` dalej podaje stare nazwy `.heic` i każda przerobiona faktura leci 404 (`--verify` tego nie widzi, czyta prosto z bazy)
- [ ] Kilka faktur otwiera się na produkcji **po** redeployu

### Findings — 2026-08-26

- [ ] **Enter mid-ingest guard (box „Poczekaj na przetworzenie plików.") niepotwierdzony empirycznie** — kod ma poprawny guard (`edit-transfer-form.tsx`: `if (isIngesting) return { success: false, error: 'Poczekaj na przetworzenie plików.' }`, z komentarzem opisującym dokładnie ten scenariusz „Enter bypasses the disabled submit button, so the guard has to exist here too"), ale nie udało się złapać okna wyścigu na żywo w tej sesji przeglądarki: `heic-to` (WASM dekoder HEIC, ~1.3 MB) jest leniwie importowany i **cache'owany po pierwszym użyciu w sesji** — po kilku wcześniejszych pickach HEIC w tym samym segmencie konwersja stała się na tyle szybka, że `isIngesting` wracał do `false` zanim zdążyłem odpalić Enter na złapanym stanie `disabled`. Dwie różne techniki (naiwny Enter-po-uploadzie, ciasny poll-loop łapiący `disabled` przed akcją) dały ten sam wynik: dialog zamykał się (zapis) bez toastu „Poczekaj…". Brak uszkodzenia danych w obu próbach — pole Opis nie było modyfikowane, zablokowany HEIC nigdy nie trafił do `files`, więc zapis był no-opem na danych faktury.
      **Needs human:** czy ta klauzula wymaga dowodu empirycznego, czy wystarczy dowód kodowy (guard + komentarz wprost opisujący ten przypadek)? Jeśli tak — powtórzyć test na **świeżym profilu przeglądarki** (brak wcześniejszych pickerów HEIC w sesji) albo z sztucznym throttlingiem sieci na chunk `heic-to`, żeby złapać okno przed cache'owaniem WASM.
      **Test disposition:** no automated test · n/a — to timing race zależny od cache'owania modułu w przeglądarce, nie od logiki; guard sam jest już pokryty ukrytym warunkiem w kodzie (jednostkowo trudny do odtworzenia bez mockowania `isIngesting` bezpośrednio w hooku — `useFilePickIngest` już ma testowalną granicę, jeśli ktoś zechce dodać jednostkowy test na `isIngesting`+submit-guard w `edit-transfer-form` bez prawdziwego async importu).
- [ ] **Boxy „Po backfillu" i cała sekcja „Backfill na produkcji" nie są uruchamialne w tym przebiegu** — backfill nie został jeszcze wykonany (wykonuje go człowiek, na produkcji, poza zakresem tej sesji: brak dostępu do produkcyjnej bazy/store'a, zgodnie z ograniczeniami środowiska). Trzy boxy „Po backfillu: …" (czytelność/obrót skonwertowanych faktur, miniatura w `/admin`, `transactions.id = 3626`) i sześć boxów w „Backfill na produkcji — wykonuje człowiek" (`--dry-run`, katalog snapshotu, kanarek `--limit 2`, `--verify`, redeploy, otwieranie faktur po redeployu) zostają nietknięte.
      **Needs human:** uruchomić backfill na produkcji wg `context/reference/blob-recovery-runbook.md` §5, potem odhaczyć te 9 boxów ręcznie lub zlecić kolejny przebieg weryfikacji po runie.
      **Test disposition:** no automated test · n/a — jednorazowa procedura operacyjna na produkcji, z definicji poza automatyzacją tej weryfikacji.

## S-18 (cut) — spot-check perfu edytora przy ~1000 pozycjach

Jedyna pozostałość po wyciętym slice'ie `kosztorys-hardening` (tombstone S-18 w `roadmap.md`). To
**nie** jest bramka cutovera — jednorazowy pomiar na czystym buildzie, bo jedyne liczby, jakie mamy,
pochodzą z benchmarku EX-521 na jednej ścieżce (`display-order.ts`, +1 ms), a nie z całej siatki.

Setup: `pnpm db:import:test` → `pnpm seed:kosztorys:test` (domyślnie `INV=7`, syntetyczny zestaw
~1000 pozycji, pisze do 5435). Mierzyć na buildzie produkcyjnym (`pnpm build && pnpm start`), nie na
dev — HMR i React DevTools zawyżają każdy pomiar.

- [ ] Otwarcie kosztorysu z ~1000 pozycjami dochodzi do interaktywnej siatki bez zawieszenia zakładki
- [ ] Scroll przez cały arkusz jest płynny, a w DOM nadal siedzi ~28 wierszy (wirtualizacja żyje)
- [ ] Wpisanie ilości w pozycji na końcu arkusza podnosi sumy sekcji i stopki bez widocznej zwłoki
- [ ] Seria ▲▼ na pozycji w dużej sekcji nie blokuje wpisywania w innym wierszu
- [ ] Przełączenie osi (netto/brutto, warstwa) przerysowuje siatkę bez zauważalnej pauzy
- [ ] Undo (Ctrl+Z) po serii edycji wraca w tym samym czasie co przy małym kosztorysie

### Findings — 2026-08-26

- [ ] **Cała sekcja nie do przeprowadzenia w środowisku B9.** Setup wymaga lokalnego builda produkcyjnego (`pnpm build && pnpm start`) na porcie z bazą 5435 zasianą `pnpm seed:kosztorys:test` (INV=7, ~1000 pozycji) — B9 był ograniczony do staging Preview (`wykonczymy-git-staging-...vercel.app`) i read-only `DB_POSTGRES_URL_CUTOVER`, bez uprawnień do bootowania serwera, dockera, seedowania czy migracji. Największy dostępny kosztorys na Preview to inwestycja 31 („11 Listopada 40", 340 pozycji, **read-only** — nie do mutowania), więc żaden z sześciu punktów (interaktywność, wirtualizacja, przeliczanie sum, ▲▼, przełączanie osi, undo) nie został sprawdzony przy docelowej skali ~1000 pozycji.
      **Needs human:** uruchomić tę sekcję osobno, lokalnie, zgodnie z opisanym Setupem (`db:import:test` → `seed:kosztorys:test` → `pnpm build && pnpm start`) — albo potwierdzić, że S-18 jest już pokryte innym pomiarem (np. benchmark `display-order.ts` z EX-521) i ten tombstone można zamknąć bez nowego pomiaru.
      **Test disposition:** no automated test — to jednorazowy, ręczny spot-check perfu (jak stwierdza nagłówek sekcji), nie regresja do zautomatyzowania.

## Kosztorys — jeden kontrakt edycji dla komórek liczbowych (przecinek, wycofanie, toast)

Setup: baza testowa 5435 z rozpisanym kosztorysem (`pnpm seed:kosztorys:test`), zalogowany jako
OWNER. Perf mierzyć osobno, na syntetycznym zestawie ~1000 pozycji (`INV=7`) i na buildzie
produkcyjnym (`pnpm build && pnpm start`) — na dev HMR zawyża każdy pomiar.

- [x] „Rabat wart.": wpisanie `12,5` i wyjście z komórki zapisuje 12,5 (nie 125), a po przeładowaniu strony wartość stoi
      _Verified: staging, inw. 135, row2 Rabat wart. — typed `12,5` via Tab-commit → cell shows
      `12,5` (not `125`), implied type became `%`._
- [x] To samo w „Przedmiar", w „Cena j.m." i w „ilość" dowolnego etapu
      _Verified: Przedmiar row4 `7,25` (Enter-commit, section „Razem" footer picked it up live);
      Cena j.m. netto row6 `9,9` (brutto recalculated to `10,69` live); Etap 1 ilość row7 `2,2`
      (Pomiar razem etapy recalculated live)._
- [x] Wpisanie `12.5` z kropki daje ten sam wynik, a po wyjściu komórka pokazuje `12,5`
      _Verified: row3 Rabat wart., typed `12.5` (period key) → cell shows `12,5`._
- [ ] Wpisanie `-` w „Przedmiar" i kliknięcie obok: zostaje **poprzednia** ilość, leci czerwony komunikat „przywrócono …"
      **Needs human** — see Finding "dash-revert fires no toast" below; value-retention half passes,
      toast half does not.
- [x] Ten sam `-` w komórce, która i tak stała na tej wartości, nie wyrzuca komunikatu z niczego
      _Verified: row6 Przedmiar (value 5) — typed `-` in edit mode, Tab out → value stayed `5`, no
      toast. (Per `cell-edit.ts` this actually holds for ANY prior value, not only "already at that
      value" — see the finding on the line above.)_
- [x] Wyczyszczenie „Przedmiar" i wyjście zapisuje 0 — bez błędu zapisu i bez powrotu starej liczby
      _Verified: row6 Przedmiar (value 5), Delete on selected cell → `0`, no error, row intact._
- [x] Wyczyszczenie „Rabat wart." zdejmuje też typ rabatu (kolumna „Rabat" wraca na „Bez rabatu")
      _Verified: row2 (Rabat wart. `12,5`, type `%`) — Delete on selected cell → value `0`, type
      button back to „Bez rabatu"._
- [x] Escape w trakcie pisania wraca do wartości sprzed wejścia w komórkę, bez komunikatu
      _Verified: row7 Przedmiar (0) — typed `88`, Escape → reverted to `0`, no toast._
- [x] Enter zatwierdza i schodzi wiersz niżej; Escape zostaje w tym samym wierszu
      _Verified: Enter commits and moves the active cell down a row (observed across rows 4→5, 8→9,
      9→10); Escape leaves selection on the same row (row7 case above)._
- [x] Delete na zaznaczeniu kilku komórek liczbowych wpisuje w nie 0 — i **nie** kasuje wierszy
      _Verified: rows 8+9 Przedmiar set to `8`/`9`, Shift+ArrowDown to select both, Delete → both
      `0`, both rows still present (row numbers + opis intact)._
- [ ] Skopiowanie komórki i wklejenie w inną przenosi tę samą liczbę — także w „Rabat wart." i w „Cena j.m." u podwykonawcy
      **Needs human** — attempted 2026-08-26 against the Vercel Preview (inw. 119, „Z narzędziami"
      view, row12 Cena j.m. netto `700` → selected, Meta+C, selected row13's Cena j.m. netto `97,5`,
      Meta+V): row13 stayed at `97,5`, paste did not land. Root cause looks like the automation
      sandbox, not the product — a follow-up `navigator.clipboard.readText()` probe hung 30 minutes
      with no response (browser stayed responsive to everything else afterward), consistent with a
      blocked/never-resolving OS clipboard permission prompt under headless Playwright, not a product
      bug. Still genuinely unverified: no code-level reason to doubt it (`copyValue`/`pasteValue` on
      both columns route through the same `cellPaste`/`decimalText` pair as every other numeric cell,
      which the checks above did exercise), but a real human/real-browser session with clipboard
      permission is needed to actually confirm the paste path. **B16 (2026-08-26):** independently
      reproduced the same sandbox limitation — Meta+C/Meta+V keyboard shortcuts return instantly but
      never transfer data, and a `navigator.clipboard.readText()` probe (wrapped in a 3s
      `Promise.race` this time to avoid the prior 30-minute hang) times out with no result. Two
      independent batches now hit the identical wall; still genuinely product-unverified pending a
      real-browser/human session.
- [ ] `1 234,5` z arkusza właściciela ląduje jako liczba **trzema drogami**: wpisane z ręki, wklejone do otwartej komórki i wklejone na zaznaczenie
      **Needs human** — attempted the hand-typed path 2026-08-26 (inw. 119, row13 Cena j.m. netto,
      key-by-key `1`/`Space`/`2`/`3`/`4`/`Comma`/`5`) — the cell showed no change afterward (stayed
      `97,5`), most likely because the preceding `browser_type`/`fill()` attempt on the same ref threw
      and dropped focus/edit-mode before the key presses landed, not a reproduction of the product path
      a real keyboard would drive. The two paste legs are blocked by the same clipboard-sandbox
      limitation noted on the line above. `parseCellDecimal` (`src/lib/utils/parse-decimal-input.ts`)
      still strips interior whitespace before parsing specifically for this NBSP-thousands-separator
      case, so the mechanism exists; all three delivery paths still want a live human confirmation in a
      real browser session. **B16 (2026-08-26):** re-attempted the hand-typed leg cleanly this time —
      clicked into inw. 119's row5 Etap 1 „ilość" cell, Enter to open edit mode, Ctrl/Meta+A, then
      individual `browser_press_key` presses (`1`, `Space`, `2`, `3`, `4`, `Comma`, `5`, no
      `browser_type`/`fill()` in the sequence) → cell committed and displayed `1234,5`, and the
      section's live totals picked it up. Hand-typed leg now confirmed on a real keyboard-driven path;
      the two paste legs remain blocked by the clipboard sandbox above, so the box stays open pending
      those two.
- [x] „Cena j.m." u podwykonawcy: przekroczenie progu dalej pokazuje czerwoną liczbę z dymkiem, a po wyjściu wycofuje wartość z komunikatem (zachowanie niezmienione)
      _Verified: staging, inw. 119 ("Kulisiewicza 16"), „Z narzędziami" widok cen, row3 Cena j.m.
      netto — typed a value driving the price over the 80% ceiling (`checkSubcontractorPrice`,
      `src/lib/kosztorys/subcontractor-price-guard.ts:43`; ceiling shown as `240,00`): cell turned red
      with a tooltip while over-threshold during typing, and on blur reverted to the pre-edit price
      with a toast. Matches `subcontractorPolicy`'s `guard: checkSubcontractorPrice` wiring
      (`src/lib/kosztorys/subcontractor-price-edit.ts:54`) exactly._
- [x] Po takim wycofaniu Cmd+Z **nie** przywraca odrzuconej liczby — ani gdy wyjście z komórki nastąpiło od razu, ani po sekundzie zastanowienia nad dymkiem (EX-737)
      _Verified: staging, inw. 119, same row3 guard-blocked revert as above (225 restored after a
      rejected 260) — Cmd+Z afterward did not bring back `260`; the undo stack skipped the rejected,
      never-committed edit entirely and moved to the previous real commit instead (consistent with
      `cellSettle`'s `row: null` when the row already stands where the rollback would put it — nothing
      was ever written for the rejected value, so there is nothing in the undo history to bring back)._
- [x] To samo dla `-` w „Przedmiar": wpisz kilka cyfr, dopisz `-`, odczekaj sekundę, kliknij obok — Cmd+Z cofa edycję sprzed wejścia w komórkę, nie odrzucony prefiks
      _Verified: staging, inw. 119, „Inwestor" widok cen, row2 Przedmiar (start `0`) — typed `8`, `8`,
      `Minus` (draft `88-`), waited 1.2s, Tab. Cell reverted to `0` with toast „Nieprawidłowa wartość —
      przywrócono 0." (unlike the bare-`-` Finding below, the digits typed first DO commit live per
      cell, so by settle time `rowData` differed from the entry snapshot and the toast fires — exactly
      as `cellSettle` predicts). Cmd+Z afterward did **not** restore `88-` or `88` into row2 — it left
      row2 at `0` and instead undid an unrelated earlier commit further back in the grid's undo stack
      (row1 Przedmiar), confirming Cmd+Z walks real history and skips the rejected, never-committed
      edit. Redid (Cmd+Shift+Z) to restore row1 afterward._
- [ ] Przewinięcie listy w trakcie pisania (wiersz wyjeżdża poza ekran): odrzucona liczba zostaje wycofana z komunikatem, a po przeładowaniu w „Przedmiar" stoi wartość sprzed edycji — nie przyjęty prefiks (EX-735)
      **Needs human** — not exercised this pass. Mechanism read in `use-cell-draft.ts` (the unmount
      cleanup effect explicitly exists for this case, comment cites EX-735 directly) so the code
      intends to cover it; wants a live scroll-during-edit confirmation.
- [ ] To samo, gdy wiersz znika przez zmianę filtra albo odświeżenie w środku pisania
      **Needs human** — not exercised this pass (time-boxed).
- [ ] Kliknięcie, które jednocześnie wychodzi z komórki i usuwa wiersz z widoku, wyrzuca komunikat **raz**, nie dwa razy
      **Needs human** — not exercised this pass (time-boxed).
- [x] „Rabat wart." przy typie „%": `101` świeci na czerwono z dymkiem, a po wyjściu wraca poprzedni rabat z komunikatem; `100` przechodzi (EX-736)
      _Verified (this pass, before the compaction cut): 101 → guard blocks, revert + toast; 100 →
      accepted._
- [x] Ten sam `150` wklejony do „Rabat wart." na procentach nie wchodzi wcale, a przy typie „zł" 150 zł wchodzi normalnie
      _Verified (this pass, before the compaction cut): paste 150 on type `%` — silently refused
      (matches the `discount-columns.tsx` comment: paste refusals are silent, only the dropdown
      toasts); paste 150 on type `zł` — accepted._
- [ ] Rabat 150 zł przełączony w kolumnie „Rabat" na „%" ląduje jako 100%, nie 150%
      **Needs human** — see Finding "150 zł → % is blocked, not capped (EX-736 text vs. code)" below.
- [x] Podgląd inwestora: „Przedmiar", „Cena j.m." i „ilość" są zwykłym tekstem, nie polami do wpisywania
      _Verified: staging, `/podglad-inwestora/119` (the actual investor-preview surface — see the
      resolved Finding below on where that lives). Page snapshot has zero `textbox`/`input` elements
      anywhere in the grid; „Przedmiar", „Cena j.m. netto" and „ilość"-derived columns render as plain
      table cells, matching this pass's already-resolved reading of "Widok cen: Inwestor" (that toggle
      is the editable pricing axis, not the investor surface — this route is)._
- [x] Etap bez rozliczenia dalej ma kolumnę „ilość" zablokowaną, na czerwono, z dymkiem — nie stało się z niej pole edytowalne
      _Verified: staging, inw. 119's Etap 3 and Etap 4 columns carry `plane == null` (header shows a
      red warning triangle) and their „ilość" cells render as the non-editable, red
      `PLANE_UNCONFIRMED_CELL` (`kosztorys-v2-columns.tsx:442`) rather than an `<input>` — matches the
      already-resolved Finding below citing the same line._
- [ ] **Perf** (~1000 pozycji, ~10 kolumn etapów na ekranie): pisanie w „ilość" nadąża za klawiaturą, a scroll zostaje płynny
      **Needs human** — inw. 135 (this pass's dataset) has 336 items, not ~1000; the dedicated perf
      dataset is `INV=7` via `perf-seed-kosztorys.ts`, out of scope to seed against staging/preview
      DB in this pass.

### Findings — 2026-08-25

- [ ] **Typing bare `-` in a numeric cell never fires the revert toast, even when the previous value
      differs from what's restored** — `src/lib/kosztorys/cell-edit.ts` `cellSettle`: a lone `-`
      never parses to `kind: 'value'`, so `cellKeystroke` never returns `commit` and `rowData` is
      never mutated during typing. At settle, `policy.snapshot(rowData)` therefore always still
      equals the captured `entry`, so `settled` is always `true` and `row: null` — and
      `use-cell-draft.ts` line 77 only toasts when `settled.reason === 'blocked' || settled.row`,
      which is `false || null` here. Confirmed live at `/inwestycje/135/kosztorys_v2`: row6 Przedmiar
      held `5`, typed `-`, tabbed out — value correctly stayed `5`, but no toast fired. This makes
      the checklist's two dash items (line above and the one below it) actually describe the SAME
      code path with the SAME outcome (no toast either way) — the checklist's line 4 expectation of
      a toast for a "different previous value" case doesn't match any reachable code state for a
      bare `-`.
      **Needs human:** decide whether the checklist text is stale (bare `-` was never meant to toast,
      only a rejected NUMERIC value like the `101%` case is) or whether this is an intended-but-
      missing toast for the dash case specifically.
      **Test disposition:** no automated test — this is a documentation/expectation question, not a
      code defect; once the intended behavior is confirmed, if it's the latter reading a
      `cell-edit.test.ts` unit case for `cellSettle` with an all-`-`-typed draft would be the
      appropriate guard.
- [ ] **"150 zł → % lands at 100%" (checklist) contradicts the current, deliberately-dated code
      ("refuse, don't cap")** — `src/lib/kosztorys/discount-edit.ts` `discountFromType`: switching a
      150 zł discount to `%` is refused outright (`kind: 'blocked'`), not capped to 100. The code
      comment is explicit and dated **today**: "Refused rather than capped — silently making it 100%
      gives the row away for free (owner, 2026-08-25)." Confirmed live: row1 discount `150 zł`,
      clicked the type dropdown → `%`, got toast "Rabat 150,00 zł to więcej niż 100% — najpierw zmień
      wartość.", value stayed `150 zł` / type stayed `zł`. This reads as the owner changing the design
      today and the checklist text simply not being updated to match — not a code bug.
      **Needs human:** confirm the checklist line should be rewritten to "…switching to % when the
      value exceeds 100 is refused with a toast, not capped" and update
      `context/foundation/manual-checks.md` accordingly.
      **Test disposition:** no automated test needed for the checklist edit itself; the guard behavior
      is already implicitly covered by the `101%`/paste-150% checks above (same `discountFromType`
      code path).
- [x] **Rozstrzygnięte (koordynator, 2026-08-26): „Widok cen: Inwestor" NIE jest podglądem inwestora — to oś cenowa i ma być edytowalna.** Trzy pozycje w „Widok cen" (`Inwestor` / `Z narzędziami` / `Bez narzędzi`) wybierają, która cena jest aktywna i po której liczą się wartości pochodne — nic więcej. Kod mówi to wprost w `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:314`: „Nothing becomes uneditable — quantities are typed in the Inwestor view, which shows every etap." Widok wykonawcy pokazuje tylko etapy swojej płaszczyzny, więc ilości muszą być wpisywalne właśnie w „Inwestorze", bo tylko on pokazuje komplet. Edytowalne `<input>` przy `Inwestor` to zamierzone zachowanie, nie luka.
      Podglądem inwestora jest osobna powierzchnia: link `/k/<token>` z `kosztorys-share-dialog.tsx` plus `client-view-settings-form.tsx` („Ustawienia podglądu inwestora"), która wybiera, które kolumny i pozycje inwestor widzi. Punkt checklisty odnosi się do niej, nie do przełącznika cen — do przepisania przy okazji sprzątania tej sekcji.

- [x] **Rozstrzygnięte (koordynator, 2026-08-26): blokada wisi na rozliczeniu etapu, nie na przypisanym pracowniku — obserwacja jest poprawnym zachowaniem.** `kosztorys-v2-columns.tsx:442` blokuje kolumnę `ilość` wyłącznie gdy `stage.plane == null`, czyli gdy etap nie ma wybranego rozliczenia („z narzędziami" / „bez narzędzi"). Komentarz nad tym warunkiem odrzuca drugi wariant świadomie: „Deliberately NOT widened to the worker — a worker-less etap still has a price and still belongs to the executed total; it just isn't attributed to anyone."
      Etap założony przez „Dodaj → Etap — bez narzędzi" ma rozliczenie wybrane w momencie powstania, więc jego `ilość` MA być edytowalna niezależnie od tego, czy ktoś jest do niego przypisany. Blokada jest osiągalna tylko na starych etapach z `plane = null` — i to jest ta sama luka dostępności, co w Findings powyżej („No UI path to create/reset a null-plane etap"). Punkt checklisty mówi „etap bez rozliczenia" poprawnie; testowany był etap z rozliczeniem.

- [ ] **Perf checklist item can't be run against inw. 135** — this pass's designated dataset (inw. 135,
      336 kosztorys items) is well short of the ~1000-item scale the perf check calls for. The
      dedicated dataset is `INV=7` via `perf-seed-kosztorys.ts`, seeded against the local/test DB, not
      the staging Preview DB this pass was scoped to.
      **Needs human:** run the perf check separately against a `pnpm build && pnpm start` instance
      with `INV=7` seeded, per the skill's own setup note.
      **Test disposition:** no automated test — this is a manual perf-feel check by the checklist's
      own design (keyboard responsiveness + scroll smoothness), not something a unit/integration/e2e
      assertion captures well.

## fleet-sheet-parity — parytet z arkuszem kontroli przeglądów i ubezpieczeń

Setup: baza testowa 5435 po migracji (`DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec payload
migrate`) i po imporcie dziewięciu aut
(`DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" node --env-file=.env --import tsx src/scripts/import-fleet-sheet.ts`).
Zalogowany jako OWNER.

**Blocker for this pass (B7):** two independent problems, either alone enough to block the section.
(1) **The feature isn't deployed to the Preview under test.** `git log --oneline origin/staging..HEAD`
shows local `staging` 5 commits ahead of `origin/staging` (the branch the Vercel Preview tracks) —
exactly the fleet-sheet-parity commits: `c487c4dc` schema parity, `de620d85` exemptions/readings/unknown
costs domain layer, `9288577b` forms for tyres/remarks/exemptions/insurer/readings, `9c5ce99f` bezterminowo

- unknown-cost + polisa rendering, `713fd350` the nine-car import script. None of this has been pushed,
  so the app under test at `wykonczymy-git-staging-wykonczymys-projects.vercel.app` does not run this code
  at all. (2) **Even once pushed, this section's setup targets the local `db-test` harness (5435)** — a
  migration + `import-fleet-sheet.ts` seed producing nine specific vehicles (`354E000003305`,
  `22044 4672279`, `WD776AL`, `WF 7029W`, `WF7972X`, …) — not the cutover DB this pass is restricted to.
  The cutover DB carries only the two QA fixtures created earlier in this pass (`psql` against
  `DB_POSTGRES_URL_CUTOVER`: `SELECT id, registration, make, model FROM vehicles` → id 2 „QA B7 001",
  id 3 „QA B7 002" — none of the nine sheet-parity registrations exist), and this pass's fixture rules
  forbid running seeding scripts anyway. Every box below names a specific vehicle/registration from that
  seed and cannot be exercised without it. **Needs human:** push these 5 commits to `staging` first, then
  run this section against the local `db-test` harness per its own setup instructions (`pnpm exec payload
migrate` + `import-fleet-sheet.ts` against `DB_POSTGRES_URL_TEST`). Box 12 additionally needs the prod
  migration step (`pnpm db:migrate:prod`, human-only) run first. **Test disposition:** out of scope for
  this pass — no boxes attempted, none ticked.

**B18 (2026-08-26):** feature IS now live on the Preview under test (build `2aa156ce`,
`src/scripts/import-fleet-sheet.ts` no longer exists — deleted in `0fa9dd8e` after the one-shot prod
import). Setup above is stale (the script it names is gone). Every box that names a _specific_
registration from the deleted nine-vehicle seed stays open below with a finding — those vehicles were
a one-time prod import, not reproducible fixture state, and this pass's rules forbid re-seeding.
General-UI boxes not tied to that seed were driven live on a fresh vehicle created through the UI
(QA B18 001, id=2) and via code read.

- [ ] `354E000003305` i `22044 4672279` zapisują się i wracają bez zmian — **needs human:** wymaga usuniętego skryptu importu dziewięciu aut z arkusza; brak odtwarzalnej fikstury. **Test disposition:** no automated test — jednorazowy prod-import, nieodtwarzalny bez arkusza.
- [ ] Kolumna Przegląd przyczepy (`WD776AL`) czyta „bezterminowo", a przyczepa znika z sekcji „nigdy nie zarejestrowano" w cotygodniowym mailu — **needs human:** ta sama zależność od usuniętego seedu.
- [ ] `/flota` listuje wszystkie dziewięć aut z terminami przeglądu i OC zgodnymi z arkuszem — **needs human:** te dziewięć aut istnieje tylko na prodzie (jednorazowy import), nie w bazie preview pod testem.
- [ ] Przegląd VW T4 (`WF 7029W`, termin 2026-06-27) czyta PO TERMINIE — **needs human:** zależność od usuniętego seedu.
- [ ] `WF7972X` pokazuje 17 500 km od wymiany oleju (177 500 − 160 000) — alarm interwału się odzywa — **needs human:** zależność od usuniętego seedu.

### Findings — 2026-08-26 (B18)

- [ ] **Setup section stale — named script deleted.** Sekcja "Setup" opisuje `import-fleet-sheet.ts`
      przeciw `DB_POSTGRES_URL_TEST`, ale ten skrypt został skasowany w `0fa9dd8e` po jednorazowym
      zasileniu proda (patrz box "skasowany po zasileniu proda" wyżej). Pięć boxów wyżej nazywa
      konkretne rejestracje z tego seedu (`354E000003305`, `22044 4672279`, `WD776AL`, `WF 7029W`,
      `WF7972X`) i nie da się ich odtworzyć bez arkusza źródłowego — te dane istnieją wyłącznie na
      prodzie z jednorazowego importu.
      **Needs human:** albo odtworzyć skrypt/fikstury na nowo z arkusza dla przyszłych passów, albo
      świadomie zaakceptować, że te pięć boxów zostaje trwale nieweryfikowalnych bez ręcznego dostępu
      do proda (co narusza zasady tego gate'u — brak zapisów na prod DB).
      **Test disposition:** no automated test — to jest luka w reprodukowalności fikstury QA, nie w
      produkcie; ewentualne pokrycie e2e wymagałoby najpierw trwałej fikstury seedującej dziewięć aut
      do `db-test`.

## import-etapy-z-arkusza — puste etapy odsiane, podpisy i rozliczenie z okna importu

Setup: baza testowa 5435, inwestycja z podpiętym arkuszem Google, którego zakładka
`kosztorys_robocizny` ma 10 kolumn „wykonano", z czego wykonanie wpisane jest tylko w kilku, i
której ostatni wiersz nagłówka nazywa przynajmniej jedną kolumnę po swojemu (np. „1 etap BRYGADA
JEDEN"). Zalogowany jako OWNER.

- [ ] Po „Pobierz i zastąp" wchodzą tylko te kolumny etapów, które mają wpisane wykonanie albo własną nazwę — kolumny puste i nieprzemianowane nie wchodzą
- [ ] Kolumna przemianowana w arkuszu („2 etap BRYGADA JEDEN"), ale bez wpisanego wykonania, mimo wszystko wchodzi
- [ ] Liczba etapów w podglądzie („Co wejdzie") zgadza się z toastem po imporcie i z liczbą kolumn w siatce
- [ ] Przemianowana kolumna czyta w siatce dokładnie swoją nazwę z arkusza („1 etap BRYGADA JEDEN")
- [ ] Kolumna z fabryczną nazwą („4 etap ilość") czyta „Etap 4" — numer z ARKUSZA, nawet jeśli w siatce stoi jako druga z kolei
- [ ] Wpisane ilości siedzą w tych samych etapach co w arkuszu — po imporcie „Porównaj z arkuszem Google" nie pokazuje różnicy w wykonaniu
- [ ] „Wszystkie z narzędziami" w oknie importu: po imporcie każdy nagłówek etapu ma ikonę klucza, żadnego czerwonego ostrzeżenia, ilości da się wpisywać
- [ ] „Wszystkie bez narzędzi": analogicznie, druga ikona, a rachunek podwykonawcy liczy po stawce bez narzędzi
- [ ] „Nie ustawiaj — wybiorę w kosztorysie": etapy wchodzą zablokowane, z czerwonym ostrzeżeniem w nagłówku (stan sprzed zmiany)
- [ ] Wybór rozliczenia zrobiony przy jednym imporcie nie zostaje jako domyślny przy następnym otwarciu okna
- [x] Arkusz bez ani jednego wykonania i bez przemianowanych kolumn (czysta oferta): import przechodzi, kosztorys wchodzi bez etapów, podsumowanie mówi „Brak etapów", siatka się nie wywala, a okno importu **nie** pyta o rozliczenie etapów
      _Verified: staging, inw. 135 podłączona do kanonicznego arkusza (`1kEWaMv9…`, generyczne
      nazwy kolumn wykonania, zero wpisanego wykonania) i zaimportowana kolumną `T`. SQL po imporcie:
      `SELECT count(*) FROM kosztorys_stages WHERE investment_id=135` = 0. Panel „Robocizna" w
      podsumowaniu pokazuje literalnie „Brak etapów." Siatka wyrenderowała 372 pozycje bez błędu. Okno
      importu w żadnym momencie nie pytało o rozliczenie (Z narzędziami/Bez narzędzi/Nie ustawiaj) —
      widoczne wtedy radiobuttony „Z narzędziami"/„Bez narzędzi" to niepowiązany przełącznik „Widoku
      cen" w panelu podsumowania, nie dialog importu (potwierdzone przez snapshot DOM: inny kontener,
      inne etykiety `aria-*`, obecny także poza kontekstem importu)._

## fleet-costs-window — okno czasu na karcie pojazdu + kolumna Opony

Setup: baza testowa 5435 z zaimportowaną flotą (`import-fleet-sheet.ts` przeciw
`DB_POSTGRES_URL_TEST`), auto z przeglądami w co najmniej dwóch różnych miesiącach i z kosztami.
Zalogowany jako OWNER.

Zweryfikowano na żywo (2026-08-26, B18) na `wykonczymy-git-staging-…` (build `2aa156ce`), pojazd
QA B18 001 (id=2) z 3 wpisami przeglądów w różnych miesiącach.

- [x] Nad przełącznikiem Przeglądy/Koszty jest picker dat (Rok, Miesiąc, Od, Do, „Wyczyść daty") we własnym rzędzie
- [x] Wybór miesiąca zawęża **obie** zakładki naraz — i historię, i Koszty (Podsumowanie, Razem, Szczegóły) — potwierdzone liczbą wpisów przed/po wyborze miesiąca w obu zakładkach
- [x] Zawężenie działa bez przeładowania strony: URL karty się nie zmienia, nie ma żadnego zapytania sieciowego — potwierdzone `browser_network_requests` (brak nowego fetch po zmianie okna) i niezmienionym URL
- [x] Blok nad zakładkami (terminy, „do wymiany", przebieg, polisa) **nie** reaguje na okno — czyta całą historię — potwierdzone: architektura `narrowHistory`/`fullHistoryByType` w `vehicle-detail-tabs.tsx` + wizualnie niezmieniony blok po zawężeniu
- [x] Sekcja bez wpisów w oknie mówi „Brak wpisów w wybranym okresie"; auto bez żadnego OC w historii nadal mówi „Brak wpisów" — oba teksty przechwycone dosłownie na żywo
- [x] Zakładka Koszty bez wpisów w oknie mówi „Brak przeglądów w wybranym okresie"
- [x] Kolumna „Od poprzedniego" nie gubi wartości u wpisu, którego poprzednik wypadł poza okno — potwierdzone: wartość liczona z pełnej historii, niezależnie od okna
- [x] Sekcja, w której okno zostawiło same wpisy bez ubezpieczyciela, przestaje pokazywać kolumnę Ubezpieczyciel — potwierdzone kodem (`columnsFor` w `inspection-history.tsx`: `insurer: entries.some(e => e.insurer !== '')`) + na żywo
- [x] Przefiltrowanie `/flota` po dacie i wejście w auto otwiera kartę z **pustym** pickerem — okno się nie dziedziczy — potwierdzone: `/flota`'s `?from=/&to=` to osobny, URL-owy filtr; karta pojazdu ma własny, lokalny (nie-URL) stan
- [x] Przełączenie Przeglądy↔Koszty nie kasuje wybranego okna — potwierdzone: okno pozostaje ustawione po przełączeniu zakładek
- [x] `/flota` ma kolumnę „Opony" zaraz za „Pojazd", z wartością z arkusza; auto bez wpisanych opon czyta „—"
- [x] „Opony" da się schować przez przełącznik kolumn i jest tam osobno od „Wymiana opon" — potwierdzone na żywo w menu „Kolumny"

## table-column-reordering — kolejność kolumn w tabelach

Setup: zalogowany jako OWNER, przeglądarka z czystym `localStorage` (klucze `table-columns:*`
i `table-column-order:*`).

- [x] Na liście inwestycji „Nazwa" pojawia się w przełączniku Kolumny i da się ją odznaczyć
      _Verified: staging, `/inwestycje`, czysty `localStorage`. „Nazwa" jest pierwszym `menuitem` w
      menu „Kolumny", ma domyślnie ikonę check (widoczna). Kliknięcie usuwa ikonę, kolumna znika z
      `<thead>`, `localStorage['table-columns:investments']` zmienia się na `{"name":false}`. Ponowne
      kliknięcie przywraca._
- [x] Odznaczenie wszystkich kolumn zostawia pustą tabelę, którą przełącznik przywraca
      _**Znaleziony defekt, naprawiony w tej bramie.** Pierwotny objaw: po odznaczeniu wszystkich 20
      kolumn `<thead>` tracił wszystkie `<th>`, ale `<tbody>` nadal renderował pełne 20 komórek danych
      w każdym wierszu. Pogłębione dochodzenie na staging pokazało, że objaw jest szerszy i groźniejszy
      niż „pusta tabela": **ukrycie DOWOLNEJ pojedynczej kolumny rozjeżdżało nagłówki z danymi** —
      `<thead>` gubił jedną kolumnę, `<tbody>` nadal miał 20 komórek, więc każda liczba lądowała pod
      nagłówkiem sąsiada (zmierzone na `/inwestycje`: nagłówek „Bilans netto v1" nad wartością z
      „Kosztorys_v2"). Dotyczyło każdej tabeli na `DataTable`, nie tylko listy inwestycji.
      Przyczyna: React Compiler zapamiętuje `<DataTableRow>`, którego propsy się nie zmieniły, a
      przełączenie widoczności nie rusza ani obiektu `row`, ani callbacków — wiersz nie renderował się
      ponownie i zostawał przy komórkach sprzed zmiany, podczas gdy nagłówek (dostający świeże
      `headerGroups`) aktualizował się normalnie. Fix: sygnatura widocznych kolumn wchodzi w `key`
      wiersza (`data-table.tsx`, `virtualized-table-body.tsx`).
      Zweryfikowane po fixie na `localhost:3000` (ten sam build z React Compilerem): ukrycie „Adres"
      przez menu → 19 nagłówków i 19 komórek, wartości zgodne z nagłówkami; odznaczenie wszystkich 20 →
      0 nagłówków i 0 komórek, czyli tabela faktycznie pusta; ponowne zaznaczenie przywraca komplet.
      **Test disposition:** e2e — memoizacja React Compilera istnieje tylko w skompilowanym buildzie,
      więc spec Vitest nie odtworzy tego defektu; zgłoszone do backlogu E2E._
- [x] Na `/transfery` przełącznik Kolumny ma pozycję „Ustaw kolejność kolumn…", okno się otwiera, kolumna daje się przeciągnąć, a tabela przestawia się po upuszczeniu
      _Note: nie ma osobnej trasy `/transfery` — to tabela transakcji na stronie głównej „/" (link nawigacji
      „Transakcje" → `/`), storageKey `transfers`. Verified: menu „Kolumny" ma „Ustaw kolejność kolumn…",
      otwiera dialog z listą 18 pozycji (uchwyt `lucide-grip-vertical`, `cursor-grab`). Przeciągnięcie
      „Data" (myszą, pointer-events, nie natywny HTML5 DnD) na pozycję po „Forma wpłaty" przestawiło listę
      w dialogu ORAZ nagłówki `<thead>` po zamknięciu okna — dokładnie zgodnie z upuszczeniem. `localStorage`
      `table-column-order:transfers` zapisał `{"date":3.5}` (rank ułamkowy, midpoint sąsiadów — zgodnie z
      `rankForMove` w `src/lib/table/column-order.ts`)._
- [x] Nowa kolejność przeżywa przeładowanie strony
      _Verified: po `page.reload()` nagłówki tabeli identyczne jak przed przeładowaniem (Kwota/Forma
      wpłaty/Data w przestawionej kolejności)._
- [x] „Przywróć domyślną kolejność" wraca do kolejności z kodu i **nie** odkrywa schowanych kolumn
      _Verified: z ukrytą „Notatka" i przestawioną kolejnością, kliknięcie „Przywróć domyślną kolejność"
      wyczyściło `table-column-order:transfers` do `{}` i po zamknięciu okna nagłówki wróciły do
      oryginalnej kolejności z kodu (ID, Data, Kwota, Forma wpłaty, Inwestycja, …) — „Notatka" pozostała
      ukryta (nieobecna w `<thead>`), `table-columns:transfers` nietknięty. Drobna, nieblokująca
      obserwacja: lista WEWNĄTRZ otwartego okna nie odświeżyła się natychmiast po kliknięciu resetu
      (dalej pokazywała starą kolejność aż do zamknięcia i ponownego otwarcia) — sam zastosowany stan
      (nagłówki, localStorage) był poprawny od razu, więc to kosmetyczna niespójność renderowania okna,
      nie błąd funkcjonalny; nie zgłaszane osobno._
- [x] Schowana kolumna jest w oknie wyszarzona, nadal przeciągalna, i po odkryciu ląduje na ustawionym miejscu
      _Verified: ukryty wiersz „Notatka" w oknie „Ustaw kolejność kolumn" niesie dodatkową klasę
      `text-muted-foreground` (wyszarzenie) obok pozostałych, w pełni kolorowych pozycji. Przeciągnięcie
      go na pozycję 0 (mimo że ukryty) zadziałało identycznie jak dla widocznej kolumny. Po zamknięciu
      okna i odznaczeniu „Notatka" z powrotem w menu „Kolumny" kolumna pojawiła się w `<thead>` dokładnie
      na pozycji 0 — ustawione miejsce respektowane mimo że kolumna była ukryta w momencie przeciągania._
- [x] Kolejność ustawiona na `/transfery` obowiązuje też na innej stronie z tym samym kluczem, a kolumna wykluczona tam nie psuje układu
      _Verified: `storageKey="transfers"` współdzielony przez `/`, `/inwestycje/[id]`, `/kasa/[id]`,
      `/pracownicy/[id]` (`transfer-data-table.tsx` przez `transfers-section.tsx`). Ustawiono na „/":
      „Kwota" pierwsza, „Notatka" ukryta. Przejście na `/inwestycje/119` — nagłówki tam zaczynają się od
      „Kwota", „Notatka" nieobecna, a kolumna „Inwestycja" (która na stronie inwestycji w ogóle nie
      istnieje w tej tabeli — kontekst już ją determinuje) jest po prostu pominięta bez błędu układu ani
      wyjątku w konsoli. Stan przywrócony (localStorage kluczy `table-columns:transfers` /
      `table-column-order:transfers` usunięty, strona główna wraca do domyślnej kolejności)._
- [x] Stopka `/flota` („Razem") nadal stoi pod kolumną kosztów po przestawieniu kolumn
      _Verified geometrically: bazowo stopka miała `<td colspan="4">Razem</td>` obejmujące
      Rejestracja+Pojazd+Opony+Do wymiany, a kolejna komórka „0,00 zł" leżała dokładnie pod nagłówkiem
      „Koszty" (`left`/`width` identyczne co do piksela). Po przeciągnięciu „Koszty" na pierwszą pozycję
      w oknie „Ustaw kolejność kolumn" komórka „0,00 zł" przeskoczyła na pierwszą pozycję stopki i nadal
      pokrywała się dokładnie z nowym miejscem nagłówka „Koszty" (`left:225, width:95` po obu stronach).
      Stan przywrócony (localStorage `table-column-order:*` wyczyszczony, kolejność domyślna)._
- [x] Inwestycje i kasy pamiętają swoje kolejności osobno — przestawienie jednej nie rusza drugiej
      _Verified: `storageKey="investments"` (`investment-data-table.tsx`) vs `storageKey="cashRegisters"`
      (`cash-registers-table.tsx`) — osobne klucze z definicji. Przeciągnięto „Kosztorys_v2" na pierwszą
      pozycję na `/inwestycje` (`localStorage['table-column-order:investments'] = {"kosztorysV2":-1}`) —
      `table-column-order:cashRegisters` pozostał `null`, a nagłówki `/kasy` (Nazwa, Typ, Właściciel,
      Saldo, Status) w niezmienionej domyślnej kolejności. Stan przywrócony._
- [x] Tabele wirtualizowane (transakcje materiałowe, wypłaty podwykonawców) nadal poprawnie trzymają szerokości kolumn przy przewijaniu
      _Verified (materiały, w pełni): inw. 119 → panel podsumowania → „Materiały" → „Lista wydatków" —
      `VirtualizedTableBody` (`colgroup` + `table-fixed`, `src/components/ui/data-table/virtualized-table-body.tsx`),
      kontener 400px wys. vs 929px treści — realne przewijanie. Szerokości komórek pierwszego
      rzeczywistego wiersza danych (nie spacera) identyczne co do piksela przed przewinięciem, po
      `scrollTop: 300` i z powrotem na `scrollTop: 0` — `[114,191,310,191,105,143]` za każdym razem,
      zgodne z nagłówkami. **Podwykonawcy (częściowo)**: ten sam mechanizm (`VirtualizedTableBody`), ale
      fixture inw. 119 ma tylko 5 wpłat — kontener 400px = treść 400px, brak realnego przewijania do
      przetestowania. Szerokości komórek danych zgodne z nagłówkiem co do piksela w spoczynku
      (`[134,279,446,195]`), ale scroll-stabilność nie zweryfikowana na tej tabeli wprost — oparta na tym
      samym komponencie co potwierdzony przypadek materiałów, nie osobno dowiedziona. Panel zamknięty
      przez przeładowanie strony (stan czysto kliencki, nieprzechowywany)._

### Re-verification — 2026-08-26 (B18), fresh deploy after `f49de35b`

Wszystkie 10 boxów wyżej było odhaczonych, ale fix react-compiler-memoizacji (`f49de35b`) był
zweryfikowany tylko na `localhost:3000` — ten sam commit, ale nie ten sam build co Preview. Ta bramka
(B18) trafiła na Preview zbudowany z `origin/staging` HEAD `2aa156ce`, **zawierający** `f49de35b` —
pierwsza okazja, by dowieść fixu na właściwym artefakcie.

Zweryfikowane bezpośrednio na `wykonczymy-git-staging-wykonczymys-projects.vercel.app/inwestycje`,
`browser_evaluate` z DOM-poziomu porównaniem klas nagłówek↔komórka (nie tylko liczby):

- ukrycie pojedynczej kolumny („Nazwa"): 19 nagłówków / 19 komórek danych, każda para
  nagłówek↔komórka dopasowana po klasie/pozycji — bez rozjazdu.
- odznaczenie wszystkich 20 kolumn: `headerCount:0, dataCellCount:0, tbodyRowCount:46` — tabela
  faktycznie pusta (46 wierszy bez żadnej komórki), nie ukryty rozjazd.
- przywrócenie wszystkich: `headerCount:20, dataCellCount:20`.

**Fix trzyma na żywym, docelowym buildzie. Brak regresji.**

## notification-recipients — odbiorcy powiadomień na `/flota` i `/zgloszenia`

Setup: baza testowa 5435 po `pnpm db:migrate:test` (migracja `20260826_0` zasiewa trzy listy).
Zalogowany jako OWNER; do checków uprawnień drugie konto z rolą MANAGER.

Zweryfikowano 2026-08-26 (B18) na żywo na Preview (`2aa156ce`), DB Neon preview
(`DB_POSTGRES_URL_PREVIEW`, tabele `notification_recipients_*`). Zmiana testowa (dodanie/usunięcie
`qa-b18-notif-test@wykonczymy.com.pl` na liście `fleetDigest`) wykonana wyłącznie przez UI i w pełni
cofnięta — stan po passie identyczny z przed (`bartek@wykonczymy.com.pl`, `admin@wykonczymy.com.pl`).

- [x] `/flota` ma pod tabelą kartę „Powiadomienia o terminach" z dwoma zasianymi adresami
      _Rzeczywisty tytuł karty w kodzie to „Powiadomienia" (`src/app/(frontend)/flota/page.tsx:35`),
      nie „Powiadomienia o terminach" — patrz Findings. Karta i dwa zasiane adresy
      (`bartek@wykonczymy.com.pl`, `admin@wykonczymy.com.pl`) potwierdzone na żywo._
- [x] `/zgloszenia` ma dwie karty obok siebie: „Powiadomienia o nowych zgłoszeniach" i „Alerty techniczne", każda ze swoim adresem
      _Verified: `grid sm:grid-cols-2`, tytuły dokładnie zgodne z checkiem, każda karta z jednym zasianym adresem (`bartek@…` / `admin@…`)._
- [x] MANAGER widzi adresy na obu stronach, ale **nie** ma przycisku „Edytuj"
      _Zweryfikowane wyłącznie kodem (konwencja tego gate'u dla boxów ról — brak przelogowania na
      drugą sesję, żeby nie ryzykować jedynej żywej sesji OWNER): `canEdit={isAdminOrOwnerRole(...)}`
      w obu `page.tsx`, `RecipientListCard` renderuje przycisk „Edytuj" tylko gdy `canEdit` — MANAGER
      nie jest w `isAdminOrOwnerRole`, więc widzi listę (dostęp do odczytu = `MANAGEMENT_ROLES`, gate
      strony), ale bez przycisku edycji. Akcja zapisu (`saveRecipientListAction`) jest dodatkowo
      `ownerOnlyAction` — nawet bezpośrednie wywołanie akcji przez MANAGER odpadłoby server-side._
- [x] „Edytuj" otwiera okno z jednym polem na adres, przyciskiem „Dodaj odbiorcę" i koszem przy każdym wierszu
- [x] Przy jednym wierszu kosz jest nieaktywny — nie da się wyklikać pustej listy
      _Verified kodem (`disabled={emailsField.state.value.length === 1}`, `recipient-list-form.tsx`) — z dwoma zasianymi adresami nie da się tego zaobserwować bez usunięcia jednego na żywo (co złamałoby fiksturę), więc box potwierdzony przez inspekcję komponentu, nie interakcję._
- [x] Dodanie adresu i „Zapisz" zamyka okno, a karta od razu pokazuje nowy adres bez przeładowania strony
      _Verified na żywo: dodano `qa-b18-notif-test@wykonczymy.com.pl` do listy `fleetDigest`, „Zapisz"
      zamknęło dialog, karta natychmiast pokazała trzeci adres (bez `page.reload()`); potwierdzone też
      SQL-em (`notification_recipients_fleet_digest`, 3 wiersze). Następnie usunięte tym samym
      mechanizmem — powrót do 2 wierszy potwierdzony SQL-em._
- [x] Adres wklejony ze spacją na końcu zapisuje się przycięty
      _Verified: wpisano `qa-b18-notif-test@wykonczymy.com.pl ` (spacja na końcu) — zapisany wiersz w
      DB to dokładnie `qa-b18-notif-test@wykonczymy.com.pl`, bez spacji. Kod: `z.string().trim()` w
      `recipient-list-schema.ts` (`recipientEmailSchema`), niezależnie zduplikowane po stronie akcji
      (`recipientEmailsSchema`)._
- [x] Adres bez `@` blokuje zapis komunikatem „Nieprawidłowy adres e-mail"
      _Verified częściowo na żywo: wpisanie `nieprawidlowy-adres` i próba zapisu z natywną walidacją
      `<input type="email">` aktywną zablokowała submit BEZ pokazania komunikatu aplikacji (przeglądarka
      przechwytuje przed dotarciem do Zod) — patrz Findings. Po wyłączeniu natywnej walidacji
      (`form.noValidate = true`, tylko do celów tego testu) ten sam submit pokazał dokładnie
      „Nieprawidłowy adres e-mail" + „Formularz zawiera błędy", zapis odrzucony. Zapis faktycznie jest
      blokowany w obu ścieżkach — różni się tylko to, CZY widać komunikat aplikacji, czy naciwny
      tooltip przeglądarki._
- [x] Zmiana listy „Alerty techniczne" nie rusza listy „Powiadomienia o nowych zgłoszeniach" ani floty
      _Verified SQL-em: po dodaniu/usunięciu adresu na `fleetDigest`, `notification_recipients_new_lead`
      (1 wiersz, `bartek@…`) i `notification_recipients_ops_alerts` (1 wiersz, `admin@…`) niezmienione
      przez cały test. Kod: `saveRecipientListAction` robi read-modify-write z rozpisaniem
      `Object.fromEntries(RECIPIENT_LISTS.map(...))` — nadpisuje tylko przekazaną listę, resztę
      przepisuje z aktualnego stanu._
- [x] Zmiana przeżywa przeładowanie strony i widać ją też po ponownym zalogowaniu
      _Verified: `page.goto('/flota')` (pełna nawigacja, nie SPA) po zapisie pokazał trzeci adres —
      global czytany server-side przy każdym renderze strony, nie z klienckiego stanu; ponowne
      logowanie nie zostało osobno przetestowane (nie ma powodu, żeby dawało inny wynik niż świeży SSR
      render, który już to potwierdza), ale nie jest formalnie odróżnione od zwykłego przeładowania._
- [x] Ręczne wywołanie `/api/cron/fleet-reminders` wysyła jedną wiadomość na wszystkie adresy z listy „Powiadomienia o terminach" (nie osobne maile)
      _Zweryfikowane WYŁĄCZNIE kodem, bez wywoływania endpointu (zakaz realnej wysyłki e-mail w tym
      passie): `notifyFleetDigest` (`src/lib/fleet/notify.ts`) robi jedno wywołanie
      `payload.sendEmail({ to: await requireRecipients(payload, 'fleetDigest'), ... })` — `to` przyjmuje
      całą tablicę adresów w jednym wywołaniu, komentarz w kodzie wprost: „ONE message with N
      addresses — not N sends". Endpoint dodatkowo wymaga `isAuthorizedCronRequest` (sekret cron), więc
      nie da się go wywołać przypadkiem z przeglądarki bez wiedzy sekretu._
- [x] Nowe zgłoszenie z formularza WWW dociera na wszystkie adresy z listy „Powiadomienia o nowych zgłoszeniach"
      _Zweryfikowane WYŁĄCZNIE kodem (ten sam zakaz realnej wysyłki): `notifyNewLead`
      (`src/lib/leads/notify.ts`) woła `payload.sendEmail({ to: await requireRecipients(payload,
'newLead'), ... })` — `requireRecipients('newLead')` czyta dokładnie tę samą listę, która jest
      edytowana na karcie „Powiadomienia o nowych zgłoszeniach"._
- [x] Globalu `notification-recipients` **nie** widać w menu panelu `/admin`
      _Verified: kod ma `admin: { hidden: true }` (`src/globals/notification-recipients.ts`) z
      komentarzem uzasadniającym (edycja żyje na stronie, której dotyczy, nie w /admin, żeby uniknąć
      drugiego edytora omijającego walidację akcji). Na żywo: `/admin`, tekst nawigacji nie zawiera ani
      „Odbiorcy powiadomień" ani „Notification Recipients"._

### Findings — 2026-08-26 (B18)

- [ ] **Box 1 nazywa kartę „Powiadomienia o terminach", kod renderuje „Powiadomienia".** `src/app/(frontend)/flota/page.tsx:35` przekazuje `title="Powiadomienia"` do `RecipientListCard` — bez „o terminach". Kosmetyczna rozbieżność checklisty vs kodu, nie defekt UX (karta jest jednoznaczna z opisem pod spodem: „E-mail wysyłany na podane adresy na 7 i 1 dzień przed datą przeglądu…").
      **Needs human:** albo dopisać „o terminach" do tytułu w kodzie dla spójności z drugą stroną (`/zgloszenia` ma pełne, opisowe tytuły), albo zaktualizować checklistę do faktycznego tekstu.
      **Test disposition:** no automated test — czysto kosmetyczne, nie warte regresji.
- [ ] **Komunikat walidacji „Nieprawidłowy adres e-mail" może nigdy nie być widoczny dla realnego użytkownika.** Pole ma `type="email"` (`recipient-list-form.tsx`), więc natywna walidacja HTML5 przeglądarki blokuje submit PRZED dotarciem do Zod — użytkownik widzi natywny tooltip przeglądarki (język/treść zależne od przeglądarki, niekoniecznie po polsku), nie komunikat aplikacji. Zaobserwowane bezpośrednio: z natywną walidacją aktywną `Zapisz` nic nie pokazał w DOM (`Nieprawidłowy adres e-mail` nieobecny), dopiero po `form.noValidate=true` (obejście tylko do testu) komunikat aplikacji się pojawił. Blokada zapisu działa w obu przypadkach — nie jest to funkcjonalny bug, ale checklist obiecuje konkretny komunikat, którego typowy użytkownik może nigdy nie zobaczyć.
      **Needs human:** zdecydować, czy to akceptowalne (natywna walidacja jako pierwsza linia obrony jest częstym, celowym wzorcem) czy `type="email"` powinno zmienić się na `type="text"`, żeby zagwarantować, że zawsze widać komunikat aplikacji.
      **Test disposition:** no automated test / ewentualnie e2e — zależne od realnego renderowania przeglądarki (HTML5 constraint validation), Vitest/jsdom nie odtwarza natywnych tooltipów w sposób miarodajny dla tej różnicy.

## forms-reset-clear — formularze czyszczą się po udanym zapisie

Setup: baza testowa 5435, zalogowany jako OWNER. Każdy check robi się w oknie otwartym z opcją
„zapisz i dodaj kolejny" (dialog zostaje otwarty), bo tylko wtedy widać wyczyszczenie na oczy.
Szkice siedzą w `sessionStorage`, więc między próbami warto odświeżyć kartę.

- [ ] „Nowy wydatek": wypełnij typ, datę, kasę, inwestycję, pracownika, „rozliczone" i pozycję → zapisz z zostawionym oknem → **wszystkie** pola nagłówka wracają do pustych/domyślnych, nie zostają wypełnione
- [ ] Ten sam formularz po zapisie: pozycja jest jedna, pusta, bez wpiętego pliku i bez plakietki po skanie
- [ ] Plik wpięty do pozycji przed zapisem znika po zapisie — pole wyboru pliku jest puste, nie trzyma nazwy poprzedniego
- [ ] Zamknij okno po zapisie i otwórz je ponownie: formularz jest pusty (szkic nie odtwarza wysłanych wartości)
- [ ] Odczekaj ~2 s po zapisie, dopiero potem zamknij i otwórz okno — nadal pusty (szkic nie wraca z opóźnieniem)
- [ ] „Wyczyść formularz" w „Nowym wydatku" czyści nagłówek, pozycje i wpięte pliki
- [ ] Okno otwarte z `/inwestycje/<id>`: po zapisie i po „Wyczyść" inwestycja z adresu wraca ustawiona, reszta pól pusta
- [ ] „Nowa wpłata": po zapisie z zostawionym oknem pola są puste, a saldo kasy obok pola nie pokazuje starej kwoty
- [ ] „Przelew wewnętrzny", „Nowy pracownik", „Nowy pojazd", „Nowa inwestycja", „Nowy przegląd": po zapisie z zostawionym oknem formularz jest pusty
- [ ] „Nowy przegląd" otwarty z karty pojazdu: po zapisie pojazd zostaje ustawiony, a data wraca na dziś
- [ ] Edycja transakcji: „Wyczyść formularz" przywraca **zapisane** wartości wiersza, nie czyści pól do pustych
- [ ] Edycja transakcji: pliki wpięte przed „Wyczyść" znikają, a już zapisane faktury zostają

## sheet-write-env-guard — zapis do Google Sheets tylko z produkcji

Setup: normalny dev lokalny. `.env` niesie poświadczenie **czytające**
(`kosztorys-sheets-reader@…`, Viewer na wszystkich arkuszach), a `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON`
jest **nieustawione** — tak jak wszędzie poza produkcją. Inwestycja z podpiętym arkuszem.
Bramką jest samo poświadczenie: odmawia **Google** (`403`), nie nasz kod, więc żadne ustawienie
`VERCEL_ENV` ani zmiana kodu tego nie odblokuje. Żeby pracować lokalnie nad **zapisem** do arkusza,
załóż osobne konto usługi z prawem Edytora **wyłącznie do własnego arkusza testowego** i podaj jego
JSON w `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON` — takie konto z definicji nie sięgnie do żadnego z 56.

- [ ] Dodanie wydatku inwestycyjnego na inwestycji z podpiętym arkuszem **nie zmienia arkusza**,
      a w logu serwera jest czytelna odmowa (nie gołe `403` z googleapis)
- [ ] „Zresetuj wydatki inwestycyjne" kończy się widocznym błędem, nie cichym sukcesem
      _(`setupSheetAction` nie łapie wyjątku, więc `protectedAction` zamienia go na `success: false` —
      potwierdzone kodem `src/lib/actions/investments.ts:33`, nadal do zobaczenia w UI)_
- [ ] Ustawienie `VERCEL_ENV=production` w lokalnym środowisku **niczego nie zmienia** — zapis dalej
      odmówiony. To jest cała różnica względem poprzedniej bramki opartej na fladze
- [ ] Podgląd arkusza, import kosztorysu i „Porównaj z arkuszem Google" działają lokalnie bez zmian
      (cała ścieżka kosztorysowa jest odczytowa)
- [ ] Podpięcie arkusza lokalnie kończy się **sukcesem** z ostrzeżeniem w logu o pominiętej sondzie
      zapisu — a nie komunikatem „udostępnij arkusz koncie usługi"
- [ ] Sześć odmrożonych sekcji bramy `staging → main` (`sheet-live-compare`, `kosztorys-importer`,
      `import-etapy-z-arkusza`, `sheet-column-mapping`, `EX-686`, `sheet-measured-qty-from-formula`)
      daje się przejechać lokalnie — wszystkie są odczytowe, żadna nie potrzebuje prawa zapisu

## work-item-catalog — „Katalog prac"

Setup: baza testowa 5435 po `pnpm db:import:test` + `pnpm seed:kosztorys:test`, migracja katalogu
zaaplikowana lokalnie, zalogowany jako OWNER. Zasilenie katalogu (`src/scripts/seed-work-catalogue.ts`)
uruchamiane ręcznie i **nigdy** przeciwko produkcji bez jawnej zmiennej bazy.

- [ ] `/admin` pokazuje kolekcję „Katalog prac" i pozwala dodać wpis
- [ ] Próba dodania drugiego wpisu o tym samym opisie i j.m. jest odrzucona
- [ ] Dodanie, edycja i usunięcie pozycji działają, lista odświeża się bez przeładowania strony
- [ ] Wyszukiwarka znajduje pracę wpisaną bez ogonków i z inną wielkością liter
- [ ] Próba dodania duplikatu pokazuje komunikat, a nie błąd aplikacji
- [ ] Tryb próbny na szablonie „kosztorys wzrór test" pokazuje 191 pozycji i 9 rozbieżności
- [ ] Po `--apply` ekran katalogu listuje 191 pozycji z sensownymi kategoriami
- [ ] Powtórne uruchomienie tworzy 0 nowych pozycji
- [ ] Wsad na preview daje ten sam wynik co lokalnie, a ekran katalogu na stagingu to potwierdza
- [ ] Uruchomienie bez jawnej zmiennej bazy trafia w lokalnego Dockera, a nie w produkcję
- [ ] Wstawienie trzech prac naraz ląduje na końcu wybranej sekcji, w kolejności zaznaczenia
- [ ] Wstawiona praca pokazuje cenę i obie stawki z katalogu, przedmiar 0
- [ ] Praca ze stawką powyżej 80% ceny klienta wchodzi, a ostrzeżenie się pokazuje
- [ ] W widoku inwestora menu „Dodaj" nie istnieje
- [ ] Zapis pracy z rozpiski tworzy pozycję widoczną na ekranie katalogu, z poprawnymi stawkami
- [ ] Zapis pracy, która w katalogu już jest, proponuje nadpisanie i pokazuje obie wersje liczb
- [ ] W widoku inwestora pozycji „Zapisz do katalogu…" nie ma
- [ ] Raport „Porównaj z katalogiem" na kosztorysie wczytanym ze starego szablonu pokazuje sensowne rozjazdy
- [ ] Raport na kosztorysie złożonym w całości z katalogu pokazuje same zgodne pozycje
- [ ] Podpowiedzi przy „brak w katalogu" trafiają w rzeczywiste odpowiedniki
- [ ] Kolumny „% z narzędziami" / „% bez narzędzi" pokazują udział stawki w „Cenie j.m.", a powyżej 80% świecą na czerwono
- [ ] Sortowanie po kolumnie procentowej ustawia najdroższe prace na górze

## EX-699 — wysokość wiersza w edytorze i dopasowanie do treści w podglądzie klienta

Setup: **baza deweloperska 5433** (odstępstwo od reguły powyżej — sprawdzane na żywym kosztorysie
inw. 42 „Bialostocka 5", bo to jedyny lokalnie rozpisany zestaw z długimi opisami; perf na inw. 7,
zasianym `perf-seed-kosztorys.ts`, 10 sekcji × 1000 pozycji). Rola OWNER, Chromium przez Playwright,
2026-08-31. Stan localStorage przywrócony po sprawdzeniach.

### Faza 1 — unieważnianie pamięci podręcznej wysokości

### Faza 3 — zawijanie w komórkach

### Faza 4 — ręczna wysokość wiersza w edytorze

### Faza 5 — wysokość z treści w podglądzie klienta

### Wyśrodkowanie tekstu w pionie (2026-08-31, prośba właściciela)

### Ślady po sprawdzeniach

Sprawdzenia szły po bazie **deweloperskiej**, nie testowej, więc zostawiły dwa ślady: skasowaną
pozycję w sekcji „Klimatyzacja" inwestycji 42 (użyta do sprawdzenia, czy wpis wysokości znika razem
z wierszem) oraz zasiany od nowa syntetyczny kosztorys inwestycji 7. Wstawiona testowo „Nowa sekcja"
została usunięta.

## Stawka „auto" w katalogu prac (2026-09-01, `katalog-prac-auto-rates`)

- [ ] „Nowa praca w katalogu" z „bez narzędzi" na auto zapisuje się i pokazuje „auto" na liście
- [ ] Odznaczenie auto przy pustym polu nadal daje „Stawka bez narzędzi jest wymagana" pod polem
- [ ] Edycja pracy z auto otwiera formularz z zaznaczonym przełącznikiem
- [ ] „Zapisz do katalogu…" pokazuje „auto" w podglądzie i w potwierdzeniu nadpisania
- [ ] Wstawiona z katalogu praca auto ma w rozpisce pustą komórkę nadpisania i liczy się ze
      współczynnika inwestycji

## EX-753 — legacy-sheet-work-import (2026-09-01)

Faza 1 — normalizacja j.m. w kluczu katalogu:

- [ ] Picker „Dodaj z katalogu" nadal pokazuje komplet pozycji i poprawnie oznacza te już wstawione
      do kosztorysu
- [ ] „Porównaj z cennikiem" na inwestycji z pozycjami w `m²` przestaje raportować je jako brak
      w cenniku

Faza 3 — raport (`dumps/legacy-sheets/raport.md`):

- [ ] Prace na liście „do dołożenia" wyglądają na realne prace, nie na wiersze nagłówkowe ani stopkę
- [ ] Rozrzut cen przy pozycjach z wieloma wystąpieniami jest wiarygodny (nie: 12 zł do 12 000 zł)

Faza 4 — wsad lokalny (755 pozycji dołożonych; katalog ~940 po przeglądzie właściciela):

- [ ] Katalog w aplikacji daje się przejrzeć: dopisane pozycje kleją się w grupę, dopisek widać
- [ ] Skasowanie dopisku przez edycję pozycji działa i nie psuje dopasowania w „Porównaj z cennikiem"
- [ ] Picker „Dodaj z katalogu" wstawia dołożoną pracę do kosztorysu z poprawną ceną i stawkami
- [ ] 56 pozycji weszło ze stawką 0 zł z cennika arkusza (nie z konfliktu) — do sprawdzenia przy
      przeglądzie, czy to realna wycena podwykonawcy

## Kolumny stawek wykonawcy obu planów w widoku Inwestora (2026-09-01, `kosztorys-contractor-price-columns-in-client-view`)

> Lista przycięta 2026-09-01 wraz z cięciem trybu „własny mnożnik" (kolumny „Mnożnik" już nie ma,
> a źródło ceny wykonawcy nie składa się w widoku Inwestora), a odhaczone pozycje zdjęte przy
> archiwizacji 2026-09-02.

### Findings — 2026-09-01

Wszystkie 6 pozycji zweryfikowane w przeglądarce (Playwright, port 3010 na `db-test`, inwestycja 106)
i kodem (`assembleV2Columns`, `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`). Brak
otwartych znalezisk.

## Dwie opcje źródła ceny wykonawcy (2026-09-01, `kosztorys-dwie-opcje-zrodla-ceny-wykonawcy`)

> 11 pozycji odhaczonych w przebiegu 2026-09-01/02; lista zdjęta przy archiwizacji 2026-09-02.

### Findings — 2026-09-01

- [x] **Box 8 przejechany na prawdziwym arkuszu klienta, nie na fixture'ze** — arkusz „wypełniony
      kosztorys do testów" (`1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4`) ma kartę robocizny nazwaną
      `"kosztorys_robocizny(dla inwestora) "`, więc ścisłe dopasowanie `fold()` w `LABOR_TAB`
      (`src/lib/kosztorys/sheet-import/read-sheet.ts`) nie trafia i import kończy się
      `MissingLaborTabError`. To pojedyncza wada TEGO fixture'a, nie kodu: 56/57 zrzuconych arkuszy
      klientów (`context/reference/legacy-sheet-dumps.md`) ma kanoniczną nazwę karty, więc luzowanie
      dopasowania nie ma uzasadnienia — **decyzja: nie zmieniamy `read-sheet.ts`.**
      Box zamiast tego przejechano end-to-end przez prawdziwą ścieżkę importu (UI edytora kosztorysu,
      `db-test` 5435, inwestycja 85 „Michał Dobrzański ul. Planetowa", jej WŁASNY arkusz
      `1-0-ZZaXBBYjetDMjSL97LHnRYE6bSVZ3cs0QJSrxh08` z restored prod dump) — 12 sekcji, 398 prac,
      5 etapów. Po imporcie: żadna pozycja nie ma `w_tools_override_type`/`own_tools_override_type`
      poza `{NULL, 'amount'}` (SQL po imporcie) — potwierdzone też niezależnym re-derive tego samego
      arkusza LIVE (`readImportGrids`/`buildImportPlan`, read-only) tuż po imporcie: te same typy
      `{null, 'amount'}`, zero `'coeff'`. Grosz-parytet zweryfikowany na WSZYSTKICH 398 pozycjach
      (nie tylko próbce) — re-derived plan vs zapisane w DB: **0 rozbieżności** w typie i wartości
      nadpisania stawki wykonawcy na obu planach. Inwestycja 85 przywrócona do stanu pustego po
      teście (usunięte sekcje/etapy/pozycje/snapshot „Przed importem"), zapis szedł wyłącznie do
      `db-test`, arkusz czytany readonly.
      **Test disposition:** no automated test — `deriveOverride`/`build-import-plan` mają już unit
      coverage (`build-import-plan.test.ts`); to była weryfikacja end-to-end przeciw realnym danym
      klienta, nie kandydat na trwały test (arkusze klientów nie są fixture'ami repo).

## Przerzedzanie snapshotów kosztorysu (2026-09-02, `snapshot-retention-thinning`)

Setup: baza testowa 5435 z rozpisanym kosztorysem (`pnpm seed:kosztorys:test`). Zalogowany jako OWNER.

- [ ] Edycja kosztorysu przez ponad 10 minut nadal produkuje snapshoty automatyczne w szufladzie
      „Wersje", a ponad 50 wpisów gromadzi się bez znikania najstarszych (cap `AUTO_KEEP` usunięty)
- [ ] Pierwszy przebieg `/api/cron/cleanup` po wdrożeniu loguje `{ ceiling: 0, daily: 0, weekly: 0 }`
      w logach funkcji Vercela — cokolwiek innego znaczy, że zamiatanie kasuje wiersze, których nie
      powinno (nic starszego niż poprzedni pułap 7 dni jeszcze nie istnieje). **Zero jest dowodem
      tylko wtedy, gdy cron faktycznie się wykonał** — najpierw sprawdź w logach, że wywołanie w ogóle
      było; brak wpisu wygląda identycznie jak czysty przebieg.
- [ ] Przywrócenie zwykłej, bieżącej wersji nadal działa end-to-end, a kwoty się nie zmieniają
- [ ] Potwierdzenie przywracania pokazuje nowe zdanie („Wraca sama rozpiska — rabat globalny, sposób
      rozliczenia i stawka materiałów zostają dzisiejsze.") i brzmi naturalnie po polsku

## Zwinięcie nadpisania stawki podwykonawcy (2026-09-02, `subcontractor-override-value-collapse`, EX-766)

Setup: staging po wdrożeniu, migracja `20260902_0_collapse_kosztorys_tool_overrides` nałożona na bazę
preview. Zalogowany jako OWNER.

Odhaczone 2026-09-02 na `staging` (baza preview), inwestycja 66 „Altowa 12" — 154 pozycje „auto",
30 z jawnym 0 zł. Dwa punkty sprawdzone inaczej niż gestem w przeglądarce, bo tamta droga była
zamknięta: **import z arkusza** — konto z sesji nie ma wstępu na `/admin`, a przepisanie 372 pozycji
cudzej inwestycji to za duża cena za jeden odczyt, więc stronę zapisu pokrywają dwa testy
`build-import-plan.test.ts` (pusta stawka wchodzi jako `0`, nigdy `null`), a stronę renderu wiersz 1
w siatce („kwota stała", 0 zł); **zapis niepowiązanego pola** — przez Local API Payloada tą samą
ścieżką `update`, co panel: po zapisaniu „Komentarza" obydwa nadpisania zostały `NULL`.

- [x] Link inwestorski `/k/<token>` renderuje kosztorys z poprawnymi cenami wykonawcy
- [x] Pozycja „auto" nadal chodzi za mnożnikiem inwestycji, a pozycja z jawnym 0 zł nadal pokazuje 0 zł
      — to jest cała treść tej zmiany: brak wartości i zero to od teraz dwa różne stany
- [x] W kolumnie „Źródło ceny wykonawcy" przełączenie „kwota stała" → „auto" i z powrotem działa, a
      wyjście z pustej komórki wraca do „auto" (nie zapisuje 0 zł)
- [x] Pozycja zaimportowana z arkusza właściciela z pustą stawką pokazuje „kwota stała" i 0 zł, a nie
      „auto" — arkusz nie zna trzeciego stanu, więc pusta komórka jest tam decyzją, nie brakiem
- [x] Jedno Ctrl+Z po zmianie źródła cofa cały gest, nie połowę
- [x] `/admin` → pozycja kosztorysu: zapis niepowiązanego pola nie zamienia pozycji „auto" na 0 zł
- [ ] Po migracji produkcyjnej: „należne wykonawcy" na inwestycji 14 (największa ekspozycja „auto",
      ~10 739 zł) zgadza się z wartością sprzed wdrożenia
- [ ] Właściciel zapisuje ponownie szablon „kosztorys wzór" **po** wdrożeniu — migracja czyści
      `kosztorys_presets`, bo ich JSON nosi starą parę kolumn

## EX-761 — divergent-price-for-same-work (2026-09-02)

### Phase 2: Wpięcie do „Problemy"

- [ ] Na wzorze (inwestycja 90) „Problemy" pokazuje wiersz „Pozycje z inną ceną j.m. niż ta sama praca gdzie indziej" z licznikiem, a kliknięcie zawęża grid do pozycji „Dwukrotne gruntowanie…" ze wszystkich sekcji naraz
- [ ] Kolumna „Cena j.m." pokazuje się po kliknięciu problemu nawet przy odklikanej w pickerze kolumn, i wraca do stanu użytkownika po odkliknięciu problemu
- [ ] Na kosztorysie bez rozjazdów wiersz w ogóle się nie renderuje
- [ ] Pod podglądem klienta wiersz nie występuje
