# Review-gate ledger — heic-upload-gap · 2026-08-25

Scope: 27 files, `staging...heic-upload-gap`. Checks that survived detection: `/10x-impl-review`,
`/code-review`, `feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`
(diff-scoped), `comment-noise-audit` (flag-only), `primitive-reuse-scan` (in the simplify pass).
Dropped: `tailwind-v4-audit` (no styling in the diff), Step 0.5 verification pass (no
`verify-manual-checks` skill installed).

The two bug-finding checks landed the same CRITICAL independently; it was reproduced in the main
thread before being accepted.

## Findings

- [x] dismissed · feature-first-structure / module-cohesion · —
      6 placements audited, 6 correct, 0 misplaced. 0 cohesion defects; the two heuristic hits
      (`form-hooks.ts` mixing a type with values, `ingest-picked-files.ts` exporting its own return
      type) both land on the skills' named carve-outs — a type derived from a defining const belongs
      with it. Net cohesion effect of the slice is positive: −20 duplicated type lines, −24 inlined
      ingest lines.

- [x] skipped · code-review · `src/components/forms/hooks/use-file-pick-ingest.ts:44` ·
      On an _unexpected_ ingest failure the hook toasts, clears `files`, and submit then proceeds —
      saving the row without its attachment. That was `inspection-form`'s pre-existing behaviour and
      the extraction inherited it into the transfer dialog. Blocking submit until a re-pick changes
      what a user may do, so it is surfaced rather than auto-applied. The picker now at least stops
      claiming the file is attached (see the `inputKey` finding), which removes the misleading half.

- [x] dismissed · simplify · `use-file-pick-ingest` / `use-invoice-upload` / `use-invoice-ingest` ·
      The three look like near-twins but share only a 6-line skeleton (`setBusy(true)` → try → report
      blocked → catch generic toast → `finally setBusy(false)`). They differ on the busy representation
      (boolean vs a `Set<string>` of row ids), whether latest-wins applies, the toast copy, and what the
      catch branch resets. A shared runner needs 4+ parameters to express 6 lines — params == the code,
      no win. The one genuinely shared piece was already extracted by this slice: `ingestPickedFiles`.

- [x] dropped · simplify · 4 cosmetic nits ·
      `'Poczekaj na przetworzenie plików.'` duplicated in both actions (one line each; a shared const
      buys indirection, not safety); a missing blank line after the relocated import in three field
      components (prettier accepts it); `(bytes / 1_000_000).toFixed(2)` twice in the backfill script
      (`src/lib/utils` has no byte formatter and two CLI call sites don't justify one); and
      `path.parse(name).name` flagged as a `splitExtension` reinvention — it is the Node platform
      primitive, correct for a CLI.

- [x] filed · simplify · `edit-transfer-form.tsx:89-102` + `inspection-form.tsx:86-105` ·
      An identical 13-line block — upload pages → run the mutation → `discardOrphanedUploads` on failure —
      with a third, deliberately divergent copy in `src/hooks/use-invoice-upload.ts:21-57`. It also
      carries a live bug: both form copies clean up orphans only when the action _returns_ failure, so an
      action that **throws** leaves paid-for pages in Blob that nothing will ever find. Pre-existing (the
      slice only added the `isIngesting` guard above it), and a new shared primitive plus a correctness
      fix deserves its own review — filed EX-734.
      test: test-driven-debugging · integration — recorded on the issue: red repro where the action
      throws after a successful upload, asserting the blob was deleted (persisted state, not the return
      value).

- [x] filed · impl-review F8 · `src/components/forms/form-fields/*.tsx` (7 files) ·
      `form: any` is the actual root cause behind the field-component annotation; the derived type is
      a workaround that restores no per-form value checking. Pre-existing (every one of those lines is
      a context line in the diff), genuinely worth doing later, and a review-worthy refactor in its
      own right — filed EX-733.

- [x] dropped · code-review · `src/components/forms/hooks/use-file-pick-ingest.ts:10` ·
      The hook's doc names its two callers, which a third caller would silently falsify. Real, but one
      clause in an otherwise load-bearing block — not worth the churn. (The caller list was in fact
      trimmed while fixing the surrounding doc.)

## Simplify pass

Ran as an agent (`/simplify` is not invokable as a Skill here), combining `primitive-reuse-scan` with a
simplification review — 7 applied, 2 held back, 1 dismissed, 4 dropped; every one folded into
`## Findings` above (tagged `simplify`). Of the two held back, one was applied in the main thread after
review (the clear button) and one was filed (EX-734).

Reuse homes came from the existing `.reuse-scan.json` (`src/components/ui`, `src/hooks`, `src/lib/**`,
`src/types`) plus `src/components/forms/hooks` and the expense-form `use-*` files, since that is where
the diff lives. One reinvention found across the whole diff — the latest-wins counter — and it was one
I had introduced earlier in this same gate.

## Tests & suite

**No new specs owed.** Every correctness finding in this gate lands on a browser-level assertion —
what the picker displays after a rejected pick, whether submit re-enables after a mid-convert clear —
and this codebase deliberately has no hook-renderer harness (`AGENTS.md`: the React-free half lives in
`src/lib/kosztorys` / `src/lib/invoices` precisely so specs never need `renderHook`). The React-free
half here, `ingestPickedFiles`, is already covered. So all three cases were folded into **EX-732**,
the slice's existing `e2e-backlog` issue, rather than filed as new ones.

Ran:

- `pnpm typecheck` — exit 0
- `eslint` (forms, invoices, backfill script, its spec) — exit 0
- `prettier --check` on the four rewritten files — clean
- `pnpm exec vitest run src/__tests__/lib/invoices/ingest-picked-files.test.ts` — 5/5 pass

Not run, awaiting the user's call: the full `pnpm test` sweep, `pnpm build`, and `pnpm test:e2e`
(~1h; never run unprompted).

## Status

**In review, not done.** Two things are outstanding and both are the user's, not the agent's:

1. The `## EX-394` section of `context/foundation/manual-checks.md` is entirely unticked. Manual checks
   passing is a hard blocker for `Done` and for archive.
2. The **production** backfill (Phase 4) is human-executed by policy — the agent never touches the Neon
   prod URL or the production Blob store. Staging is done and verified; prod is rehearsed, not run.

Nothing in this change has been committed. `EX-394` stays In Progress with an `[in review]` marker
(the team has no In Review state).

---

# Review-gate ledger — drugi przebieg (EX-733 + EX-734) · 2026-08-25

Zakres: `e24cb697..HEAD` — `5f1fe3ed` (dedup uploadu faktur + cichy `keepOpen`) i `f7a683bd`
(zdjęcie `form: any` z wrapperów pól). Fan-out: code-review, comment-noise (flag-only), audyt
struktury/kohezji.

## Findings

- [x] 🔵 OBSERVATION · dismissed · code-review · `submit-with-invoice-pages.ts:29` · „pliku" → „plików"
      w treści błędu edit-transfer — formularz jest `multiple`, liczba mnoga jest poprawniejsza.
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/invoices/discard-orphaned-uploads.ts:10` ·
      sprzątanie jest best-effort i przy wygasłej sesji samo nie przejdzie auth. Sprzed tej zmiany,
      bez dostępnego lekarstwa po stronie klienta.
- [x] dismissed · structure · `plane-amount-field.tsx:1`, `expense-category-field.tsx:1`,
      `line-items-field.tsx:26` · współdzielony `form-fields/` importuje konkretne typy API z folderów
      trzech formularzy — inwersja zależności. Świadoma: to wrappery jednego konsumenta, a unia nazw
      w `FormWithFieldT` odwróciłaby zależność w drugą stronę. Rozstrzygnięte w EX-733.
- [x] dropped · structure · `bulk-expense-form.ts:65` · `BulkExpenseFormApiT` nie mieszka w pliku
      `*-form-api.ts` jak dwa pozostałe. Po wyciągnięciu `FormApiOfT` to jedna linia typu w pliku,
      który i tak jest jego naturalnym domem — przenoszenie samo w sobie nic nie kupuje.
- [x] dropped · comment-noise · `form-hooks.ts:53`, `deposit-form-api.ts:7` · dwa komentarze przeszły
      strip test bez zmian (jednolinijkowe uzasadnienie `store: unknown`; reguła domenowa o kwocie brutto).

## Tests & suite

- `pnpm typecheck` — exit 0
- `pnpm test` — **195 plików / 2759 testów pass**, 49 plików skipped (DB-backed, bez kontenera)
- `eslint` (lib/invoices, components/forms, **tests**/lib/invoices) — czysto
- `prettier` — czysto
- Instrumenty zweryfikowane na znanych pozytywach, nie na zielonym typechecku:
  `name="kategoriaKtorejNieMa"` → 1 błąd; rename `sourceRegister` w `DepositFormValuesT` → błąd
  w `deposit-form.tsx:248` (dokładnie ten call site, który wcześniej nie był sprawdzany).
- Nie uruchamiane: `pnpm build`, `pnpm test:e2e` (~1h, nigdy bez polecenia).

## Status

Bez zmian względem pierwszego przebiegu: **in review**. Sekcja `## EX-394` w `manual-checks.md`
nietknięta, backfill produkcyjny wykonuje człowiek. **Zero otwartych `[ ]`** — jedyna obserwacja
spoza slice'a została naprawiona na polecenie użytkownika po zamknięciu bramki.

_Trimmed at archive (2026-09-02): 37 `fixed` finding(s) removed — a fixed finding's durable record is its commit; what survives is the negative space git cannot hold. Pre-trim tally: 37 fixed, 12 other, 0 open._
