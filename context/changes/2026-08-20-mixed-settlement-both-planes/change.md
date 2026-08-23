---
change_id: mixed-settlement-both-planes
title: Tryb mieszany — każda wpłata na obu planach, jedna tabela rozliczenia
status: implementing
created: 2026-08-20
updated: 2026-08-23
archived_at: null
branch: kosztorys-client-view-offer-settlement-variants
worktree: null
---

## Notes

Each wpłata carries both planes (the amount it was paid at, plus its twin crossed at VAT), which
collapses tryb mieszany's two settlement tory into one top-down table identical in shape to the other
tryby. Spiked in the working tree on 2026-08-20; this change hardens it.

Spike removed: `MixedSettlementT`, `computeMixedSettlement`, `creditOnNet`, `grossUpRate`,
`outstandingNet` / `remainderGross`, and the two-tor layout in `buildSettlementGroups`.
Spike added: `depositRowPair` / `sumDepositPair` (`lib/kosztorys/deposit-planes.ts`),
`computeMixedAmountDue`, netto/brutto columns in the wpłaty list.

Three bugs found on the way, all in the pre-spike arithmetic — the new model dissolves all three,
and each owes a regression guard:

1. „Do zapłaty netto" subtracted a wpłata brutto at face value from a netto figure (−2399,20 where 0
   was owed).
2. „Pozostało brutto" was „Łącznie brutto − wpłaty netto", so VAT was still charged on the part
   already settled off-invoice (3 200 zł too much on 40 000 zł paid netto).
3. `formatNet` printed „-0,00" for a float residue like −7e-12.

Second spike (2026-08-20, working tree, no tests) — the decisions below, panel side only:
`materialsSettlementPair` (materiały split at VAT w mieszanym, one figure elsewhere); `combinedPair`
now takes a materiały PAIR; `computeAmountDue` absorbed `computeMixedAmountDue` and takes the wpłaty
as a pair plus the tryb; `settlementModeToGridAxis` → `settlementModeToMoneyAxis`, now driving the
panel's columns too; `buildSettlementGroups` lost its `mixedPaid`/`depositsTotal` split and takes one
crossed `paid` plus the axis; `offPlaneDeposits` + a new `SettlementPlaneWarning` (red the whole way
through, lists the offending wpłaty one by one — data and kwota paid → kwota as counted — because a
count doesn't say WHICH wpłaty to go and fix); off-plane wpłaty also turn red in the wpłaty list, and
the plane field left the transfer EDIT form. **The listing's bilans followed in the same spike** (the „olej na razie
bilans" park was lifted the same day): `balance` / `balanceGross` are now `-computeAmountDue(…).net`
/ `.gross` — the panel's own call, negated, not a second formula. New `selectDepositPlaneSums` +
`fetchDepositPlaneSums` (per-investment wpłaty bucketed by plane, INVESTOR_DEPOSIT only) feed
`shapeInvestments` through a new `depositPlaneSumsRecord` param, crossed by a new
`depositPairFromPlaneSums` that `sumDepositPair` now delegates to. `grossBalance` lost its last
non-test caller and is dead — delete it with the test rewrite. v1 (`balanceFromTransactions`) is
untouched: it stays the transactions plane, wpłaty at face value, all three deposit types.
Verified against the signed-off example — the listing returns −48 500 / −52 380, the panel's
48 500 / 52 380.

Owner decisions, 2026-08-20:

- **A wpłata comes off each column at that column's own value.** A wpłata brutto comes off brutto in
  full and off netto as its netto value (amount ÷ (1+VAT)); a wpłata netto comes off netto in full and
  off brutto grossed. This **reverses the 2026-08-07 ruling** ("a wpłata brutto enters at face value,
  not de-grossed") deliberately — that rule subtracted brutto złotys from a netto price and produced
  the −2399,20 bug below. Confirmed by the owner in his own words.
- **The panel and the investments listing must name one amount.** They disagree today: the panel
  crosses wpłaty, `calculate-balance.ts` / `gross-balance.ts` still deduct them face value. Before the
  spike the two-tor arithmetic cancelled back to face value, so the two agreed by accident. The
  listing's bilans therefore has to branch on the settlement mode — the per-investment `{rate, mode}`
  map already exists server-side (`src/lib/db/sum-transfers.ts:177,186`), so the mode is available;
  what changes is that the bilans reads it instead of summing wpłaty flat.

- **In tryb mieszany only, materiały get their own netto and brutto at the investment's VAT rate** —
  they stop standing at face value across both columns. 10 000 z paragonu → 9 259,26 netto / 10 000
  brutto at 8%. In tryb netto and brutto the Podsumowanie keeps materiały as one figure, unchanged.
  Reason:
  the company issues ONE faktura for the whole job at one rate, and materiały ride it as part of the
  service; the 23% paid at the shop is the company's own input tax and never reaches the client. The
  whole bill therefore becomes one netto price and one brutto price joined by a single rate.
- **A wpłata is on account of the whole bill** — it is never earmarked to robocizna or to materiały.
  With one rate across the bill this is arithmetically moot (every wpłata crosses at the same rate),
  which is exactly why the two rulings belong together: the "what did this wpłata pay for?" question
  disappears instead of being answered.

- **The tryb decides which columns exist.** Tryb netto shows the netto column only, tryb brutto the
  brutto column only; both columns stand in tryb mieszany alone. **Primarily for the client** — the
  owner's words — so the share/preview surfaces hide the column too. This deliberately reverses two
  rulings: 2026-08-07 ("both money columns stand in EVERY tryb, client-facing preview included; the
  tryb decides the arithmetic behind „Do zapłaty", never which columns exist", which is when
  `settlementModeToPanelAxis` was deleted) and EX-631 / 2026-08-12 ("podgląd nie zna trybu
  rozliczenia — oś kwot to preferencja czytania, a preferencja jednego czytelnika nie może decydować,
  co widzi drugi"). The mode already reaches the preview because it drives the rozpiska's columns;
  what returns is the summary panel reading it again.
- **The crossing rule is universal: a wpłata enters a column converted to that column's plane.** In
  tryb netto a GROSS-tagged wpłata enters ÷ (1+VAT); in tryb brutto a NET-tagged one enters grossed.
  Tryb mieszany differs only in showing both values at once, not in how it computes. (Corrects an
  earlier assumption in this doc that one column means nothing to cross — the plane tag is per wpłata
  and a brutto wpłata can occur in any tryb.)
- **The materiały hole in tryb netto / brutto is accepted.** Because materiały stay one figure there
  while a cross-plane wpłata still crosses at VAT, such a wpłata under-credits the client by
  VAT × (materiały part) — 740,74 zł on a 10 000 wpłata at 8%. Owner accepted it rather than splitting
  materiały in every tryb.
- **The cross-plane wpłata warning comes back**, owner-only, never on a client surface. It was deleted
  on 2026-08-19 (commit `ad61e023`) because „baner nie wnosił nic czytelnego dla właściciela"; it
  returns because it now guards a real loss. Fires on tryb netto with wpłaty brutto and the reverse;
  tryb mieszany still never screams (2026-07-26). **It must NOT be the old banner** — owner: „tamten
  był paskudny". The deleted one (`settlement-plane-warning.tsx` at `ad61e023^`) was a full-width red
  `WarningBanner` above the tables carrying a paragraph of prose plus a „Pokaż wpłaty" link; it
  already named the count and the amount, so the failure was its form, not its content. New form to be
  designed during planning; it still has to name the amount at stake.
- **A wpłata's netto/brutto tag is NOT editable — the correction is anulowanie + re-księgowanie.**
  Retagging moves the debt by a VAT's worth (800 zł on a 10 000 wpłata at 8%), which is the same class
  of decision as editing the kwota — and the edit form already refuses THAT for wpłaty. A transfer has
  no version history (an edit overwrites in place), so the only path that leaves a trail is
  `cancelled: true` + a `CANCELLATION` row. `VatPlaneField` is therefore gone from
  `edit-transfer-form.tsx` and `vatPlane` from `editExpenseFormSchema`; the tag is still set at
  creation in `deposit-form.tsx`, and `updateTransferAction` still tolerates the field it no longer
  receives. Marża is untouched by any of this — wpłaty never enter it.
- **Legacy untagged wpłaty scream too** (owner: „1. Niech krzyczy"). Untagged counts as netto, so in
  tryb brutto every one of them is off-plane and red. They are not backfilled or grandfathered — they
  go through the same anuluj-i-zaksięguj-na-nowo path.

Worked example the owner signed off on (robocizna 88 500 netto, materiały 10 000 z paragonu, VAT 8%,
wpłaty 40 000 netto gotówką + 10 000 brutto przelewem):

|           | Netto      | Brutto     |
| --------- | ---------- | ---------- |
| Robocizna | 88 500,00  | 95 580,00  |
| Materiały | 9 259,26   | 10 000,00  |
| Łącznie   | 97 759,26  | 105 580,00 |
| Wpłaty    | −49 259,26 | −53 200,00 |
| Pozostało | 48 500,00  | 52 380,00  |

Every row satisfies `netto × 1,08 = brutto`, and the 10 000 przelewem discharges materiały exactly.

Third pass, 2026-08-20 (later the same day) — REVERSES two of the rulings above:

- **Tryb mieszany shows the netto column only; the brutto column is gone.** Every tryb now shows
  exactly ONE money column. What is „mieszane" is the WPŁATY, not the bill: a brutto-tagged wpłata is
  legitimate there and comes off the netto column de-grossed, where tryb netto flags it as off-plane.
  `settlementModeToMoneyAxis` maps MIXED → 'net'.
- **VAT never touches materiały, in any tryb.** `materialsSettlementPair` deleted; materiały stand at
  face value on both planes, priced only by the investment's own stawka materiałów. This kills the
  double reduction found in the follow-up research (the stawka divided once, VAT again — including the
  netto-billed bucket, which carries no VAT toward the investor and must never be cut). „Wracamy do
  stałej stawki za materiały."
  `computeAmountDue` therefore no longer takes the tryb at all.
- Consequence to accept or act on: MIXED and NET now differ ONLY in whether a brutto wpłata is flagged
  off-plane. Decide whether the third tryb still earns its place.

Panel/list details settled in the same pass:

- The wpłaty pie is **deleted** (it sliced face-value buckets beside a crossed „Razem"). The „Struktura
  kosztów" pie takes materiały netto from the settlement and shows **percent only** — the money is in
  the table beside it. `formatValue` on `SlicePie` / `PieSliceLegend` is optional for that.
- The wpłaty list's tag column is „**Typ wpłaty**". In tryb mieszany a SECOND table below it — „Wpłaty
  wg typu" — carries a subtotal per tag (each as a pair, so both columns still add down to „Razem").
  Interleaving those subtotals into the list broke the column sum and was rejected.
- „Pozostało do zapłaty" compares against zero **after rounding to grosze** — crossed wpłaty land on
  1e-13 and the row screamed red beside „0,00".
- A parenthetical brutto twin under „Pozostało do zapłaty" was built and then rejected — not wanted.

Open decisions carried into planning:

- The existing per-investment materiały netto rate answers a different question (how much the client
  owes for materiały at all, receipt brutto vs receipt netto). Deliberately parked — decide how it
  composes with the rule above.
- The face-value „Razem wpłaty" row: it lost its column when the wpłaty list went two-plane. Restore
  as a separate row or drop.
- The face-value „Razem wpłaty" (95 580) lost its home when the list went two-column. Restore as a
  separate row or drop.
- Crossing runs at flat VAT; materiały carry none, so a wpłata that paid for materiały grosses a
  touch high. Accepted for the spike (owner: materiały + reszta stay face value) — decide whether it
  stays.
- The listing keeps BOTH bilans columns in every tryb, where the panel now shows only the tryb's
  own. One table spans investments settled every which way, so a per-row blank would be unreadable —
  but it does mean the listing prints a figure the panel deliberately hides. Decide whether that
  stands.
- v2 counts wpłaty od inwestora ONLY, where v1's `totalIncome` still counts all three deposit types.
  Right by construction (a zasilenie z konta firmowego is not a client payment) and matching the
  panel, but a legacy COMPANY_FUNDING/OTHER_DEPOSIT row still carrying an investment_id now shows up
  in v1 and not in v2. Worth a one-off query before the plan.
- `grossBalance` is dead production code — its two specs are the only callers left.
- Tests for both files are red: they reference removed symbols and the removed „Pozostało" rows.

Fourth pass, 2026-08-23 (spike, working tree, no tests) — **VAT crossing on wpłaty is deleted**,
reversing the „a wpłata enters a column converted to that column's plane" ruling above. A wpłata now
carries only the kwoty it actually had:

- **Wpłata netto (gotówka) is face value and has NO brutto kwota.** The wpłaty list prints „×" in the
  brutto column, never a 0,00 — a zero reads as a payment worth nothing, where the truth is that the
  kwota does not exist.
- **Wpłata brutto (przelew) is booked with BOTH kwoty off the faktura** — `amount` brutto and
  `netAmount` its netto. The form types both; the netto is suggested at the investment's stawka and
  stays overwritable. `netAmount` already existed on `transactions` (it is the netto-wydatek column),
  so **no migration**.
- **Why:** the bill is built at two stawki — in tryb brutto materiały enter at the shop's 23% while
  robocizna grosses at the faktura's — so no single rate bridges a wpłata. Crossing over-credited the
  client (blended, ~73 zł on a 10 000 wpłata in the worked example; the whole VAT where the bill is
  materiały only). Owner: „Jeśli jest rozliczana brutto to nie może tam być wpłat netto" + „wpłata
  netto to face value".
- **Consequence accepted:** „Razem" in the wpłaty list stops being a VAT-linked pair. Legacy wpłaty
  brutto with no `netAmount` go through a single spike-only bridge (`legacyNet`, applied once in
  `depositPairFromPlaneSums`) — kept only so pre-spike rows stay legible; those rows are corrected by
  anulowanie + re-księgowanie, not backfilled (owner: dane są ciągle testowe).

Code: `deposit-planes.ts` rewritten (`sumDeposits` / `DepositPairT` with `gross: number | null`;
`sumDepositPair` + the tally deleted; `DepositPlaneSumsT` now four raw sums). `net_amount` reads
through `getDepositTransactions` and `selectDepositPlaneSums`. Write path: new
`carriesNetAmount(type, vatPlane)` in `constants/transfers.ts` is the one authority for which rows
store a netto — it replaces `billsNetAmount` in `hooks/transfers/validate.ts` (which was nulling the
column for every wpłata), in `getNetAmountError`, and in the collection's admin condition;
`createTransferSchema` and `expenseFormSchema` gained `netAmount`; `PlaneAmountField` renders one
input on gotówka and two on przelew.

Still owed: the booking gate (a wpłata's plane must match the tryb unless MIXED, plus the
tryb-switch case) and the listing's „nie dotyczy" on the bilans column an investment is not settled
on (`shape-investments.ts` carries the note).

Nazewnictwo wpłat, 2026-08-23 (owner) — **a wpłata's tag is named by its forma, not by its plane.**
„Netto"/„brutto" meant two different things on one screen — the tryb the whole bill is settled in,
and the tor one wpłata arrived by — and the reader had to tell them apart from context. The stored
value is untouched (`vatPlane` stays NET/GROSS); only the owner-facing name changes, via new
`DEPOSIT_PLANE_LABELS` („Gotówka"/„Przelew") + `DEPOSIT_PLANE_INSTRUMENTAL` in
`constants/transfers.ts`. `VAT_PLANE_LABELS` keeps naming the tryb, which is still netto/brutto.
Applied: the wpłaty list's tag column („Forma wpłaty"), its subtotals („Wpłaty gotówką" /
„Wpłaty przelewem", header „Wpłaty wg formy"), the off-plane warning („Rozliczenie brutto, a 2
wpłaty są gotówką."), the footnote („Wpłaty bez oznaczonej formy są traktowane jako gotówka.") and
the tryb-mieszany hint, whose copy still described the deleted two-tor model.
Not yet renamed: the transfers listing column „Rozliczenie netto/brutto" (`components/tables/
transfers.tsx`) and the deposit form's own kwota labels.

„Razem" znika z listy wpłat, 2026-08-23 (owner) — tylko z pierwszej tabelki. The netto and brutto
columns stopped being a VAT-linked pair when crossing was deleted, so a bold pair at the foot of the
list invited reading it as one figure at two stawkach when the brutto side counts only przelewy.
The split table below keeps its „Razem" — there it totals what stands directly above it. The figure
the reader actually needs is unaffected: the „Wpłaty" deduction row in the settlement above already
carries the sum on the tryb's own plane.

## Lista inwestycji — jeden bilans na tryb, 2026-08-23

Kolumny „Bilans netto v2" i „Bilans brutto v2" nie stoją już obok siebie na każdej inwestycji.
Widoczna jest ta, w której inwestycja jest rozliczana; druga mówi „nie dotyczy":

- rozliczenie **netto** → netto liczone, brutto „nie dotyczy",
- rozliczenie **brutto** → brutto liczone, netto „nie dotyczy",
- rozliczenie **mieszane** → **netto**, dokładnie jak panel Podsumowania.

Powód, dla którego mieszane idzie na netto (a nie pokazuje obu, jak brzmiała pierwsza myśl): nic nie
jest już przeliczane przez VAT, więc bilans brutto odlicza wyłącznie przelewy i po cichu gubi każdą
wpłatę gotówką. Na inwestycji 205 (rozliczenie brutto, 7 wpłat / 3 przelewy) to różnica między
+1 162,22 a −53 500. W trybie brutto ta różnica jest uczciwa — te wpłaty są tam już zaznaczone na
czerwono jako niezgodne. W mieszanym gotówka jest legalna, więc ta sama liczba byłaby po prostu
fałszywa.

Reguła to ta sama projekcja co oś panelu (`settlementModeToMoneyAxis`), nie druga jej kopia — lista
nie może pokazać kwoty, której panel pokazać odmawia. Obie kwoty liczą się dalej dla każdego wiersza;
tryb jest faktem, który właściciel może przestawić, i kolumna wraca razem z nim.

Podpowiedzi nagłówków obu kolumn mówią teraz, kiedy kolumna żyje (były opisem samej formuły).

## Blokada księgowania — ostrzeżenie zamiast blokady, 2026-08-23

Owner rozstrzygnął dwie rzeczy (research: `research.md`, sekcja „Follow-up 2026-08-23"):

1. **Pilnujemy tylko jednego kierunku** — gotówki na inwestycji rozliczanej brutto. Tam wpłata
   naprawdę znika z rozliczenia: nie ma kwoty brutto, a nic już nie przelicza przez VAT. Kierunek
   odwrotny (przelew tam, gdzie rachunek jest netto) spłaca dług kwotą netto z faktury — nic nie
   ginie, więc nie ma o co pytać. Reguła nazywa się `strandsDeposit`, celowo węższa niż
   `isOffPlaneDeposit`: tamta odpowiada „czy wiersz jest oznaczony wbrew trybowi", ta „czy ta wpłata
   przepada".
2. **Nigdzie nie blokujemy — pytamy.** Wpłata fizycznie się wydarzyła; odmowa zapisania faktu
   nauczyłaby tylko przekłamywać metodę płatności, żeby przejść przez drzwi. Tym bardziej, że tagu
   wpłaty nie da się potem poprawić (jedyna droga to anulowanie i zaksięgowanie na nowo).

Dwa miejsca, oba dialogiem potwierdzenia:

- **Przy księgowaniu wpłaty.** `useManagedForm` dostało `confirmBeforeSubmit` — wywoływane między
  poprawnym formularzem a zapisem, zwraca treść pytania albo `null`. Odpowiedź jest **awaitowana
  wewnątrz `onSubmit`**, nie odkładana na potem, żeby stan „zapisywanie", toast i czyszczenie draftu
  zostały tam, gdzie są w każdym innym formularzu. Tryb inwestycji był już na kliencie —
  `InvestmentRefT.settlementMode`, ta sama tablica, z której formularz bierze stawkę VAT.
- **Przy przestawianiu trybu rozliczenia.** Istniejące okno „Uwaga — zmiana widoczna dla inwestora!"
  dostaje drugie zdanie: ile wpłat i za ile przestanie się liczyć. Liczy je panel Podsumowania (tam
  są wiersze wpłat), a `handleSettlementModeChange` tylko doszywa zdanie — hook ustawień nigdy nie
  dostał wpłat i nie ma powodu, żeby zaczął. Obie kontrolki (popover „Opcje rozliczenia" i select
  w zakładce Podsumowanie) idą przez jedno owinięcie, więc żadna nie podniesie przestawienia bez
  wyceny.

Świadomie NIE objęte: panel admina i wywołanie akcji wprost. Skoro nigdzie nie blokujemy, warstwa
serwerowa nie zyskuje nowej reguły — ostrzeżenie jest z definicji ekranowe.

### Lekarstwem jest tryb, nie wpłata (korekta tego samego dnia)

Pierwsza wersja tych komunikatów kazała wpłatę **przeksięgować**. Owner odwrócił kierunek: jeśli na
inwestycję wpływa gotówka i przelew, to ta inwestycja **jest mieszana** — to tryb się nie nadążył,
nie wpłata jest zła. Więc każdy z trzech komunikatów wskazuje teraz „ustaw rozliczenie mieszane".
Sens praktyczny: przestawienie na mieszany naprawdę ratuje tę kwotę (rachunek idzie wtedy netto,
gdzie każda forma ma kwotę), a kazanie przeksięgować gotówkę na przelew znaczyłoby wpisać fakturę,
której nie ma.

Dlatego czerwony tekst pod rozliczeniem **zostaje w obu kierunkach** — bo w obu mówi to samo o
trybie. Zmieniło się to, że przestał kłamać: zdanie „… nie spłaca nic" pojawia się wyłącznie przy
rozliczeniu brutto, gdzie kwota faktycznie znika. Przy netto przelew spłaca dług kwotą netto
z faktury i zdanie tego już nie sugeruje.

Dwa predykaty stoją więc obok siebie i to jest celowe: `isOffPlaneDeposit` odpowiada „czy tryb wciąż
mówi prawdę" (oba kierunki, czerwony wiersz i tekst), `strandsDeposit` — „czy ta wpłata przepada"
(tylko gotówka przy rozliczeniu brutto, i tylko to zatrzymuje księgowanie pytaniem).
