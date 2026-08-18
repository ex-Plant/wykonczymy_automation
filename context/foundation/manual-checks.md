# Manual verification

One living checklist for every slice — the project's QA registry. Each `##` section is a slice/change; tick boxes by hand (or point an agent at a section: "drive these checks with Playwright and report" — the `verify-manual-checks` skill) as you verify. Lives in `context/foundation/` (not the change folder) so it survives `/10x-archive` and never freezes stale. A slice with unticked boxes here is **not** `Done` — manual checks are a hard blocker (see `/10x-implement`). Not gated by CI.

**Run against the isolated test DB, not the dev DB.** Manual checks mutate data, so point the app at the `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, `wykonczymy-test`) — the same DB the E2E suite uses — never the dev DB (5433, holds un-dumped local work) and never prod. Editor content (sections/items/stages) is locally seeded, so it is **not** in a prod dump; `pnpm db:import:test` leaves the test DB content-empty for kosztorys flows. Seed it separately: `perf-seed-kosztorys.ts` for a synthetic set (no external deps) or `seed-kosztorys.ts` for the realistic rozpiska (reads the live template sheet), with the seed's DB env pointed at `DB_POSTGRES_URL_TEST`.

## EX-649 — zakładka „Marża": prognoza i marża rzeczywista

Setup: baza testowa 5435 z rozpisanym kosztorysem (`pnpm seed:kosztorys:test`), co najmniej dwa
etapy z przypisanym rozliczeniem i jeden **bez**, kilka pozycji z rabatem, a na inwestycji
zaksięgowane wypłaty i strata. Zalogowany jako OWNER.

- [ ] W podsumowaniu kosztorysu jest zakładka „Marża" obok „Podwykonawcy"
- [ ] Przełącznik „Prognoza / Marża rzeczywista" przełącza dwie różne tabele, a wybór scenariusza („z narzędziami / bez narzędzi") widać **tylko** pod prognozą
- [ ] Prognoza w obu scenariuszach różni się wyłącznie wierszem „Należne podwykonawcom (przedmiar)"; „Wartość przedmiaru" stoi w miejscu
- [ ] Rabat na pozycji nie rusza prognozy, a marżę rzeczywistą obniża
- [ ] Marża rzeczywista pokazuje „Ustaw rozliczenie etapów" (nie zero), dopóki etap z wykonaną pracą nie ma rozliczenia; po ustawieniu pojawia się kwota
- [ ] W podglądzie inwestora nie ma ani „Marży", ani „Podwykonawców"
- [ ] Na `/inwestycje` kolumny „Marża" i „Marża v2" stoją obok siebie i **różnią się** na inwestycji, która ma i zaksięgowane wypłaty, i kosztorys
- [ ] Inwestycja z nierozliczonym etapem pokazuje „ustaw etapy" w „Marża v2", a w „Marża" niezmienioną kwotę
- [ ] Jako MANAGER nie ma na liście żadnej z dwóch kolumn marży
- [ ] „Marża v2" na liście równa się „Marży rzeczywistej" w panelu kosztorysu tej samej inwestycji

## EX-691 — „Porównaj z arkuszem Google" pod aktywnym rabatem globalnym

Setup: inwestycja z podpiętym arkuszem Google, w kosztorysie rozpisana robocizna na etapy,
w „Rabat" tryb **Kwotowy** z kwotą inną niż suma rabatów pozycyjnych.

- [ ] Przy aktywnym rabacie globalnym okno „Porównaj z arkuszem Google" pokazuje **czerwoną** notkę w bloku „Kwoty", że kwoty rozjeżdżają się z kosztorysem
- [ ] Same kwoty w oknie nie zmieniły się — notka tłumaczy różnicę, nie przelicza jej
- [ ] Bez rabatu globalnego (tryb „Wyłączony") notki nie ma, choćby prace miały rabaty pozycyjne
- [ ] Rabat globalny równy sumie rabatów pozycyjnych na pracach wykonanych — notki nie ma, bo nic się nie rozjeżdża

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

- [ ] **Batch scan → generate populates rows (the fixed 🔴).** "Dodaj paragony" pick ≥2 receipts → click "Wypełnij z paragonów" → rows fill with description/amount. **Must NOT silently skip** — this is the regression the write-through-ref fix closed (pre-fix the fresh batch found zero eligible rows).
- [ ] **Remove a middle row keeps every other row's file + FV label aligned.** Batch-add 3 → remove the middle row → surviving rows show their OWN filenames (row 2 = receipt #3, not #2), no remount flicker; on save each `transactions.invoice` points at the correctly-aligned media (no off-by-one).
- [ ] **Attach / replace / remove a single row's FV updates the label in place.** Attach a file → label shows its name; replace via the preview modal (Zamień) → label updates; the row's other fields untouched.
- [ ] **Reset / clear mints a fresh blank row.** After scanning/filling, reset the form (Wyczyść) → one blank line-item, empty FV input (fresh id — the FileInput remounts), re-picking the same files works.
- [ ] **AI rename applies to the uploaded file.** Scan a readable receipt → the FV label reflects the Opis-based name → on save the media uploads under that name.

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

- [ ] Podsumowanie in **Netto** axis: „Materiały", each category row, Łącznie, and Do zapłaty all show `brutto/(1+VAT)`; in **Brutto** axis they show the raw amount; the two columns differ by the VAT.
- [ ] The formula hint appears on materiały rows and reads correctly (VAT subtracted).
- [ ] Robocizna („Suma prac wykonanych") figures are unchanged; udział percentages still sum sensibly.
- [ ] Share/preview render (`preview`) renders the same derived figures without owner-only links/screams.

## kosztorys-tryb-mieszany — cash-settlement view w Podsumowaniu (slice B)

> **SUPERSEDED (2026-07-23/24, EX-536):** the **manual `C` cash input** below was **removed** — the owner flipped tryb mieszany to derive the cash (netto) part from **Σ netto wpłaty** (deposits bucketed by `vatPlane`, null⇒netto), not a typed field. Checks referencing typing `C` exercise a deleted control; do **not** run them. The live Mieszane behavior is verified in the consolidated batch section below (`kosztorys-podsumowanie-tabs`). Kept as history.

### Phase 2: Panel wiring + cash-settlement UI

- [ ] Panel opens on **Netto** by default; grid columns/toggle default unchanged (still show all).
- [ ] „Mieszana" shows netto-only waterfall + „Suma transzy" netto + the three cash rows.
- [ ] ~~Typing `C` recomputes Reszta and Razem live~~ — **removed control (see SUPERSEDED note above).**
- [ ] Netto and Brutto axes unchanged from before.
- [ ] Preview render (`preview`) shows the block with a **disabled** input.

## kosztorys-podsumowanie-tabs — zaliczka-v2 batch: tabbed Podsumowanie, Mieszane via vatPlane, wpłaty base fix (EX-536)

**Not yet driven** — collected at the branch-wide review gate (`.review-gate/staging-batch-2026-07-24.md`), authored per the "no manual checks; register them" directive. Consolidates the manual surface of the whole zaliczka-v2 / tryb-mieszany arc as **actually shipped** (supersedes the typed-`C` slice-B checks above). Drive against the **5435 test DB**, OWNER/MANAGER, an investment with a seeded kosztorys + deposits.

### Podsumowanie tabs + money axis

- [ ] Podsumowanie renders as **tabs**; the panel money-axis toggle offers **Netto / Brutto / Mieszane**; a `Description` explains Mieszane ("częściowo netto, częściowo brutto").
- [ ] **Netto** vs **Brutto**: materiały (+ each category, Łącznie, Do zapłaty) differ by exactly the VAT (`brutto/(1+VAT)` vs raw); robocizna („Suma prac wykonanych") unchanged between axes.
- [ ] **Mieszane**: two stacked tables — netto section (Robocizna + Materiały = Łącznie − wpłaty netto → Do zapłaty netto) and faktura section (Reszta brutto − wpłaty brutto → Do zapłaty brutto). Rabat > 0 → trailing informational row. No crash when Do zapłaty goes negative (overpaid).
- [ ] **Materiały brutto→netto reduction**: the reduction-% control drives the netto materiały figure (default = VAT rate); Łącznie/Do zapłaty follow. Clearing/changing % recomputes live.

### Deposits + wpłaty base (⚠ the code-review WARNING fix — money-semantics)

- [ ] **Wpłaty tab / deposit list**: shows the investment's INVESTOR_DEPOSIT rows only; plane pie splits netto vs brutto (null⇒netto bucket).
- [ ] ⚠ **`wplatyNet` base fix — verify on an investment carrying a legacy `COMPANY_FUNDING` (or `OTHER_DEPOSIT`) row.** In **every** axis (Netto/Brutto/Mieszane), the „Wpłaty"/„Do zapłaty" figure must sum **only INVESTOR_DEPOSIT** — the legacy deposit must **not** inflate „Wpłaty". Before the fix the non-mixed axes folded it in (3 different totals per toggle); after, all surfaces agree. **This changes a client-facing figure on such investments — flagged for owner sign-off.** (Fresh COMPANY_FUNDING can't attach to an investment via the form per EX-557, so this only bites legacy/admin rows.) Regression-guarded by `src/__tests__/lib/db/get-deposit-transactions.test.ts`.

### Wydatki + Robocizna tabs

- [ ] **Wydatki tab**: per-category materiały breakdown table + expense pie; Σ === materiały brutto.
- [ ] **Robocizna tab**: per-etap „Suma transzy" table + Razem; the **„Postęp prac" bar** sits **below the table** with the caption „Ile zostało wykonane względem pierwotnych estymat z wyceny projektu" (no tooltip); percent can exceed 100% (bar caps, text shows the real overrun); hidden entirely when Przedmiar (plannedNet) ≤ 0.

### Deploy note (migration ordering — deploy-time, not a code check)

- [ ] **Both `20260721_*` migrations must be applied to preview/prod before/with this merge** — `20260721_0_drop_kosztorys_stage_from_transactions` then `20260721_1_add_vat_plane_to_transactions`. The `vat_plane` SELECT in `getDepositTransactionsForInvestment` **500s** if the code ships before the migration runs. Human-applied via `pnpm db:migrate:prod` (per AGENTS.md); order: migrate **before** the code that reads the column lands.

## remove-section-coeff — drop per-section coeff tier + explicit section sidebar buttons

**Driven 2026-07-24** — all 5 sidebar checks pass (OWNER `e2e@wykonczymy.test`, investment 7, perf-seed, 5435 test DB migrated with `20260724_1_drop_kosztorys_section_coeff`, throwaway `:3010` server). Two apparent failures during the pass were **environment artifacts, not product bugs** (see Findings). Removes the per-section subcontractor markup coeff (`wToolsCoeff`/`ownToolsCoeff` on `kosztorys_sections`) — `effectiveCoeff` collapses to global(investment)→per-item-override only — and replaces the icon-only sidebar actions with explicit labeled buttons.

### Findings — 2026-07-24

- [ ] **Deploy note (unchanged, human-owned):** `20260724_1_drop_kosztorys_section_coeff` still owes application to preview/prod via `pnpm db:migrate:prod` before the code lands there. Applied to the 5435 test DB during this pass (the dry-run) with no issue. **Needs human:** run the prod/preview migration at deploy time. **Test disposition:** no automated test — deploy-ordering step.

### Deploy note (migration ordering — deploy-time, not a code check)

- [ ] **`20260724_1_drop_kosztorys_section_coeff` must be applied to preview/prod with this merge.** Drops `w_tools_coeff` / `own_tools_coeff` from `kosztorys_sections` **only** (the investment-level columns of the same name stay). Human-applied via `pnpm db:migrate:prod`. **Ordering is reversed vs the usual "migrate before push" rule** — that rule is for column _adds_ (new code needs the column to exist). This is a _drop_: sections are read through the Payload ORM (`payload.find`), which builds its `SELECT` from the collection schema, so dropping the columns while old code (whose field defs still list them) is live would 500 on a missing column. Deploy the **code first** (its removed field defs stop selecting the columns), **then** run the migration to drop them. Kosztorys data is throwaway pre-dogfooding, so no backfill is owed.

## EX-564 — kosztorys-percent-rabat-bulk-apply

**Awaiting manual verification.** All automated checks green (tsc 0, full unit suite 1117 pass, lint 0). No DB migration owed — `investments.globalDiscountType` is a plain `text` field, so narrowing the stored global discount to amount-only needs no schema change. Percent global rabat stops being stored state and becomes a one-shot bulk-apply into every per-item rabat; the stored global discount is now amount-only; subcontractor views are rabat-free.

Setup: run the app against the **5435 test DB** (see intro — seed a kosztorys into it first; the dump carries none). Log in as **OWNER/MANAGER**. Open an investment's **Kosztorys** tab → **Podsumowanie** tab (the „Rabat % na wszystkie pozycje" tool + „Rabat całościowy" select live in the settings bar there).

### Phase 0: Subcontractor views are rabat-free

- [ ] **Discount columns hidden in subcontractor views.** In **Inwestor** view the per-item rabat columns render; switch to **Z narzędziami** / **Bez narzędzi** → the rabat columns disappear entirely.
- [ ] **Subcontractor prices are gross of rabat.** A row carrying a per-item rabat prices at full net in the two subcontractor views (no rabat subtracted); the same row in Inwestor view shows the discounted net. Section subtotals and „Suma" match (subcontractor total ignores rabat).
- [ ] **Percent tool disabled while an amount „Rabat całościowy" is active.** Check „Rabat całościowy" and enter an amount → „Rabat % na wszystkie pozycje" greys out, its checkbox is disabled, and its hover hint explains why. Uncheck „Rabat całościowy" → the percent checkbox re-enables.

### Phase 1: Percent bulk-apply tool

- [ ] **Apply 10% → every row shows 10% rabat; persists after reload.** Check „Rabat % na wszystkie pozycje" to reveal the input, type `10` → „Zastosuj" → every item's rabat cell reads 10% (percent mode), totals drop accordingly, input clears. Reload → the per-item rabaty persist.
- [ ] **Overwrite check.** Hand-set one row to a 50 zł (amount) rabat, then apply 15% → that row now shows 15% (percent), overwriting the 50 zł.
- [ ] **Invalid input rejected.** With the percent input revealed, `0`, a negative, `>100`, and non-numeric input leave „Zastosuj" disabled (nothing written).

### Phase 2: Amount-only stored discount

- [ ] **„Rabat całościowy" is a checkbox → amount only.** Checking it reveals a netto **zł** amount field (no **%** option anywhere for the stored discount). Setting e.g. `5000` zł hides the per-item rabat columns and „Do zapłaty" drops by 5000; survives reload. Unchecking clears the discount.
- [ ] **Version restore keeps the live amount discount.** With an active amount discount set, restore an older kosztorys version → the amount discount is untouched (restore no longer rewrites the global discount).

## etap-tool-plane (EX-565) — per-etap rozliczenie plane + view-independent subcontractor settlement

**In review** — automated checks green (tsc, full unit suite, lint, webpack build; Turbopack build is blocked only by the worktree's symlinked `node_modules`). Manual boxes below **not yet driven**. Gives each etap a `plane` (z/bez narzędzi, `null` = defaulted-to-z-narzędziami + warned) and rebuilds „Podsumowanie podwykonawców" as ONE view-independent settlement — each etap valued at its own plane's price, split + razem, one shared wypłaty pool. Inwestor view + client share must stay byte-for-byte unchanged.

Setup: run the app against the **5435 test DB** (see intro — apply `20260724_2_add_plane_to_kosztorys_stages` there first, then seed a kosztorys into it; the dump carries none). Log in as **OWNER/MANAGER** (stage controls need MANAGEMENT_ROLES; `ADMIN`/`PASS` env is stale — mint a temp OWNER via the Local API script). Open an investment's **Kosztorys** tab with ≥1 section and etapy across both planes.

### Phase 1: Data layer

- [ ] After migration + dev-server **restart**, the kosztorys editor loads without query errors (lessons.md: verify the running app, restart pre-migration servers)
- [ ] Payload admin shows the plane select on a Kosztorys Stage

### Phase 2: Settlement math

- [ ] On a mixed-plane test kosztorys, „Suma wykonanej pracy" is identical in the Z and Bez views and equals the hand-computed per-plane sum

### Phase 3: Etap header UI

- [ ] Picking a plane updates the header icon instantly and survives a reload (persisted)
- [ ] A fresh etap shows the default wrench + `TriangleAlert`; picking z narzędziami explicitly clears the warning
- [ ] Client share page shows plain etap labels — no plane icons or warnings
- [ ] Selecting a plane does not disturb grid state (sort, filter, unsaved edits)

### Phase 4: Grid „nie dotyczy"

> **Superseded by EX-571** (section below). „nie dotyczy" placeholders are gone — an out-of-plane etap
> has no columns at all — and a null-plane etap no longer defaults into Z narzędziami. Do not run the
> four boxes below; EX-571's Phase 2 boxes replace them.

- [ ] In Bez narzędzi view, a z-narzędziami etap's value cells and footer read „nie dotyczy"; its qty cells still accept input
- [ ] A null-plane etap shows values in Z narzędziami view (it defaults there) and „nie dotyczy" in Bez narzędzi
- [ ] Inwestor view shows every etap's values as before
- [ ] No cell-remount symptoms while typing in qty cells (characters don't drop)

### Phase 5: Subcontractor summary

- [ ] Mixed-plane investment: Z and Bez views show the identical summary; split rows + razem reconcile with the grid's per-etap values
- [ ] „Pozostało do wypłaty" = razem − zaliczki, negative renders destructive as before
- [ ] Warning badge appears while any etap is unconfirmed and disappears once every plane is explicitly picked
- [ ] Single-plane investment (all z narzędziami, confirmed): summary matches the pre-change figure in the Z view

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

- [ ] In Z narzędziami, „Pomiar razem" in the „Razem" row equals the hand-summed ilości of the z-narzędziami etapy only; same for Bez narzędzi
- [ ] „Razem Netto" in Z + „Razem Netto" in Bez equals „Suma wykonanej pracy" (razem) from „Podsumowanie podwykonawców"
- [ ] Each side's „Razem Netto" equals its own row in „Podsumowanie podwykonawców" (Z / Bez) to the grosz
- [ ] Inwestor view's Pomiar and Razem are unchanged from before the change (compare against Przedmiar-based figures)

### Phase 2: Grid pokazuje tylko rachunek jednej ekipy

- [ ] In a subcontractor view the out-of-plane etapy have **no** columns at all (no „nie dotyczy" cells)
- [ ] An etap with no rozliczenie picked appears in **neither** subcontractor view and shows no wrench icon in its header
- [ ] In Inwestor, an etap with no rozliczenie has its ilość cells **locked** (typing does nothing) and unlocks the moment a rozliczenie is picked
- [ ] In Inwestor, an etap with no rozliczenie has its **whole** block on a red tint — header plus every cell of its ilość / netto / brutto columns; picking a rozliczenie clears the tint instantly
- [ ] The red tint does not bleed into the neighbouring etapy's columns and does not fight the „Razem" row's own styling
- [ ] „Wartość netto/brutto przedmiar", „Pozostało", „% wykonania" are absent in both subcontractor views and present in Inwestor
- [ ] „Razem Netto/Brutto" header reads „— po rabacie" in Inwestor and „— do zapłaty ekipie" in a subcontractor view
- [ ] Typing into an etap ilość cell drops no characters (no cell remount after the column rebuild)

### Phase 3: Rabat i podpowiedzi

- [ ] Inwestor Podsumowanie's robocizna figure is identical whether the panel was opened from Inwestor directly or after switching from a subcontractor view and back
- [ ] With a global rabat set, „Rabat" in the totals equals the rabat computed off the client-priced executed work (unchanged from before the change)
- [ ] With an unassigned etap present, the badge in „Podsumowanie podwykonawców" says the sum is **lower** than the executed work (no „liczone jako z narzędziami")
- [ ] The rabat tooltips („Rabat", „Rabat kwota netto", „Razem Netto", „Razem Brutto", „Etap — kwota netto") state that rabat never lowers the crews' prices

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

- [ ] Every section opens with a band; its netto equals that section's row in the Podsumowanie
- [ ] The band's figure is unmoved by a search filter or a section filter (full-dataset subtotal)
- [ ] Sorting a column makes the bands disappear and the grid read as one flat list; clearing the sort brings them back
- [ ] Collapsing a section hides exactly its rows, leaves its band, and leaves no gap in the numbering
- [ ] „Razem" is unchanged by a collapse
- [ ] Renaming a section on the band renames it everywhere (Podsumowanie, filter menu, the hidden „Sekcja" column)
- [ ] The band's „…" inserts / moves / recolours / deletes the section, and the delete confirm names the right item count
- [ ] The row „…" menu no longer offers any section action
- [ ] „Sekcja" is hidden by default in a fresh browser profile and can still be re-enabled from the column picker
- [ ] Typing into a cell right below a band drops no characters (no remount from the wrapped columns)
- [ ] The share/preview link renders the bands read-only — no rename, no „…" menu — and collapse still works
- [ ] The client view's netto/brutto toggle moves the band's figure with the columns

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

- [ ] Three tabs appear — „Materiały", „Materiały rozliczane netto", „Materiały wliczone w robociznę" — and each shows only its own rows
- [ ] The brutto „Razem" plus the netto „Razem" equals the breakdown „Razem" above the list
- [ ] **Footer stays pinned (2.3).** With enough rows to scroll the list, „Razem" remains visible at the bottom instead of scrolling away with the rows
- [ ] The netto tab shows two amount columns, „Brutto" then „Netto", and the „Razem" figure sits under „Netto"; the other tabs show a single „Kwota" column
- [ ] Clicking a netto row lands on a transfers list that **contains** that row; same for a korekta row and a brutto row
- [ ] **Preview render (3.4).** The client share view shows the tabs and the „Razem" footers, and clicking a row navigates nowhere
- [ ] An investment with neither netto nor settled rows shows no toggle at all

---

## EX-569 — client-facing „Pobierz faktury" in the kosztorys Wydatki tab

**In review** — automated green (tsc 0, eslint 0, unit 1140/1140, 33 in `invoice-zip.test.ts`).
Branch `feat/ex-569-kosztorys-client-invoices` (worktree). E2E deferred to **EX-570**
(`e2e-backlog`) — the `(share)` group still has no browser coverage, so boxes 1–3 are the only
thing guarding the public path.

Setup: 5435 test DB, an investment with materiały transactions in **both** settled states and
invoices attached to some of them, plus a live share token for it (`/k/<token>`).

### Client share path

- [ ] Logged out on `/k/<token>` → Podsumowanie → Wydatki: the „Pobierz faktury" button downloads an archive of the visible dataset
- [ ] Switching to „Materiały wliczone w robociznę" and downloading yields that dataset's invoices, not the other one's
- [ ] The archive name carries the investment name and the dataset label; two investments downloaded the same day do not collide in Downloads
- [ ] A dataset where some rows have no invoice reports the shortfall („Pobrano 3 z 5 — 2 bez faktury") rather than implying a complete set
- [ ] An investment with zero materiały transactions renders no list and no button
- [ ] A dataset whose rows all lack an invoice renders the list but no „Pobierz faktury" button

### Owner app view

- [ ] Same three checks on `/inwestycje/<id>/kosztorys_v2` — button present, follows the toggle, archive correct
- [ ] A materiały transaction with an attached invoice reaches the list with a live `invoiceUrl` on both surfaces (the file actually opens from the archive)

### Regression on the authenticated transfers table

The zip/toast loop moved into the shared `useInvoiceZip`, so the transfers export changed behavior.

- [ ] The transfers table's „Faktury" button still downloads a working archive with correct filenames
- [ ] Its final toast now reports missing invoices honestly on a filter set where some rows have none (the pre-fetch „Pobieram…" toast is gone — the button spinner replaces it)

## EX-585 — kosztorys-invoice-note-and-preview

Extends EX-569's Wydatki list with a „Notatka" column (numer faktury + tooltip) and a per-row
invoice preview. Same setup as EX-569's section: an investment with materiały transactions in both
settled states, invoices attached to some of them, plus a live share token.

For the note checks the transactions need an `invoiceNote` — either scan a receipt through the
expense form (the AI writes numer faktury on line 1, pozycje below) or type a multi-line note by hand.

### Phase 2: Compact preview trigger

- [ ] Transfers table: the invoice icon still opens the preview dialog, and Usuń / Zamień inside it still work
- [ ] Transfers table: rows with no invoice still show the `+` upload button, unchanged
- [ ] Transfers table: a row whose invoice is an **image** now shows the magnifier icon instead of the document icon (the shared trigger picks the icon by mime type; the hand-rolled button always showed a document)
- [ ] The line-item invoice field in the expense form still renders the full-width bordered trigger

### Phase 3: The two columns

- [ ] Kosztorys Podsumowanie → Wydatki (owner view): rows with a scanned invoice show the numer faktury in „Notatka"; hovering reveals the full note with the pozycje on separate lines
- [ ] A row whose transfer has no note shows „—" and no hover affordance
- [ ] Clicking the „Faktura" icon opens the preview dialog — a PDF in the native viewer, an image inline
- [ ] Clicking the „Faktura" icon does NOT navigate to the transfer detail page (the row link must not fire)
- [ ] The client share view (`/k/<token>`, logged out) shows both new columns with the same content, and its rows still don't navigate anywhere
- [ ] All three dataset tabs („Materiały" / „Materiały rozliczane netto" / „Materiały wliczone w robociznę" — EX-581's split) carry the new columns
- [ ] „Notatka" and „Faktura" sit **before** the amount columns, so the „Razem" footer's total still lands under the column it sums (on the netto tab, under „Netto")

**Row height changed 36 → 44** (a text-only row had no budget for the icon). The virtualizer
estimates and never measures, so any row rendering at a different height drifts the scroll spacers:

- [ ] Scroll a list of ~100+ rows to the bottom and back — rows stay aligned with the header and no gap or overlap appears at either end
- [ ] A dataset mixing rows with and without invoices scrolls without drift (the invoice-less cell reserves the control's box on purpose)
- [ ] A very long note (many pozycje) does not wrap the cell onto a second line — it stays truncated at one line

### Post-merge: toolbar

- [ ] Each dataset tab shows its row count in the label (`Materiały (152)`), and the number matches the rows the list actually renders
- [ ] „Pobierz faktury" sits flush with the table's right edge, not the panel's

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

- [ ] Payload admin: „Sposób rozliczenia" is visible and editable on an investment
- [ ] An existing investment (e.g. the seeded dogfooding one) reads „Netto" rather than empty
- [ ] Owner switches the mode in the Podsumowanie select; the panel's figures change and the pick survives a hard reload
- [ ] The same investment opened in a second browser profile shows the owner's stored mode, not that profile's old `localStorage` value
- [ ] Client view shows exactly one money plane in the grid, matching the panel, and has **no** axis control in its header
- [ ] With the mode „Mieszane", the client sees both the netto and brutto parts and their wpłaty
- [ ] With the mode „Mieszane", the owner's grid shows both money columns
- [ ] The client view still fills the viewport with no dead band at the bottom (guards the `h-dvh` fix from `7b70ec2a`, whose header this change edits)
- [ ] A brutto wpłata on a netto-declared investment raises the owner-only warning in Podsumowanie, naming the mode and the offending amount
- [ ] The client view of that same investment shows no warning
- [ ] With VAT 0% the mode select is still **editable** (EX-590) and the VAT 0% scream shows beside it
- [ ] With VAT 0% and the mode „Mieszane", the panel still shows the split netto/brutto sections and the grid still shows both money columns

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
- [ ] In the editor, Wydatki and Wpłaty are unchanged (both new flags default to today's behaviour)
- [ ] `/k/<token>` renders four client views with their pies, no settings bar, no reconciliation scream, and no marża anywhere
- [ ] For an investment with kosztorys rows, every Podsumowanie figure on `/inwestycje/<id>` matches the same figure in the editor panel on the same settlement mode
- [ ] Wydatki on the investment page shows the per-category breakdown with **no pie and no transaction list**
- [ ] Wpłaty shows exactly three Razem buckets (netto / brutto / nie określono), with no udział pie and no per-deposit rows
- [ ] Podsumowanie on the investment page shows the settlement table with **no** „Struktura kosztów" pie
- [ ] The panel renders **always open** — there is no Podsumowanie collapsible trigger to click
- [ ] An investment with **no** kosztorys rows renders the panel on transaction figures — not an all-zero panel
- [ ] The panel appears without blocking first paint; the transfers table below still filters and paginates
- [ ] `?widok=v1` renders the page **identically to before this change** — the same tile block, the same figures, the toggle above it — and the browser network panel shows no kosztorys/deposit fetch
- [ ] `?widok=v2` and `?widok=v1` open in two tabs side by side compare cleanly: Materiały and Wpłaty agree, only Robocizna and Rabat differ
- [ ] The toggle preserves the page's other search params (transfers filters, pagination) when switching
- [ ] The reconciliation scream still fires when the kosztorys and transaction figures disagree
- [ ] Changing the settlement mode from the panel persists and survives a hard reload
- [ ] In v2, `/inwestycje/<id>` shows the owner strip (Marża / Strata / Rozliczone R+M — **no** Wypłaty, that lives in Podwykonawcy) **below** the panel, and no tile block
- [ ] A MANAGER (non-owner) sees the v2 panel but **none** of the owner strip
- [ ] `/raporty` renders its tiles exactly as before, deselect included
- [ ] Printing from the transfers table works in both readings: v1 keeps the dynamic bilans, v2 produces a header with all fields and a static bilans (accepted degradation — see `lessons.md`)

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

- [ ] An investment with materiały spend and no rate set shows marża and bilans exactly as before the change (the `null` default changes nothing)
- [ ] Checking „rozliczane po kwocie netto" (opens at the VAT rate) moves marża down and bilans inwestora up by the **same** amount
- [ ] That amount equals `materiały brutto − materiały brutto / 1,23` — not `materiały brutto × 0,23`
- [ ] The „w tym obniżka materiałów" sub-line under Materiały in Podsumowanie quotes that same amount, and the Podsumowanie column still adds up top-down (Robocizna − Rabat + Materiały = Łącznie; the „w tym" line is not added)
- [ ] The investments list shows the same marża as the investment's own page
- [ ] A „Wydatek inwestycyjny netto" row (frozen netto bucket) is **not** discounted — its Netto column equals its Brutto in the per-category table, and the concession is computed off the brutto bucket only
- [ ] Switching to rozliczenie brutto returns marża and bilans to their no-rate values and shows the notice that the rate changes nothing there
- [ ] Switching back to netto restores the figures — the saved rate was kept, not cleared
- [ ] Editing the % writes through: reload and both the on/off state and the number survive
- [ ] The client share (`/k/<token>`, logged out) shows the discounted „Do zapłaty" and **no** pricing control
- [ ] `/raporty` shows the warning banner above the figures without scrolling

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
- [ ] Changing VAT and rabat globalny in „Opcje rozliczenia" shows the new value **immediately**, with a pending indicator, and no full-page flash
- [ ] Changing „sposób rozliczenia" and „stawka netto wydatków" shows a pending indicator and settles — these two are deliberately **not** optimistic (their value lives only on `tree`, which is frozen at mount)

### Write-path coalescing (the `deferRefresh` win, and the gate fix to it)

- [ ] Editing a single grid cell fires the autosave and **no** full-route refresh alongside it
- [ ] Editing 5–10 cells in quick succession produces **one** route refresh after the typing stops — not one per cell (this is the uncleared-timer bug fixed at the review gate; unfixed it queues a refresh per edited cell)
- [ ] After that single refresh lands, the totals panel figures match the grid

### Non-regression on the rewired reads

- [ ] Renaming an investment updates the name in the top-bar crumb without a hard reload (the per-entity cache tag path)
- [ ] Uploading a new invoice attachment makes it appear in the transfers table on the next render (the whole-table media cache is invalidated by the media write hook)
- [ ] Deleting an invoice attachment removes it from the transfers table on the next render
- [ ] A brand-new investment with **zero** kosztorys rows opens the editor without a 500 (the `coalesce` on the `json_agg` query — pinned by a DB spec, worth eyeballing once)
- [ ] Sections render in `displayOrder`, not insertion order
- [ ] The client share link (`/k/<token>`, logged out) shows figures consistent with the owner's view after an edit — `deferRefresh` expires the tags without re-rendering, and the share route is the only place a dropped invalidation would show

### Nav crumb (adjacent strand on the same branch)

- [ ] The crumb's back arrow returns to wherever you came from (investment page → editor → arrow → back to the investment page)
- [ ] Opening an editor URL **directly in a fresh tab** and clicking the back arrow lands on `/inwestycje/<id>` rather than doing nothing or leaving the app (the empty-history fallback added at the review gate)

### Rabat globalny (fixed / deliberately left at the review gate)

- [ ] With a stored „Kwotowy" rabat, switching to „Wyłączony" while the save **fails** leaves the select showing „Kwotowy" again, matching the figures — it must not read „Wyłączony" while the totals still subtract a rabat
- [ ] Applying a % still cannot be undone with Ctrl+Z — **by decision** (owner, 2026-07-27). Guarded by a confirm dialog instead; see `## EX-606`.

## EX-605 — rabat globalny: activates on selection, undoable, one „Zapisz"

Fixes the „Kwotowy" finding left open above. Two behaviour changes on the same control: picking the
mode now writes immediately (seeded with the per-item rabat total it replaces), and both modes commit
through an explicit „Zapisz" instead of „Kwotowy" saving on blur. Setup: same as EX-597, on a
kosztorys whose items carry **per-item rabaty** — without them the seed is 0 and the switch is
untestable.

- [ ] Picking „Kwotowy" replaces the per-item rabaty **immediately**, with no amount typed — the rabat column stops applying and „do rozliczenia" does not move (the seed equals what it replaced)
- [ ] Ctrl+Z after that switch restores the per-item rabaty **and** puts the select back on „Wyłączony" — the select must not sit on „Kwotowy" over a rabat that is no longer stored
- [ ] Ctrl+Shift+Z redoes it, and the figures land where they were after the original switch
- [ ] Switching to „Wyłączony" brings every per-item rabat back at its original value — „Kwotowy" must never have deleted anything
- [ ] Typing a kwota and **not** pressing „Zapisz" (click elsewhere, blur the field) changes nothing; the previous kwota still applies
- [ ] „Zapisz" is inert until the typed value actually differs from the stored one, and Enter does the same as the click
- [ ] Ctrl+Z after saving a kwota restores the previous kwota, both in the field and in the totals
- [ ] „%" still commits through the same button and clears its input on success — only its label changed

## EX-606 — the % mass-overwrite gets a confirm dialog, not an undo entry

**Owner's ruling (2026-07-27):** the overwrite stays destructive and stays outside Ctrl+Z. The
guard is a confirm dialog. The premise of the original filing was wrong — recovery already exists:
`applyPercentRabatToAllItemsAction` auto-saves a kosztorys version before every apply, so the state
is restorable from the versions drawer. The dialog's job is to make both facts visible at the moment
of the click. Setup: a kosztorys with **hand-typed per-item rabaty** on several items, tryb „%".

- [ ] „Zapisz" in „%" opens a confirm dialog naming the typed percent, and **nothing is written** until you confirm
- [ ] On a kosztorys where **no** item carries a rabat, „Zapisz" writes straight through with **no dialog** — there is nothing to overwrite
- [ ] The dialog counts the affected items and gets the Polish right: „w 1 pozycji" vs „w 3 pozycjach"
- [ ] That count is correct while a rabat globalny „Kwotowy" is active — the stored per-item rabaty still exist and still get overwritten, even though the totals show no per-item rabat
- [ ] Cancel / Escape / clicking the overlay leaves every per-item rabat exactly as it was
- [ ] The 0% dialog says rabaty will be **zeroed**; a non-zero one says they will be **overwritten**
- [ ] Both dialogs say Ctrl+Z will not undo it and point at the auto-saved version
- [ ] After confirming, that pre-change state really is in the versions drawer, and restoring it brings the hand-typed rabaty back
- [ ] Ctrl+Z after a confirmed apply does **not** revert the rabaty (this is the intended behaviour, not a bug)

## EX-607 — kosztorys-section-footer-row

The section band split in two: the header keeps identity only (colour dot, name, „N poz.", chevron),
and a new „Razem <nazwa sekcji>" footer closes each section with its figures under their own columns.
Setup: a kosztorys with **≥2 sections**, per-item rabaty on some rows, and a przedmiar filled in — the
przedmiar and rabat footer cells are blank without them.

- [ ] Each footer's caption reads „Razem <nazwa sekcji>" and follows a rename immediately; a long name truncates rather than pushing the figures out of their columns
- [ ] Each section's netto sits directly under `Wartość netto` and equals what the band's label used to show; brutto likewise
- [ ] Σ of the section footers' netto equals the grand „Razem" netto at the bottom
- [ ] The przedmiar pair fills in the client view and the footer cells are blank in the other views (the przedmiar has no per-rozliczenie reading)
- [ ] The etap axis is filled per section: each etap's qty column, their sum, and each etap's wartość netto/brutto — and per section Σ of the etap wartości equals that section's netto
- [ ] „Pozostało" and „Przedmiar" (qty) are filled per section; a section holding a row with no przedmiar does not count that row as settled
- [ ] Every footer column reads as the sum of the cells above it in that section — a column with no honest total (a share, a ratio) is **blank, never a 0**
- [ ] Folding a section leaves the header line alone — items **and** footer gone; unfolding brings both back
- [ ] Switching the money axis to netto-only hides the brutto footer cells with their columns; no number is left stranded under a hidden header
- [ ] Sorting by any column removes headers and footers together; clearing the sort restores both
- [ ] Typing into a cell directly above a footer keeps focus and accepts every character — a remount would drop all but the last one
- [ ] Saving persists nothing new: reload and the same figures come back, with no phantom row in the kosztorys

### Perf on the big dataset (review-gate finding)

The footers recompute every column once per section on top of the „Razem" pass, so the per-edit totals
work roughly doubled and has been unmeasured since the widening. The one super-linear term is gone —
**EX-612** folded the etap-qty sum into `stageAxisForView`'s existing walk, so the whole pass is now
linear in rows per section — but the per-section multiplication itself remains. Setup: `INV=7 node
--env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts` (~1000 items), then open that kosztorys.

- [ ] Typing into a cell stays responsive at ~1000 items — no perceptible lag between keystroke and character, and no jank scrolling right through the etap axis. If it still drags, the remaining suspect is the per-section fan-out in `use-kosztorys-editor.ts` (`sectionColumnTotals`), not the etap loop.

## EX-608 — nazwa inwestycji w górnym pasku bez trzeciego zapytania

Nazwa w górnym pasku czyta się z danych, które nawigacja i tak pobiera, zamiast osobnym zapytaniem.
Setup: DevTools → Network, wejście na `/inwestycje/<id>/kosztorys_v2`.

- [ ] Nazwa inwestycji i strzałka „wróć" są w górnym pasku tak jak przed zmianą, na obu podstronach (`/kosztorys`, `/kosztorys_v2`)
- [ ] Zmiana czegokolwiek w „Opcjach rozliczenia" (VAT / tryb / materiały netto / rabat globalny) nie gasi nazwy ani jej nie miga — pasek zostaje wypełniony przez cały zapis
- [ ] Zmiana nazwy inwestycji w jej edycji jest widoczna w górnym pasku po powrocie na podstronę kosztorysu
- [ ] Na stronach spoza inwestycji (`/`, `/kasa/<id>`, `/pracownicy`) pasek nadal nie pokazuje nic w tym miejscu
- [ ] Wejście na `/inwestycje/999999/kosztorys_v2` (nieistniejąca) nie wywala paska — po prostu brak nazwy

## EX-609 — subcontractor-price-guard

Cena wykonawcy nie może przekroczyć 80% ceny dla inwestora — zapis jest blokowany, komórka czerwienieje.
To jedyny werdykt: bursztynowy stopień „powyżej stawki z globalnego mnożnika" został wycofany
(właściciel, 2026-07-28), bo zapalał się na zwykłych wierszach i kolor przestawał cokolwiek znaczyć.
Setup: kosztorys z wypełnionymi cenami dla inwestora, globalny mnożnik „z narzędziami" wyraźnie poniżej 0,8
(np. 0,65), oba widoki wykonawcy dostępne z przełącznika.

**Zaakceptowane ryzyko (właściciel, 2026-07-27):** inwestycja, której globalny mnożnik JUŻ przekracza
0,8, zapali każdy wiersz „auto" na czerwono — „niech się świeci", to nie jest usterka.

- [ ] Widok „z narzędziami", tryb „kwota stała": kwota powyżej 80% ceny dla inwestora nie zmienia wiersza — komórka czerwienieje i pokazuje tooltip z maksymalną kwotą; poprawna kwota kasuje czerwień
- [ ] Kolumna „Mnożnik" w trybie „własny mnożnik": mnożnik powyżej 0,8 zostaje odrzucony tak samo
- [ ] Wyjście z komórki (blur) po odrzuconym wpisie gasi czerwień i tooltip, a wiersz wraca do poprzedniej wartości — i mówi o tym toast „Cena odrzucona — przywrócono …"
- [ ] Niedokończony wpis („1e") cofa się po wyjściu BEZ toasta — ogłaszamy odrzucenie, nie każdą literówkę
- [ ] Kwota stała powyżej stawki z globalnego mnożnika, ale poniżej 80%, wpisuje się normalnie i NIE zostawia po sobie żadnego koloru ani wykrzyknika — nigdzie w tabeli nie ma już żółtego
- [ ] Sumy w „Podsumowaniu" wykonawcy są identyczne jak przed zmianą
- [ ] Obniżenie „Cena j.m." dla inwestora na tyle, by istniejąca kwota stała przekroczyła 80%, zapala „Cenę" na czerwono po powrocie do widoku wykonawcy — mimo że nikt nie tknął kolumn wykonawcy
- [ ] To samo zachowanie w widoku „bez narzędzi", mierzone względem JEGO mnożnika
- [ ] „Ustawienia": mnożnik powyżej 0,8 cofa pole do poprzedniej wartości i nie zapisuje; 0,8 przechodzi; opis pod polami mówi o suficie
- [ ] Wpisywanie w komórce „Cena" nie gubi znaków ANI kursora — długa kwota wchodzi w całości, także w momencie przekroczenia progu, kiedy komórka zmienia kolor
- [ ] „Cena" jest edytowalna w każdym trybie: w wierszu „auto" da się od razu wpisać kwotę, „Źródło" przeskakuje na „kwota stała", a „Mnożnik" pokazuje „—"
- [ ] Wyczyszczenie „Ceny" wraca do „auto" dopiero po wyjściu z komórki — w trakcie pisania pole zostaje puste i nie odbiera kursora
- [ ] Escape w trakcie edycji („Cena" albo „Mnożnik") porzuca wpis i przywraca wartość sprzed wejścia w komórkę — bez toasta, bez podwójnego zapisu
- [ ] Enter zatwierdza tak samo jak wyjście z komórki — przyjęta wartość zostaje, odrzucona cofa się z toastem
- [ ] „Mnożnik" przyjmuje wartość dziesiętną w całości („0,72") — przecinek nie znika w trakcie pisania
- [ ] Przełączenie „Źródła" nie rusza ceny: „kwota stała" 60 zł → „własny mnożnik" pokazuje 0,6 i tę samą cenę; z powrotem na „kwotę stałą" znów 60 zł
- [ ] Rozpoczęcie edycji, przewinięcie tabeli tak, by wiersz zszedł z ekranu, i wyjście z komórki NIE zapisuje wpisu na innym wierszu
- [ ] Tabulatorem (bez myszy) do odrzuconej komórki — tooltip z powodem pokazuje się sam, nie trzeba najeżdżać
- [ ] Ujemna kwota („-50") jest odrzucana tak samo jak przekroczenie sufitu, również w wierszu bez ceny dla inwestora
- [ ] „Ustawienia": ujemny globalny mnożnik nie przechodzi (pole ma dolną granicę 0)
- [ ] **Wydajność** — na kosztorysie ~1000 pozycji (`INV=7 node --env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts`) przewijanie i pisanie w widoku wykonawcy są tak samo płynne jak przed zmianą; każda komórka montuje własny tooltip, więc to jest miejsce, gdzie regres byłby widoczny

## EX-615 — drop-empty-kosztorys-scaffold

### Phase 1: Empty-grid hint

- [ ] An investment with zero sekcje opens the editor showing the hint over an empty grid — not a dialog.
- [ ] **With the totals panel expanded** (its persisted default is `open`), decide whether the hint being occluded is acceptable — the panel is `z-20` + `h-full` + opaque, the hint is an un-z-indexed `absolute inset-0` sibling, so a first-ever visitor sees the panel, not the hint. Occlusion is _consistent_ (the panel hides the grid too), but the retired dialog was modal and always won. Raised at the review gate; see EX-617.
- [ ] Typing a search term that matches nothing on a _populated_ kosztorys does NOT show the hint.
- [ ] The share/client view of an empty kosztorys shows the title without the „Dodaj" sentence.

### Phase 2: Delete the client scaffold

- [ ] Restoring a snapshot from the „Wersje" drawer still reseeds the grid (the remount still fires).
- [ ] „Sekcja z szablonu…" still populates an empty kosztorys from the `Dodaj` menu.

### Phase 3: Delete the server scaffold

- [ ] Creating an investment **without** a preset succeeds and opens an empty kosztorys showing the hint.
- [ ] Creating an investment **with** a preset still seeds the full rozpiska and shows no warning toast.

## EX-618 — scalable-preset-section-picker

### Phase 1: Extract the derivation, fold the search

- [ ] Typing `lazienka` into an existing table's search box (e.g. investments) matches a „Łazienka" row.

### Phase 2: Two-pane picker (desktop)

- [ ] Both panes render side by side; clicking a szablon on the left fills the right pane with its sekcje.
- [ ] Ticking sekcje in szablon A, switching to szablon B, ticking more, then „Dodaj (N)" appends all of them — the counter reflects the cross-szablon total throughout.
- [ ] „Zaznacz wszystkie" ticks the whole active szablon; clicking it again unticks it; the left row's `N/N` figure tracks it.
- [ ] Filtering the left pane to hide a szablon that has ticks does not change „Dodaj (N)", and clearing the filter shows those ticks still set.
- [ ] Searching a name with Polish characters matches from an ASCII query.
- [ ] Closing and reopening resets both the selection and the search box.

### Phase 3: Narrow-screen drill-in

- [ ] At 390px width the dialog shows only the szablon list; tapping one shows only its sekcje; back returns to the list with the szablon still highlighted.
- [ ] Ticks made before going back are still set after returning and drilling into another szablon; „Dodaj (N)" totals both.
- [ ] Resizing across 768px (this repo's `sm`) mid-selection does not lose ticks or strand the user on a hidden pane; at 800px both panes are visible.
- [ ] The dialog at 390px does not scroll horizontally, and the footer stays reachable.

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

## EX-575 — drop-cost-variant-columns

Both dead columns are gone (migration `20260728_0`), applied locally on 5433 and 5435.
Prod migration is owed at ship time, by a human.

### Phase 4: The editor still works against the narrowed schema

- [ ] Seeded kosztorys editor (`INV=6`) opens: siatka renderuje się, autozapis komórki utrwala się po odświeżeniu.
- [ ] „Dodaj sekcję" i „Dodaj pozycję" działają — nowa sekcja przychodzi z pierwszą pozycją.
- [ ] „Dodaj sekcję z szablonu" listuje szablony i dokłada wybrane sekcje.

### Phase 5: Pre-migration payloads still load

- [ ] Wersja kosztorysu zapisana **przed** migracją wczytuje się bez błędu, a drzewo jest kompletne.
- [ ] Globalny szablon zapisany przed migracją nakłada się tak samo.

### Phase 6: The domain note reads as closed

- [ ] `context/reference/kosztorys-editor-domain-notes.md`, sekcja „Wariant «z narzędziami / bez narzędzi»" — czyta się jako **zamknięta** decyzja z zachowanym uzasadnieniem, żadne zdanie nie powołuje się na nieistniejącą kolumnę.
- [ ] Żadne zdanie nie miesza rejestrów (słownictwo arkusza vs identyfikatory kodu).

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

- [ ] **Cofnięcie do wersji odtwarza drzewo bez zmian.** Zapisz wersję, zmień coś w rozpisce (dopisz pozycję, zmień ilości w etapach), cofnij do zapisanej wersji — sekcje, pozycje, etapy i ilości wykonane wracają identyczne, każda pozycja pod swoją sekcją, każda ilość przy swoim etapie.
- [ ] **Nałożenie szablonu na pustą inwestycję.** Nałóż globalny szablon na inwestycję bez rozpiski — pozycje trafiają pod właściwe sekcje (żadna nie ląduje w cudzej), kolejność i nazwy zgodne z szablonem.

## summary-panel-filter-blind — panel wholly filter-blind, scope-marker apparatus deleted

Reverses **EX-600** below: the panel no longer half-reacts to filtry transakcji, so the asterisks and
the przypis it introduced are gone. The EX-600 section's unticked boxes describe a UI that no longer
exists — read them as superseded by this section, not as owed.

### Phase 1: Panel goes filter-blind

- [ ] Na inwestycji z kosztorysem liczby w „Podsumowaniu" są identyczne przed i po nałożeniu filtra transakcji.
- [ ] Sumy w zakładce „Materiały/Wydatki" są identyczne przed i po nałożeniu filtra.
- [ ] Liczby w zakładce „Marża" są identyczne przed i po nałożeniu filtra, i nadal ukryte dla MANAGERA.
- [ ] „Wpłaty" na stronie inwestycji zgadzają się z „Wpłatami" na `kosztorys_v2` tej samej inwestycji.
- [ ] Inwestycja **bez** pozycji kosztorysu nadal renderuje odczyt z planu transakcji, bez błędu.

### Phase 2: Strip the scope-marker apparatus

- [ ] Żadnej gwiazdki przy wierszach „Podsumowania" w każdej osi kwot (netto / brutto / mieszany).
- [ ] Czerwony przypis „Pola oznaczone gwiazdką…" zniknął.
- [ ] Na inwestycji, gdzie robocizna z kosztorysu rozjeżdża się z transakcjami LABOR_COST, ostrzeżenie o rozbieżności pokazuje się **także** przy aktywnym filtrze.
- [ ] `SettlementPlaneWarning` pokazuje się na rozjeżdżającej się inwestycji przy aktywnym filtrze.
- [ ] Podgląd inwestora (`preview`) nadal wycisza oba werdykty.

### Phase 3: Delete the dead filter plumbing

- [ ] Filtrowanie tabeli transferów, paginacja i kafelek „Suma wybranych transakcji" działają bez zmian na stronie inwestycji.
- [ ] Te same filtry działają na `/pracownicy/[id]`, `/raporty` i `/kasa/[id]`.

## AI receipt scan: extract the netto amount (EX-577)

### Phase 1: Netto extraction, end to end

- [ ] Skan prawdziwej faktury netto (PDF) na typie „Wydatek inwestycyjny netto" wypełnia Kwotę i Netto, a formularz zapisuje się bez błędu walidacji.
- [ ] Skan paragonu z samym brutto i pieczątką „w tym VAT 23%" zostawia Netto puste — model nie wylicza go z VAT-u.
- [ ] Skan na typie brutto, potem zmiana typu na „Wydatek inwestycyjny netto" → kolumna Netto jest już wypełniona.
- [ ] Skan na typie brutto i zapis → zapisany transfer nie niesie `netAmount`.
- [ ] Nieczytelny obraz nadal zwraca marker „NIE UDAŁO SIĘ ODCZYTAĆ" i puste Netto.

## Multi-page invoices (EX-659)

### Phase 1-2: Read path, podgląd, eksport

- [ ] Wydatek z jedną fakturą wygląda i zachowuje się jak dotąd — ikona, podgląd, „Pobierz", „Drukuj".
- [ ] Wydatek z 3 stronami otwiera podgląd, który przewija strony strzałkami z licznikiem „2/3".
- [ ] „Pobierz wszystkie" z podglądu wielostronicowego daje ZIP z 3 plikami o różnych nazwach.
- [ ] „Drukuj" w podglądzie wielostronicowym drukuje wszystkie strony w jednym zadaniu, nie tylko pierwszą.
- [ ] Masowe pobieranie faktur z tabeli wydatków liczy strony, nie wiersze — toast pokazuje liczbę plików w ZIP-ie.

### Phase 3: Edycja zapisanej faktury

- [ ] W edycji wydatku „Dodaj stronę" dokłada plik do istniejącej faktury (nie podmienia).
- [ ] „Usuń stronę" kasuje tylko oglądaną stronę; pozostałe zostają, licznik się zmniejsza.
- [ ] „Usuń całą fakturę" znika wtedy, gdy została jedna strona.
- [ ] Usunięcie strony i ponowny wybór tego samego pliku działa (input czyści wartość).
- [ ] Faktury można dodać/usunąć także na cudzej transakcji — bez komunikatu o uprawnieniach.

### Phase 4-5: Dodawanie i skan AI

- [ ] W formularzu wydatku można dołączyć kilka plików do jednego wiersza; miniatury i licznik zgadzają się z wyborem.
- [ ] Skan AI z 3 stron jednej faktury wypełnia formularz raz (jedna pozycja), nie trzy.
- [ ] Skan z 9 stron zwraca czytelny błąd o limicie stron, nie 500.
- [ ] Plik innego typu niż obraz/PDF jest odrzucany komunikatem, nie cichym błędem.

### Phase 6: Sprzątanie plików

- [ ] Nieudany zapis formularza z 3 stronami nie zostawia osieroconych plików w Blob.
- [ ] Usunięcie wydatku kasuje jego pliki, ale nie kasuje pliku, który wskazuje jeszcze inny wydatek.

## Dodawanie faktur wprost z „+" w tabeli wydatków (EX-662)

- [ ] Dwa zdjęcia wybrane na jednym „+" dokładają obie strony do tej samej transakcji.
- [ ] HEIC prosto z iPhone'a dołącza się z tabeli (przed zmianą tu nie działał).
- [ ] Za duże zdjęcie daje ten sam polski komunikat co formularz wydatku, a reszta plików z paczki wchodzi.
- [ ] Po udanym dodaniu pojawia się toast „Faktura dodana", a wiersz od razu pokazuje strony.
- [ ] W trakcie przesyłania „+" jest zablokowany — drugiego wyboru nie da się zacząć.

## cron-lead-reconcile (EX-416)

Setup: run the app locally (`.env` → 5433 dev DB) and read `CRON_SECRET` from `.env`. The Graph calls
hit **live Meta data** with the never-expiring Page token, so a sweep here really does insert leads —
run it against the dev DB, not prod.

### Phase 1: Extract the sweep core

- [ ] „Pobierz zgłoszenia" in the app still reports the same added/scanned counts as before the split

### Phase 2: Cron route, schedule, and recovery alert

- [ ] Hitting `/api/cron/leads-reconcile` locally without a bearer returns 401
- [ ] Hitting it with the correct `CRON_SECRET` returns counts, and a run that recovers a lead delivers the alert mail to `LEADS_ALERT_EMAIL`
- [ ] The Vercel dashboard lists the new cron after deploy, and its first run logs a 200

### Review gate (added 2026-08-10)

- [ ] Break the Meta token in `.env`, hit the route with the correct secret → **500** _and_ a „🚨 Cron odzyskiwania zgłoszeń nie zadziałał" mail lands in `LEADS_ALERT_EMAIL`. This is the failure the whole change exists to prevent, and the only leg no unit test can prove end-to-end (real Graph rejection → real SMTP send).

## lead-recovery-notifies-sales (EX-660)

Same setup as `cron-lead-reconcile` above (local app, dev DB on 5433, `CRON_SECRET` from `.env`).
**Caution:** these checks read live Meta data and send real mail to `LEADS_NOTIFY_EMAIL`,
`LEADS_ALERT_EMAIL`, and — if anything regresses — to a real customer address.

Precondition: a lead that exists in Meta's recent window but not in the local DB (delete it locally).

- [ ] Click „Pobierz zgłoszenia" → the sales inbox receives one ordinary „Nowe zgłoszenie" for that lead, indistinguishable from a webhook-delivered one
- [ ] The customer address receives **nothing** — no late „Dziękujemy za kontakt". This is the leg the whole `autoReply: 'skip'` option exists for
- [ ] The recovered row in the admin panel shows `notifyStatus: sent`, `autoReplyStatus: skipped` — never `skipped`/`skipped`
- [ ] Exactly one summary mail arrives, to `LEADS_ALERT_EMAIL` only (not the sales inbox), with no contact details and no "call them yourself" instruction

## investments-listing-expense-plane — wydatki w liście na płaszczyźnie rozliczenia materiałów

**In review** — automated gate green (tsc 0, eslint 0 errors, unit 2035, integration 83, build OK) and
the parity audit reports 0 outliers across 96 inwestycji on the dev DB. Boxes below are what no test
proves: the figures the owner actually reads on `/inwestycje`, against the same investment's
Podsumowanie. Setup per the intro (5435 test DB) **except** the investment-31 rows — that investment
with its materiały rate lives on the dev DB (5433), which is where the defect was found.

### Phase 1: Bramka i brakujący kabel

- [ ] „Podsumowanie" inwestycji 31 pokazuje te same liczby co przed zmianą w trybie netto, i tak samo zachowuje się po przełączeniu na brutto i z powrotem

### Phase 2: Naprawa „Wydatków inwestycyjnych" i kolumn kategorii

- [ ] `/inwestycje`, wiersz „11 Listopada 40": budowlane 105 712,10 · wykończeniowe 47 156,35 · pozostałe 20,00 · wydatki inwestycyjne 152 648,46 (suma kolumn nie domyka się do totalu o −240,00 — to legacy materiał bez kategorii, kolumny „Korekta" już nie ma)
- [ ] Te same liczby zgadzają się co do grosza z „Razem" netto w „Podsumowaniu" tej inwestycji
- [ ] Inwestycja bez stawki materiałów wygląda dokładnie jak przed zmianą
- [ ] Po przełączeniu inwestycji 31 na rozliczenie brutto kolumny pokazują surowe kwoty z ewidencji, a po powrocie na netto wracają liczby netto

### Phase 3: Trzy nowe kolumny

- [ ] Wiersz inwestycji 31: „Wydatki wliczone w robociznę" = 1 004 421,85
- [ ] „Bilans brutto" inwestycji 31 = −28 764,67, czyli co do grosza „Pozostało do zapłaty" brutto z „Podsumowania" tej inwestycji (ze znakiem: minus = inwestor winien)
- [ ] „Bilans brutto" w wierszu z rabatem liczy VAT od robocizny **po rabacie** — kwota rabatu nie jest oVAT-owana
- [ ] Przełącznik kolumn wymienia wszystkie trzy nowe kolumny, a ukrycie/pokazanie przeżywa odświeżenie strony
- [ ] Konto MANAGERA widzi „Korektę" i „Wydatki wliczone w robociznę", a nadal nie widzi „Marży" ani „Wypłat"

### Phase 4: Detektory

- [ ] `dumps/parity-post-fix.json` pokazuje dla inwestycji 31 niezerowe `wydatkiInwestycyjne` i `match: true` — czyli że ta pozycja jest naprawdę porównywana, a nie skraca się do zera

## kosztorys-importer (EX-417)

Setup: local app against the 5433 dev DB, logged in as OWNER or MANAGER, on an investment that has a
linked Google Sheet. **The Sheets credential in `.env` is live** — the importer only ever reads, but
pick an investment whose sheet you are happy to have read. Kosztorys rows are throwaway until
dogfooding merges to `main`, so replacing one is safe.

- [ ] „Opcje" → „Pobierz z arkusza Google…" is present for every role that reaches the editor — OWNER/ADMIN **and MANAGER** (the importer sits at MANAGEMENT_ROLES like every other kosztorys mutation)
- [ ] On an investment with no linked sheet the dialog opens and refuses with „Inwestycja nie ma kosztorysu." — the confirm button stays disabled
- [ ] Preview opens with **Rozpoznane kolumny first** — Przedmiar / j.m. / Cena j.m. / rabat / Wartość netto plus nazwa sekcji + opis pracy, each with the column letter and the header cell it matched
- [ ] „Co wejdzie" counts match the sheet: sekcje, prace, etapy
- [ ] Rate auto-resolutions are listed one by one with the rejected side visible — never silently applied
- [ ] Footer totals compare against the sheet's own „wartość netto" / „R netto - suma prac wykonannych"; a match is neutral, a real difference is amber. **This is the parse's own proof** — a green pair means every cena, rabat and ilość landed right
- [ ] „Zostaną zachowane" lists vanished prace and nothing is deleted
- [ ] During the write both „Pobierz i zastąp" and „Anuluj" are disabled and the button reads „Pobieram…"
- [ ] After apply the grid **re-seeds without a manual reload** — the imported rozpiska is on screen
- [ ] „Wersje" shows a **named** entry „Przed importem z arkusza Google" at the top (among the manual versions, **not** buried in „Historia automatyczna"), and restoring it brings the previous kosztorys back — this is the undo for a bad import
- [ ] On a sheet whose cennik headers are unreadable the dialog **refuses** with „Nie odczytałem żadnego cennika…" and the confirm button stays disabled — no import of flat 0 zł stawki

## EX-560 — ex-560-reload-from-preset

Setup: local app against the 5433 dev DB, logged in as OWNER, on an investment whose kosztorys has at
least one sekcja, an etap and some wpisane wykonanie, plus at least one zapisany szablon in the
library.

- [ ] „Wczytaj szablon…" appears in „Opcje" and lists saved szablony
- [ ] The search box filters the szablon list by name
- [ ] The dialog states how many sekcje and prace disappear and how many arrive
- [ ] Confirming replaces the rozpiska; the grid shows the new content without a manual refresh
- [ ] VAT and the coefficients are unchanged afterwards; a rabat globalny set beforehand is cleared, and „do zapłaty" is never negative
- [ ] „Wczytaj" lists „Przed wczytaniem: «nazwa szablonu»" — named after the szablon, so two swaps are distinguishable — and restoring it brings the original rozpiska back including etapy and postęp
- [ ] Reloading an investment with an empty kosztorys works too (no special-casing)

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

- [ ] Inwestycja **z kosztorysem**: „Bilans netto", „Bilans brutto", „Koszty inwestora" i „Marża" w wierszu listy zgadzają się co do grosza z „Podsumowaniem" tej samej inwestycji (v2). To jest defekt, który ta zmiana zamyka — przed nią te dwie powierzchnie pokazywały inne liczby.
- [ ] Inwestycja **bez kosztorysu** pokazuje na liście i w v2 **0 zł robocizny i 0 zł rabatu**, nawet jeśli ma zaksięgowane `LABOR_COST` (np. inwestycja 31). Jej stare liczby widać po przełączeniu na **v1** — i tylko tam.
- [ ] Inwestycja z kosztorysem sumującym się **do zera** wygląda identycznie jak ta bez kosztorysu. Nie da się ich odróżnić po liczbach i nie ma powodu, żeby dało się je odróżnić.
- [ ] Inwestycja z pustym kosztorysem, ale z zaksięgowaną robocizną w transakcjach — reconciliation **krzyczy** niezgodność. To jest sygnał „ta robota czeka na wprowadzenie do kosztorysu", nie fałszywy alarm.
- [ ] Zmiana ilości w kosztorysie rusza „Marżę" na liście **bez** klikania „Odśwież dane".
- [ ] Zakładka **Marża** w v2 pokazuje tę samą robociznę i ten sam rabat co blok nad nią.
- [ ] Okno „Nowa transakcja" (i **edycji** transakcji) nie oferuje już „Robocizny" ani „Rabatu"; stary wiersz `LABOR_COST`/`RABAT` dalej się renderuje w tabeli, daje się anulować i jedzie do arkusza.
- [ ] Draft w sessionStorage: wybierz stary typ, przeładuj — formularz nie wraca do ukrytego typu.
- [ ] Inwestycja z kosztorysem i **bez żadnej** transakcji `LABOR_COST`/`RABAT` **nie krzyczy** „Niezgodność z transakcjami" (ani w edytorze, ani na stronie inwestycji).
- [ ] Inwestycja, która ma zaksięgowaną robociznę, ale **nie ma** rabatu — krzyk na rabacie **zostaje**. Wyciszenie jest per inwestycja, nie per figura.
- [ ] Przełącznik **v1/v2** w panelu: v1 dalej pokazuje liczby z transakcji (celowo rozjeżdża się z listą — legacy do porównań).

## EX-557 — wpłaty bez inwestycji („Inna wpłata" wraca, oba typy tracą inwestycję)

**In review** — cała bramka zielona (tsc, eslint, `pnpm test` 2131, `pnpm test:integration` 99,
`pnpm test:parity` 3). E2E okna wpłaty odroczone do **EX-679** (`e2e-backlog`).

Setup: aplikacja na dev DB (5433), potrzebne dwa konta — MANAGER i ADMIN/OWNER.

- [ ] Jako MANAGER okno wpłaty oferuje „Inna wpłata" (wróciła) i „Wpłata od inwestora", ale **nie** „Zasilenie z konta firmowego"
- [ ] Jako ADMIN/OWNER lista typów ma wszystkie trzy, w kolejności alfabetycznej po polskiej etykiecie
- [ ] Wejście z `/inwestycje/<id>` → „Inna wpłata" → pole inwestycji znika, a zapisany wiersz ma w kolumnie Inwestycja „—", nie inwestycję, na której stałeś
- [ ] To samo dla „Zasilenie z konta firmowego"
- [ ] Wybierz „Wpłata od inwestora", ustaw inwestycję i netto/brutto, przełącz typ na „Zasilenie" i zapisz — żadna z tych dwóch wartości nie ląduje na wierszu
- [ ] Edycja istniejącego wiersza `COMPANY_FUNDING` z tabeli transakcji nie oferuje pola inwestycji, a zapis niepowiązanego pola (opis) przechodzi bez błędu

## EX-675 — strata obniża dług inwestora jak rabat

**In review** — cała bramka zielona (tsc, eslint, `pnpm test` 2153, `pnpm test:parity` 3). Strata
wchodzi teraz w bilans **nominalnie**: 1000 zł wchłonięte to dokładnie 1000 zł mniej długu na
netto i na brutto — inaczej niż rabat, który jest ustępstwem od ceny i gruntuje się o VAT. Marża
bez zmian. Inwestycja przy stracie stała się **wymagana**.

Setup: aplikacja na dev DB (5433), zalogowany jako OWNER (kafelek „Strata" i „Marża" są dla
ADMIN/OWNER). Inwestycja **62** jest wzorcem: 362,84 zł materiału pokryte stratą 362,84 zł.

- [ ] Inwestycja 62: nagłówkowy bilans pokazuje **0 zł**, marża **−362,84 zł**
- [ ] Kafelek „Strata" stoi w wierszu kredytów obok rabatu (nie w osobnym bloku), a suma kafelków po odznaczeniu/zaznaczeniu dowolnego z nich dalej zgadza się z nagłówkiem
- [ ] Bilans brutto tej samej inwestycji nie „gruntuje" straty — przy stracie 1000 zł i VAT 23% dług spada o 1000 zł, nie o 1230 zł
- [ ] Podsumowanie v2 inwestycji ze stratą: krok **„Strata"** stoi pod „Wpłatami", na minusie, spięty przez oba tory kwotowe; „Pozostało do zapłaty" schodzi o tę samą kwotę na netto i na brutto
- [ ] Inwestycja **bez** straty nie pokazuje kroku „Strata" w ogóle (żadnego 0 zł)
- [ ] Tryb **mieszany**: „Strata" pojawia się raz, w torze netto (jak „Wpłaty netto"), a podpowiedź przy „Pozostało brutto" wymienia stratę wśród odjętych pozycji
- [ ] Podgląd inwestora (link do kosztorysu) pokazuje ten sam obniżony dług — bez ujawniania marży i wypłat
- [ ] Okno „Nowa transakcja" → „Strata": pole inwestycji jest **wymagane**, zapis bez niej odrzucony
- [ ] Do istniejącej straty da się dopiąć fakturę (edycja tylko tego pola) — zapis przechodzi, nie żąda ponownie inwestycji
- [ ] Wyczyszczenie inwestycji na istniejącej stracie (panel Payloada) jest **odrzucone** — wcześniej przechodziło po cichu, zostawiając stratę bez właściciela
- [ ] Krok „Strata" nie ma żadnej podpowiedzi pod kwotą — ani w panelu, ani w podglądzie inwestora

## EX-686 — rozjazd „Pomiar z natury" vs suma etapów po imporcie

**In review** — cała bramka zielona (tsc, eslint 0 błędów, `pnpm test` 2150,
`pnpm test:integration` 104). `pnpm build` przeszedł przez `next build --webpack`; turbopack nie
buduje w worktree z dowiązanym `node_modules` — ścieżkę turbopackową potwierdzić po scaleniu.
E2E odroczone (patrz bramka przeglądu).

Setup: dev DB (5433), zalogowany jako OWNER, inwestycja z zaimportowanym arkuszem, w którym
„Pomiar z natury" jest wpisany ręcznie (inwestycja 31 — 32 pozycje, 41 377 zł rozjazdu).

- [ ] Najechanie na komórkę „Pomiar (razem etapy)" **nie** pokazuje żadnej podpowiedzi z rozbiciem arkusz/etapy — rozjazd czyta się wyłącznie z kolumny „Pozostało do rozliczenia"
- [ ] Kolumna „Pozostało do rozliczenia" stoi na pierwszym miejscu (zaraz za „Akcje", przed „Sekcją"), ma czerwony nagłówek i czerwone tło komórek, i pokazuje wprost ilość ze znakiem oraz kwotę — bez najeżdżania kursorem
- [ ] Kolumna „Pozostało do rozliczenia" pojawia się dopiero po wciśnięciu przycisku „z pomiarem do rozpisania na etapy" i znika po jego odciśnięciu; nie ma jej w liście „Kolumny" i nie da się jej stamtąd ani schować, ani wywołać
- [ ] Przy wciśniętym przycisku kolumna zostaje po przełączeniu Praca ↔ Postęp, a sortowanie po jej nagłówku układa pozycje wg kwoty; po odciśnięciu przycisku sortowanie samo się czyści (nie zostaje kolejność bez nagłówka do wyłączenia)
- [ ] Przycisk „z pomiarem do rozpisania na etapy" w pasku narzędzi pokazuje liczbę takich pozycji; kliknięcie zawęża siatkę tylko do nich
- [ ] Wpisanie brakującej ilości w etapie zdejmuje pozycję z listy i zmniejsza licznik — bez odświeżania strony
- [ ] Gdy wszystkie rozjazdy zniknęły, przy włączonym warunku widać „Brak pozycji z pomiarem do rozpisania na etapy" z powrotem do pełnej listy, a sam przycisk znika
- [ ] Sekcja zwinięta **chowa** swoje pozycje także przy włączonym warunku — zwinięcia zdejmuje wyłącznie szukanie (ptaszek i zwinięcie stoją w tym samym menu „Filtry")
- [ ] Ponowny import tego samego arkusza nadpisuje odniesienie bieżącą treścią arkusza
- [ ] Robocizna, marża i bilans nie drgnęły po imporcie — odniesienie nie wchodzi do żadnej kwoty
- [ ] Podgląd dla inwestora (link publiczny): brak czerwieni, brak podpowiedzi, brak kolumny „Pozostało do rozliczenia", brak przycisku „z pomiarem do rozpisania na etapy" i pozycji w menu
- [ ] Kosztorys założony ręcznie (bez importu) nie pokazuje przycisku „z pomiarem do rozpisania na etapy" w ogóle

## EX-682 / EX-683 — sortowanie wewnątrz sekcji

**In review** — cała bramka zielona (tsc, eslint 0 błędów, `pnpm test` 2162,
`pnpm test:integration` 107, `next build --webpack`). E2E odroczone (patrz bramka przeglądu).

Zapis kolejności przeniesiony do menu nagłówka kolumny — sprawdza go sekcja EX-688 niżej;
punkty o utrwalaniu z menu wiersza wypadły razem z tamtym poleceniem.

Setup: aplikacja na 5435 (test DB) z zaseedowanym kosztorysem, zalogowany jako OWNER, zakładka
Kosztorys inwestycji.

- [ ] Sortowanie po „Opis" układa pozycje alfabetycznie wewnątrz każdej sekcji, kolejność sekcji bez zmian
- [ ] Pas nagłówka i pas podsumowania sekcji są widoczne przy aktywnym sortowaniu
- [ ] Zwijanie sekcji działa przy aktywnym sortowaniu; wyszukiwarka nadal chwilowo rozwija sekcje
- [ ] Sortowanie po kolumnie z „—" (np. „Pozostało") spycha te wiersze na koniec **swojej** sekcji
- [ ] Podgląd dla inwestora (link publiczny): grupa „Sekcja" w ogóle się nie pokazuje

## EX-688 — zakres sortowania kolumny + „Zapisz kolejność" w menu nagłówka

**In review** — tsc czysty, eslint bez błędów, specy sortowania i zapisu kolejności zielone.
E2E odroczone (patrz bramka przeglądu).

Setup: jak wyżej — aplikacja na 5435 (test DB) z zaseedowanym kosztorysem, zalogowany jako OWNER,
zakładka Kosztorys inwestycji.

- [ ] Menu kolumny pokazuje cztery polecenia sortowania (dwa „zachowując sekcje", dwa przez cały kosztorys), „Zapisz kolejność" i „Wyczyść sortowanie"
- [ ] Sortowanie „w sekcjach" po „Opis" zachowuje pasy sekcji i kolejność samych sekcji
- [ ] Sortowanie „w całym kosztorysie" daje jedną płaską listę — pasy sekcji znikają, a numery pozycji jadą z nimi (numeracja liczy się po pełnym, nieposortowanym zbiorze, więc idzie nie po kolei)
- [ ] „Zapisz kolejność" działa przy każdym sortowaniu, także „w całym kosztorysie" — zapisuje kolejność wewnątrz każdej sekcji
- [ ] Sortowanie „w sekcjach" → „Zapisz kolejność" → wyczyszczenie sortowania → kolejność została **w każdej** sekcji; po odświeżeniu nadal ta sama
- [ ] Cmd+Z cofa utrwalenie wszystkich sekcji jednym ruchem; Cmd+Shift+Z je przywraca
- [ ] Utrwalenie przy wpisanej frazie w wyszukiwarce porządkuje **całe** sekcje, nie tylko widoczne wiersze
- [ ] Po utrwaleniu i wyczyszczeniu sortowania ▲▼ oraz „Wstaw" działają normalnie
- [ ] W menu wiersza (grupa „Sekcja") nie ma już żadnego utrwalania kolejności
- [ ] Sekcja zwinięta przy sortowaniu „w całym kosztorysie" nie chowa swoich pozycji (bez pasa nie ma czym rozwinąć)
- [ ] Żadne sortowanie nie przeżywa odświeżenia strony — po reloadzie kosztorys wraca do kolejności zapisanej
- [ ] Podgląd dla inwestora (link publiczny): w menu nagłówka nie ma „Zapisz kolejność"

## sheet-live-compare — „Porównaj z arkuszem Google" (EX-417)

**In review** — tsc czysty, eslint 0 błędów, spec odświeżania zielony na 5435.
`pnpm build` **nie przeszedł w worktree**: turbopack odmawia na dowiązanym `node_modules`
(„Symlink node_modules is invalid") — to ograniczenie środowiska, nie kodu; potwierdzić po scaleniu.
E2E odroczone do EX-687 (`e2e-backlog`).

Setup: dev DB (5433), zalogowany jako OWNER, inwestycja 31 (arkusz podpięty, 26 pozycji z Pomiarem
jako formułą `=N`).

Osobnej akcji „Zaciągnij pomiary z arkusza" **już nie ma** — zaciągnięcie jedzie razem z odczytem,
więc każdy punkt poniżej dotyczy jednego okna.

- [ ] Opcje → „Porównaj z arkuszem Google…" otwiera okno, pokazuje „Czytam arkusz Google…", a potem cztery bloki: Kwoty, Prace, Stawki podwykonawców, Jak odczytaliśmy arkusz Google
- [ ] Blok „Kwoty" zestawia wartość prac wykonanych obu stron, a „Pozostało do rozliczenia" pokazuje się tylko wtedy, gdy „wartość netto" w arkuszu naprawdę liczy się z Pomiaru
- [ ] Blok „Jak odczytaliśmy arkusz Google" podaje 26 z ~435 prac z Pomiarem wskazującym na Przedmiar — **samą liczbą, bez listy wierszy do rozwinięcia**
- [ ] Pozostałe klasy (Przedmiar z etapu, wartość błędu) mają listy do rozwinięcia, a link prowadzi do konkretnej komórki w arkuszu
- [ ] Praca przemianowana w arkuszu pojawia się na obu listach „tylko po jednej stronie" — i okno mówi wprost dlaczego
- [ ] Ostatnia linia okna raportuje zaciągnięcie: przy pierwszym otwarciu niezerowe liczby, przy drugim „był już zgodny z arkuszem Google"
- [ ] Po pierwszym otwarciu kolumna „Pozostało do rozliczenia" w siatce przelicza się od razu, bez odświeżania strony
- [ ] Drugie otwarcie **nie** przemontowuje siatki: wpisany filtr, sortowanie i zwinięte sekcje zostają na miejscu
- [ ] Zmiana jednego Pomiaru w arkuszu i ponowne otwarcie rusza wyłącznie tę pracę
- [ ] Wyczyszczenie Pomiaru w arkuszu i ponowne otwarcie zdejmuje odniesienie z tej pracy
- [ ] Robocizna, marża i bilans nie drgnęły po zaciągnięciu — odniesienie nie wchodzi do żadnej kwoty
- [ ] Arkusz z przemianowanym nagłówkiem „Pomiar z natury": okno działa, mówi o nierozpoznanej kolumnie i **nie kasuje** zapisanych Pomiarów
- [ ] Inwestycja bez podpiętego arkusza: jeden toast „Inwestycja nie ma kosztorysu.", nie puste okno
- [ ] Odebranie kontu serwisowemu dostępu do arkusza daje jeden polski toast, nie surowy błąd Google
- [ ] W menu wiersza nie ma już „Etapy są prawdą" — na żadnej pozycji

## kosztorys-filter-conditions — jeden rejestr warunków filtrowania (EX-665)

**In review** — tsc czysty, eslint 0 błędów, `pnpm test` 2197, `pnpm build` przechodzi w głównym
katalogu (wcześniejsza porażka dotyczyła worktree z dowiązanym `node_modules` i się nie powtarza).
Lista poniżej opisuje stan po `c6c32570` — gramatyce „ptaszek znaczy widoczne".

Setup: dev DB (5433), zalogowany jako OWNER, kosztorys z sekcją w całości wykonaną, ale
niewycenioną (cena j.m. = 0) — to przypadek, przez który powstała ta zmiana.

- [ ] „Filtry" → w grupie „Prace" każdy warunek stoi zaptaszkowany; odptaszkowanie „Pozycje bez przedmiaru" zabiera te pozycje z siatki
- [ ] Odptaszkowanie obu połówek pary („bez przedmiaru" i „z przedmiarem") opróżnia siatkę — ptaszek znaczy „widoczne", nie „pokaż tylko te"
- [ ] Odptaszkowanie dwóch różnych warunków naraz zabiera sumę obu zbiorów, a licznik przy każdym z nich się nie rusza
- [ ] Trigger „Filtry" pokazuje, ile rzeczy menu aktualnie zabiera (odptaszkowane warunki + zwinięte sekcje), i podświetla się razem z tą liczbą; diagnostyki z paska go nie ruszają
- [ ] „Sekcje bez wykonanych prac (N)" zwija dokładnie te sekcje, w których KAŻDA pozycja jest niewykonana — sekcja wykonana, ale niewyceniona zostaje otwarta; ręczne odptaszkowanie jednej z nich zdejmuje ptaszek z tego wiersza
- [ ] Sekcja, której filtr nie zostawił ani jednej pozycji, znika w całości — bez pustej belki i sumy
- [ ] „Zresetuj filtry" na górze menu wraca do pełnej listy: zdejmuje i warunki, i zwinięcia; jest klikalny natychmiast po odptaszkowaniu sekcji (nie czeka pół sekundy)
- [ ] Numery pozycji przeskakują przy filtrze zamiast przenumerowywać się od 1
- [ ] Sortowanie po kolumnie nie przenumerowuje pozycji — numery jadą razem z wierszami
- [ ] „Bez ceny j.m." stoi w pasku z licznikiem i znika, gdy wszystko jest wycenione
- [ ] Wpisanie brakującej ceny zmniejsza licznik bez odświeżania strony
- [ ] Pusta siatka nazywa filtr, który ją opróżnił, a przycisk wraca do pełnej listy
- [ ] Ustawione filtry przeżywają odświeżenie strony i NIE przenoszą się na inną inwestycję
- [ ] Podgląd dla inwestora (link publiczny): brak menu „Filtry", brak przycisków diagnostycznych, pełna lista pozycji
- [ ] Sumy (robocizna, marża, bilans, „Razem") nie drgnęły przy żadnym filtrze

## sheet-column-mapping — ręczne wskazanie kolumny arkusza (EX-690)

**In review** — tsc czysty, eslint bez nowych błędów, `pnpm test` 2228, `pnpm build` przechodzi.
Stan po `94ffefd0`.

Setup: dev DB (5433), zalogowany jako OWNER. Inwestycja 84 (Żupnicza) jest dowodem z natury —
jej arkusz rozbija „Wartość netto" na dwie kolumny, więc dopasowanie po nazwie tam nie działa.

- [ ] Inwestycja 84: „Pobierz z arkusza Google…" mówi wprost, której kolumny nie rozpoznał, i pokazuje listę kandydatów z literami kolumn i nagłówkami
- [ ] Wskazanie kolumny `S` przelicza podgląd w tym samym oknie i odblokowuje „Pobierz i zastąp"
- [ ] Po zamknięciu okna bez pobierania „Porównaj z arkuszem" na tej samej inwestycji działa bez ponownego wskazywania
- [ ] Linijka „Kolumnę „…" wskazałeś ręcznie" jest widoczna, a „Usuń wskazanie" przywraca odmowę odczytu
- [ ] Po poprawieniu nagłówka w arkuszu na „Wartość netto" odczyt idzie po nazwie, mimo zapisanego wskazania na inną kolumnę
- [ ] Wskazanie zapisane na jednej inwestycji nie zmienia niczego na drugiej
- [ ] Brakująca kolumna opcjonalna (np. „komentarz") NIE blokuje pobrania — pick stoi w bloku „Czego nie odczytaliśmy"
- [ ] Arkusz nieudostępniony kontu serwisowemu: okno mówi, komu go udostępnić, a przycisk kopiuje adres
- [ ] Śmieciowy identyfikator arkusza: komunikat o nieistniejącym arkuszu, bez rady „spróbuj później"
- [ ] Arkusz bez zakładki `kosztorys_robocizny`: komunikat mówi o zakładce, nie o nagłówkach

## kosztorys-terminology — rename identyfikatorów Polish→English (EX-548)

**In review** — bramka całodrzewowa zielona (`typecheck`, `lint` z aktywnym guardem, `test` 2268,
`test:parity`, `test:integration`, `build`). Stan po `24de9993`. Slice nie zmienia zachowania:
weryfikacja polega na potwierdzeniu, że nic nie drgnęło.

Setup: dev DB (5433), zalogowany jako OWNER, inwestycja z wypełnionym kosztorysem i zaksięgowanymi
transferami LABOR_COST/RABAT (rekoncyliacja ma co porównywać).

- [ ] Panel Podsumowanie renderuje te same złotówki co przed zmianą — wiersze Robocizna / Rabat / Łącznie / Pozostało do zapłaty
- [ ] Blok rekoncyliacji na stronie inwestycji pokazuje ten sam werdykt co przed zmianą, i przy zgodności, i przy rozjeździe
- [ ] Wykres kołowy sekcji przełącza się między „Przedmiar" a „Wykonane" i rysuje te same udziały (unia stringowa zmieniła wartości, etykiety zostały)
- [ ] Formularz wydatku i transferu wewnętrznego pokazuje saldo kasy źródłowej i przelicza „Saldo po transakcji"

## kosztorys-column-order — okno „Ustaw kolejność kolumn" (EX-692)

**In review** — bramka całodrzewowa zielona (`typecheck`, `lint` bez nowych błędów, `test` 2289,
`build`). Stan po `f5ec376d`.

Setup: dev-owy edytor kosztorysu z rozpisanymi etapami (żeby grupa etapów miała co przenosić),
zalogowany jako OWNER. Kolejność siedzi w `localStorage` pod `kosztorys-v2-col-order`.

- [ ] Ręczny wpis `{"price": -1}` w localStorage pod `kosztorys-v2-col-order` przestawia „Cena j.m." na początek ruchomej części gridu po odświeżeniu
- [ ] Link do widoku inwestora z tym samym wpisem pokazuje kolejność arkuszową
- [ ] Menu „Kolumny" → „Ustaw kolejność kolumn…" otwiera okno; menu zamyka się, okno zostaje i ma focus
- [ ] Przeciągnięcie „Cena j.m." nad „Przedmiar" przestawia kolumny w gridzie po zamknięciu okna
- [ ] Przeciągnięcie grupy etapów przenosi wszystkie kolumny etapów blokiem
- [ ] „Opis prac" i kolumna akcji nie mają uchwytu i nie dają się przeciągnąć
- [ ] Kolumna ukryta w pickerze jest na liście wyszarzona; po przeciągnięciu i pokazaniu jej w pickerze ląduje na ustawionym miejscu
- [ ] Kolejność przeżywa `F5` i jest ta sama na innym kosztorysie
- [ ] „Przywróć domyślną kolejność" wraca do układu arkusza
- [ ] Widok inwestora (link udostępniony) pokazuje kolejność arkuszową niezależnie od ustawień właściciela
- [ ] Zmiana kolejności nie psuje przeciągania krawędzi kolumny (szerokości) ani sortowania z nagłówka

## kosztorys-editor-hook-split — rozbicie hooka edytora (EX-521)

**In review** — bramka całodrzewowa zielona (`typecheck`, `lint` bez nowych błędów, `test` 2313,
`test:integration` 118, `test:parity`, `build`). Stan po `5b72e785`. Slice nie zmienia zachowania:
weryfikacja polega na potwierdzeniu, że nic nie drgnęło. Kolejność sekcji i pozycji przeszła na
serwer (fazy 1–2), reszta to przeprowadzka logiki bez zmiany działania.

Setup: baza testowa (5435) z zasianym kosztorysem (`pnpm seed:kosztorys:test`), zalogowany jako
OWNER. Do A/B wydajności drugie okno na `staging`.

- [ ] ▲▼ na sekcji przestawia ją i przeżywa odświeżenie
- [ ] „Wstaw sekcję powyżej/poniżej" ląduje w dobrym miejscu i przeżywa odświeżenie
- [ ] Wstawienie sekcji w środku, potem ▲▼ na późniejszej — zamieniają się właściwe dwie sekcje
- [ ] Cofnięcie przestawienia sekcji przywraca poprzednią kolejność
- [ ] ▲▼ na pozycji przestawia ją w obrębie sekcji i przeżywa odświeżenie
- [ ] „Wstaw pozycję powyżej/poniżej" ląduje w dobrym miejscu i przeżywa odświeżenie
- [ ] Sortowanie po kolumnie → „Zapisz kolejność" → odświeżenie: kolejność zapisana
- [ ] Cofnięcie po zapisie kolejności przywraca poprzednią, ponowienie ją przywraca
- [ ] Pisanie po kilku komórkach i jedno cofnięcie zwija się w jeden krok, jak wcześniej
- [ ] Cofnięcie przywraca wszystkie pola edycji obejmującej kilka kolumn
- [ ] Szukanie + filtr warunkiem + sortowanie kolumną składają się jak wcześniej
- [ ] Zmiana współczynnika globalnego przelicza grid i sumy, i przeżywa odświeżenie
- [ ] Zmiana VAT, trybu rozliczenia i stawki materiałów działa jak wcześniej
- [ ] Rabat globalny i rabat procentowy działają jak wcześniej, razem z cofnięciem
- [ ] Dodanie etapu, zmiana nazwy, planu narzędziowego i pracownika, usunięcie — jak wcześniej
- [ ] Usunięcie etapu z zapisanym postępem nadal ostrzega/blokuje jak wcześniej
- [ ] Szukanie, sortowanie, zwijanie sekcji i „Zresetuj filtry" działają jak wcześniej
- [ ] Prowadnica przy zmianie szerokości kolumny nadal chodzi za kursorem
- [ ] Podgląd dla inwestora pokazuje ceny dla inwestora bez kolumn współczynników, niezależnie od `localStorage`
- [ ] A/B wydajności: kosztorys 1000+ pozycji na tej gałęzi i na `staging`, ciągłe pisanie w komórce — bez dodatkowych zacięć

## client-preview-settings — ustawienia podglądu inwestora (EX-695)

**In review** — bramka całodrzewowa zielona (`typecheck`, `test` 2419, `build`; `lint` bez nowych
błędów — dwa istniejące dotyczą nieśledzonego `test.js`). Stan po `d50c164a`.

Setup: dev DB (5433), zalogowany jako OWNER, inwestycja z wypełnionym kosztorysem, w tym co najmniej
jedna pozycja bez przedmiaru i bez etapów. Migracja `20260815_0_add_kosztorys_client_view` nałożona
lokalnie.

- [ ] „Opcje" → sekcja „Inwestor" ma trzy pozycje: „Widok inwestora", „Ustawienia podglądu…", „Udostępnij"
- [ ] Odznaczenie dwóch kolumn i „Zapisz" — po odświeżeniu linku `/k/<token>` obu nie ma, a kwoty w podsumowaniu się nie zmieniły
- [ ] Zamknięcie okna bez zapisu nie zmienia nic w linku inwestora
- [ ] Odznaczenie „Ukryj pozycje bez przedmiaru i bez wykonanej pracy" przywraca puste pozycje w linku, kwoty dalej bez zmian
- [ ] Licznik przy tym polu zgadza się z liczbą takich pozycji w całym kosztorysie (nie tylko widocznych)
- [ ] „Zapisz jako domyślne" — inna inwestycja, która nie ma własnych ustawień, startuje z tego zestawu
- [ ] „Udostępnij" otwiera się na kroku ustawień za każdym razem, także gdy link już istnieje; „Dalej" zapisuje i pokazuje ekran linku
- [ ] Ekran linku działa jak wcześniej: wygeneruj / kopiuj / wygeneruj nowy / wyłącz link, z potwierdzeniem wyłączenia
- [ ] „Widok inwestora" i link tokenowy wyglądają identycznie — żadnej dodatkowej belki ani panelu na `/podglad-inwestora/<id>`
- [ ] MANAGER: zapis ustawień odmawia komunikatem „Tylko właściciel może zmieniać ustawienia podglądu inwestora"

## drop-stage-percent-columns — usunięcie kolumn „% wykonania" per etap (EX-703)

**Done** (EX-703 zamknięty 2026-08-17) — bramka całodrzewowa zielona (`typecheck`, `test` 2302,
`build`; `lint` bez nowych błędów — trzy istniejące dotyczą nieśledzonego `test.js` i
`use-latest-request.ts`). Stan po `98b6c03a`; od `f7ac3163` scalone z `kosztorys-editor-hook-split`.

Setup: dev-owy edytor kosztorysu z rozpisanymi etapami, zalogowany jako OWNER. Do ostatniego punktu
wpisz ręcznie `table-columns:kosztorys-progress-display` = `"percent"` w `localStorage` (klucz po
usuniętej osi — sprawdzamy, że nie wywraca edytora).

- [ ] Menu „Kolumny" ma tylko sekcje „Kwoty", „Warstwy" i „Kolumny" — żadnej sekcji „Etapy"
- [ ] Przełączanie „Kwoty" (Netto/Brutto) i „Warstwy" (Praca/Postęp) działa jak wcześniej
- [ ] Nigdzie nie ma kolumny „Etap N %" — ani w widoku inwestora, ani „Z narzędziami", ani „Bez narzędzi"
- [ ] „Etapy — kwota netto" dalej widoczne domyślnie, „…brutto" dalej domyślnie ukryte; oba dają się przełączać w pickerze, a „Praca" dalej je chowa
- [ ] Kolumna „% wykonania (względem przedmiaru)" dalej się renderuje i dalej świeci na czerwono, gdy suma etapów przekracza Przedmiar
- [ ] Usunięcie etapu czyści jego kolumny bez zostawiania pustej szerokości
- [ ] Podgląd inwestora (`/podglad-inwestora/<id>`) renderuje się bez kolumny procentowej, a okno ustawień podglądu nie oferuje już „Etapy — % wykonania"
- [ ] Kosztorys z zapisanym ptaszkiem przy tej kolumnie otwiera się bez błędu
- [ ] Ze starym wpisem `"percent"` w localStorage edytor ładuje się normalnie i pokazuje kolumny kwot etapów

## filtry-problemy — grupa „Problemy" w menu Filtry

**In review** — bramka całodrzewowa zielona (`typecheck`, `test` 2362, `build`; `lint` bez nowych
błędów — trzy istniejące dotyczą nieśledzonego `test.js` i `use-latest-request.ts`).

Setup: dev-owy edytor kosztorysu (`INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`),
zalogowany jako OWNER. Przed sprawdzaniem wyczyść jedną „Cena j.m.", zawyż jedną cenę wykonawcy
powyżej 80% ceny dla inwestora i dodaj etap bez wybranego sposobu rozliczenia.

- [ ] Na pasku narzędzi nie ma już żadnego przycisku diagnostyki — „bez ceny j.m." i „z pomiarem do rozpisania na etapy" są wyłącznie w „Filtry"
- [ ] Menu „Filtry" ma dwie grupy przełączników: „Prace" (ptaszek = widoczne) i „Problemy" (ptaszek = zostaw wyłącznie te)
- [ ] W „Problemy" widać wyłącznie wiersze z licznikiem > 0; przy czystym kosztorysie całej grupy nie ma
- [ ] Przycisk „Filtry" ma czerwony trójkąt, zanim cokolwiek kliknięto — świeci go każdy z sześciu problemów, „z pomiarem do rozpisania na etapy" włącznie
- [ ] Na czystym kosztorysie przycisk ma zwykłą ikonę filtra
- [ ] Dwa włączone problemy pozycji dają sumę trafień, nie część wspólną
- [ ] „Pokaż etapy bez wybranego sposobu rozliczenia" zostawia wyłącznie kolumny tego etapu — ilość, wartość netto i brutto naraz; wyłączenie przywraca resztę
- [ ] Zawężone kolumny etapu zachowują czerwień i zablokowaną komórkę ilości
- [ ] Sumy wierszy i podsumowanie nie zmieniają się przy zawężeniu — to gest czytania, nie filtr danych
- [ ] Licznik przy „Filtry" rośnie po włączeniu problemu i wraca po „Zresetuj filtry", które czyści też zawężenie etapów
- [ ] Przełączanie „Inwestor" / „Z narzędziami" / „Bez narzędzi": wiersze ceny wykonawcy zostają na obu planach, a wiersze etapowe liczą tylko etapy danego widoku
- [ ] „Pozostało do rozliczenia" dalej wchodzi wyłącznie razem ze swoim wierszem, teraz włączanym z menu
- [ ] Podgląd inwestora (`/podglad-inwestora/<id>` i link tokenowy) nie pokazuje grupy „Problemy" ani trójkąta
- [ ] Menu filtrów na przelewach i w kasach działa jak wcześniej

## nomenklatura inwestora + potwierdzenie zmiany trybu

**In review** — `typecheck` i `lint` na dotkniętych plikach zielone; punkty poniżej niesprawdzone
ręcznie. Zmienia nazewnictwo UI („klient" → „inwestor", `/podglad-klienta` → `/podglad-inwestora`)
i stawia jedno potwierdzenie przed obiema zmianami trybu rozliczenia.

Setup: dev-owy edytor kosztorysu jako OWNER, panel „Podsumowanie" otwarty.

- [ ] „Opcje" → sekcja nazywa się „Inwestor" i ma pozycje „Widok inwestora", „Ustawienia podglądu…", „Udostępnij"
- [ ] „Widok inwestora" otwiera `/podglad-inwestora/<id>` i renderuje się tak jak przedtem
- [ ] Oś cen w siatce ma pozycję „Inwestor"; legenda i tipy nagłówków nie mówią już o kliencie
- [ ] Zmiana „Rozliczenie robocizny" w „Podsumowaniu" pyta „Uwaga — zmiana widoczna dla inwestora"; „Anuluj" zostawia stary tryb, „Potwierdź" zapisuje
- [ ] To samo potwierdzenie wyskakuje z „Opcji rozliczenia" — z obu miejsc jedno okno
- [ ] Zmiana „Sposób rozliczenia materiałów" (brutto ↔ netto) pyta tak samo, z obu miejsc
- [ ] Poprawienie „Stawki VAT na materiały" wewnątrz trybu netto zapisuje się BEZ pytania
- [ ] Ctrl+Z po potwierdzonej zmianie trybu cofa ją bez pytania
- [ ] Podgląd inwestora nie pokazuje żadnego z tych przełączników ani okna

## filtry-problemy — osobny przycisk „Problemy" (fazy 5–7)

**In review** — bramka całodrzewowa zielona (`typecheck`, `test` 2379, `build`; `lint` bez nowych
błędów — te same trzy istniejące). Domyka zmianę powyżej: zatrzask poprawianych pozycji z jawnym
odświeżeniem, wyjście „Problemów" z „Filtrów" na własny przycisk z pojedynczym wyborem i przejście
do widoku, którego problem dotyczy.

Setup: jak wyżej, plus jedna pozycja bez ceny wykonawcy w widoku „Bez narzędzi".

- [ ] Pasek narzędzi ma osobny przycisk „Problemy" z czerwonym trójkątem; przy czystym kosztorysie przycisku nie ma wcale, a „Filtry" nie ma już grupy „Problemy"
- [ ] Włączony problem robi z przycisku „Problemy (1)" w czerwieni; drugi wybór zastępuje pierwszy, ten sam wybrany ponownie wyłącza
- [ ] Wybór „ze zbyt wysoką stawką wykonawcy w widoku bez narzędzi" przełącza siatkę na „Bez narzędzi" i odsłania kolumny wykonawcy
- [ ] Ręczne przełączenie osi cen po takim wyborze zostaje — problem dalej zawęża, widok się nie cofa
- [ ] Wyłączenie problemu przywraca widok sprzed wyboru; „Zresetuj filtry" też
- [ ] Problem bez planu („bez ceny j.m.", etapowe) zostawia widok tam, gdzie był
- [ ] Poprawiona pozycja zostaje na ekranie do czasu kliknięcia „Odśwież — ukryj poprawione"; pozycja ta znika dopiero wtedy
- [ ] „Odśwież" widać w menu wyłącznie przy włączonym problemie
- [ ] Stawka i mnożnik wykonawcy słuchają klawiatury siatki — Enter zatwierdza i schodzi niżej, Escape porzuca, strzałki wychodzą z komórki

## sortowanie-kolumn-spojne — sortowanie w każdej kolumnie z danymi

**Zarchiwizowane** (`context/archive/2026-08-17-sortowanie-kolumn-spojne/`) — wszystko
zautomatyzowane zielone (tsc 0, eslint 0 na zmienionych plikach, 2419 testów). Sortowanie przestaje
zależeć od tego, którego nagłówka kolumna użyła: klucze dostają etapy
(ilościowo i wartościowo netto/brutto), „Komentarz", „Źródło ceny wykonawcy" i „Mnożnik". Bez
sortowania zostają tylko „akcje" i przerwa między warstwami — nie ma w nich czego porównywać.

Setup: baza testowa 5435 z rozpisanym kosztorysem (co najmniej dwa etapy, oba z przypisanym
rozliczeniem, oraz jedna pozycja z rabatem kwotowym, jedna z pustym „Przedmiarem" i kilka bez
komentarza).

- [ ] „Komentarz" sortuje w obie strony, a pozycje bez komentarza siedzą **na dole** w obu
- [ ] „Przedmiar" z jedną wyczyszczoną komórką nadal sortuje liczbowo (9 poniżej 10, nie odwrotnie)
- [ ] „Źródło ceny wykonawcy" rosnąco: automatyczne → własny mnożnik → kwota stała, na obu widokach wykonawcy
- [ ] „Mnożnik" sortuje liczbowo, a wiersze z „—" lądują na dole w obu kierunkach
- [ ] Menu etapu sortuje po jego ilości, a zmiana nazwy / usunięcie / rozliczenie / pracownik dalej działają
- [ ] „Zapisz kolejność" pod sortowaniem etapu zapisuje tę kolejność i przeżywa wyczyszczenie sortowania
- [ ] Usunięcie sortowanego etapu czyści sortowanie zamiast zamrozić wiersze
- [ ] Kolumna „netto" etapu sortuje po jego wartości, a „brutto" układa wiersze tak samo
- [ ] Przy rabacie kwotowym posortowana kolejność zgadza się z kwotami wypisanymi w komórkach
- [ ] Nagłówek etapu wartościowo dalej zawija nazwę i pokazuje podpowiedź, a przełącznik osi kwot dalej chowa grupę
- [ ] W podglądzie inwestora nagłówki etapów (i wartości etapów) to zwykłe etykiety, bez menu

## EX-713 / EX-714 — pasek aktywnych filtrów i trzy nowe pary warunków

**In review** — automaty zielone (tsc 0, eslint 0 na zmienionych plikach, `pnpm test` bez nowych
błędów: dwa istniejące pady dotyczą `LABOR_COST` / `RABAT` w dialogu transferów i są sprzed tej
zmiany). Wszystko, co skraca siatkę, dostaje swój chip pod paskiem narzędzi; rejestr rośnie o rabat,
źródło stawki wykonawcy i komentarz.

Setup: baza testowa 5435 z rozpisanym kosztorysem (`pnpm seed:kosztorys:test`), w nim co najmniej
jedna pozycja z rabatem, jedna z ręczną stawką wykonawcy, jedna z komentarzem i kilka bez.
Zalogowany jako OWNER.

- [ ] Przy czystym kosztorysie paska chipów nie ma wcale; odznaczenie czegokolwiek w „Filtrach" wywołuje go pod paskiem narzędzi
- [ ] Chip filtra mówi „Ukryto: …", chip problemu „Tylko: …", a X przy każdym zdejmuje dokładnie jego
- [ ] Zwinięte sekcje to **jeden** chip z liczbą, a jego X rozwija wszystkie
- [ ] Wpisana fraza ma swój chip; jego X czyści też pole „Szukaj"
- [ ] „Wyczyść wszystko" pojawia się od dwóch chipów i zdejmuje wszystko naraz — łącznie z frazą; sortowanie zostaje
- [ ] Filtry ustawione wczoraj wracają po przeładowaniu i pasek mówi o nich od razu, bez otwierania menu
- [ ] Przy kilkunastu chipach pasek zawija się na kolejne linie — żaden chip nie ucieka za prawą krawędź
- [ ] Przy włączonym filtrze zwinięta sekcja rozwija się sama, a po zdjęciu filtra znów jest zwinięta
- [ ] „Filtry" mają nowe pary: rabat, źródło stawki wykonawcy, komentarz — każda po dwie pozycje
- [ ] Para rabatowa znika z menu po włączeniu rabatu globalnego, a pozycja z rabatem 0 zł liczy się jako „bez rabatu"
- [ ] Pary o stawce wykonawcy widać tylko na widoku, którego dotyczą; przełączenie osi cen **nie** zabiera już włączonego filtra z menu ani z paska
- [ ] „Sekcje z rabatem" / „bez rabatu" zwijają sekcje, a pary o stawce i komentarzu nie mają w tej liście własnego wiersza
