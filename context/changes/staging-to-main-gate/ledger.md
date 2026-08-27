# Staging → main: brama manualna

**Cel:** przelecieć rejestr `context/foundation/manual-checks.md` na **staging** przed mergem `staging → main`.

## Środowisko (przepięte 2026-08-26 po awarii cutovera)

- **Aplikacja:** `https://wykonczymy-git-staging-wykonczymys-projects.vercel.app` (Vercel Preview, gałąź `staging`, SSO przechodzi z profilu przeglądarki Playwright MCP). Alias serwuje redeploy `wykonczymy-dzbkl6voz` z 2026-08-26 09:12 — ten sam build (`8d774edd`), tylko z nowym env.
- **Baza (od 2026-08-26 09:12):** `DB_POSTGRES_URL_PREVIEW` — **`ep-still-term-agp9aqfa-pooler`**, gałąź preview Neona. Decyzja właściciela: wrócić na preview, bo gałąź cutoverowa (`ep-wild-resonance`) **została skasowana po ~23 h życia**. Przepięcie: `vercel env add DB_POSTGRES_URL preview --force` + `vercel redeploy`. **Potwierdzone w stopce aplikacji:** `neondb@ep-still-term-agp9aqfa-pooler`. **To nie jest prod** — prod stoi na `ep-steep-unit-agsa64dd` i nikt go nie dotykał.
- **Sesja:** `qa-gate@wykonczymy.test` (id **63**), rola **OWNER**, hasło losowe (nie w repo). Założona przez jednorazowy skrypt Local API na gałęzi preview, bo `test@test.pl` żył na skasowanym cutoverze. `src/scripts/seed-e2e-user.ts` **nie został użyty** — ma twardą blokadę na nie-localhost i tworzy konto z hasłem trzymanym w repo; obchodzenie tego na zdalnej bazie byłoby dokładnie tym, przed czym ta blokada broni. **Do skasowania na koniec bramy.**
- **Stan bazy (preview, 2026-08-26):** 115 inwestycji, **11 185 pozycji kosztorysu** (dużo bogatsza niż cutover), 3704 transakcje, 1 pojazd. Najbogatsze kosztorysy: inw. 66 „Altowa 12" (402 poz.), 76 (391), 64 (390), 85 (389), 119 (387), 100 (385).
- **Fixture'y bramy z cutovera są STRACONE** — pojazdy `QA B7 001/002`, pracownik `QA B7 Employee`, inwestycje 135/136/137, transakcje testowe. Żyły na skasowanej gałęzi. Kolejne partie zakładają swoje od nowa.
- **Nigdy:** prod (`DB_POSTGRES_URL_PROD`, `ep-steep-unit`), `db:migrate:prod`, czyszczenie ciasteczek w przeglądarce (kasuje SSO Vercela — czyścić wyłącznie `payload-token`).

## Skala

71 sekcji rejestru, **734 nieodhaczone boxy** (odhaczone: 5, sekcja S-08). Przelot idzie **partiami po ekranach**, nie po sekcjach — sekcje mocno na siebie nachodzą.

## Partie

| #   | Partia                                                                 | Sekcje rejestru                                                                                                                                              | Status                                 |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| B1  | Grid kosztorysu: kontrakt edycji, sortowanie, filtry, kolejność kolumn | kontrakt-edycji, sortowanie-kolumn-spojne, EX-682/683, EX-688, EX-665, filtry-problemy ×2, EX-713/714, EX-692, EX-580, EX-607, EX-618, EX-560                | w toku                                 |
| B2  | Podsumowanie / marża / rozliczenia podwykonawców                       | EX-649, zaliczka-v2 A+B, podsumowanie-tabs, mixed-settlement, EX-588, EX-594, EX-596, EX-597, EX-605, EX-606, EX-564, EX-565, EX-571, EX-609, EX-575, EX-574 | czeka                                  |
| B3  | Lista inwestycji: bilans/marża/robocizna v1 vs v2                      | EX-555, EX-557, EX-675, investments-listing-expense-plane, summary-panel-filter-blind, EX-608, EX-720                                                        | w toku                                 |
| B4  | Wydatki, faktury, HEIC, skan AI                                        | EX-448, EX-567, EX-581, EX-569, EX-585, EX-662, EX-659, EX-577, EX-394, blob-store-isolation                                                                 | czeka                                  |
| B5  | Arkusz Google: import, porównanie, mapowanie kolumn                    | EX-417 ×2, EX-690, EX-691, EX-686, sheet-measured-qty, import-zastepuje                                                                                      | czeka                                  |
| B6  | Podgląd inwestora i nomenklatura                                       | client-preview-settings, offer-settlement-variants, nomenklatura, EX-548                                                                                     | czeka                                  |
| B7  | Flota                                                                  | EX-711 ×2                                                                                                                                                    | czeka (0 pojazdów — zakładam przez UI) |
| B8  | Leady, cron, powiadomienia                                             | EX-416, EX-660                                                                                                                                               | czeka                                  |
| B9  | Perf, hook split, resztki                                              | S-18, EX-521, EX-430, EX-615, EX-703, remove-section-coeff, EX-600                                                                                           | czeka                                  |

## Do decyzji człowieka (zbiorczo do raportu)

- [x] **Rola OWNER** — zgoda właściciela, `id=63` podniesione do OWNER na cutoverze 2026-08-25. Zostaje do cofnięcia po zamknięciu bramy.
- [x] **Migracja `20260825_0_fix_own_tools_coeff_rounding` — bez decyzji, wchodzi normalnie.** Prod nie ma **ani jednego** wiersza kosztorysu — nie dlatego, że funkcja tam nie dojechała (dojechała dawno), tylko dlatego, że nikt jeszcze nie założył kosztorysu na produkcji. Backfill `0.55 → 0.5525` nie ma więc czego przecenić. Na preview to samo od innej strony: wszystkie 115 inwestycji już na `0.5525`.
- [x] **(B2b) „Rabat całościowy nadal oferuje %" — ODRZUCONE, false positive.** `f4605bf4` zwęził **zapisywany** rabat globalny do kwoty; tryb „%" w kontrolce to osobna, celowa funkcja — jednorazowy bulk-write tego samego % w rabat **każdej pozycji** (`src/components/kosztorys/summary/global-discount-control.tsx:13-28,99-127`, opisany w komentarzu i objęty `applyPercentDiscountSchema`). Nic do naprawy.
- [x] **(B2b) 1-groszowy rozjazd „Pozostało do wypłaty" na inw. 31 — ODRZUCONE, nie odtwarza się.** Sprawdzone na żywo 2026-08-26 (inw. 31 → „Podwykonawcy"): tabela „Razem" i blok „Podsumowanie podwykonawców" pokazują **tę samą** liczbę `-131 494,72`. To stan PO fixie `1601b075` (suma w pełnej precyzji, zaokrąglona raz — `subcontractorRowTotals`); `-131 494,73` z opisu B2b to stan sprzed fixa, cytowany w komentarzu w kodzie.
- [ ] **27 migracji `main..staging` do proda** — pełna lista z kolejnością deploya w raporcie końcowym.
- [x] **Flota: 0 pojazdów na cutover** — decyzja właściciela: **żadnego seedowania ani backfillu**, pojazdy i przeglądy zakładam **przez UI** w trakcie partii B7 (właściciel: „po to są te testy") — również import arkusza wolno odpalać z UI.
- [x] **(B2b) „Staging Preview jest stary" — ODRZUCONE, false alarm (zweryfikowane 2026-08-26).** Deployment aliasu `wykonczymy-git-staging-…` (`created 2026-08-25T20:13:37`) zbudowany jest z `8d774edd` (@ `20:05:55`) — czyli z **czubka `origin/staging`**; `git log --since='2026-08-25 20:13' origin/staging` = **0 commitów**. Oba „niewidoczne live" fixy SĄ w zdeployowanym buildzie (`git merge-base --is-ancestor <fix> origin/staging` przechodzi dla `1601b075` i `f4605bf4`). Rzekome „24 commity nowsze" to **lokalna, niewypchnięta** praca innej sesji w tym samym worktree (lokalny `staging` = `713fd350`, 5 commitów ponad `origin/staging`) — nie ma jej na remote, więc Vercel nie ma czego budować. Wniosek: **dowody UI ze wszystkich partii bramy stoją**, żadnego redeploya nie trzeba.

## Findingi

_(uzupełniane partiami; format: `[ ]` otwarte / `[x]` zamknięte, z dyspozycją testową)_

**B1** — `context/foundation/manual-checks.md`, 12 sekcji manualnego QA na staging (inw. 135, rola MANAGER):

- **B1** — „Kosztorys — jeden kontrakt edycji…": 12 zweryfikowane, 10 needs-human, 5 findings (żaden nie blokuje — dokumentacyjne/oznaczenie stanu, nie regresje kodu; 0 poprawek na miejscu).
- **B1** — `sortowanie-kolumn-spojne`: 0/11 zweryfikowane (brak dowodów na konkretne kolumny listy), 1 finding otwarty `[ ]` — sekcja oznaczona „Zarchiwizowane" ale checklista nieodhaczona, needs human (retro-tick czy pełny przebieg).
- **B1** — `EX-682 / EX-683`: 2/5 zweryfikowane (alfabetyczne sortowanie w sekcji + widoczność pasów przy aktywnym sortowaniu), 3 needs-human.
- **B1** — `EX-688`: 2/12 zweryfikowane (4 polecenia sortowania w menu + zachowanie pasów przy „w sekcjach"), 10 needs-human.
- **B1** — `kosztorys-filter-conditions`: 0/15 zweryfikowane (tylko struktura menu potwierdzona wizualnie), 15 needs-human — time-boxed.
- **B1** — `filtry-problemy — grupa „Problemy" w menu Filtry`: 1 finding zamknięty `[x]` — sekcja zastąpiona przez „osobny przycisk (fazy 5–7)" niżej, żywy UI już nie ma grupy „Problemy" w „Filtry"; reszta punktów nieoznaczana (opisany interfejs nie istnieje).
- **B1** — `filtry-problemy — osobny przycisk (fazy 5–7)`: 0/9 w pełni zweryfikowane, 3 z częściowym dowodem (przycisk osobny + brak grupy w Filtry; „Problemy (1)"; „Wyczyść wszystko" czyści problem), 9 needs-human.
- **B1** — `EX-713 / EX-714`: 4/15 zweryfikowane (format chipów „Tylko:"/„Szukaj:", chip frazy + X, „Wyczyść wszystko" od 2 chipów, trzy nowe pary w „Filtry"), 11 needs-human.
- **B1** — `kosztorys-column-order (EX-692)`: 1/11 zweryfikowane (menu → dialog otwiera się z focusem), 10 needs-human — drag-and-drop nieprzetestowany (zbyt zawodny przez klikanie w drzewie dostępności).
- **B1** — `EX-580`: 0/12 w pełni zweryfikowane, 2 z częściowym dowodem (pas renderuje netto; „Sekcja" domyślnie ukryta), 10 needs-human.
- **B1** — `EX-607`: 2/12 zweryfikowane z zastrzeżeniem (podpis stopki dwuwierszowy zamiast jednowierszowego; figury pod właściwymi kolumnami), 10 needs-human, perf-item nieprzetestowany (inw. 135 ma 336 poz., nie ~1000).
- **B1** — `EX-618`: 2/11 zweryfikowane (dwupanelowy dialog; „Zaznacz wszystkie"), 1 nietestowalne w tym środowisku (tylko jeden szablon w bibliotece), 8 needs-human.
- **B1** — `EX-560`: 4/7 zweryfikowane (lista szablonów w „Opcje"; podgląd „Zniknie:"/„Wejdzie:"; przeładowanie bez ręcznego odświeżenia; nazwany punkt przywracania + skuteczne „Przywróć"), 3 needs-human.

Blokery: brak — żaden check nie zawiódł jawnie; deficyt to zakres czasowy (time-box) na batch 12-sekcyjny, nie odkryty regres. 2 findings dokumentacyjne (sortowanie-kolumn-spojne anomalia archiwizacji; filtry-problemy grupa = stan zastąpiony) — żadne nie blokuje `Done` samo w sobie, ale duża liczba needs-human oznacza, że te 11 sekcji (poza pierwszą) **nie są w pełni zweryfikowane** i wymagają kolejnej partii ręcznej.

**B2a** — `context/foundation/manual-checks.md`, 3 sekcje z przydzielonych 7 rzeczywiście przejechane (inw. 135 „PROBA CUTOVER…", rola OWNER, staging preview + odczyty na `DB_POSTGRES_URL_CUTOVER`):

- **B2a** — `EX-649` („zakładka Marża: prognoza i marża rzeczywista", money-critical): **16/22 zweryfikowane** — w tym jeden rzeczywisty end-to-end test pieniężny na żywo: zaksięgowano transfer `LABOR_COST` 100 zł (nigdy wcześniej niezaksięgowany na inw. 135) przez dialog „Wydatek" → potwierdzono, że rusza wyłącznie „Robocizna v1" (0→100) i pojawia się ikona rozjazdu przy „Robocizna v2" (kod: `gap !== 0` w `investments.tsx`), podczas gdy „Robocizna v2" (550,00) i „Marża v2" (142,50) stoją w miejscu; oraz rabat pozycyjny 50 zł, który nie rusza Prognozy (2737,50/1225,03 niezmienione) ale obniża Marżę rzeczywistą (192,50→142,50, sprawdzone też w DB `kosztorys_items.discount_type/discount_value`). Dialog transferu potwierdzony żywo: „Koszty robocizny"/„Rabat" obecne, lista typów alfabetycznie po PL. 6 boxów otwartych `[ ]` jako findings — wszystkie o ten sam brakujący fixture: żaden etap na całej bazie cutover nie ma jednocześnie `plane IS NULL` **i** wykonaną pracę (`stage_progress.qty_done<>0`), więc stan „Ustaw rozliczenie etapów"/„ustaw etapy" nie da się zaobserwować w przeglądarce bez seeda; UI (menu „Rozliczenie" per etap) nie oferuje ścieżki powrotu do `null` po ustawieniu. Jeden box (MANAGER nie widzi kolumn marży) zweryfikowany wyłącznie przez czytanie kodu (`isAdminOrOwner` gate w `investments.tsx`), świadomie bez przelogowania na MANAGER, by nie ryzykować jedynej żywej sesji OWNER na stagingu.
- **B2a** — `kosztorys-podsumowanie-tabs` (batch EX-536): **1/10 zweryfikowane** — zakładki Podsumowanie/Materiały/Robocizna/Podwykonawcy/Marża + toggle Netto/Brutto/Mieszane istnieją. Widok „Mieszane" na inw. 135 nie dał się w pełni zweryfikować: settlement_mode persystuje poprawnie po twardym reloadzie (`MIXED` w DB), ale renderuje tylko JEDNĄ tabelę zamiast opisanych dwóch (netto + faktura) — inw. 135 ma zerowe materiały, co prawdopodobnie zwija sekcję brutto/faktura, ale nie potwierdzono tego w kodzie ani na innej inwestycji z realnymi materiałami. 9 boxów otwartych `[ ]`, w tym ⚠ money-semantics box (`wplatyNet` legacy-deposit fix) nieprzetestowany — brak w zasięgu inwestycji z legacy `COMPANY_FUNDING`/`OTHER_DEPOSIT`.
- **B2a** — `EX-588` (investment-settlement-mode): **2/12 zweryfikowane** — istniejąca inwestycja czytała „Netto" (nie pusty stan); przełączenie na „Mieszane" przez selektor w Podsumowaniu wywołało dialog ostrzegawczy „widoczne dla inwestora", zapisało się do `investments.settlement_mode='MIXED'` i przetrwało twardy reload. 10 boxów otwartych `[ ]` — większość wymaga drugiego profilu przeglądarki z niezależnym `localStorage` (niebezpieczne/niemożliwe w tej pojedynczej sesji trzymającej jedyną żywą sesję Vercel SSO + apki na stagingu) albo widoku `/podglad-inwestora`.

**Nieosiągnięte w tej partii (0 boxów dotkniętych):** `kosztorys-zaliczka-v2` (4 boxy), `kosztorys-tryb-mieszany` (5 boxów — sekcja historyczna/superseded, jej żywe zachowanie jest w `kosztorys-podsumowanie-tabs`), `mixed-settlement-both-planes` (sekcja nieprzeczytana), `EX-596` (sekcja nieprzeczytana). Zgodnie z „prefer depth over coverage": budżet poszedł w całości na dokładne domknięcie sekcji money-critical `EX-649` plus częściowe domknięcie dwóch sąsiednich sekcji, które nachodzą na te same kontrolki (przełącznik rozliczenia robocizny). Blokery: brak jawnych regresji; jeden rzeczywisty finding strukturalny (brak fixture dla stanu „ustaw etapy" na całej bazie cutover) zgłoszony jako needs-human z konkretną receptą naprawy (seed/DB update na dedykowanej inwestycji testowej). 0 poprawek kodu na miejscu (nie znaleziono bugów — wszystkie odchylenia od checklisty to brak dowodu/fixture, nie regres).

**B3** — `context/foundation/manual-checks.md`, wszystkie 7 przydzielonych sekcji przejechane (inw. 31 „11 Listopada 40" real read-only + inw. 6/135 real/QA tymczasowe mutacje przez UI, rola OWNER, staging preview + odczyty na `DB_POSTGRES_URL_CUTOVER`):

- **B3** — `EX-555` (write-switch robocizna/rabat z kosztorysu na liście): **9/12 zweryfikowane**, w tym pełny cykl fixture przez UI na inw. 135 (anulowanie #4670 z audit-trail, dobukowanie #4672 `LABOR_COST` 550 zł) i tymczasowy flip inw. 6 na `settlement_mode='GROSS'` z powrotem na `NET`, zweryfikowany SQL-em po przywróceniu. 2 findings otwarte `[ ]` — oba dokumentacyjne, nie regresje: box 4 twierdzi coś przeciwnego niż świadomy komentarz w `hasKosztorysReading()`; boxy 8-9 opisują stan sprzed EX-649, który jawnie i tymczasowo przywrócił „Robociznę"/„Rabat" do okna transakcji (AGENTS.md, do EX-712). 1 finding zamknięty `[x]` (incydentalna notatka o trwałej zmianie fixture na inw. 135, nie defekt).
- **B3** — `EX-557` (wpłaty bez inwestycji): **6/6 zweryfikowane**, 0 findings — sekcja w pełni zamknięta. Jeden box (ukrycie „Zasilenie z konta firmowego" dla MANAGER) zweryfikowany wyłącznie kodem (`deposit-form.tsx:59-62`, `isAdminOrOwnerRole`), świadomie bez drugiej sesji.
- **B3** — `EX-675` (strata obniża dług inwestora jak rabat): **5/11 zweryfikowane**, w tym pełny fixture-cycle na inw. 6 (LOSS transfer zaksięgowany, zweryfikowany w Podsumowaniu i SQL-em, potem anulowany przez UI z audit-trail i `settlement_mode` przywrócone do `NET`). 3 findings otwarte `[ ]`: boxy 4/6 opisują dwie jednoczesne kolumny pieniężne (netto+brutto), co jest strukturalnie niemożliwe w obecnym kodzie — `settlementModeToMoneyAxis()` (`src/lib/kosztorys/settlement-mode.ts:53-61`) mapuje każdy tryb na **dokładnie jedną** oś, nigdy `'both'` (świadoma zmiana właściciela 2026-08-20, odwracająca wcześniejszą zasadę z 2026-08-07) — to najcenniejszy finding tej partii, bo jest ugruntowany w kodzie, nie w domysłach; box 7 nie ma pod ręką fixture (inwestycja ze stratą ma pusty kosztorys, inwestycja z kosztorysem nie ma straty); boxy 9-11 nieosiągnięte (budżet czasu). 1 finding zamknięty `[x]` (sprzątanie fixture inw. 6).
- **B3** — `investments-listing-expense-plane`: **2/11 zweryfikowane** — self-consistency między listingiem a Podsumowaniem inw. 31 potwierdzona co do grosza na aktualnych, żywych danych. 4 findings otwarte `[ ]`: większość boxów w checklisie przypina konkretne złotówki sprzed jakiegoś czasu, a inw. 31 to realne, wciąż zmieniające się dane — liczby się przesunęły (np. „Wydatki wliczone w robociznę" dziś 4421,85 zł, nie 1 004 421,85 zł z checklisty); kolumna „Bilans brutto v2" na inw. 31 czyta „nie dotyczy", bo inwestycja jest dziś w trybie NET (ten sam mechanizm co finding EX-675 boxy 4/6); kolumna „Korekta" z Phase 3 box 5 nie istnieje już w kodzie (grep: zero trafień); `dumps/parity-post-fix.json` z Phase 4 nie istnieje w repo.
- **B3** — `summary-panel-filter-blind`: **9/12 zweryfikowane** — pełny na żywo test filter-blindness na inw. 31: nałożono/zdjęto filtr „Typ" na zakładkach Podsumowanie/Materiały/Marża, liczby identyczne co do grosza przed i po (Marża 390 258,13 zgadza się dodatkowo z listingiem); potwierdzono brak asterysków/przypisu w treści strony i w kodzie (grep „gwiazd" — zero trafień, aparat w pełni usunięty); potwierdzono w kodzie wyciszenie werdyktu w podglądzie inwestora (`settlement-summary.tsx:71`, `reconVisible = !preview && …`); inwestycja bez pozycji kosztorysu (101) renderuje się bez błędu. 1 finding otwarty `[ ]`: 3 boxy nieosiągnięte (fixture z realnym rozjazdem robocizna v1/v2, paginacja/kafelek zaznaczenia, 3 dodatkowe trasy `/pracownicy`, `/raporty`, `/kasa`).
- **B3** — `EX-608` (nazwa inwestycji bez trzeciego zapytania): **5/5 zweryfikowane**, 0 findings — sekcja w pełni zamknięta, w tym żywy `MutationObserver`-test potwierdzający brak migotania nazwy podczas zapisu VAT i żywy round-trip zmiany nazwy inwestycji przez UI (przywrócona po teście).
- **B3** — `EX-720` (nadmiarowe odczyty na trasach kosztorysu): **4/14 zweryfikowane** — redirect EMPLOYEE→`/zaloguj` i gejt zakładki „Marża" OWNER/MANAGER potwierdzone kodem (`requireManagementPage`, `financials` prop), 404 na nieistniejącej inwestycji potwierdzony na żywo (dzieli trasę z EX-608 box 5). 1 finding otwarty `[ ]` pokrywający 10 nieosiągniętych boxów — wymagają fixture'ów spoza zasięgu real/QA danych (podwykonawcy bez przypisanego pracownika, inwestycja z samymi rozliczonymi R+M, arkusz podpięty vs niepodpięty) — needs human z sugestią przelotu na 5435 test DB z projektowym setupem sekcji zamiast stagingu.

**Tally B3:** 40/71 boxów zweryfikowanych na żywo/kodem w tej partii, 31 nieodhaczonych (11 findings otwartych precyzyjnie opisujących powód, 2 findings zamknięte jako incydentalne notatki fixture). Blokery: brak jawnych regresji kodu — wszystkie otwarte findings to albo (a) checklist opisujący stan sprzed EX-649/EX-675 UI reversal, (b) przestarzałe złotówki na realnych, wciąż zmieniających się danych, albo (c) brak pod ręką konkretnej fixtury w jednej dzielonej sesji real/QA. Najcenniejszy finding: `settlementModeToMoneyAxis()` w `settlement-mode.ts` dowodzi kodem, że dwie jednoczesne kolumny pieniężne (netto+brutto) są dziś strukturalnie niemożliwe — unieważnia to część checklisty w dwóch sekcjach na raz (EX-675, investments-listing-expense-plane). 0 poprawek kodu na miejscu (nie znaleziono defektów — wszystkie odchylenia to brak dowodu/fixture albo nieaktualny opis, nie regres).

**B2b** — `context/foundation/manual-checks.md`, 3 z 10 przydzielonych sekcji z realną głębią, reszta nietknięta lub jeden box (inw. 31 „11 Listopada 40" real read-only, inw. 135/136 QA mutowalne, rola OWNER, staging preview + odczyty na `DB_POSTGRES_URL_CUTOVER`; **inwestycja 136 „QA B2b 2026-08-26" założona przez UI** dla EX-564/EX-609, ma jeden wyceniony wiersz Przedmiar=10/Cena j.m. netto=100/brutto=108,00):

- **B2b** — `EX-571` (subcontractor-view-settlement-only, money-critical): **Faza 1 — 4/4 zweryfikowane** (Pomiar Z/Bez zgodny co do grosza z SQL `plane='w_tools'`/`'own_tools'` na inw. 31: 5364,53 / 2,00; suma 75 949,27+1190,00=77 139,27 = „Suma wykonanej pracy"; per-side wiersze panelu zgodne; Inwestor bez filtra = 5366,53 = suma obu). **Faza 2 — 6/8 zweryfikowane** (nagłówki kolumn per widok zrzucone i porównane — Etap 8/9/10 nieobecne w żadnym zrzucie Z/Bez; czerwony tint opisany ze zrzutu; brak przecieku do sąsiednich etapów; picker „Kolumny" dowodzi, że przedmiar/rabat/%-wykonania są **strukturalnie nieobecne** w widokach podwykonawców, nie tylko ukryte — diff listy opcji Inwestor vs Z narzędziami; warianty nagłówka „Razem Netto/Brutto" „— po rabacie" vs „— do zapłaty ekipie" potwierdzone grepem po zapisanym snapshocie). 2 boxy nieodhaczone (locked cells odblokowują się po wyborze etapu; wpisywanie nie gubi znaków) — wymagają mutacji inw. 31 (read-only) albo fixture z niepotwierdzonym etapem, którego UI nie potrafi dziś założyć (patrz finding niżej). **Faza 3 — 0/N, nietknięta** — budżet poszedł w Fazy 1-2, jeden box nachodzi na finding „brak widocznej odznaki" niżej (etap-tool-plane).
- **B2b** — `etap-tool-plane (EX-565)` (per-etap rozliczenie + view-independent subcontractor settlement, money-critical): **Faza 2 (matematyka rozliczenia) — 1/1 zweryfikowany** (te same SQL/UI dowody co EX-571 Faza 1). **Faza 5 (subcontractor summary) — 2/4 zweryfikowane**: mixed-plane Z/Bez dają identyczne podsumowanie zgodne co do grosza; „Pozostało do wypłaty" ujemne renderuje się `text-destructive font-bold` (potwierdzone `getComputedStyle`/className). 2 boxy nieodhaczone: odznaka ostrzegawcza dla niepotwierdzonego etapu nieuruchamialna na inw. 31 (jej null-plane etapy mają zerowe Pomiar — kod `subcontractor-due.ts` świadomie gate'uje odznakę na `rows.some(row => row[key])`, więc brak odznaki jest **poprawny**, nie defekt), i brak baseline sprzed zmiany do porównania. 2 findings: jeden otwarty `[ ]` (brak ścieżki UI do założenia/zresetowania niepotwierdzonego etapu — needs human), jeden zamknięty `[x]` (1-groszowy rozjazd na „Pozostało do wypłaty" — już naprawiony w kodzie `1601b075`, staging Preview jest przestarzały, patrz finding w „Do decyzji człowieka" powyżej; pokryte istniejącym testem `subcontractor-summary.test.ts`).
- **B2b** — `EX-609` (subcontractor-price-guard): **0/N, sekcja nietknięta** — budżet czasu wyczerpany na dokładnym domknięciu EX-571/etap-tool-plane przed dotarciem do tej sekcji (depth-over-coverage).
- **B2b** — `EX-564` (kosztorys-percent-rabat-bulk-apply): **1/N zweryfikowany** — Faza 0 box „kolumny rabatu ukryte w widokach podwykonawców" potwierdzony ponownym użyciem dowodu z EX-571 (picker „Kolumny"). Reszta nietknięta; przy próbie żywego testu Fazy 1 na inw. 136 natrafiono na dowód tej samej staleness co wyżej: okno „Opcje rozliczenia" → „Rabat całościowy" wciąż oferuje „%", mimo że kod (`f4605bf4`, refaktor „amount-only stored discount") jest już na HEAD gałęzi `staging` — patrz finding w „Do decyzji człowieka".
- **B2b** — `EX-605`, `EX-606`, `EX-594`, `EX-597`, `EX-575`, `EX-574`: **0/N każda, sekcje całkowicie nietknięte** — budżet partii wyczerpany na sekcjach money-critical (EX-571/etap-tool-plane) plus dochodzeniu stale-preview, zgodnie z „depth over coverage".

**Tally B2b:** ok. 13/~30 boxów rzeczywiście dotkniętych sekcji zweryfikowanych na żywo/SQL w tej partii (dokładna baza „~30" = suma boxów w Fazach 1-2 EX-571 + Faza 2/5 etap-tool-plane + Faza 0 EX-564; pozostałe sekcje partii — EX-609, EX-605, EX-606, EX-594, EX-597, EX-575, EX-574 — **w całości nieodhaczone, ok. 60+ boxów nieosiągniętych**, zero prób). 2 findings otwarte `[ ]` (brak ścieżki UI do niepotwierdzonego etapu — etap-tool-plane; staleness Vercel Preview — cross-cutting, zapisany w „Do decyzji człowieka" zamiast per-sekcja bo dotyczy całej bramy). 1 finding zamknięty `[x]` (1-groszowy rozjazd — już naprawiony w kodzie, artefakt starego builda). Blokery: (a) **stale Vercel Preview** — najcenniejszy/najgroźniejszy finding tej partii, bo unieważnia część już zrobionej weryfikacji w innych partiach tej bramy, jeśli sprawdzały świeżo zmergowany kod przez UI bez cross-checku `git merge-base`; (b) brak ścieżki UI do zresetowania etapu do `plane IS NULL` (dziedziczy się z findingu B2a o tym samym mechanizmie — trzeci raz ten sam brak fixture w tej bramie). 0 poprawek kodu na miejscu (nie znaleziono regresji — jedyny „bug" zaobserwowany live okazał się już naprawiony w kodzie, tylko niewidoczny na starym buildzie). Nieosiągnięte: EX-609 w całości, EX-605/606/594/597/575/574 w całości, EX-571 Faza 3 w całości, EX-564 Fazy 1-2 (poza jednym box).

**B4** — `context/foundation/manual-checks.md`, wszystkie 9 przydzielonych sekcji „wydatki, faktury, załączniki" przejechane (inw. 135 „PROBA CUTOVER…" mutacje przez UI przez cały czas, rola OWNER, staging preview + odczyty na `DB_POSTGRES_URL_CUTOVER`; fixture'y — HEIC/PDF>4MB/9-stronicowy skan/wielostronicowe faktury — wygenerowane lokalnie i wgrane przez UI, nie seedowane):

- **B4** — `EX-448` (stable per-row ids): **5/6 zweryfikowane**. 1 finding zamknięty `[x]` — box 3 opisuje martwy UI-verb „Zamień", zastąpiony przez append-page model EX-659; sama zdolność działa, tylko nazwa kontrolki w checkliście jest przestarzała.
- **B4** — `Dodawanie faktur wprost z „+" (EX-662)`: **5/5 zweryfikowane**, 0 findings — sekcja w pełni zamknięta, w tym HEIC→JPEG z poziomu tabeli (transakcja #4680, potwierdzone DB `media.mime_type='image/jpeg'`).
- **B4** — `EX-581` (netto expenses — własna zakładka): **6/10 zweryfikowane**. 3 findings otwarte `[ ]`: box 4 (kolejność kolumn Netto/Brutto odwrócona vs. opis checklisty — needs human czy tekst czy render jest błędny), zakładka „Materiały wliczone w robociznę" nieobecna w widoku klienta `/k/<token>` (prawdopodobnie zamierzone — materiały rozliczone w robociznę nie obciążają inwestora — ale niepotwierdzone), drobny konsolowy `400` na widoku klienta (nie dochodzony, nie blokujący).
- **B4** — `EX-567` (netto investment-expense type): **już zarchiwizowana przed tą partią** (2026-07-26, wszystkie 12 boxów zweryfikowane wtedy, 0 defektów) — brak nowej pracy do wykonania w B4.
- **B4** — `Multi-page invoices (EX-659)`: **16/17 zweryfikowane** — sekcja w pełni domknięta poza jednym otwartym findingiem. Obejmuje pełny cykl: multi-select w jednym pickerze (3/9 plików), skan AI 3-stronicowej faktury jako jedna pozycja (nie trzy), limit 8 stron (9. strona → czytelny 400, nie 500), odrzucenie pliku spoza image/PDF (czytelny 400), oraz sprzątanie plików w Blob (kod: `withOrphanCleanup()` czyści osierocone wgrania po nieudanym zapisie; `deleteUnreferencedMedia()` sprawdza referencje w `transactions` I `vehicle-inspections` przed skasowaniem obiektu z Bloba). 1 finding otwarty `[ ]`: plik odrzucony przez skan AI (zły typ/nieczytelny) zostaje mimo to podpięty jako FV wiersza — nietestowany sam „Zapisz" w tym stanie, needs human czy to zamierzone.
- **B4** — `EX-585` (kosztorys-invoice-note-and-preview): **16/17 zweryfikowane**, 1 finding otwarty `[ ]` — drobne konsolowe ostrzeżenie Radix „Missing Description" na dialogu podglądu faktury, bez wpływu funkcjonalnego.
- **B4** — `EX-569` (client-facing „Pobierz faktury"): **8/12 zweryfikowane**, 2 findings otwarte `[ ]`: ten sam brak zakładki „wliczone w robociznę" w widoku klienta co w EX-581 (jeden wspólny root cause), oraz box 5 nieprzetestowany (brak pod ręką fixture z żywym kosztorysem i zerowymi transakcjami materiałowymi jednocześnie).
- **B4** — `AI receipt scan (EX-577)`: **5/5 zweryfikowane**, 0 findings — sekcja w pełni zamknięta (brutto-scan, netto-scan z PDF, nieczytelny paragon, pieczątka VAT — wszystkie warianty).
- **B4** — `EX-394` (HEIC dziura w edycji przelewu + backfill) — **UI-połowa tylko, zgodnie z zadaniem**: **9/26 zweryfikowane**. Główna checklista (14 boxów, w tym 3 „Po backfillu"): 3/14 — HEIC→JPEG przez „Dodaj faktury" (transakcja #4683, DB potwierdza `iphone_test-16c592.jpg`/`image/jpeg`; pod-twierdzenie „Zapisz zablokowany na czas przetwarzania" nie zaobserwowane wprost — 6 KB plik przetworzył się szybciej niż round-trip snapshotu), PDF >4 MB odrzucony czytelnym komunikatem („Plik „big_pdf_test.pdf" przekracza 4 MB…", nie 413), picker wraca do „Przeciągnij lub kliknij" po odrzuceniu. 11 boxów nieosiągniętych (budżet czasu — wymagają precyzyjnego trafienia w stan „w trakcie przetwarzania/konwersji", co już raz okazało się niedeterministyczne w tej sesji, plus osobny obszar floty). Podsekcja „Usuwanie faktur i stron" (jedyna ścieżka kasująca bajty z Bloba) — **6/6 w pełni zweryfikowane na żywo**: usuwanie pojedynczej strony z wielostronicowej faktury (#4688, 4→3 strony, DB potwierdza), usuwanie całej faktury (4688, 3→0, komórka wraca do „Dodaj fakturę"), usuwanie jednostronicowej faktury z odrębnym komunikatem „usunąć fakturę?" nie „stronę" (#4678), anulowanie (przycisk „Anuluj" i Escape) nie kasuje niczego (potwierdzone DB), identyczna ścieżka z „Edytuj transakcję" (#4679), i trwałość po odświeżeniu strony (usunięte nie wracają, nieusunięte nadal się otwierają — #4686/#4680). Podsekcja „Backfill na produkcji" (6 boxów) — **świadomie nieodhaczona, human-owned**: agent nie dotykał produkcji ani jej store'a Bloba zgodnie z zadaniem; te boxy czekają na człowieka.

**Tally B4:** 70/98 boxów zweryfikowanych na żywo/kodem/DB w tej partii (nie licząc 12 już zarchiwizowanych w EX-567 przed B4), 28 nieodhaczonych (6 findings otwartych `[ ]` precyzyjnie opisujących powód, 1 finding zamknięty `[x]` jako nieaktualny opis checklisty). Blokery: brak jawnych regresji kodu — najcenniejszy pozytywny wynik to pełne, żywe domknięcie ścieżki kasującej bajty z produkcyjnego Bloba (usuwanie stron/faktur, 6/6) oraz limitu stron/typu pliku w skanie AI (400, nie 500). Wszystkie otwarte findings to albo (a) rozjazd między checklistą a zamierzonym zachowaniem widoku klienta (brak zakładki „wliczone w robociznę" — jeden root cause powtórzony w 2 sekcjach), (b) drobne, niedochodzone konsolowe ostrzeżenia, albo (c) jeden realny, niepotwierdzony behawior (plik odrzucony przez skan AI zostaje mimo to podpięty jako FV wiersza) wymagający decyzji człowieka przed testem. 0 poprawek kodu na miejscu (nie znaleziono regresji — wszystkie odchylenia to brak dowodu/fixture, nieaktualny opis checklisty, albo pytanie o zamierzone zachowanie). Nieosiągnięte w tej partii: 10 z 14 boxów głównej checklisty EX-394 (stan „w trakcie przetwarzania", flota, notatki) i 6 boxów „Backfill na produkcji" (jawnie human-owned, nie próbowane).

**B5** — `context/foundation/manual-checks.md`, batch „arkusz Google" — 4 z 7 przydzielonych sekcji zamknięte z realnym dowodem (depth-over-coverage — kosztorys-importer i sheet-column-mapping w pełni przejechane, sheet-live-compare i EX-686 częściowo), 3 sekcje w ogóle nietknięte (inw. 135 „PROBA CUTOVER…" mutacje przez UI, inw. 31 „11 Listopada 40" real read-only tylko do odczytu, rola OWNER, staging preview + odczyty na `DB_POSTGRES_URL_CUTOVER`):

- **B5** — `kosztorys-importer (EX-417)`: **7/10 zweryfikowane**, w tym pełny live import-cycle na inw. 135: podpięcie kanonicznego arkusza przez UI (`/kosztorysy` → „Dodaj kosztorys"), „Pobierz z arkusza Google…" preview (14 sekcji · 372 prac · 10 etapów — potwierdzone SQL-em co do joty), „Porównanie sum" (wartość netto / R netto zgadzają się), lista 99 znikających prac rozwinięta, i pełny undo: nazwana wersja „Przed importem z arkusza Google" (`kosztorys_snapshots.id=24, kind='manual'`) przywrócona przez „Wersje" → „Przywróć", SQL potwierdza powrót do 336/13. 1 finding zamknięty `[x]` (Finding D — arkusz testowy ma przemianowaną zakładkę `kosztorys_robocizny(dla inwestora)`, aplikacja poprawnie odmawia z czytelnym komunikatem; przełączono się na arkusz kanoniczny). 1 finding otwarty `[ ]` (Finding A — „brak arkusza" nie pokazuje już okna z odmową, tylko chowa całą grupę menu „Arkusz Google"; dotyczy też `sheet-live-compare`). 2 boxy nieodhaczone bez findingu: stan „Pobieram…" w trakcie zapisu (import zbyt szybki na blank offer sheet, żeby złapać synchronicznym pollingiem), i odmowa nieczytelnego cennika (żaden z dwóch użytych arkuszy jej nie wywołał).
- **B5** — `sheet-column-mapping — ręczne wskazanie kolumny arkusza (EX-690)`: **4/10 zweryfikowane** — mechanizm potwierdzony na inw. 135 + arkusz kanoniczny (nie inw. 84, realne dane klienta, nietknięte): rozbicie „Wartość netto" na `S`/`T` wywołało dokładnie ten sam combobox z literami kolumn i nagłówkami, wskazanie `T` odblokowało „Pobierz i zastąp" i przeliczyło podgląd w tym samym oknie, a wskazanie przeżyło ponowne otwarcie okna. 1 finding otwarty `[ ]` (Finding E — linijka „Kolumnę „…" wskazałeś ręcznie" z „Usuń wskazanie" nie pojawiła się nigdzie w treści okna po wskazaniu; needs human czy istnieje gdzie indziej w przepływie, czy to regres). 5 boxów nieodhaczonych bez findingu — wymagają edycji nagłówków/dostępu żywego arkusza kanonicznego (poza zakresem read-only-preferred) albo śmieciowego identyfikatora arkusza, nie próbowane.
- **B5** — `sheet-live-compare — „Porównaj z arkuszem Google" (EX-417)`: **6/15 zweryfikowane** na inw. 31 (real, read-only) — okno otwiera się z czterema blokami, blok „Jak odczytaliśmy" pozostał liczbą bez listy (figura przestarzała w checkliście: dziś ~240 z 336, nie 26 z ~435 — kosztorys inw. 31 urósł od czasu spisania checklisty), pozostałe klasy mają rozwijalne listy z `SheetCellLink` do konkretnej komórki, ostatnia linia okna idempotentnie zgłosiła „już zgodny z arkuszem Google" przy dwóch kolejnych otwarciach, a drugie otwarcie nie przemontowało siatki (filtr wyszukiwania przeżył cykl otwórz/zamknij). 1 box nieodhaczony przez cross-reference na Finding A (inwestycja bez arkusza — menu schowane, nie okno z odmową). 8 boxów nieodhaczonych bez findingu: wymagają edycji żywego, realnego arkusza inw. 31 (przemianowanie pracy, zmiana/wyczyszczenie Pomiaru, odebranie dostępu) — świadomie pominięte jako naruszające read-only inw. 31, plus 3 boxy niezależnie nieizolowane w tym przebiegu (inw. 31 była już zsynchronizowana z wcześniejszej sesji, więc świeży przelicz/przed-po figur nie był do złapania).
- **B5** — `EX-686 — rozjazd „Pomiar z natury" vs suma etapów po imporcie`: **2/12 zweryfikowane** kodem — brak tooltipa na komórce „Pomiar (razem etapy)" potwierdzony wprost w `computedColumn`/`ComputedCell` (brak `tip`, więc brak `HintTooltip`), a widoczność kolumny „Rozjazd" wyłącznie za wciśniętym przyciskiem toolbar potwierdzona strukturą tablicy kolumn (`divergence: … opts.divergenceFilterEngaged ? [...] : []`). 1 finding zamknięty `[x]` (Finding B — checklist twierdzi czerwony nagłówek/tło i pozycję „zaraz za Akcje, przed Sekcją"; kod pokazuje zwykłą ramkę bez czerwieni i pozycję **za** „Sekcją"+„Opis prac", nie przed nią — potwierdzone kodem i wcześniejszym zrzutem ekranu na inw. 31). 9 boxów nieosiągniętych — czas partii wyczerpany na dwóch pierwszych sekcjach zgodnie z zasadą depth-over-coverage.
- **B5** — `EX-691 — „Porównaj z arkuszem Google" pod aktywnym rabatem globalnym`: **0/4, sekcja nietknięta** — wymaga fixture'y (inwestycja z arkuszem + robocizną rozpisaną na etapy + rabatem globalnym „Kwotowy" ≠ suma rabatów pozycyjnych), nie zbudowanej w tym przebiegu.
- **B5** — `import-zastepuje-w-calosci — import zastępuje całą rozpiskę`: **0/5, sekcja nietknięta** — dotyczy inwestycji 90 („kosztorys wzór"), nie jednej z jawnie oznaczonych fixture (135 mutuj swobodnie / 31 read-only); status mutowalności inw. 90 nie rozstrzygnięty w tym przebiegu, więc pominięta.
- **B5** — `sheet-measured-qty-from-formula — „Pomiar z natury" z formuły`: **0/5, sekcja nietknięta** — dotyczy inwestycji 65, ten sam powód co wyżej (status mutowalności nierozstrzygnięty, budżet czasu wyczerpany na wcześniejszych 4 sekcjach).

**Tally B5:** 19/61 boxów zweryfikowanych na żywo/kodem/SQL w tej partii, 42 nieodhaczonych — 3 sekcje (14 boxów) w ogóle nietknięte, reszta (28 boxów) w sekcjach częściowo przejechanych. 2 findings otwarte `[ ]` (Finding A — menu „Arkusz Google" znika zamiast pokazywać okno z odmową, dotyczy dwóch sekcji naraz; Finding E — brak linijki potwierdzającej ręczne wskazanie kolumny). 2 findings zamknięte `[x]` (Finding D — przemianowana zakładka arkusza testowego, aplikacja odmawia poprawnie, obejście przez zmianę arkusza; Finding B — pozycja i stylowanie kolumny „Rozjazd" odjechały od checklisty, ale to udokumentowany, świadomy drift, nie regres). Blokery: brak jawnych regresji kodu — najcenniejszy pozytywny wynik to pełny, żywy round-trip importu z undo (14 sekcji/372 prac potwierdzone SQL-em na wejściu i wyjściu) i potwierdzenie kodem, że dwie odrębne komórki (`stageQtySum` bez tooltipa, `divergence` za toolbar-gate) zachowują się inaczej niż ich sąsiadka w checkliście zakładała. 0 poprawek kodu na miejscu (nie znaleziono regresji — wszystkie odchylenia to nieaktualny opis checklisty albo pytanie do człowieka). Nieosiągnięte: 3 pełne sekcje (EX-691, import-zastepuje-w-calosci, sheet-measured-qty-from-formula) plus większość boxów `EX-686` i `sheet-live-compare` wymagających edycji żywych arkuszy Google poza zasięgiem read-only-preferred tej partii.

- **B6** — `client-preview-settings — ustawienia podglądu inwestora (EX-695)`: **9/10** — pojedynczy otwarty finding (przeniesiony/zastany z wcześniejszej partii, nie dotyczy tego przebiegu).
- **B6** — `kosztorys-client-view-offer-settlement-variants — warianty „Oferta / Rozliczenie…"`: **6/6, sekcja zamknięta** — bez findingów.
- **B6** — `nomenklatura inwestora + potwierdzenie zmiany trybu`: **9/9, sekcja zamknięta** — bez findingów.
- **B6** — `kosztorys-terminology — rename identyfikatorów Polish→English (EX-548)`: **3/4** — panel Podsumowanie, blok rekoncyliacji i formularz wydatku/transferu zweryfikowane na żywo na inw. 135; wykres kołowy sekcji nieweryfikowalny na tej fixture (SlicePie wymaga 2+ niezerowych sekcji robocizny, inw. 135 ma robociznę skoncentrowaną w jednej) — finding otwarty, pytanie do człowieka czy dorobić drugą sekcję.
- **B6** — `EX-691 — „Porównaj z arkuszem Google" pod aktywnym rabatem globalnym`: **4/4, sekcja zamknięta** — fixture zbudowana na inw. 135 (Rabat globalny Kwotowy, kolejno 200 zł / Wyłączony / 50 zł = suma rabatów pozycyjnych), wszystkie 4 boxy potwierdzone na żywo (czerwona notka pod rozjazdem, kwoty w oknie stałe niezależnie od stanu rabatu, notka znika i przy „Wyłączony", i przy rabacie globalnym = sumie pozycyjnych). Rabat globalny przywrócony do „Wyłączony" po teście.
- **B6** — `import-zastepuje-w-calosci — import zastępuje całą rozpiskę`: **0/5, sekcja nietknięta** — dotyczy inwestycji 90 („kosztorys wzór. nic nie dodajemy", obecnie 0 pozycji); nazwa czyta się jako ostrzeżenie właściciela przed modyfikacją, więc nie zasiałem/wymiotłem jej bez zgody — ten sam blokier co w B5, wciąż nierozstrzygnięty.
- **B6** — `sheet-measured-qty-from-formula — „Pomiar z natury" z formuły`: **4/5** — Faza 2 boxy 2-4 i cała Faza 3 potwierdzone na żywo/kodem/w dokumentach na inw. 135 (licznik „z pomiarem do rozpisania na etapy" ukryty przy count=0, „już zgodne" na powtórnym uruchomieniu, podgląd inwestora bez „Rozjazd"/„Problemy", oba dokumenty referencyjne opisują starą ślepotę na `=N#` wyłącznie jako historię z datą rozstrzygnięcia). Faza 2 box 1 wymaga inwestycji 65 („Okocimska 9", realny adres, 0 pozycji obecnie) — ten sam blokier co w B5, nierozstrzygnięty.

**Tally B6:** 35/43 boxów zweryfikowanych na żywo/kodem/SQL w tej partii, 8 nieodhaczonych — 2 sekcje (`import-zastepuje-w-calosci`, `EX-691`… nie, patrz niżej) — poprawka: 1 sekcja w ogóle nietknięta (`import-zastepuje-w-calosci`, 5 boxów), 6 sekcji domknięte lub prawie domknięte (3 w pełni zamknięte 0 findingów, 3 z 1 otwartym findingiem każda). 4 findings otwarte `[ ]` — wszystkie wymagają decyzji człowieka o fixture (dorobić drugą niezerową sekcję robocizny na inw. 135; czy wolno mutować inw. 90/65, obie realne poza jawnie oznaczonymi 135/31). 0 findings zamkniętych w tej partii (żadna nie była naprawą kodu — wszystkie to pytania o zasięg fixture). 0 poprawek kodu na miejscu — nie znaleziono regresji, EX-691 i większość `sheet-measured-qty-from-formula` potwierdzają, że opisane w checkliście zachowanie faktycznie działa tak jak udokumentowano. Rabat globalny na inw. 135 przywrócony do stanu wyjściowego („Wyłączony") po testach Section 5. Nieosiągnięte: `import-zastepuje-w-calosci` w całości (0/5) oraz jeden box `sheet-measured-qty-from-formula` — oba blokowane tym samym pytaniem (czy inwestycje 90/65, nieoznaczone jawnie jako throwaway, wolno zasiać/wymieść w tym przebiegu).

**B7 — flota (`EX-711` ×2, `fleet-sheet-parity`)** — przelot na staging, rola OWNER, pojazdy zakładane przez UI:

- **B7** — `EX-711 — moduł floty: przeglądy pojazdów i przypomnienia mailowe`: **16/29** odhaczone, 3 findings z `Needs human:`.
- **B7** — `EX-711 — flota: ręczne znaczniki „do wymiany" i typ „Serwis"`: **26/31** odhaczone (podsekcja „Załączniki przeglądu" 5/5, „Bramka przeglądu (2026-08-24)" 8/9).
- **B7** — `fleet-sheet-parity`: **0/14**, sekcja **niewykonalna w tej bramie** — testuje kod, którego **nie ma na remote** (`git log origin/staging..HEAD`: `c487c4dc`, `de620d85`, `9288577b`, `9c5ce99f`, `713fd350` — lokalna praca innej sesji, nie ma jej w buildzie stagingu), a jej fixture wymaga lokalnej bazy `db-test`. **Nie blokuje mergu `staging → main`**: skoro tego kodu nie ma na `staging`, nie ma go też w tym, co się merguje.
- Fixture'y założone przez UI: pojazdy `QA B7 001` (id 2), `QA B7 002` (id 3), pracownik `QA B7 Employee` (id 65). Żadnego seeda, żadnego SQL-owego zapisu.

- [x] **NAPRAWIONE (B7, `src/hooks/prevent-delete.ts:48`)** — odmowa skasowania kasy/inwestycji/użytkownika z powiązanymi danymi docierała do panelu jako gołe **„Something went wrong."** zamiast zdania z licznikami („…istnieją powiązane dane (transakcje: 5)…"). Przyczyna: hook rzucał zwykły `Error`, a `routeError` Payloada podmienia treść każdego błędu, którego nie umie uznać za publiczny (`node_modules/payload/dist/utilities/isErrorPublic.js` — potrzebny `status` ≠ 500 albo `isPublic`). Zmiana: `throw new APIError(message(blockers), 400)`. Integralność danych była cały czas w porządku (kasowanie było poprawnie odrzucane) — wada dotyczyła wyłącznie komunikatu, we wszystkich trzech miejscach użycia `makePreventDelete`.
      **Test disposition:** test-driven-debugging · unit — nowy spec `src/__tests__/hooks/prevent-delete.test.ts` (asercja: rzucony błąd JEST `APIError`, `status` 400, treść z licznikami). **Instrument zwalidowany**: na starym kodzie spec pada, po fixie przechodzi. `pnpm typecheck` zielony.

**B9 — regresje kosztorysu (`EX-703`, `EX-521`, `remove-section-coeff`, `EX-615`, `EX-430`, `S-18`, `EX-600`)**:

- **B9** — `drop-stage-percent-columns (EX-703)`: przelecione, kolumny „Etap N %" nie wracają nigdzie (edytor, „Z narzędziami", „Bez narzędzi", podgląd inwestora); stary wpis `"percent"` w `localStorage` nie wywraca edytora.
- **B9** — `kosztorys-editor-hook-split (EX-521)`: **19/20** — jedyny nieodhaczony to A/B wydajności na 1000+ pozycjach (najbogatszy kosztorys tutaj ma 340 poz.).
- **B9** — `remove-section-coeff`: przelecione.
- **B9** — `EX-615 — drop-empty-kosztorys-scaffold`: **5/8**; 3 punkty nieprzećwiczone (podpowiedź przy pustym wyszukiwaniu, widok klienta pustego kosztorysu, tworzenie z presetem) — wymagają świeżego pustego fixture'a, opisane inline z `Needs human:`.
- **B9** — `EX-430 — harden bulk-insert restore`: **2/2**, sprawdzone na stagingu + odczycie cutovera zamiast na przepisanej bazie 5435 (odnotowane w rejestrze).
- **B9** — `S-18 (cut)`: **0/6** — sekcja nieuruchamialna w tym środowisku (wymaga lokalnego `pnpm build && pnpm start` na zasianym zestawie ~1000 poz., `INV=7`). Sama sekcja jest oznaczona jako „(cut)" — jednorazowy pomiar, nie bramka cutovera. **Nie blokuje mergu.**
- **B9** — `EX-600`: potwierdzone jako ZDEZAKTUALIZOWANE, opisany interfejs już nie istnieje — bez odhaczania.
- Findings: 3 (2 otwarte środowiskowo-porządkowe, 1 oddalone: semantyka panelu „Filtry" — „odhaczone domyślnie / odznacz by ukryć" jest zamierzona, sprawdzona przeciw kodowi). **0 błędów produktu, 0 regresji.**
- Fixture przez UI: inwestycja **137 „QA B9 empty-kosztorys"** (założona pusta, po testach ma sekcję „Wiatrołap" z 4 pozycjami). Zostaje jako udokumentowany fixture QA — jak inw. 136 z B2b.

- [ ] **(higiena danych, nie błąd) Inwestycja 135 została z 5% rabatem na wszystkich 336 pozycjach** po testach rabatu w B9. Kolejne partie czytające figury na 135 zobaczą kwoty po rabacie. **Needs human:** czy przywrócić 135 z „Wersje" do stanu sprzed rabatu (tak zlecam kolejnej partii), czy zostawić — to i tak baza cutoverowa, dane kosztorysowe są jednorazowe.

**B10 — rozliczenia, rabat, panel podsumowania** (`EX-605`, `EX-606`, `EX-609`, `EX-594`, `EX-597`, `EX-596`, `EX-588`, `EX-575`, `EX-574`, `EX-649`): **76/134** boxów, 19 findings, **0 błędów produktu**. Komplet: `EX-605` 8/8, `EX-606` 9/9, `EX-575` 7/7; `EX-609` 19/21, `EX-649` 16/22, `EX-594` 11/19. `EX-574` 0/9 — strona wygaszona przez EX-598, fix potwierdzony na poziomie kodu i danych, nie przez UI.

## 🔴 BRAMA WSTRZYMANA — baza cutoverowa Neona ZNIKNĘŁA (2026-08-26 ~09:00)

`EX-596` / `EX-597` / `EX-588` nie dało się dokończyć (32 boxy), bo **cała gałąź `/inwestycje*` na stagingu przestała się renderować** („Coś poszło nie tak"). To **nie jest błąd kodu i nie blokuje mergu** — to awaria środowiska:

- Logi runtime Vercela: `Error: Failed query: SELECT investment_id, expense_category_id, … FROM transactions …` na `GET /inwestycje` i `GET /inwestycje/135/kosztorys_v2`.
- Ta sama kwerenda odpalona wprost na `DB_POSTGRES_URL_CUTOVER`:
  `psql: error: … ERROR: The requested endpoint could not be found, or you don't have access to it.`
- Endpoint **`ep-wild-resonance-agwnbpae`** (gałąź cutoverowa) **nie istnieje**. Dla porównania `DB_POSTGRES_URL_PREVIEW` (`ep-still-term-agp9aqfa`) odpowiada normalnie — więc to nie sieć, nie hasło i nie Neon jako całość, tylko **skasowana gałąź**.
- `vercel env pull` dla `preview`/`staging` potwierdza, że deployment stagingu wciąż wskazuje na `ep-wild-resonance` — czyli na nieistniejącą bazę.
- Znany wzorzec: gałąź preview Neona usunięta przez retencję (to samo raz już zdjęło proda). Pulpit `/` renderował się dalej, bo idzie z cache'u — dlatego awaria wygląda na „częściową".

- [ ] **(człowiek) Decyzja przed dokończeniem bramy:** albo (a) **odtworzyć gałąź cutoverową** ze świeżego dumpa proda i wskazać na nią `DB_POSTGRES_URL` w Preview, albo (b) **przepiąć staging na `ep-still-term`** (gałąź preview, żyje) i przyjąć, że to inna kopia danych. Bez tego dalszych partii nie ma jak przelecieć — aplikacja nie ma bazy. **Uwaga:** fixture'y założone w tej bramie (pojazdy `QA B7`, inwestycje 136/137, transakcje testowe) żyły na skasowanej gałęzi i **są stracone**; przy odtworzeniu trzeba je założyć od nowa.
- **Wszystko, co zweryfikowano przed ~09:00, zostaje w mocy** — awaria dotyczy dostępności środowiska, nie poprawności zweryfikowanego zachowania.
- Stan zostawiony przez B10 przed awarią: inwestycja 135 miała przestawione `materialsNetRate` z Brutto na Netto 23% (nie zdążył cofnąć). Nieistotne — dane zniknęły razem z gałęzią.

**B8 (leady/cron) — ustalenia wstępne, przed przelotem:**

- **Większości checków z `cron-lead-reconcile (EX-416)` i `lead-recovery-notifies-sales (EX-660)` NIE wolno odpalić w tej bramie.** Obie listy z definicji: (a) czytają **żywe dane Meta** przez nigdy niewygasający token strony, (b) **wysyłają prawdziwą pocztę** na `LEADS_NOTIFY_EMAIL` / `LEADS_ALERT_EMAIL`, a przy regresie — na **adres prawdziwego klienta**. Same checklisty mówią „run against the dev DB, not prod", a staging stoi na świeżej kopii proda. To akcja na zewnątrz, więc zostaje **do decyzji człowieka**, nie do samodzielnego odpalenia przez QA.
- **Leg „bez bearera → 401" jest nieweryfikowalny przez ten URL:** `GET /api/cron/leads-reconcile` na stagingu zwraca **302** (przekierowanie ochrony deploymentu Vercela — SSO), więc żądanie nigdy nie dociera do route'a i 401 nie ma jak się pokazać. Do sprawdzenia albo lokalnie, albo z tokenem `x-vercel-protection-bypass`.
- **Leg „Vercel wystawia crona"** — potwierdzone w konfiguracji repo: `vercel.json` deklaruje `/api/cron/leads-reconcile` o `0 4 * * *` (obok `/api/cron/cleanup` o `0 3 * * *`). Potwierdzenie „pierwszy przebieg loguje 200" wymaga dashboardu produkcyjnego **po** mergu — to punkt dla człowieka po deployu.

**B9 (`blob-store-isolation`) — ustalenia wstępne, przed przelotem:**

- **Ta sekcja opisuje checki na LOKALNEJ maszynie, nie na stagingu** (`pnpm dev`, wklejanie tokenów do `.env`/`.env.local`, `pnpm build`, `pnpm blob:refresh:preview`, `pnpm db:import`). Nie da się ich „przelecieć na stagingu" — i nie powinno się, bo dwa z nich każą wkleić **produkcyjny** token Blob, a produkcyjny store trzyma prawdziwe faktury bez wersjonowania i bez undelete.
- **Faza 2 (odrzucanie tokenu w obie strony) jest pokryta testem jednostkowym** — `blobTokenRefusal` w `src/lib/env/schema.ts:105`, ten sam strażnik wywołany niezależnie w `src/payload.config.ts:42` (ścieżka `/admin`, ta która faktycznie kasuje) i trzeci w `scripts/blob-restore.mjs:54`. Spec: `src/__tests__/lib/env/schema.test.ts:108+`, pokrywa oba kierunki (token prodowy poza produkcją **i** token preview przy `VERCEL_ENV=production`). Ręczne powtarzanie tego z żywym tokenem prodowym dokłada ryzyko, a nie sygnał.
- **Rekomendacja dla bramy:** Fazy 1–3 zostają nieodhaczone jako _poza zakresem przelotu na stagingu_ (środowisko lokalne), Faza 4 (dokumentacja) jest sprawdzalna z samego repo. Nie blokują mergu.

**B11 (sekcje odblokowane po awarii) — 2026-08-26, baza preview:**

- **EX-597** — +3 boxy (5/18). Zweryfikowane na inw. 119: zmiana nazwy inwestycji odświeża okruszek
  bez twardego przeładowania (round-trip w obie strony), a zmiana VAT 8%→9%→8% i rabatu globalnego
  pokazuje nową wartość natychmiast, bez błysku całej strony (POST server-action, nie nawigacja
  dokumentu — referencje gridu przetrwały). Otwarte: 2 boxy „Feel", 3 boxy write-path-coalescing,
  2 boxy non-regression (upload/usunięcie faktury).
- **EX-596** (7/11) i **EX-588** (10/12) — zamknięte we wcześniejszej części sesji; jeden box EX-588
  faktycznie zablokowany, finding o brzmieniu „Mieszane" udokumentowany.
- **Awaria `/inwestycje*` NIE reprodukuje się** — potwierdzone niezależnie przez B11. Zgodnie z
  ustaleniem: przyczyną było skasowanie gałęzi Neona, nie defekt produktu. Nie jest blokerem mergu.
- **Nowy otwarty finding (nie bloker):** `src/components/ui/use-history-back.ts:12` — strzałka wstecz
  w świeżej karcie. Strażnik `window.history.length > 1` nie mierzy tego, co ma mierzyć: `history.length`
  liczy również wpisy z innych witryn w tej samej karcie, więc w świeżo otwartej karcie bywa 2 i strzałka
  robi `router.back()` wyprowadzający poza aplikację, zamiast pójść do `fallbackHref`. Zreprodukowane
  dwukrotnie przez Playwrighta. **Potrzebne od człowieka:** potwierdzenie w prawdziwej przeglądarce
  (Playwright ma własną historię startową) — świadomie NIE naprawiane na gorąco, bo poprawny strażnik
  to znacznik nawigacji wewnątrz aplikacji, a nie jednolinijkowa korekta warunku.
  **Dyspozycja testowa:** test-driven-debugging · unit — `useHistoryBack` jest czystą funkcją nad
  `window.history` i `router`, więc atrapa obu wystarcza; e2e nie odtworzy „świeżej karty" wiarygodniej.
- **Nie dotknięte, przechodzą dalej:** `kosztorys-zaliczka-v2` (0/4), reszta `kosztorys-podsumowanie-tabs`,
  `mixed-settlement-both-planes` (0/7), `EX-571`, `EX-564`.
- **Fixture'y:** inw. 119 przywrócona do pierwotnej nazwy i VAT 8%. Nic nie commitowane.

**B12 (grid kosztorysu: filtry, sortowanie, kolejność kolumn, pasy sekcji) — 2026-08-26:**

- **+20 boxów** (408 odhaczonych / 460 otwartych). `sortowanie-kolumn-spojne` 7, `EX-580` 4,
  `kosztorys-filter-conditions` 6, `EX-682/683 + EX-688` 5 (te ostatnie w dużej mierze domknięte
  wcześniej przez B1).
- **inw. 119 przywrócona w całości** — nazwa, VAT, filtry, sortowanie, oś ceny (Inwestor), okno
  „Kolumny" (Sekcja i Komentarz z powrotem ukryte). Potwierdzone zrzutem przed zamknięciem partii.
- **Nie dojechane:** `kosztorys-column-order`, `EX-713/714`, `filtry-problemy` ×2, `EX-607`,
  `table-column-reordering` — wszystkie niosą uczciwy stan częściowy z wcześniejszych partii.
- **Boxy zablokowane fixture'em, nie defektem:** inw. 119 nie ma ani jednego komentarza, ani jednego
  rabatu kwotowego, ani jednego nadpisania mnożnika — kilku warunków sortowania nie ma na czym pokazać.
  Do odtworzenia przez UI w kolejnej partii albo świadomie zostawione.

- [x] **NAPRAWIONE — dryf zmiennoprzecinkowy w Przedmiarze, `src/lib/kosztorys/sheet-import/parse-labor-tab.ts:49,90`.**
      Sheets oddaje własnego IEEE double'a, a `planned_qty` to `numeric` bez precyzji, więc zapisywał go
      wiernie: w bazie preview **10 wierszy** typu `161.39000000000001`, `30.340000000000003`,
      `25.119999999999997` (6 inwestycji, m.in. 119, 66, 42, 32, 65, 101). To **nie jest** brzydota w bazie
      — komórka edytora to input, którego tekst musi się parsować z powrotem na tę samą liczbę, więc
      `decimalText` to `String(value)` i ogon renderuje się wprost w gridzie, a przez `copyValue` wychodzi
      do schowka i z powrotem do arkusza właściciela. Fix na granicy wejścia: `number()` i `readMeasuredQty`
      przepuszczają teraz wartość przez `round6` — helper już był w tym pliku, użyty tak samo dla rabatu
      (linia 169), więc to precedens z sąsiedniej linijki, nie nowy pomysł. Cztery pola: `plannedQty`,
      `clientPrice`, `sheetMeasuredQty`, `qtyDone`.
      **Czyszczenia danych nie ma** — te 10 wierszy żyje wyłącznie na preview, a prod nie ma ani jednego
      kosztorysu. Wejdą poprawne przy następnym imporcie.
      **Dyspozycja testowa:** test-driven-debugging · unit — spec `strips float drift off every figure it
reads from the sheet` w `src/__tests__/lib/kosztorys/sheet-import/parse-labor-tab.test.ts`.
      **Instrument zweryfikowany na kodzie sprzed fixa:** `AssertionError: expected 161.39000000000001 to
be 161.39`. Po fixie 198/198 w całym `sheet-import`, `pnpm typecheck` czysty.
- [ ] **Komunikat pustego gridu nie nazywa filtra, który go opróżnił** (Finding F, przeniesiony z
      wcześniejszej partii). **Potrzebne od człowieka:** czy pusty grid ma nazywać aktywny warunek, czy to
      świadoma oszczędność. **Dyspozycja testowa:** no automated test — jednozdaniowa treść komunikatu.
- [ ] **„Razem nie zmienia się po zwinięciu sekcji" — box jest niejednoznaczny.** Po zwinięciu stopka
      sekcji **znika**, a niezmieniona zostaje sama suma w pasie sekcji. Nie odhaczone, bo box da się
      przeczytać dwojako. **Potrzebne od człowieka:** przeformułowanie boxa. **Dyspozycja testowa:**
      no automated test — redakcja rejestru, nie zachowanie kodu.

**B17 (EX-564 rabat bulk-apply, EX-571 dokończenie, kosztorys-podsumowanie-tabs, kosztorys-tryb-mieszany) — 2026-08-26, baza preview:**

- **`EX-564` — +7 boxów, domknięte 8/8** (z 1/8). Cała ścieżka rabatu: podwykonawcy pozostają
  bez rabatu (potwierdzone i w UI — „Suma etapy netto" niezmieniona przy aktywnym 15% rabacie
  pozycji — i w schemacie: `discount_type`/`discount_value` nie sąsiaduje z kolumnami
  `w_tools_override_*`/`own_tools_override_*`), bulk-apply 15% nadpisuje istniejący rabat
  dowolnego typu (SQL-potwierdzone), walidacja odrzuca ujemne/>100 (sprawdzone przez atrybut
  `disabled`), `0%` to **świadome** zerowanie masowe za bramką dialogu potwierdzenia (nie cichy
  brak działania — komentarz w `percent-discount.ts` wprost to opisuje), a „Rabat całościowy"
  (kwotowy, 750 zł) przetrwał restart strony i — potwierdzone czytaniem kodu, nie klikaniem w
  drawer „Wersje" (niestabilny w tej sesji Playwrighta) — przetrwałby też przywrócenie wersji:
  `restoreSnapshotAction` woła `restoreKosztorys` bez opcji `clearGlobalDiscount`, która domyślnie
  jest `false`; jedyne dwa wywołania z `clearGlobalDiscount:true` to „Wyczyść kosztorys" i import z
  arkusza/preset — restore wersji nie jest jednym z nich. **Trzy pozycje checklisty opisują
  nieaktualny kształt UI** (kontrolka to jeden 3-wartościowy `SimpleSelect`, nie para checkboxów;
  przycisk to „Zapisz", nie „Zastosuj") — odnotowane inline, nie blokuje.
- **`EX-571` — +3 boxy, 13/16** (z 10/16). Figura robociznej w Podsumowaniu jest niezależna od
  widoku gridu (kod: panel czyta propsy liczone raz po stronie serwera, nie stan widoku kolumn) —
  rabat globalny odejmuje się od robocizny tak samo jak przed EX-571 (5000,00 → -750,00 →
  4392,86, zgodne z wcześniejszym pomiarem). Podpowiedzi „Rabat nie obniża stawek robocizny dla
  ekip." potwierdzone na kolumnach Razem Netto/Brutto i Etap — kwota netto (`header-tips.ts`);
  kolumna „Rabat" sama nie ma zarejestrowanej podpowiedzi wcale (nie błędna treść, tylko brak —
  odłożone, nieistotne pieniężnie). **2 boxy zostają otwarte** — oba to ten sam,
  udokumentowany brak ścieżki UI do etapu bez wybranej płaszczyzny z niezerowym pomiarem (jedyne
  takie etapy żyją na inwestycji 31, read-only, i mają zerowy pomiar).
- **`kosztorys-podsumowanie-tabs` — +5 boxów, 6/11** (z 1/11). Oś netto/brutto materiały+robocizna,
  przeliczenie % redukcji materiałów po „Zapisz", zakładka Wydatki (podział + wykres kołowy),
  zakładka Robocizna (pasek postępu — z podpowiedzią, pozycja nad tabelą nie pod, etykieta
  „Robocizna" nie „Suma transzy" — trzy rozjazdy z brzmieniem checklisty, odnotowane), lista wpłat
  (mechanizm to per-wiersz flaga poza-planem + tabela „Wpłaty wg formy" tylko w MIXED, nie „kołowy
  wykres płaszczyzn" jak w checkliście). **1 box definitywnie nieosiągalny w tym środowisku:**
  `SELECT … FROM transactions WHERE type IN ('COMPANY_FUNDING','OTHER_DEPOSIT') AND cancelled=false
AND investment_id IS NOT NULL` zwraca **0 wierszy** na całej bazie preview — nie „nie dotarłem",
  tylko strukturalnie nie ma na czym pokazać. **Potrzebne od człowieka:** czy regresyjny test
  jednostkowy (`get-deposit-transactions.test.ts`) wystarcza jako pokrycie, czy dopiąć osierocony
  wiersz historyczny (id 858) do jednorazowej inwestycji przez UI — nie ma do tego ścieżki w UI, więc
  wymaga jawnej zgody człowieka.
- **`kosztorys-tryb-mieszany`** pozostaje **0/6** — **zdiagnozowana jako martwa/zdezaktualizowana
  checklista, nie regres.** Cała Faza 2 opisuje UI sprzed EX-536 (ręczny input `C`, „trzy wiersze
  gotówkowe"). Żywe zachowanie Mieszanego jest już poprawnie pokryte przez
  `mixed-settlement-both-planes` i `kosztorys-podsumowanie-tabs` — finding rekomenduje przeredagowanie
  lub usunięcie sekcji zamiast dalszego odhaczania.
- **`kosztorys-zaliczka-v2`** (4/4) i **`mixed-settlement-both-planes`** (7/7) — domknięte wcześniej
  w tej samej partii (przed tym segmentem), bez zmian tutaj.
- **`EX-597` — +1 box, 6/18** (z 5/18): „Sekcje renderują się w `displayOrder`, nie kolejności
  wstawienia" potwierdzone czytaniem SQL-a — `json_agg` w `kosztorys-tree.ts` sortuje
  `ORDER BY display_order, id`, kolejność wstawienia to tylko remis. `EX-596` bez zmian (7/18) —
  wszystkie 11 otwartych boxów mają już komplet ustaleń/`Needs human:` z wcześniejszych partii tej
  bramy, priorytet #7 w tej partii nie uzasadniał ponownego przejeżdżania na żywo.
- **0 błędów produktu tej partii** — każdy pozorny regres (Zapisz „cicho" nie reagujący na `0`,
  brak kolumn rabatu u podwykonawców, brak podziału per-row w gridzie po rabacie kwotowym) okazał się
  po przeczytaniu kodu zamierzonym zachowaniem albo nieaktualnym opisem checklisty.
- **Fixture'y:** inwestycja **135** — `settlement_mode='NET'` (bez zmian), `materials_net_rate=0.05`
  (z wcześniejszej partii, bez zmian), pozycja „Malowanie ścian QA" ma teraz `discount_type='percent',
discount_value=15` (nadpisane z 10% podczas testu bulk-apply), **oraz** `global_discount_type='amount',
global_discount_value=750` (nowe z tej partii) — te dwa mechanizmy rabatu (per-pozycja percent +
  globalny amount) świadomie zostawione współistniejące, fixture jest throwaway/mutowalny. Depozyty
  4599/4600 i wydatki 4601/4602 z wcześniejszej partii bez zmian. Inwestycje 31/90/65 nietknięte.

**B18 (fleet-costs-window, fleet-sheet-parity, notification-recipients, re-weryfikacja `f49de35b`) —
2026-08-26, fresh Preview `2aa156ce`:**

- **Build potwierdzony fresh na starcie:** `origin/staging` HEAD `2aa156ce`, zawiera `f49de35b`,
  `1027592f`, `dfd72b31`, `99caf1cb`, `494a2039` — potwierdzone przed pierwszym boxem (patrz sekcja
  „Fix" powyżej dla szczegółów re-weryfikacji).
- **`fleet-costs-window` — 12/12 zweryfikowane, 0 findings.** Cała sekcja domknięta na żywo na
  pojeździe QA B18 001 (id=2, 3 wpisy przeglądów w różnych miesiącach): picker dat w osobnym rzędzie,
  zawężenie obu zakładek naraz bez przeładowania/fetcha (`browser_network_requests` czysty, URL
  niezmieniony), blok nad zakładkami czyta pełną historię niezależnie od okna (architektura
  `narrowHistory`/`fullHistoryByType`, `vehicle-detail-tabs.tsx`), oba warianty pustego stanu
  („Brak wpisów w wybranym okresie" / „Brak przeglądów w wybranym okresie"), kolumna „Od poprzedniego"
  liczona z pełnej historii, kolumna Ubezpieczyciel znika gdy okno zostawia same wpisy bez
  ubezpieczyciela (`columnsFor` w `inspection-history.tsx`), okno nie dziedziczy się z `/flota`, nie
  kasuje się przy przełączeniu Przeglądy↔Koszty, kolumna „Opony" na `/flota` (pozycja, wartość, „—" dla
  pustej, chowalna osobno od „Wymiana opon").
- **`fleet-sheet-parity` — +7 boxów zweryfikowanych (7/14 razem z 2 już `[x]` od wcześniej, 5 zostaje
  otwartych).** Sekcja odblokowana od poprzedniego statusu „poza zasięgiem" (B7: feature niewypchnięta)
  — na tym buildzie **jest** żywa, ale jej „Setup" jest stały: `src/scripts/import-fleet-sheet.ts`,
  skrypt zasilający dziewięć konkretnych rejestracji z arkusza, został skasowany w `0fa9dd8e` po
  jednorazowym imporcie na prod. Zweryfikowane bez zależności od tego seedu: warunkowe pola
  Ubezpieczyciel/Nr polisy tylko przy Rodzaj=OC (kod + `/admin` na żywo), zapis przeglądu z pustym
  Koszt, toggle OC↔Przegląd w dialogu, „Odczyt licznika" (tylko data/przebieg/notatka), „bezterminowo"
  przeżywa reload, auto bez cen czyta „—" i nie wchodzi do „Razem", strona pojazdu (Opony/Uwagi/polisa).
  5 boxów zostaje otwartych jako finding — nazywają konkretne rejestracje (`354E000003305`,
  `22044 4672279`, `WD776AL`, `WF 7029W`, `WF7972X`) nieodtwarzalne bez arkusza źródłowego.
- **`notification-recipients` — 13/13 zweryfikowane na żywo (9 z realną interakcją UI, 2 wyłącznie
  kodem z zakazu wysyłki e-mail, 2 wyłącznie kodem z konwencji tego gate'u dla ról).** Karty na
  `/flota` (2 zasiane adresy) i `/zgloszenia` (dwie karty side-by-side, po jednym adresie) potwierdzone.
  Pełny cykl edycji przeprowadzony na żywo na liście `fleetDigest`: dodanie trzeciego adresu z
  końcową spacją → zapis natychmiastowy bez przeładowania → SQL potwierdza wiersz przycięty →
  przeżywa `page.reload()` → usunięcie z powrotem do 2 wierszy, SQL potwierdza. Nieprawidłowy adres
  blokuje zapis w obu ścieżkach (natywna walidacja `type="email"` ORAZ, po jej wyłączeniu do testu,
  komunikat aplikacji „Nieprawidłowy adres e-mail") — patrz finding niżej. Izolacja list potwierdzona
  SQL-em (`newLead`/`opsAlerts` niezmienione przez cały test na `fleetDigest`). Global ukryty w
  `/admin` (`admin: { hidden: true }`, potwierdzone kodem i live). Dwa boxy o realnej wysyłce
  (cron `/api/cron/fleet-reminders`, nowy lead) zweryfikowane **wyłącznie kodem** — bez wywołania
  endpointów — `notifyFleetDigest`/`notifyNewLead` robią jedno `sendEmail` z całą listą w `to`, zgodnie
  z checklistą. MANAGER (brak przycisku „Edytuj") zweryfikowany wyłącznie kodem, bez przelogowania —
  ta sama konwencja co B2a/B3 (nie ryzykować jedynej żywej sesji OWNER).
- **Re-weryfikacja po `f49de35b`** — `table-column-reordering` (10/10, dowód na fresh Preview zamiast
  `localhost`) i `EX-555` box 1 (inw. 6) — obie potwierdzone bez regresji, pełny opis w sekcji „Fix"
  powyżej i w `manual-checks.md`.
- **Nowy finding (dryf fikstury, nie defekt):** `EX-555` box 3 opierał się na inw. 31 jako przykładzie
  „bez kosztorysu w v2 mimo zaksięgowanego `LABOR_COST`" — SQL na żywo pokazuje **336 wierszy** w
  `kosztorys_items` dla inw. 31 teraz, czyli ktoś spoza tej sesji zaczął wprowadzać jej kosztorys od
  poprzedniej partii. Inw. 31 jest real/read-only dla tego gate'u, więc nie dało się ani zbadać dalej,
  ani przywrócić — box zostaje `[x]` (był poprawny gdy dowód powstawał), premisa jako żywy przykład
  jest przestarzała. Potrzebna nowa inwestycja referencyjna dla przyszłych powtórek.
- **2 drobne findings (nieblokujące, needs human):** tytuł karty na `/flota` w kodzie to
  „Powiadomienia", nie „Powiadomienia o terminach" jak w checkliście (kosmetyka); pole adresu ma
  `type="email"`, więc natywna walidacja przeglądarki może zablokować zapis PRZED pokazaniem komunikatu
  aplikacji „Nieprawidłowy adres e-mail" — zapis i tak jest zablokowany, różni się tylko widoczność
  komunikatu.
- **0 błędów produktu tej partii** poza dwoma drobnymi findingami wyżej (żadne nie blokuje mergu).
- **`## EX-711` (obie sekcje, 27/31 i 16/28) NIE dojechane w tej partii** — czas w całości poszedł na
  trzy sekcje wyżej zgodnie z priorytetem „głębiej niż szerzej".
- **Fixture'y:** pojazd **QA B18 001** (id=2, trwały fixture floty — 3 wpisy przeglądów w różnych
  miesiącach, wyjątek „bezterminowo" na Przegląd techniczny) zostaje jako stała fikstura dla kolejnych
  partii. `notification-recipients` przywrócone do stanu sprzed testu (2 adresy na `fleetDigest`,
  1 na każdej z pozostałych list) — potwierdzone SQL-em. Inwestycja 135: mutacje z partii B17
  (transakcje #4670 anulowana/#4671/#4672, rabaty per-pozycja + globalny) bez dalszych zmian w tej
  partii. Inwestycje 31/90/65 nietknięte (poza odczytem SQL na 31). Filtr Status na `/inwestycje`
  (dodanie „Zakończona") przywrócony do stanu domyślnego po użyciu.

**B19 (import-etapy-z-arkusza, sheet-live-compare, `EX-686`, kosztorys-importer, sheet-column-mapping) —
2026-08-26, baza preview:**

- **Rdzeń tej partii: jeden strukturalny fakt, potwierdzony kodem i SQL-em, blokuje sześć różnych
  boxów w trzech sekcjach naraz.** Kanoniczny arkusz Google (`1kEWaMv9…`) ma zero wpisanego wykonania
  w kolumnach `D:M` i zero przemianowanych nagłówków etapów w całej zakładce `kosztorys_robocizny` —
  `parse-labor-tab.ts:216` (`usedColumns.has(column) || isNamedStage(caption(column))`) wpuszcza
  kolumnę etapu tylko przy wykonaniu albo własnej nazwie, więc **każdy** import z tego arkusza daje
  strukturalnie 0 etapów, niezależnie od tego, która inwestycja importuje i czy import jest
  pierwszy-w-życiu. Świeży, jednorazowy import na inw. 135 (link + import od zera, nie powtórka)
  to potwierdził na żywo: SQL po imporcie — `count(*) FROM kosztorys_sections WHERE investment_id=135`
  = 14, `kosztorys_items` = 372, **`kosztorys_stages` = 0** — zgodne co do liczby z podglądem „Co
  wejdzie" w UI. To samo doświadczenie zamyka `import-etapy-z-arkusza`'s box 11 (czysta oferta:
  import przechodzi, „Brak etapów." w podsumowaniu, siatka się nie wywala, okno importu nie pyta o
  rozliczenie) i tłumaczy, dlaczego nawet **świeża, nigdy wcześniej niesynchronizowana** inwestycja
  na `sheet-live-compare`'s „Porównaj z arkuszem…" nie daje realnej tranzycji do zaobserwowania —
  pierwsze-w-życiu otwarcie na inw. 135 mimo to wylądowało na gałęzi „Zapisany Pomiar z natury był
  już zgodny z arkuszem Google.", bo `sheet_measured_qty` zostaje `NULL` na wszystkich 372 pozycjach
  przed i po. Rozszerza — nie zastępuje — wcześniejsze findingi B14 (`sheet-live-compare`) i
  wcześniejszą blokadę w `EX-686`: rzucenie tam samej rzuconej, throwaway inwestycji nie wystarczy,
  bo brakujące dane leżą w **arkuszu**, nie w inwestycji.
- **Korekta błędnej liczby „10 etapów"** w dwóch boxach (`kosztorys-importer` „Co wejdzie" i
  `sheet-column-mapping` „Wskazanie kolumny „S" przelicza podgląd") — obie zapisane wcześniej bez
  towarzyszącego sprawdzenia SQL-em, obie poprawione na **0 etapów** z odniesieniem do dowodu wyżej.
  Self-korekta, nie zgłoszenie do backlogu — dowód jest teraz w pliku.
- **`EX-686` — +1 box, 8/13.** „Kosztorys założony ręcznie (bez importu) nie pokazuje przycisku…"
  przeniesiony z „Needs human" na `[x]`: inw. 133 i 134 mają ręcznie zbudowany kosztorys (373 pozycji
  każda) z `kosztoryses.google_sheet_id IS NULL` — SQL: `sheet_measured_qty` `NULL` na wszystkich
  373 wierszach obu inwestycji, a menu „Problemy" na inw. 134 na żywo nie ma żadnej pozycji „z
  pomiarem do rozpisania na etapy". Pozostałe 4 boxy tej sekcji zostają otwarte z tego samego,
  wcześniej już udokumentowanego powodu fikstury (brak zapisywalnej inwestycji z realnym rozjazdem
  arkuszowym) — skorygowane, nie zmienione.
- **`sheet-column-mapping` — bez nowych ticków (4/11), jedna próba domknięcia boxa „wskazanie na
  jednej inwestycji nie zmienia drugiej" nie powiodła się fiksturowo.** Próbowano inw. 134 jako
  drugiej inwestycji — menu „Opcje" na 134 w ogóle nie ma pozycji łączącej z arkuszem (ten sam
  gating co Finding A w `kosztorys-importer`: akcja znika, gdy kosztorys ma już pozycje), więc box
  zostaje otwarty z wyjaśnieniem, nie z nowym findingiem. **Uwaga porządkowa:** wcześniejsza w tej
  sesji próba kliknięcia przycisku „Dodaj kosztorys" na 134 (przed tą partią raportu) nie
  zarejestrowała się w UI (brak zmiany w DB, brak toastu, przycisk pozostał `enabled`) — po
  ponownym, czystym podejściu okazało się to fałszywym alarmem narzędziowym: menu na 134 strukturalnie
  nie oferuje tej akcji, więc wcześniejsze kliknięcia trafiały w martwy/nieaktualny snapshot, nie w
  realny przycisk. Nie jest to defekt aplikacji.
- **0 nowych błędów produktu tej partii** — wszystko, co wyglądało na regres (brakujące etapy, brak
  tranzycji przy „Porównaj z arkuszem"), okazało się jednym, spójnym faktem strukturalnym arkusza
  źródłowego, nie kodem.
- **Fixture'y:** inwestycja **135** — podłączona do kanonicznego arkusza (`google_sheet_id` ustawiony
  po raz pierwszy) i zaimportowana w całości (372 pozycji / 14 sekcji / 0 etapów), zastępując
  poprzednią zawartość rozpiski. `global_discount_type='amount', global_discount_value=750` i
  `materials_net_rate=0.05` z partii B17 **przetrwały** import (to pola inwestycji, nie pozycji) —
  potwierdzone SQL-em i widoczne w panelu Marża („Rabat -750,00"). Pozycja „Malowanie ścian QA" z
  jej 15% rabatem per-pozycja **nie przetrwała** — import zastąpił wszystkie pozycje, ta konkretna
  pozycja już nie istnieje pod tym opisem. Fixture jest throwaway, nowy stan (import z kanonicznego
  arkusza) zostaje jako baza dla kolejnych partii zamiast przywracania przez „Wersje" — pozwala od
  razu testować `sheet-column-mapping`/`sheet-live-compare` bez ponownego importu. Inwestycje 133/134
  odczytane wyłącznie SQL-em, nietknięte. Inwestycje 31/90/65 nietknięte.
- **Nie dojechane w budżecie tej partii:** `import-zastepuje-w-calosci` (0/6) — priorytet najniższy w
  tej partii, cały czas poszedł na domknięcie strukturalnego bloku wyżej zgodnie z „głębiej niż
  szerzej".

## Migracje `main..staging` (27) — kolejność deploya

Klasyfikacja z ciała `up()` (nie z `down()`). Zasada z AGENTS.md: **ADD → migracja przed kodem**,
**DROP → kod przed migracją** (stary kod nadal SELECT-uje kolumnę).

**Na gałęzi preview (obecny staging) zaaplikowane są wszystkie 27** — head `20260825_0_fix_own_tools_coeff_rounding`,
77 wpisów w `payload_migrations` łącznie. Poprzedni zapis („26 z 27") dotyczył **skasowanej gałęzi cutoverowej**
i jest nieaktualny. Stanu migracji **proda** nie sprawdzałem — AGENTS.md zabrania odpytywania Neona proda;
to człowiek konfrontuje przed mergem.

### ADD (migracja **przed** wypuszczeniem kodu)

`20260716_1_add_global_discount_to_investments`, `20260718_0_add_planowana_investment_status` (ADD VALUE),
`20260718_1_add_kosztorys_stage_to_transactions`, `20260720_0_add_kosztorys_shares` (CREATE TABLE),
`20260721_1_add_vat_plane_to_transactions` (CREATE TYPE), `20260724_2_add_plane_to_kosztorys_stages` (CREATE TYPE),
`20260726_0_add_investment_expense_net_type` (ADD VALUE), `20260726_1_add_net_amount_to_transactions`,
`20260726_2_add_color_to_kosztorys_sections`, `20260726_3_add_settlement_mode_to_investments` (CREATE TYPE),
`20260726_4_add_materials_net_rate_to_investments`, `20260728_1_add_worker_to_kosztorys_stages`,
`20260813_0_add_sheet_measured_qty_to_kosztorys_items`, `20260814_0_add_sheet_column_mapping_to_kosztoryses`,
`20260815_0_add_kosztorys_client_view` (CREATE TABLE), `20260818_1_add_fleet` (CREATE TABLE + 2 typy),
`20260819_0_client_view_offer_settlement_variants` (CREATE TYPE), `20260819_1_add_service_type_and_vehicle_flags` (ADD VALUE)

### DROP (kod **przed** migracją)

`20260716_0_drop_kosztorys_measured_qty`, `20260721_0_drop_kosztorys_stage_from_transactions`,
`20260724_1_drop_kosztorys_section_coeff`, `20260728_0_drop_kosztorys_cost_variant`,
`20260818_0_drop_kosztorys_hidden_in_export`, `20260824_0_drop_kosztorys_client_view_hidden_columns`

### Mieszane / danych

- `20260810_0_invoice_has_many` — **CREATE TABLE + DROP COLUMN w jednym**. Nie da się jej ustawić
  poprawnie względem obu reguł naraz: `transactions_rels` musi powstać **przed** nowym kodem, a
  `transactions.invoice_id` może zniknąć dopiero **po** wygaszeniu starego (stary Payload selectuje tę
  kolumnę przy **każdym** odczycie transakcji → 42703, nowy czyta `transactions_rels` → „relation does
  not exist"). Okna błędu nie da się uniknąć, da się je skrócić do sekund.
  **Rekomendowana procedura (człowiek, przy deployu na prod):**
  1. zmerguj `staging → main`, poczekaj aż Vercel **zbuduje** deployment produkcyjny, ale **nie promuj** go
     (build sam w sobie nie dotyka schematu — `payload migrate` jest od dawna wyjęty z `pnpm build`);
  2. `pnpm db:migrate:prod` (robi dump Neona, potem migruje) — od tej chwili stary, wciąż promowany build
     ma sekundy/minuty na odczytach transakcji z błędem;
  3. natychmiast **promuj** zbudowany deployment.
     Okno = czas promocji, nie czas builda. Blast radius: ~5 użytkowników, błąd dotyczy wyłącznie odczytów
     transakcji, dane nie są zagrożone (migracja ma własny `RAISE EXCEPTION`, gdy backfill skopiuje mniej
     wierszy niż jest faktur). Alternatywa „rozbić na dwie migracje" jest czystsza, ale wymaga jeszcze
     jednego cyklu deploya i nie jest tego warta przy tej skali.
- `20260824_1_require_inspection_cost` — `UPDATE` + `ALTER COLUMN` (NOT NULL na `cost` przeglądów).
  Kolejność: **ADDITIVE — migracja przed kodem** (uzasadnienie w komentarzu samej migracji: odwrotna
  kolejność zostawia wiersze NULL pod polem `required`, przez co każdy częściowy update rzuca
  `ValidationError` bezterminowo). **Pre-check przed prodem:** `SELECT count(*) FROM vehicle_inspections
WHERE cost IS NULL;` — na cutoverze `vehicle_inspections` ma **0 wierszy**, więc backfill niczego nie
  nadpisze, ale prod sprawdzić osobno tuż przed uruchomieniem.
- `20260825_0_fix_own_tools_coeff_rounding` — `ALTER COLUMN DEFAULT` + backfill `0.55 → 0.5525`.
  Ani ADD, ani DROP — żaden kod nie czyta kolumny, której by nie było, więc kolejność deploya nie gryzie.
  Premisa z komentarza migracji („wolno ją puścić, dopóki żadna inwestycja nie ma kosztorysu") na prodzie
  **obowiązuje**, bo na produkcji nikt jeszcze nie założył kosztorysu — funkcja jest tam od dawna, dane nie.
  Sanity check, gdyby ktoś odgrzewał tę bramę później: `SELECT count(*) FROM kosztorys_items;` na prodzie
  ma zwrócić `0`.

## Fix — rozjazd nagłówków z danymi po ukryciu kolumny (`f49de35b`)

Znaleziony przez B13 jako „odznaczenie wszystkich kolumn nie zostawia pustej tabeli", po dochodzeniu
okazał się szerszy: ukrycie **dowolnej** kolumny w tabeli na `DataTable` gubiło `<th>`, ale zostawiało
komplet `<td>` — każda wartość pod nagłówkiem sąsiada. Przyczyna: React Compiler cache'uje
`<DataTableRow>` o niezmienionych propsach, a przełącznik widoczności nie rusza ani `row`, ani
callbacków. Fix: sygnatura widocznych kolumn w `key` wiersza. Guard: **EX-743** (e2e).

**Konsekwencja dla bramy:** staging serwuje build sprzed fixu, więc każda obserwacja zrobiona tam
z ukrytą kolumną mogła czytać wartość sąsiada. Sprawdzone boxy, które opierały się na odczycie
liczby przy ukrytych kolumnach, wymagają powtórki po redeployu — dotyczy głównie sekcji
`table-column-reordering` i `EX-555` (kolumny v2 na liście inwestycji).

**Powtórka wykonana — B18 (2026-08-26), fresh Preview `2aa156ce`, po `f49de35b`:** oba miejsca
potwierdzone bezpośrednio na docelowym buildzie (nie `localhost`). `table-column-reordering`:
ukrycie pojedynczej kolumny (19/19 nagłówków↔komórek dopasowanych po klasie), ukrycie wszystkich 20
(`headerCount:0, dataCellCount:0, tbodyRowCount:46` — realnie pusta, nie ukryty rozjazd), przywrócenie
wszystkich (`20/20`). `EX-555` box 1 (inw. 6, „brak danych" na v2): dokładnie te same wartości co
przed fixem. **Fix trzyma na żywym artefakcie. Zero regresji.**

## Odmrożenie sekcji arkuszowych (2026-08-26, `sheet-write-env-guard`)

Sześć sekcji było wstrzymanych, odkąd wyszło, że localhost i preview pisały do **żywych arkuszy**
(36 obcych wierszy na 8 arkuszach; arkusze są nasze, udostępniamy je klientom). Bramka weszła i
**nie jest bramką w kodzie** — jest w poświadczeniu. Poza produkcją aplikacja niesie konto
`kosztorys-sheets-reader@…` z prawem **tylko do odczytu**, więc próba zapisu z laptopa czy z preview
kończy się `403` od Google. Żadna flaga, żadne `VERCEL_ENV=production` ani zmiana kodu tego nie
odblokuje. **Wstrzymanie zdjęte.**

**Warunek uruchamiania tych sekcji — węższy, niż mogłoby się wydawać.** Cała strona kosztorysowa
jest **wyłącznie odczytowa**: import, „Pobierz i zastąp", ręczne wskazanie kolumny i „Porównaj
z arkuszem Google" jadą na `getReadonlySheetsClient()` (`src/lib/actions/kosztorys-import.ts:81,196`)
i nie zapisują do arkusza ani jednej komórki — czytają go i piszą do **bazy**. Wszystkie sześć sekcji
przejeżdża się lokalnie jak dotąd, bez żadnych dodatkowych uprawnień.

Zapis w tej aplikacji ma dokładnie dwa źródła i oba dotyczą **trzech zakładek lustrzanych**
(`wydatki inwestycyjne`, `transfery`, `rozliczone R+M`): `sheets-sync` po mutacji wydatku/transferu
oraz `stampAllTabs` (podpięcie arkusza, podpięcie do inwestycji, „Zresetuj wydatki inwestycyjne").
Tylko box dotykający **tych** ścieżek odmówi poza produkcją. Naprawa arkusza odbywa się z produkcji
i innej drogi nie ma.
