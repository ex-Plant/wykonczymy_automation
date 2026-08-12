# Manual verification

One living checklist for every slice — the project's QA registry. Each `##` section is a slice/change; tick boxes by hand (or point an agent at a section: "drive these checks with Playwright and report" — the `verify-manual-checks` skill) as you verify. Lives in `context/foundation/` (not the change folder) so it survives `/10x-archive` and never freezes stale. A slice with unticked boxes here is **not** `Done` — manual checks are a hard blocker (see `/10x-implement`). Not gated by CI.

**Run against the isolated test DB, not the dev DB.** Manual checks mutate data, so point the app at the `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, `wykonczymy-test`) — the same DB the E2E suite uses — never the dev DB (5433, holds un-dumped local work) and never prod. Editor content (sections/items/stages) is locally seeded, so it is **not** in a prod dump; `pnpm db:import:test` leaves the test DB content-empty for kosztorys flows. Seed it separately: `perf-seed-kosztorys.ts` for a synthetic set (no external deps) or `seed-kosztorys.ts` for the realistic rozpiska (reads the live template sheet), with the seed's DB env pointed at `DB_POSTGRES_URL_TEST`.

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

- [ ] **Discount columns hidden in subcontractor views.** In **Klient** view the per-item rabat columns render; switch to **Z narzędziami** / **Bez narzędzi** → the rabat columns disappear entirely.
- [ ] **Subcontractor prices are gross of rabat.** A row carrying a per-item rabat prices at full net in the two subcontractor views (no rabat subtracted); the same row in Klient view shows the discounted net. Section subtotals and „Suma" match (subcontractor total ignores rabat).
- [ ] **Percent tool disabled while an amount „Rabat całościowy" is active.** Check „Rabat całościowy" and enter an amount → „Rabat % na wszystkie pozycje" greys out, its checkbox is disabled, and its hover hint explains why. Uncheck „Rabat całościowy" → the percent checkbox re-enables.

### Phase 1: Percent bulk-apply tool

- [ ] **Apply 10% → every row shows 10% rabat; persists after reload.** Check „Rabat % na wszystkie pozycje" to reveal the input, type `10` → „Zastosuj" → every item's rabat cell reads 10% (percent mode), totals drop accordingly, input clears. Reload → the per-item rabaty persist.
- [ ] **Overwrite check.** Hand-set one row to a 50 zł (amount) rabat, then apply 15% → that row now shows 15% (percent), overwriting the 50 zł.
- [ ] **Invalid input rejected.** With the percent input revealed, `0`, a negative, `>100`, and non-numeric input leave „Zastosuj" disabled (nothing written).

### Phase 2: Amount-only stored discount

- [ ] **„Rabat całościowy" is a checkbox → amount only.** Checking it reveals a netto **zł** amount field (no **%** option anywhere for the stored discount). Setting e.g. `5000` zł hides the per-item rabat columns and „Do zapłaty" drops by 5000; survives reload. Unchecking clears the discount.
- [ ] **Version restore keeps the live amount discount.** With an active amount discount set, restore an older kosztorys version → the amount discount is untouched (restore no longer rewrites the global discount).

## etap-tool-plane (EX-565) — per-etap rozliczenie plane + view-independent subcontractor settlement

**In review** — automated checks green (tsc, full unit suite, lint, webpack build; Turbopack build is blocked only by the worktree's symlinked `node_modules`). Manual boxes below **not yet driven**. Gives each etap a `plane` (z/bez narzędzi, `null` = defaulted-to-z-narzędziami + warned) and rebuilds „Podsumowanie podwykonawców" as ONE view-independent settlement — each etap valued at its own plane's price, split + razem, one shared wypłaty pool. Klient view + client share must stay byte-for-byte unchanged.

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
- [ ] Klient view shows every etap's values as before
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
render only in Klient, because Przedmiar has no plane. Klient is unchanged. Supersedes EX-565's
Phase 4 boxes above.

Setup: **5435 test DB** (see intro), OWNER login, a kosztorys with ≥2 etapy on different planes plus
one etap with **no** rozliczenie picked, and at least one pozycja with a rabat.

### Phase 1: Pomiar liczony po planie

- [ ] In Z narzędziami, „Pomiar razem" in the „Razem" row equals the hand-summed ilości of the z-narzędziami etapy only; same for Bez narzędzi
- [ ] „Razem Netto" in Z + „Razem Netto" in Bez equals „Suma wykonanej pracy" (razem) from „Podsumowanie podwykonawców"
- [ ] Each side's „Razem Netto" equals its own row in „Podsumowanie podwykonawców" (Z / Bez) to the grosz
- [ ] Klient view's Pomiar and Razem are unchanged from before the change (compare against Przedmiar-based figures)

### Phase 2: Grid pokazuje tylko rachunek jednej ekipy

- [ ] In a subcontractor view the out-of-plane etapy have **no** columns at all (no „nie dotyczy" cells)
- [ ] An etap with no rozliczenie picked appears in **neither** subcontractor view and shows no wrench icon in its header
- [ ] In Klient, an etap with no rozliczenie has its ilość cells **locked** (typing does nothing) and unlocks the moment a rozliczenie is picked
- [ ] In Klient, an etap with no rozliczenie has its **whole** block on a red tint — header plus every cell of its ilość / netto / brutto / % columns; picking a rozliczenie clears the tint instantly
- [ ] The red tint does not bleed into the neighbouring etapy's columns and does not fight the „Razem" row's own styling
- [ ] „Wartość netto/brutto przedmiar", „Pozostało", „% wykonania" are absent in both subcontractor views and present in Klient
- [ ] „Razem Netto/Brutto" header reads „— po rabacie" in Klient and „— do zapłaty ekipie" in a subcontractor view
- [ ] Typing into an etap ilość cell drops no characters (no cell remount after the column rebuild)

### Phase 3: Rabat i podpowiedzi

- [ ] Klient Podsumowanie's robocizna figure is identical whether the panel was opened from Klient directly or after switching from a subcontractor view and back
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
a share token for the same investment so `/podglad-klienta/<id>` (or `/k/<token>`) can be opened in a
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

Cena wykonawcy nie może przekroczyć 80% ceny klienta — zapis jest blokowany, komórka czerwienieje.
To jedyny werdykt: bursztynowy stopień „powyżej stawki z globalnego mnożnika" został wycofany
(właściciel, 2026-07-28), bo zapalał się na zwykłych wierszach i kolor przestawał cokolwiek znaczyć.
Setup: kosztorys z wypełnionymi cenami klienta, globalny mnożnik „z narzędziami" wyraźnie poniżej 0,8
(np. 0,65), oba widoki wykonawcy dostępne z przełącznika.

**Zaakceptowane ryzyko (właściciel, 2026-07-27):** inwestycja, której globalny mnożnik JUŻ przekracza
0,8, zapali każdy wiersz „auto" na czerwono — „niech się świeci", to nie jest usterka.

- [ ] Widok „z narzędziami", tryb „kwota stała": kwota powyżej 80% ceny klienta nie zmienia wiersza — komórka czerwienieje i pokazuje tooltip z maksymalną kwotą; poprawna kwota kasuje czerwień
- [ ] Kolumna „Mnożnik" w trybie „własny mnożnik": mnożnik powyżej 0,8 zostaje odrzucony tak samo
- [ ] Wyjście z komórki (blur) po odrzuconym wpisie gasi czerwień i tooltip, a wiersz wraca do poprzedniej wartości — i mówi o tym toast „Cena odrzucona — przywrócono …"
- [ ] Niedokończony wpis („1e") cofa się po wyjściu BEZ toasta — ogłaszamy odrzucenie, nie każdą literówkę
- [ ] Kwota stała powyżej stawki z globalnego mnożnika, ale poniżej 80%, wpisuje się normalnie i NIE zostawia po sobie żadnego koloru ani wykrzyknika — nigdzie w tabeli nie ma już żółtego
- [ ] Sumy w „Podsumowaniu" wykonawcy są identyczne jak przed zmianą
- [ ] Obniżenie „Cena j.m." klienta na tyle, by istniejąca kwota stała przekroczyła 80%, zapala „Cenę" na czerwono po powrocie do widoku wykonawcy — mimo że nikt nie tknął kolumn wykonawcy
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
- [ ] Ujemna kwota („-50") jest odrzucana tak samo jak przekroczenie sufitu, również w wierszu bez ceny klienta
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
- [ ] Podgląd klienta (`preview`) nadal wycisza oba werdykty.

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
- [ ] „Bilans brutto" inwestycji 31 = −28 764,67, czyli co do grosza „Pozostało do zapłaty" brutto z „Podsumowania" tej inwestycji (ze znakiem: minus = klient winien)
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

## EX-672 — ex-672-remove-print-csv-export

Setup: local app against the 5433 dev DB, logged in as OWNER (invoice download and the owner-only
figures both need it), on an investment that has transakcje with faktury attached.

- [x] Na `/inwestycje/[id]`, `/kasa/[id]`, `/pracownicy/[id]` i `/raporty` nie ma już przycisków „Drukuj" ani „CSV" nad tabelą transakcji
- [x] „Pobierz faktury" jest na wszystkich czterech stronach i pobiera ZIP z fakturami z aktualnego filtra
- [x] Na pulpicie managera nadal **nie ma** przycisku „Pobierz faktury"
- [x] `?widok=v1` na stronie inwestycji: kafelki nadal się przełączają, przygasają po odznaczeniu, a „Bilans inwestora" przelicza się na klik
- [x] Kafelki kas i wykres sald na pulpicie nadal się przełączają
- [x] Filtry, paginacja i „Suma wybranych transakcji" działają bez zmian na wszystkich czterech stronach
- [x] Podgląd wielostronicowej faktury nadal ma własne „Drukuj" i „Pobierz wszystkie" (to inna funkcja niż usunięty druk tabeli)
