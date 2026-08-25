---
date: 2026-08-20T13:13:58+0200
researcher: ex-Plant
git_commit: 8513eede7110fab5a9f4ca935774d4c3f3b50335
branch: kosztorys-client-view-offer-settlement-variants
repository: wykonczymy
topic: 'Tryb mieszany — każda wpłata na obu planach, jedna tabela rozliczenia'
tags: [research, codebase, kosztorys, settlement, vat-plane, deposits]
status: complete
last_updated: 2026-08-23
last_updated_by: ex-Plant
last_updated_note: 'Added follow-up research for the booking gate (wpłata plane vs settlement mode)'
---

# Research: tryb mieszany — każda wpłata na obu planach

**Date**: 2026-08-20T13:13:58+0200
**Researcher**: ex-Plant
**Git Commit**: 8513eede7110fab5a9f4ca935774d4c3f3b50335
**Branch**: kosztorys-client-view-offer-settlement-variants
**Repository**: wykonczymy

## Research Question

The spike replaced tryb mieszany's two-tor settlement with a model where every wpłata carries both
planes (`depositRowPair`: the plane it was paid on holds the amount, the other holds it crossed at
VAT), collapsing the panel into one top-down table. Before turning that into a planned change:
what else reads these figures, what does it collide with, which prior owner rulings does it touch,
and what does the test landscape owe?

## Summary

Three findings dominate.

1. **The spike broke a numeric identity nobody was watching.** Before it, tryb mieszany's closing
   figure was algebraically identical to the server-side `−balance` / `−grossBalance` — the two-tor
   arithmetic cancelled back to a face-value deduction. `computeMixedAmountDue` now deducts crossed
   wpłaty, so the panel and the investments listing name the same debt at two different amounts, and
   the panel is what the client sees. This is the plan's central decision, not a detail.
2. **The wpłaty pie and the wpłaty table are now computed by two rules from the same rows** — one
   face value, one crossed — and since the split is no longer gated on tryb mieszany (owner,
   2026-08-20) that disagreement is visible on every investment.
3. **The test suite will go green having tested nothing about the new branch.** Two files are red
   for compile reasons; once mechanically repaired they cover only the non-mixed path, and the new
   crossing primitives plus `formatNet` have zero coverage. This is `lessons.md:350` verbatim.

## Detailed Findings

### Who reads the touched symbols

Every consumer of the settlement math is a client component under
`src/components/kosztorys/summary/**`. Nothing in `src/lib/actions`, `src/app`, `src/collections`,
`src/hooks` or `src/lib/google` imports `summary-economics.ts` or `deposit-planes.ts`. The only
server-side consumers of that module are `billedMaterials` (`src/lib/queries/shape-investments.ts:11`)
and `materialsNetDiscount` (`src/lib/db/investment-financials.ts:19`) — neither touched by the spike.

- `computeAmountDue` — `src/components/kosztorys/summary/summary-panel-content.tsx:211` (sole call site)
- `computeMixedAmountDue` — `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx:94` (sole call site)
- `depositRowPair` — `src/components/kosztorys/summary/tables/deposits-table.tsx:69`
- `sumDepositPair` — `summary-panel-content.tsx:202`, `deposits-table.tsx:58`
- `bucketDepositsByPlane` — `summary-panel-content.tsx:199`, still feeding `paidNet`/`paidGross`/`depositsTotal`

The share surfaces `src/app/(share)/k/[token]/page.tsx:16` and
`src/app/(share)/podglad-inwestora/[id]/page.tsx:14` render `KosztorysEditorBody preview`, i.e. the
same panel code — they inherit the new arithmetic verbatim, with no separate code path to review.

### The second implementation of the same figure

`amountDue` is `−balance`, and `amountDue.gross` is `−balanceGross`, computed by a fully separate
server path: `src/lib/db/calculate-balance.ts:11` + `src/lib/db/gross-balance.ts:8`, assembled in
`src/lib/queries/shape-investments.ts:42,61` and rendered as „Bilans netto v2" / „Bilans brutto v2"
at `src/components/tables/investments.tsx:74,80`.

```
−balance      = materialsBilled + laborCostsNet − deposits − loss = computeAmountDue(...).net
−grossBalance = −balance + vat × (labor − discount)               = computeAmountDue(...).gross
```

The removed `computeMixedSettlement` closed at `combined.gross − paidNet − loss − paidGross`, i.e.
`combined.gross − depositsTotal − loss` — the same face-value deduction as `calculateBalance`. The
new `computeMixedAmountDue` (`src/lib/kosztorys/summary-economics.ts:150`) deducts `paidPair`, which
is not `depositsTotal`. Worked example, robocizna 1000 netto, VAT 23%, no materiały, no strata:

| wpłata 400      | panel (MIXED)               | listing v2      | rozjazd                     |
| --------------- | --------------------------- | --------------- | --------------------------- |
| oznaczona NET   | net 600 / **brutto 738**    | −600 / **−830** | 92 zł brutto (= 0,23 × 400) |
| oznaczona GROSS | **net 674,80** / brutto 830 | **−600** / −830 | 74,80 zł netto              |

Nothing polices the seam: `src/__tests__/investment-render-parity-db.test.ts:150-200` compares the
listing against the **v1 FinancialStats tiles**, never against `computeAmountDue`.

Everywhere else there is no second implementation. `src/lib/kosztorys/reconciliation.ts:70-95`
compares robocizna/rabat netto only. `deriveFinancials` sums income face value and plane-blind
(`src/lib/db/investment-financials.ts:103`). `src/lib/google/**` mirrors raw transfer rows with no
plane column. Snapshots and presets persist neither deposits nor `settlementMode` nor `vatPlane`.

### `settlementMode` and `vatPlane` outside the panel

`SettlementModeT = 'NET' | 'GROSS' | 'MIXED'` (`src/lib/kosztorys/settlement-mode.ts:13`), stored on
the investment (`src/collections/investments.ts:114`). **No server figure branches on `MIXED`.** The
one server-side branch on mode is `effectiveMaterialsNetRate`
(`src/lib/kosztorys/settlement-mode.ts:65`), where MIXED behaves exactly like NET.

**Nothing outside the summary panel reads a deposit's `vatPlane`.** Elsewhere it is stored, form-edited
and rendered as a label only (`src/collections/transfers.ts:144`, `src/lib/schemas/transfer.ts:29`,
`src/components/forms/deposit-form/deposit-form.tsx:74`, `src/components/tables/transfers.tsx:60`).

### Where a wpłata total is shown, and on which basis

| Surface                                            | file:line                                                       | Basis                                                 |
| -------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| Settlement „Wpłaty" step                           | `settlement-groups.ts:33-41`                                    | MIXED: crossed pair; else `faceValue(−depositsTotal)` |
| „Pozostało do zapłaty"                             | `settlement-groups.ts:50-57`                                    | as above                                              |
| Wpłaty list rows + „Razem"                         | `deposits-table.tsx:69,80`                                      | **crossed, in every tryb** (owner, 2026-08-20)        |
| Wpłaty netto/brutto pie                            | `summary-deposits-tab.tsx` → `chart-slices.ts:100`              | **face-value partition** (`bucketDepositsByPlane`)    |
| Investment page tile „Wpłaty" / „Bilans inwestora" | `investment-financial-fields.ts:135`, `financial-stats.tsx:117` | face value, plane-blind                               |
| Listing „Bilans netto/brutto v2"                   | `components/tables/investments.tsx:74,80`                       | face value                                            |
| Google Sheet „transfery"                           | `sheet-configs.ts:64`, `sheet-summary.ts:28`                    | face value, no plane                                  |

The pie's two wedges sum to `depositsTotal`; the table's two „Razem" cells beside it do not, and
neither wedge equals the column above it. `summary-panel-content.tsx:199,202` derives both from the
same rows by two different rules — the exact drift the `:202` comment claims to prevent.

### Prior owner rulings this change touches

Full chronology in the sub-agent report; the load-bearing ones:

- **2026-07-19** — „VAT dotyczy WYŁĄCZNIE prac (robocizna)". The netto/brutto axis belongs to the
  _cennik prac_, not the ledger; ledger actuals render face value: „Wpłaty to pieniądze już wpłacone
  przez inwestora — nie ma czego gruntować" (`kosztorys-editor-domain-notes.md:473-490`).
- **2026-07-21 (EX-536)** — the documented **exception**: „zaliczka netto czy brutto" = **obie**, both
  axes. A wpłata carries a three-state `vatPlane`, chosen per wpłata, never derived
  (`kosztorys-editor-domain-notes.md:491-505`). This is the ruling the spike builds on.
- **2026-07-23** — „brak wartości = netto"; `null` pays down the gotówka side. Flipped from an earlier
  `null → brutto` default.
- **2026-07-22** — the mixed-tryb scope lock: do **not** touch `investment-financials.ts`,
  `calculate-balance.ts`, `calculate-margin.ts` or the transactions model; **„bilans won't reconcile
  — accepted, not a bug"** (`context/archive/2026-07-22-kosztorys-tryb-mieszany/change.md:22-24`).
  Same doc: „wpłaty are subtracted AFTER grossing, never grossed", and materiały need no special case
  **only** because `Mb = Mn × (1+VAT)` under a single rate — „it stops being exact the day materiały
  carry their own VAT rate."
- **2026-08-07** — „a wpłata brutto enters at FACE VALUE, not de-grossed… dividing it by the VAT rate
  credited the client less than they actually paid." **`depositRowPair` reverses this literally**
  (`row.amount / (1 + vatRate)`), under the owner's 2026-08-20 decision. The reversal must be written
  down, or the next reader restores the old rule as a bugfix.
- **2026-08-08** — 🔴 „Pozostało brutto" is `combined.gross − paidNet`, never `toGross(outstandingNet)`;
  grossing the remainder charges VAT on materiały too (`review-gate-branch.md:54-76`, commit
  `d0512bbb`). The spike's flat-VAT crossing of the wpłaty pool is the **same defect on the other
  side of the equation** — it grosses a pool that partly paid for materiały.
- **2026-08-13 (EX-675)** — strata comes off both axes face value, unlike a rabat. Unchanged; but its
  „netto tor only" rendering rule (`settlement-groups.ts:88-91`, old) no longer has a tor to live in.
- **2026-08-12 (EX-631)** — the preview does not know the tryb; both columns stand in every tryb,
  client-facing included.

**Doc drift found:** `kosztorys-editor-domain-notes.md:491-505` calls `vatPlane` „create-only,
immutable"; `src/collections/transfers.ts:138-153` deliberately makes it editable after the fact.
The notes are wrong and must be corrected as part of this change.

### The sheet has no counterpart

No wpłaty column in the client tab (`A…AF` map, `kosztorys-editor-domain-notes.md:53-58`); `AF` is a
per-row „pozostało do rozliczenia", i.e. progress control, not a payment ledger. The `Podsumowanie`
tab is `Robocizna + Materiały = Łącznie` with no settlement waterfall. „VAT nie ma w arkuszu
odpowiednika i zawsze przechodzi z inwestycji" (`:430`). Per `lessons.md:315`, this must be stated in
the change doc so nobody later „restores parity" by deleting the apparatus.

### Test landscape

**Red now (compile):** `src/__tests__/lib/kosztorys/summary-economics.test.ts:4` and
`src/__tests__/components/kosztorys/summary/settlement-groups.test.ts:3` both import the removed
`computeMixedSettlement`; the latter also asserts the deleted two-table shape and passes `mixed:`
where `ArgsT` now takes `mixedPaid:`.

**Would go tautological if repaired mechanically** — the `lessons.md:350` trap:

- `summary-economics.test.ts:29` „faceValue is a no-VAT figure (wpłaty / korekta)" — still passes,
  still documents the pre-spike model of what a wpłata is.
- `summary-economics.test.ts:239` „Łącznie − Rabat − Wpłaty === Do zapłaty on BOTH axes" — green, and
  correct for NET/GROSS, while the MIXED composition it appears to guard has no guard at all.
- `settlement-groups.test.ts:9,30,42,122,132` — after the `mixed`→`mixedPaid` rename these cover only
  the `mixedPaid == null` branch; the per-plane „Wpłaty" line and `span: false` would be untested.
- `summary-economics.test.ts:321` „credits wpłaty brutto at face value" — **inverted** by the spike.
  Do not port it; re-assert the opposite.

**Zero coverage today:**

- `depositRowPair` / `sumDepositPair` — `src/__tests__/lib/kosztorys/deposit-planes.test.ts` covers
  `bucketDepositsByPlane` only.
- `formatNet` — `src/__tests__/lib/kosztorys/format.test.ts` tests the percent formatters only. Worse,
  `e2e/kosztorys-reconciliation.spec.ts:104` and `e2e/investments-listing-kosztorys.spec.ts:109`
  import `formatNet` **as their own oracle**, so a `formatNet` bug can never fail them — which is
  why the „−0,00" bug reached the screen.

**Parity / golden master:** `pnpm test:parity` will stay green — none of the four changed modules is
on either parity path (`financial-golden-master-db.test.ts:47-63` snapshots
`totalIncome`/`balance`/`margin`/`marginV2`/`categoryCosts`, the transactions-plane deposit sum). That
is itself the finding: a client-facing figure moved and the golden master does not notice.

**`test-plan.md` has no risk for this.** The words wpłata / deposit / settlement / Podsumowanie / VAT /
mieszany / Pozostało / Do zapłaty / strata return **zero** hits. The nearest are risk #1 („two app
surfaces disagree", `:51`) and #5 (sheet parity, `:55`). A risk must be added via `/10x-test-plan`
first — suggested shape: _„A wpłata is credited at the wrong figure because it crossed the VAT plane
— the investor is told they owe more (or less) than they do."_ Risk #1 is the one the panel↔listing
rozjazd falls under.

**`manual-checks.md` describes deleted UI** in four places: `:116` (two stacked tables in Mieszane),
`:407`/`:413` (split netto/brutto sections), `:434` (three „Razem" buckets, no per-deposit rows),
`:966`/`:968` (strata in the netto tor, hint at „Pozostało brutto"). All must be rewritten.

## Code References

- `src/lib/kosztorys/summary-economics.ts:118-132` — `computeAmountDue`, face-value deduction
- `src/lib/kosztorys/summary-economics.ts:141-154` — `computeMixedAmountDue` (new)
- `src/lib/kosztorys/deposit-planes.ts:41-63` — `depositRowPair` / `sumDepositPair` (new)
- `src/lib/db/calculate-balance.ts:11-20`, `src/lib/db/gross-balance.ts:8-15` — the server twin
- `src/components/kosztorys/summary/settlement-groups.ts:33-57` — the one-table build
- `src/components/kosztorys/summary/tables/deposits-table.tsx:58-88` — the always-on plane split
- `src/components/kosztorys/summary/summary-panel-content.tsx:199-202` — both deposit rules side by side
- `src/lib/kosztorys/format.ts:6-10` — `formatNet`, now rounding to grosze before formatting

## Architecture Insights

- **The crossing pattern is already established.** `breakdownRowPair` (materiały) is the precedent:
  ONE rate spans the bridge in both directions, and the plane a row was RECORDED on decides the
  direction. `depositRowPair` is the same shape — which is why the spike reads as a simplification
  rather than a new mechanism.
- **But the two crossings use different rates for the same reason.** Materiały cross on the persisted
  `materialsNetRate`, and where none is saved they **do not cross at all** — VAT is deliberately not a
  fallback (2026-08-07 ruling). Wpłaty now cross on flat VAT unconditionally. A wpłata that paid for
  materiały is therefore grossed by a rate that bucket never carries.
- **`vatPlane` changed status.** It used to be load-bearing in MIXED and inert elsewhere
  (`deposits-table.tsx`, old comment). After today's widening it is load-bearing in the _list_ in
  every tryb, while the _settlement_ still ignores it outside MIXED. Two rules, one field, one screen.
- **`formatNet`'s new rounding has a far wider blast radius than the panel** — 21 non-test files
  including every grid cell and the reconciliation tooltip. `reconciliation.ts` decides mismatch with
  `roundToCents` on the value while the tooltip now rounds the display, so „Różnica: 0,00" can print
  on a firing mismatch.

## Historical Context (from prior changes)

- `context/archive/2026-07-22-kosztorys-tryb-mieszany/change.md` — origin of the two tables; the scope
  lock and the „bilans won't reconcile" acceptance
- `context/archive/2026-07-26-investment-settlement-mode/change.md:24-38` — MIXED is stored and
  selectable, never derived; MIXED never screams
- `context/archive/2026-07-29-netto-expense-grossup/review-gate-branch.md:54-76` — the „never gross the
  remainder" fix, commit `d0512bbb`
- `context/archive/2026-08-19-kosztorys-client-view-offer-settlement-variants/change.md` — the pattern
  for anything investor-visible: persistent mode + „Uwaga — zmiana widoczna dla inwestora!" dialog
- `context/foundation/lessons.md:40` (test the bridge, not each plane), `:350` (a test guarding the old
  definition goes tautological), `:1286` (deleting the second plane beats testing the bridge)

## Open Questions

1. **Panel vs listing — which one is right?** The spike makes tryb mieszany's „Pozostało do zapłaty"
   disagree with „Bilans netto/brutto v2" and with the investment page. Options: (a) accept, and say so
   where the figures are read — the 2026-07-22 lock already accepted a non-reconciling bilans, though
   it was written about the v1 transactions plane, not about two v2 figures disagreeing; (b) cross the
   wpłaty in `calculateBalance`/`grossBalance` too, which breaches that lock; (c) keep the settlement
   face value and let the crossing live only in the wpłaty _list_. **Owner decision required.**
2. **The wpłaty pie.** Face-value partition beside crossed columns. Keep (it answers a different
   question — which wpłaty landed on which plane), relabel, or drop.
3. **Flat VAT vs the materiały rate.** Accepted for the spike. Note it grosses a pool that partly paid
   for materiały — the mirror of the defect fixed on 2026-08-08.
4. **The lost face-value „Razem wpłaty"** (95 580 in the owner's own data) has no column in a
   two-plane list. Restore as a third row, or drop.
5. **`computeAmountDue` for NET/GROSS** still deducts deposits face value from both axes, ignoring a
   row's `vatPlane`. Consistent with the ledger, inconsistent with the list now shown in every tryb.

## Follow-up Research 2026-08-20 (post-spike: „czy finanse się będą zgadzać")

Second pass, run against the finished spike (`0c49c46`, working tree) rather than the design: three
parallel audits — surface inventory, derived figures, tests/caching. What follows is the verdict.

### Verdict

The v2 seam itself reconciles: the listing's bilans and the panel's „Pozostało do zapłaty" are the
same `computeAmountDue` call, negated, fed matching inputs on both sides (robocizna z kosztorysu,
wpłaty `INVESTOR_DEPOSIT` niecofnięte, materiały z tych samych dwóch kubełków, strata, tryb i stawka
z tego samego rekordu). Marża (v1 i v2), rozjazd robocizny, wykres na `/inwestycje` i dashboard nie
ruszają się wcale — wpłaty nie wchodzą do żadnego z tych wzorów. Nigdzie w aplikacji nie ma sumy
sum, więc żadna suma nie miesza kwot przeliczonych z nominalnymi.

Dwie realne wady i jedna nieaktualna dokumentacja — poniżej.

### 1. Materiały schodzą dwa razy w trybie mieszanym (defekt)

`computeAmountDue` (`src/lib/kosztorys/summary-economics.ts:141`) woła
`materialsSettlementPair(billedMaterials(materials, materialsNetRate), vatRate, mode)`.
`billedMaterials` już podzieliło paragon przez `(1 + materialsNetRate)`, a `effectiveMaterialsNetRate`
zostawia tę stawkę żywą w MIXED (`settlement-mode.ts:69`) — więc gałąź MIXED dzieli całość jeszcze raz
przez `(1 + vatRate)`.

Gorzej: dzieli też kubełek `netBilled`, o którym `summary-economics.ts:57-66` i
`investment-financials.ts:87` mówią wprost, że jest **już netto i nie wolno go redukować**.

Przykład (stawka materiałów 0,23, VAT 0,08, paragon 10 000, netto 5 000): billed = 13 130,08,
MIXED netto = 12 157,48 — sam `netBilled` gubi 370,37 zł. Worked example w `change.md`
(10 000 → 9 259,26 / 10 000) tego nie widzi, bo zakłada brak stawki materiałów i pusty kubełek netto.

To jest dokładnie ta zaparkowana decyzja („jak stawka netto materiałów komponuje się z podziałem
VAT") — tyle że kod już ją podjął, i to źle.

### 2. „Pozostało do zapłaty" świeci na czerwono przy zerze (defekt, drobny)

`settlement-groups.ts:49-53` porównuje `amountDue.net > 0` bez zaokrąglenia, na figurze, która teraz
zawsze przechodzi przez `÷ (1+vatRate)`. Przy VAT 8%: Łącznie netto 1 000 zł opłacone jedną wpłatą
brutto 1 080 zł daje `+1,14e-13` → wiersz czerwony, a `formatNet` (utwardzony w tym samym spike'u)
drukuje „0,00". Wzorzec naprawy już jest w repo: `margin-actual-table.tsx:41-44` (`roundToCents`).
Przy okazji: `format.ts:6` inline'uje regułę zaokrąglania zamiast importować `roundToCents` — dwie
kopie tej samej reguły.

### 3. Jedna nazwa, dwie liczby + nieaktualny tip

- „Wydatki inwestycyjne" na liście to `billedMaterials` w kwocie nominalnej
  (`shape-investments.ts:40-43`), a „Materiały" w panelu to `materialsSettlementPair`
  (`summary-overview-tab.tsx`). W MIXED różnią się o czynnik VAT.
- `investments-header-tips.ts:10-11` — wspólna stała `BALANCE` („…plus obniżka materiałów…") wisi na
  OBU kolumnach bilansu, a jest prawdziwa już tylko dla v1: kolumna v2 nie ma członu
  `materialsNetDiscount`, liczy wyłącznie `INVESTOR_DEPOSIT`, przelicza wpłaty przez VAT i w MIXED
  degrosuje materiały.

### 4. Naprawione w trakcie tej sesji

Wykres kołowy wpłat pokazywał kwoty nominalne obok przeliczonego „Razem" — wykres usunięty w całości.
Wykres „Struktura kosztów" mieszał robociznę netto z materiałami sprzed podziału VAT — teraz bierze
`materialsPair.net` i pokazuje sam procent.

### 5. Zawężenie typów wpłat — bezpieczne dziś, nieegzekwowane w schemacie

v2 liczy tylko `INVESTOR_DEPOSIT`, v1 (`totalIncome`) wszystkie trzy. `transactions.investment_id` to
zwykły nullable FK bez CHECK; ochrona jest wyłącznie w kodzie (`validate.ts:94-95`, zeruje pole przy
KAŻDYM zapisie). Rzeczywiste wiersze `OTHER_DEPOSIT` z `investment_id` istnieją
(`context/archive/2026-08-12-ex-557-legacy-deposit-types/change.md:86-99`), ale wszystkie są
anulowane, a oba czytniki wykluczają anulowane — więc dziś zawężenie nie zmienia żadnej liczby.
Nowość jest taka, że gdyby taki żywy wiersz się pojawił, v1 i v2 rozjechałyby się **po cichu**:
wcześniej `balance` też czytał `totalIncome`, więc zgadzały się z konstrukcji.

### 6. Zaokrąglenia — czysto

`sumDepositPair` deleguje do `depositPairFromPlaneSums`, więc kubełkowanie w SQL i w TS to jedna
implementacja; jedyna różnica to `SUM(...) FILTER` na `numeric` kontra fold na floatach, mierzalna
jako **2,3e-13 zł** na netto i 0 na brutto. Żadna z tych figur nigdzie nie jest zapisywana ani
porównywana (poza defektem nr 2).

### 7. Cache — bez zastrzeżeń

`[CACHE_TAGS.transfers]` to komplet dla `fetchDepositPlaneSums`: fold czyta wyłącznie kolumny
`transactions`, a stawka VAT dochodzi później, z osobnego wpisu (`reference-data-v2`, tagowanego
`investments`), który każda zmiana stawki / trybu / stawki materiałów unieważnia własną akcją.
Wszystkie ścieżki zapisu `vat_plane` (formularz, edycja, panel admina) i anulowania rewalidują
`transfers`. Jedyna luka: tagi są tu literałem inline (`balances.ts:146`), a
`balances-cache-tags.test.ts` sprawdza tylko wyeksportowaną stałą — czyli strażnik, którego nagłówek
ostrzega „czytnik bez tagu serwuje starą liczbę i wszystkie testy przechodzą", ma obok siebie
niewidocznego czytnika.

### 8. Testy — co jest czerwone i czego brakuje

Czerwone (kompilacja / asercje):

- `summary-economics.test.ts` — importuje skasowany `computeMixedSettlement`; poza tym ~15 wywołań na
  starych sygnaturach (`combinedPair`, `computeAmountDue`). W `:496` dawna `loss` ląduje w slocie
  `mode` — strata cicho znika. Cały blok „wpłaty w kwocie nominalnej na obu osiach" (`:152-201`,
  `:243-268`) to spisana reguła, którą właściciel odwrócił.
- `settlement-groups.test.ts` — ten sam skasowany import + args na starym kształcie; asercja
  `span === true` dla „Wpłaty" to znowu stara reguła.
- `settlement-mode.test.ts` — `computeAmountDue` na starej sygnaturze → `NaN`, a `not.toBe` przechodzi
  między dwoma `NaN`.
- `shape-investments.test.ts` — trzy asercje, w tym jedna na `-0` (Vitest używa `Object.is`).
  **Zero pokrycia nowego 5. parametru** — żadne wywołanie nie podaje mapy wpłat, więc przeliczanie,
  które definiuje obie kolumny pieniężne listy, jest na tej warstwie nieprzetestowane.
- `investment-render-parity-db.test.ts` — woła `shapeInvestments` z **czterema** argumentami (czyli
  „jakby nie było żadnej wpłaty"), a `balanceGross` porównuje z `grossBalance` — funkcją bez żadnego
  produkcyjnego wywołania.

Zielone, ale nic nie strzegą:

- `financial-golden-master-db.test.ts` snapshotuje `calculateBalance` na surowych financials, czyli
  `balanceFromTransactions` — nigdy nie widział bilansu listy. Jego hash wejścia nie zawiera
  `vat_plane`, mimo że ta kolumna rusza dziś renderowaną liczbą.
- Cztery testy `balanceGross` w `shape-investments.test.ts` przechodzą tylko dlatego, że przy zerze
  wpłat nowy wzór pokrywa się ze starym — nie odróżnią już `grossBalance` od `computeAmountDue().gross`.
- `gross-balance.test.ts` strzeże martwego kodu.

Brak w ogóle:

- Sześć nowych eksportów w `deposit-planes.ts` (w tym samo przeliczanie) — zero testów.
- Zgodność panel ↔ lista trzyma się wyłącznie na konwencji „to samo wywołanie": wpłaty do panelu idą
  z `bucketDepositsByPlane(rows)`, do listy z SQL-owego `selectDepositPlaneSums`, i **nic nie
  sprawdza, że te dwie drogi dają to samo**. To jest ten workstream, który `test-plan.md:80` nazywa
  „Lock the financial core / cross-surface parity" ze statusem `not started`. Repo ma już wzorzec na
  taki strażnik: `kosztorys-tree-sql-drift.test.ts`.

## Follow-up Research 2026-08-20 (po trzecim przebiegu — listing + otwarte tematy)

Two agents, read-only, against the working tree after the MIXED→netto / materiały-face-value reversal.

### 1. Listing verdict: `/inwestycje` is NOT coherent

`balanceGross = -computeAmountDue(...).gross` mixes three planes at once:

```
amountDue.gross = laborCostsNet × (1+VAT)          // robocizna grossed
                + billedMaterials                   // NETTO price, face value on the brutto axis
                − (paidNet × (1+VAT) + paidGross)   // wpłaty crossed onto brutto
                − loss                              // face value
```

Worked example (VAT 23%, stawka 23%, robocizna 100 000 netto po rabacie, paragony 12 300 → billed
10 000, wpłaty 50 000 nieoznaczona + 12 300 brutto): `balance = −50 000`, `balanceGross = −59 200`.
The old `grossBalance` returned −73 000 on the same data.

Identity: `balanceGross = balance − [VAT × laborCostsNet − (paid.gross − paid.net)]` — it moves with
the **tagging mix of the wpłaty**, not with anything about the deal. It is not an invoice total, not a
cash figure, and not the netto bilans converted.

**Worse: for every row exactly ONE of the two bilans columns is live.** Tryb NET → the panel shows
netto only, so `balanceGross` appears on no surface; tryb GROSS → `balance` is the orphan. The listing
renders no `settlementMode` column (`InvestmentRowT` carries it, `getInvestmentColumns` never reads
it), so the reader cannot tell which half is real. The `shape-investments.ts:75-79` comment argues a
per-row blank would be unreadable — but an unlabelled wrong column is worse.

**Decision owed:** drop `balanceGross`, or show the tryb beside the pair and blank the column the
investment isn't settled on.

### 2. Panel ↔ listing plumbing: agrees, by construction, on the live column only

Same `computeAmountDue` call both sides. Inputs: robocizna netto derived twice (TS
`kosztorysClientTotals` vs SQL `selectKosztorysClientTotals` — only `pnpm test:parity` guards it);
wpłaty derived twice (`sumDepositPair`/`bucketDepositsByPlane` vs SQL `FILTER (WHERE vat_plane IS
DISTINCT FROM 'GROSS')`) but arithmetically equivalent; materiały, stawka gating, strata and VAT
identical. So no drift on the figure — the drift is that the listing publishes the hidden column too.

### 3. Header tips are now false

- `investments-header-tips.ts:9-10` — „wpłaty … transakcyjne na OBU planach, więc bilans różni się
  wyłącznie parą robocizna/rabat". False: v2 wpłaty are `INVESTOR_DEPOSIT` only AND VAT-crossed, v1's
  `totalIncome` is all three buckets at face value. Wpłaty are a second axis of v1↔v2 difference.
- `BALANCE` applied to `balance` (`:15`) — still exact for `balanceFromTransactions`, no longer the
  formula that runs for v2; „Wpłaty" there is `paidNet + paidGross/(1+VAT)`.
- `balanceGross` (`:16`) „Ten sam bilans w brutto" — wrong twice: no single conversion relates the two
  (materiały/strata face value, robocizna/wpłaty gross), and the figure is only findable elsewhere in
  tryb brutto.
- `totalInvestmentExpense` (`:23-24`, pre-existing) omits the `materialsNetBilled` bucket added at face
  value and the fact the rate goes inert in tryb brutto.

### 4. Dead / stale after the reversal

- `src/lib/db/gross-balance.ts` — dead in production; only importers are its own spec and
  `investment-render-parity-db.test.ts:21`. `calculate-balance.ts:10` still cross-references it.
- **`-0,00 zł` on the listing:** `balance: -amountDue.net` yields `-0` for a settled investment;
  `formatPLN` prints „-0,00 zł" and `BalanceCell`'s `value < 0` is false for `-0`, so it shows a minus
  without the red. `calculateBalance` returned `+0`.
- `MoneyAxisT = 'both'` is unreachable from any settlement mode; `summaryMoneyCols`/`axisShows`'
  two-column branch is dead on the settlement path (still live for the grid / stages tab).
- **Panel contradicts itself across tabs:** `materials-breakdown-table.tsx:38` gates its
  Netto/Brutto/Różnica columns on `netRate != null`, not on the money axis — tryb netto + stawka shows
  one column in Podsumowanie and three in Materiały.
- „Wydatki inwestycyjne" on the listing == the breakdown table's „Razem" Netto. Agrees; only the
  unlabelled plane is a wrinkle.

### 5. The two wpłaty sources — row sets are identical

`getDepositTransactions` (`sum-transfers.ts:315-324`) and `selectDepositPlaneSums`
(`deposit-plane-sums.ts:24-33`): same table, same `type = 'INVESTOR_DEPOSIT'`, same
`cancelled IS NOT TRUE`, no date scoping, equivalent plane rule. Both cached on `CACHE_TAGS.transfers`.
Both then apply the SAME crossing function (`sumDepositPair` delegates to `depositPairFromPlaneSums`),
so the crossing half cannot drift. Drift surface = bucketing + WHERE only.

Real divergence risks: a third `vat_plane` enum value (SQL edit would have no TS twin to break);
numeric-vs-float summation in the last bits (same class as the `roundToCents` fix at
`settlement-groups.ts:54`); an investment missing from the listing's map silently reads `NO_DEPOSITS`
= 0 zł, a failure the panel cannot express; two `unstable_cache` entries under one tag can skew.

**Cheapest guard:** `src/__tests__/lib/db/deposit-plane-sums.test.ts`, modelled on
`deposit-transactions-where-scope.test.ts` (same `describe.skipIf(!ENV_READY)` marker → joins the
pre-push integration gate for free). One fixture set (NET, GROSS, null-plane, cancelled,
COMPANY_FUNDING, a deposit on a second investment), one assertion: SQL row === `bucketDepositsByPlane`
of `getDepositTransactionsForInvestment`. ~45 lines, pins WHERE and bucketing without restating either.
The `kosztorys-tree-sql-drift` regex shape does NOT fit — that catches a missing column, not two
disagreeing summation rules.

### 6. Test landscape (current tree)

`tsc --noEmit`: **30 errors, all in specs**, none in source. **43 failing tests.**

Red and REVERSED (delete, don't repair):

- `summary-economics.test.ts:272-372` — whole `computeMixedSettlement` block. Two cases encode exactly
  what today reversed: `:322` asserts a wpłata brutto at face value (`not.toBeCloseTo(600 − 200/1.23)`
  is now the CORRECT answer) and `:329-347` „extra złoty brutto lowers netto by exactly that złoty"
  (now `100/1.23`).
- `settlement-groups.test.ts:53-118` — two captioned groups; `buildSettlementGroups` returns one.
  `:22` „Wpłaty carry no VAT: one merged cell" — wpłaty now carry a pair, no `span`.
- `settlement-mode.test.ts:13,51` — `MIXED → 'both'`, and MIXED ≠ NET axis.

Red but merely STALE (signature churn — wrap in `faceValue(...)` and they pass unchanged):
every `computeAmountDue(1000, 300, …)` / `combinedPair(1000, <number>, vat)` call; `settlement-mode.test.ts:61`.

Green but no longer guarding:

- `shape-investments.test.ts` `balanceGross` cases (`:180,:213,:246,:336`) pass only because every
  fixture has zero wpłaty — the one case where old and new formulas coincide. The new plumbing has
  **no unit coverage at all**. `:55`/`:312` fail (still expect `balance` from `totalIncome`), `:64`
  fails on `-0`.
- `gross-balance.test.ts` — all green, guards a dead module.
- `financial-golden-master-db.test.ts` — structurally unaffected, and that's the problem: `balance` is
  computed INSIDE the spec via `calculateBalance` (`:249`), no `balanceGross`, no plane field. Zero
  coverage of the v2 bilans, the crossing, or the SQL fold. Its `:238` „Mirrors shapeInvestments()"
  comment is now false.
- `settlement-mode.test.ts:21-23` „never yields a hidden-money axis" is trivially true; the file's
  premise comment `:9-10` („the panel has no such projection") is factually false —
  `summary-overview-tab.tsx:84` reads it.
- `deposit-planes.test.ts:10-11` header names a target that no longer exists.

Untested and moving money on screen: 7 of 8 runtime exports of `deposit-planes.ts` —
`depositRowPair`, `isOffPlaneDeposit`, `offPlaneDeposits`, `settledPlaneAmount`, `NO_DEPOSITS`,
`depositPairFromPlaneSums` (**the listing's bilans**), `sumDepositPair` (**the panel's „Wpłaty"**).
`selectDepositPlaneSums`: zero coverage. `buildSettlementGroups`: sole export, all 9 specs red.

**`investment-render-parity-db.test.ts` fails by construction, and one break is silent:** `:152-157`
calls `shapeInvestments` with FOUR args — the new fifth `depositPlaneSumsRecord` defaults to `{}`, so
every investment resolves to `NO_DEPOSITS` and the listing side computes with zero wpłaty. tsc does
not catch it (optional param). Then `:186` compares against the v1 term-by-term balance and `:192-200`
against the deleted `grossBalance`. It must be re-pointed at `computeAmountDue`, not repaired.

**What `settlement-mode.test.ts` should assert now:** MIXED and NET map to the SAME axis and it is
`'net'` (so a re-flip to `'both'` fails loudly). The rule that actually separates them is
`isOffPlaneDeposit` — three MIXED branches exist in source: `deposit-planes.ts:65`,
`summary-overview-tab.tsx:130` (warning gate), `deposits-table.tsx:77` (subtotal table gate). That
assertion belongs in `deposit-planes.test.ts`. EX-590's „stored mode changes the reading at VAT 0%"
premise then rests on `effectiveMaterialsNetRate` alone unless `:49-52` is re-anchored on
`isOffPlaneDeposit`.

---

## Follow-up Research 2026-08-23 — the booking gate

**Git commit**: 0c49c46c · **Branch**: kosztorys-client-view-offer-settlement-variants

### Question

Before building it: what does the codebase already give us for the rule _„a wpłata's forma must match
the investment's tryb unless the tryb is MIXED"_, and what does the tryb-switch case (existing wpłaty
going off-plane retroactively) actually cost?

### Summary — six findings that shape the build

1. **There is exactly ONE UI that can create a wpłata**, and it does not have a plane field. The plane
   IS the payment method. So the rule is in practice a constraint on `paymentMethod`, not on a field
   the user picks.
2. **The investment's `settlementMode` is already on the client**, in the same array the form already
   `.find()`s for `vatRate`. A client-side gate costs zero new plumbing and zero new fetches.
3. **The server has no such thing in scope.** `validate.ts` — the acknowledged authority — sees only
   the investment _id_. Enforcing there means an async lookup inside the hook (no precedent in
   `hooks/transfers/`, one precedent one collection over) or, better, a small action-level guard on
   the `validateSourceRegister` pattern.
4. **This would be the codebase's first validation rule that compares another record's VALUE.** Every
   existing cross-entity check is existence/uniqueness only.
5. **Only tryb brutto actually loses money.** In netto and mieszany an off-plane przelew still pays
   the debt down at its `netAmount`. The gate's severity — and the warning's copy — are asymmetric,
   and the copy currently is not.
6. **The tryb switch is completely unguarded** and every ingredient to guard it is one query away.

### Detailed findings

#### A. Write paths — one door, and it derives the plane

`src/components/dialogs/deposit-dialog.tsx:13` (mounted globally in `nav/top-nav.tsx:29`) →
`deposit-form.tsx`. Plane derivation: `planeFor()` at `deposit-form.tsx:61` — `TRANSFER → 'GROSS'`,
else `'NET'`. Written at four points: default (`:89-90`), method listener (`:197`), type listener
(`:160`), draft restore (`:97`). `VatPlaneField` no longer exists.

Nothing else in the app produces an `INVESTOR_DEPOSIT`: the wydatek dialog's type list excludes
deposits (`expense-form.tsx:260` over `TRANSACTION_TRANSFER_TYPES`), stale drafts are coerced back
(`draft-type.ts:15`), the internal-transfer dialog is `REGISTER_TRANSFER` only, and no seed/E2E
fixture writes one.

Paths that CAN still produce or retag one without touching the form:

| Path                                   | plane source                                                                                                                  | tryb in scope? |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `createTransferAction` called directly | caller-supplied, `.optional()`, **no type gate** (`schemas/transfer.ts:29`)                                                   | no             |
| `updateTransferAction` called directly | caller-supplied, applied iff stored type is a deposit (`actions/transfers.ts:245,260`)                                        | no             |
| Payload `/admin`, REST, Local API      | admin-picked or **null** (field has no `defaultValue`, and unlike `amount`/`type` it is **not** `access.update: () => false`) | no             |
| `createBulkTransferAction`             | never set → **null**; schema has no field, but `type` accepts a deposit                                                       | no             |

Two pre-existing holes worth fixing in the same pass, both independent of the gate:

- **`vatPlane` is never cleared server-side for a type that must not carry it.** `validate.ts` nulls
  `sourceRegister`, `investment`, `worker`, `settled`, `netAmount` (`:95-97,115-117,122-124,140-142`)
  — there is no `vatPlane` arm. The deposit form compensates client-side and its own comment
  (`deposit-form.tsx:131-133`) names the hole.
- **`createTransferAction` spreads the raw `data`, not `parsed.data`** (`actions/transfers.ts:51-57`),
  so unvalidated keys survive the schema.

#### B. Where the tryb is, and is not

Already loaded, unused: `InvestmentRefT.settlementMode` (`types/reference-data.ts:35`), selected at
`queries/reference-data.ts:65` and mapped at `:114`. The form holds the whole `ReferenceDataT`
(`deposit-form.tsx:38`) and already does the identical lookup for the stawka:

```ts
// deposit-form.tsx:75
const rateFor = (id) =>
  referenceData.investments.find((i) => String(i.id) === id)?.vatRate ?? DEFAULT_VAT
```

A `modeFor` beside it is two lines. Cache note: `fetchReferenceData` is keyed `['reference-data-v2']`
(`reference-data.ts:152`) — reading an existing field needs no version bump; adding one would.

Not in scope anywhere on the server write path: `settlementMode` appears in **no** file under
`hooks/transfers/`, `actions/transfers*`, `schemas/transfer.ts`, `utils/validation.ts`.

#### C. The four validation layers, and which one is the authority

1. Client Zod — the deposit form reuses `expenseFormSchema` (`deposit-form.tsx:17`). Errors carry a
   `path` → **inline field errors**.
2. Action Zod — `validateAction` collapses the ZodError to `error.issues[0].message`
   (`run-action.ts:22`), path discarded → **toast only**.
3. Payload `beforeValidate` → `hooks/transfers/validate.ts`, `throw new Error(errors.join(' '))`
   (`:150`). **The authority** — the only gate the admin panel, REST and scripts also pass. Its
   messages are currently English and are toasted verbatim from the app.
4. Field-level Payload validators — **none exist repo-wide** (`validate:` has zero hits in
   `src/collections/`; no `filterOptions` anywhere either).

**Admin-panel fidelity trap:** a plain `Error` thrown from the hook is not public, so `routeError`
replaces it with „Something went wrong." + 500 — the real reason only reaches the server log. To be
legible at `/admin` the throw must be `new APIError(msg, 400)` or a Payload `ValidationError` bound to
the field. The codebase currently uses neither.

#### D. The precedent to copy

No rule anywhere compares a related record's value; every cross-entity check is existence/uniqueness,
and all of them sit in the **action**, not in Zod and not in the hook:

- `validateSourceRegister` (`actions/validate-source-register.ts:15-41`) — raw SQL via `getDb`, called
  from `actions/transfers.ts:43-48` after `validateAction` and before `payload.create`, gated on the
  same predicate the schemas use, returns `{ success: false, error: 'Kasa nie istnieje' }` → Polish
  toast. Note `:43-45`: a sufficient-funds guard was **deliberately refused** — registers may go
  negative.
- `linkSheetToInvestmentAction` (`actions/sheets.ts:88-123`) — three lookups, four Polish guards; the
  DB constraint is the backstop, the guard just makes the failure legible.
- In-hook async lookup precedent, if we go that way: `collections/cash-registers.ts:17-33`
  (`await req.payload.find(...)` + `throw new Error('<polish>')` in a `beforeDelete`). `resolveId`
  (`utils/resolve-id.ts:2`) handles the number-vs-object relationship shape and is already used inside
  a transfers hook (`sync-sheet.ts:31`).

Also relevant to the shape of the fix: the codebase has **no declarative option-narrowing**. The three
existing patterns are (1) filter the options array before rendering — and always keep the currently
selected id in it (`entity-combobox-field.tsx:65`), (2) `listeners.onChange` that resets the dependent
field (the dominant one; `deposit-form.tsx:153-166,196-198`), (3) conditional mounting plus a
server-side null (because hiding a field does not clear it — `deposit-form.tsx:131-137`).

#### E. The severity is asymmetric — and today's copy hides it

Per tryb, what a wpłata contributes to the settled plane (`deposit-planes.ts:45-48,71-79`,
`settlement-mode.ts:52-62`):

| tryb  | plane settled | gotówka                              | przelew                        |
| ----- | ------------- | ------------------------------------ | ------------------------------ |
| NET   | net           | full `amount`                        | **counts**, at its `netAmount` |
| MIXED | net           | full `amount`                        | **counts**, at its `netAmount` |
| GROSS | gross         | **nothing** — it has no brutto kwota | full `amount`                  |

So a przelew booked on a tryb-netto investment is a hygiene flag, not a lost złoty; a gotówka on a
tryb-brutto investment genuinely vanishes from the settlement. `SettlementPlaneWarning` says „nie
spłaca nic" in **both** directions (`settlement-plane-warning.tsx:16-19,45-56`) — true only for brutto.
The owner's mandate quoted in `change.md` is likewise one-directional: „Jeśli jest rozliczana brutto to
nie może tam być wpłat netto."

#### F. The tryb switch

Write paths for the mode: the purpose-built action `updateInvestmentSettlementModeAction`
(`actions/kosztorys.ts:186-202`), the create-time default (`actions/investments.ts:50`), and `/admin`.
Both UI controls (the „Opcje rozliczenia" popover, `summary-investment-settings.tsx:75-80`, and the
inline „Rozliczenie robocizny" select, `summary-overview-tab.tsx:105-114`) funnel through
`use-kosztorys-settings.ts:186-194`.

Side effects, end to end: a confirm dialog (`investor-impact.ts:6-9` — „Uwaga — zmiana widoczna dla
inwestora!", which **says nothing about wpłaty**), an undo entry, then `payload.update` +
`updateTag('collection:investments')` (`kosztorys.ts:198-200`) plus the collection's own
`revalidateTag`. **No snapshot invalidation, no transfer touched, no retagging, no recompute** — every
consequence is pure re-projection at read time. Booked wpłaty simply start being flagged.

So a creation-time gate alone cannot hold the invariant, and the red rows + warning must stay as its
complement. The switch action has no read of the existing deposits today, but `deposit-plane-sums.ts`
already buckets them per investment — counting the wpłaty a switch would strand is one call.

### Constraints from the change record (must not be re-litigated)

- Nothing crosses VAT (4th pass) — gotówka has no brutto kwota at all.
- MIXED never screams; the gate must exempt it entirely.
- Legacy untagged wpłaty scream too, are not backfilled, and go through anuluj + zaksięguj na nowo.
- **A wpłata's tag is not editable** — so refusing at creation is the only remedy the app offers, and
  the admin panel's still-editable `vatPlane` is a leak in that ruling.
- Copy uses „Gotówka"/„Przelew" (`DEPOSIT_PLANE_LABELS`), never the tryb's netto/brutto vocabulary.
- A warning must name the kwota at stake, not just a count.

### Open questions for the design

1. **Does the gate block both directions or only the one that loses money?** Blocking a przelew in
   tryb netto refuses a booking that is financially harmless today.
2. **Block, or warn-and-let-through?** The correction path is anuluj + re-księgowanie, which is
   expensive; a hard block at the door is cheaper for the owner than an undo afterwards. But a hard
   block on a wpłata that physically happened is a refusal to record reality.
3. **Which layer?** Client-only (free, bypassable), action-level guard on the `validateSourceRegister`
   pattern (Polish toast, covers the app), or the hook (covers `/admin` and REST too, costs an async
   lookup on every transfer write unless gated on the type first).
4. **The tryb switch**: count the wpłaty that would be stranded and say so in the confirm dialog, or
   refuse the switch outright while such wpłaty exist?
5. **`vatPlane` in `/admin`** — lock it like `amount`, or leave the escape hatch open deliberately?
6. Still parked from the change record: with a gate in place, **MIXED and NET differ only in whether a
   przelew is flagged**. Does the third tryb still earn its place?
