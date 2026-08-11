# Rename decisions — kosztorys-terminology (owner rulings)

Owner naming calls that gate the EX-548 codemod. Anything the research
(`research.md`) flagged as "owner-decision needed" gets resolved here on
`file:line`, then folds into `/10x-plan`. Code register only.

## Q1 — Labor B2 operand (RESOLVED: variant B, 2026-07-20)

The recon (`reconciliation.ts:73`) compares the **pre-rabat** kosztorys labor
against Σ LABOR_COST. Two distinct figures live in `use-kosztorys-editor.ts`:

- `:339` `sumaPracNet` — robocizna netto **pre-rabat** (the actual recon operand)
- `:357` `laborCostsNetFromKosztorys` = `totalNet − discountAmount` — robocizna
  netto **post-rabat** (feeds `computeSummarySplit` + `computeDoZaplatyRM`, NOT recon)

**Ruling — move the suffixed name onto the real operand:**

| Figure                     | Old name                     | New name                         |
| -------------------------- | ---------------------------- | -------------------------------- |
| pre-rabat operand (`:339`) | `sumaPracNet`                | **`laborCostsNetFromKosztorys`** |
| post-rabat (`:357`)        | `laborCostsNetFromKosztorys` | **`laborCostsNetAfterDiscount`** |

Rationale: the plane-suffix pair `…FromKosztorys` / `…FromTransactions` must name
the two figures the recon actually compares. Σ LABOR_COST (transactions twin) is
pre-rabat, so the kosztorys twin must be the pre-rabat `sumaPracNet`. Corrects
glossary rows 87-89.

## Q2 — `rabatAmount` collision (SUPERSEDED by Q5, 2026-07-26 — do not implement)

> **Superseded.** The refactor that moved the mode selection into
> `clientTotalsFromSubtotals` deleted this ruling's evidence base: at `a5ef7baf`
> `rabatAmount` is not computed anywhere. Kept for the reasoning trail only —
> implement **Q5** instead.

`use-kosztorys-editor.ts:366` `rabatAmount = discountAmount + itemRabatTotal`.
Glossary target `discountAmount` is occupied by the global-only figure at `:351`.

**Verified NOT "global + per-item added":** it is global XOR per-item, never both.
Under a live global discount `applyDiscount` returns gross (`calc.ts:29`), so
`rowDiscountForView = 0` (`calc.ts:98`) → `itemRabatTotal = 0`; and
`discountAmount = 0` when global is off (`isGlobalDiscountActive`, `calc.ts:21-22`).
The sum is a branch-free way to pick whichever mode is active (comment
`:358-359`). So `combined*`/`total*` names would lie.

**Ruling:** `rabatAmount` → **`effectiveDiscountNet`** — "the discount currently in
effect, whichever mode". `discountAmount` (`:351`, global-only) stays as-is.

## Q3 — `computeDoZaplatyRM` / `doZaplaty` (RESOLVED: full-word English, 2026-07-20)

`summary-economics.ts:67` — Cat gray, missing from glossary. Sheet footer
„Aktualnie do zapłaty R+M" = robocizna + materiały − wpłaty (`= −Bilans` on the
R+M base).

**Ruling — Cat B1:** „do zapłaty" has a clean English equivalent ("amount due"), so
it fails the rule-1 A-test → English, like `bilans→balance` / `marza→margin`.

- `computeDoZaplatyRM` → **`computeAmountDueLaborAndMaterials`**
- the `doZaplaty*` family → **`amountDueLaborAndMaterials`**

**No initials, no abbreviations** (owner, 2026-07-20): the `RM` suffix is spelled
out as `LaborAndMaterials` — never `RM` / `LM` / single letters. Aligns with the
global TS rule "full, descriptive identifiers; no abbreviations". The UI label
stays „R+M" (Polish UI); only the code identifier changes.

## Q4 — `sumaPracPreRabat` (RESOLVED: delete, don't rename, 2026-07-26)

`summary-economics.ts:124-126` returns `laborCostsNetFromKosztorys + rabatAmount`,
which expands to `doneNet + itemRabatNet` — the definition of `sumaPracNet`
(`settlement.ts:102`). `summary-economics.test.ts:380-383` already asserts the two
are equal.

**Ruling:** delete the function and thread the real `sumaPracNet` into its three
consumers (`brutto-netto-summary.tsx:102`, `mixed-summary.tsx:60`,
`summary-overview-tab.tsx:103`). Renaming would preserve a rule-4 duplicate under a
better name. The identity test dies with the function — nothing left to compare.

Prop sets of three components change, so `tsc` catches every site; it cannot fail
silently.

## Q5 — `rabatAmount` (RESOLVED: collapse onto `rabatClientNet`, 2026-07-26) — supersedes Q2

At `a5ef7baf` `rabatAmount` is **not computed**. It is a prop name with exactly one
producer: `kosztorys-editor-body.tsx:299` passes `rabatAmount={rabatClientNet}`. The
`discountAmount + itemRabatTotal` arithmetic Q2 reasoned about moved down into
`clientTotalsFromSubtotals` (`settlement.ts:103`); neither `itemRabatTotal` nor the
hook-level `discountAmount` exists any more.

**Ruling:** `rabatAmount` and `rabatClientNet` are one figure and take one name —
**`discountNetFromKosztorys`** (the Cat-B2 target from the recon pair). Do **not**
coin `effectiveDiscountNet`; with nothing left to disambiguate it would create the
rule-4 duplicate Q2 was written to prevent.

`discountAmount` remains unavailable as a target, for a new reason: it is now a
**per-row grid column id** (`column-config.ts:25-26`, `sort-value.ts:39,41`), a
different occupant than Q2 assumed.

## Q6 — `bilans` → `balance` (RESOLVED: accept the overload, 2026-07-26)

One prod site: `print-button.tsx:35` `const bilans = calculateBalance(...)`. The
producer is already `calculateBalance`, so the local is the only Polish left on the
line.

**Ruling:** `balance`. `investorBalance` would be more precise but would disagree
with its own producer, and reconciling that means renaming `calculateBalance` and
its call sites — scope creep for one local. The overload with cash-register /
worker balance is real and resolved by context at every site.

`BILANS_LABEL` → `BALANCE_LABEL`; the Polish string value is untouched.

## Q7 — `SectionPieBaseT` (RESOLVED: keep both members Polish, 2026-07-26)

`chart-slices.ts:46` — `'przedmiar' | 'wykonane'`. Rule 1 read strictly keeps
`'przedmiar'` (Cat A) and sends `'wykonane'` → `'executed'`, producing a
mixed-language union.

**Ruling:** keep the pair Polish. These are not a sheet noun standing beside a
generic figure — they are the sheet's **two bases for one comparison**, a matched
pair, and splitting them costs more legibility than the compliance is worth.

**New narrow exemption — Cat A by association:** a Polish member may stay Polish
when it exists _only_ as the counterpart to a Cat-A noun inside a single union that
names sheet artifacts. It does not license `wykonane` anywhere else — every other
`wykonan*` identifier is Cat B1 → `executed*` (`wykonaneNet` →
`executedNet`). Record this in the glossary so it is not "fixed" later as an
inconsistency.

## Q8 — `saldo` scope (RESOLVED: fold into this change, 2026-07-26)

16 identifiers / ~155 occurrences / 20 files on the registers/transfers plane
(`use-saldo.ts`, `saldo-summary.tsx`, `register-saldo.ts`, form components).
Initially recommended as a separate slice on size grounds; **that recommendation was
wrong** and the evidence retracted it:

- Zero `saldo` hits in `src/collections` or `src/migrations` — same clean bill as
  the kosztorys set.
- **The SQL already says `balance`** — `sum-transfers.ts:57,83,91,100,123` all alias
  `AS balance`; `register-saldo.ts` wraps the result and renames it _back_ to
  `saldo`, which `use-saldo.ts` then propagates upward.

So this is not a collision needing a ruling — it is the same half-renamed seam as
`isBruttoMaterial` beside `isNetMaterial`, spread over more files. The English name
is already underneath; the Polish layer was added on top.

**Ruling:** rename in this change, and add the `^saldo|Saldo` stem to the guard now
rather than shipping it knowingly blind to its largest stem.

**Manual check owed** (checklist item, not a slice boundary): the saldo preview in
`internal-transfer-form` and `expense-form` is a real-data path and wants a
click-through. `validate-source-register.ts:45` records that the preview is advisory
only, so no financial figure depends on it.

---

## Status

**Q1, Q3–Q8 RESOLVED. Q2 SUPERSEDED by Q5. One open.**

**OPEN — Q9 `remaining` / `dueNet` (`subcontractor-summary.ts:35`).** Agent
recommendation, not yet an owner ruling: **stay bare, no plane suffix.** `dueNet` is
executed value at the subcontractor price (kosztorys plane), `payoutsTotal` is
Σ realized PAYOUTs (transactions plane) — two planes, but an obligation minus a
settlement, not one concept reconciled against itself. `dueNetFromKosztorys` would
imply a `dueNetFromTransactions` that does not exist. Confirm or overrule before the
codemod.

Feeds `/10x-plan kosztorys-terminology` as the rename spec. Still owed by the plan:

- **Glossary corrections** — rows 116-117 (przedmiar/pomiar not drift), 72-74
  (`totalRabat` not canonical), 87-89 (labor operand is the pre-rabat figure per Q1),
  49/71-75 (rabat is B2 not B1), plus the Q4–Q8 rulings and the ~18 missing concepts
  enumerated in `research.md` §9.
- **`context/domain/01-domain-distillation.md`** — regenerate from scratch (~25 of
  ~35 citations stale).
- **Guard edits before enabling** — stem additions and the `e2e/` glob widening
  (`research.md` §7), including the `Identifier`-visitor blind spot on Polish
  string-literal union members.
