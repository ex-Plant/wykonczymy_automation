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
- [ ] Client-share view (`clientView`) renders the same derived figures without owner-only links/screams.

## kosztorys-tryb-mieszany — cash-settlement view w Podsumowaniu (slice B)

> **SUPERSEDED (2026-07-23/24, EX-536):** the **manual `C` cash input** below was **removed** — the owner flipped tryb mieszany to derive the cash (netto) part from **Σ netto wpłaty** (deposits bucketed by `vatPlane`, null⇒netto), not a typed field. Checks referencing typing `C` exercise a deleted control; do **not** run them. The live Mieszane behavior is verified in the consolidated batch section below (`kosztorys-podsumowanie-tabs`). Kept as history.

### Phase 2: Panel wiring + cash-settlement UI

- [ ] Panel opens on **Netto** by default; grid columns/toggle default unchanged (still show all).
- [ ] „Mieszana" shows netto-only waterfall + „Suma transzy" netto + the three cash rows.
- [ ] ~~Typing `C` recomputes Reszta and Razem live~~ — **removed control (see SUPERSEDED note above).**
- [ ] Netto and Brutto axes unchanged from before.
- [ ] Client preview (`clientView`) shows the block with a **disabled** input.

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
