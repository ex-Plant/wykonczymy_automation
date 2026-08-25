# Review-gate ledger — heic-upload-gap · 2026-08-25

Scope: 27 files, `staging...heic-upload-gap`. Checks that survived detection: `/10x-impl-review`,
`/code-review`, `feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`
(diff-scoped), `comment-noise-audit` (flag-only), `primitive-reuse-scan` (in the simplify pass).
Dropped: `tailwind-v4-audit` (no styling in the diff), Step 0.5 verification pass (no
`verify-manual-checks` skill installed).

The two bug-finding checks landed the same CRITICAL independently; it was reproduced in the main
thread before being accepted.

## Findings

- [x] 🔴 CRITICAL · fixed · impl-review + code-review · `context/reference/blob-recovery-runbook.md:392` ·
      The documented production procedure aborts on its first command. The script imports
      `payload.config`, which refuses the production Blob token whenever `VERCEL_ENV !== 'production'`
      — so all three prod commands threw at import, before `main()`. Reproduced verbatim. The staging
      rehearsal never exposed it because the preview token passes the guard.
      Fixed with the recommended Fix B, not the one-line Fix A: the runbook now sets
      `VERCEL_ENV=production` **and** the script carries its own replacement guard (below), so the
      procedure does not begin by disarming a check with nothing behind it.
      test: no automated test · n/a — the guard is exercised by the three refusal reproductions
      recorded under the next finding; a unit test would need the whole env layer stubbed.

- [x] 🟡 WARNING · fixed · code-review · `src/scripts/backfill-heic-media.ts:99` ·
      No guard paired the DB against the blob store, and they are independent axes both hand-typed on
      the command line. One wrong `_PROD` rewrites production rows to filenames whose bytes went to
      preview: every backfilled invoice 404s and the production original is deleted rather than
      replaced. `scripts/blob-restore.mjs` already carries this class of guard; the strictly more
      destructive script had none.
      `resolveTarget()` now refuses unless the database and the store name the same environment,
      requires `--allow-prod` for the production pair, and fails closed on an unrecognised token.
      Store ids are imported from `src/lib/env/schema.ts` rather than hand-synced.
      test: no automated test · n/a — verified by reproduction: prod-store+preview-DB refuses,
      prod-DB+preview-store refuses, both before any DB or store access.

- [x] 🟡 WARNING · fixed · impl-review F3 · `src/scripts/backfill-heic-media.ts:281` ·
      A row failing after Payload deleted its blob was logged and abandoned, and `failures` was never
      persisted — `verify()` iterates the manifest, which by construction holds only successes. On
      production that is a live invoice 404ing with no id and no remediation path.
      Took Fix B (fail fast): the run now stops at the first failing row, writes the manifest, and
      prints the exact `blob-restore.mjs` command that puts that row's original back.
      test: no automated test · n/a — one-off CLI; the invariant is cheaper to satisfy than to test.

- [x] 🟡 WARNING · fixed · impl-review F4 + code-review · `src/scripts/backfill-heic-media.ts:299` ·
      The manifest — the documented rollback map — was written once after the last row, so an
      interrupt at row 10 of 18 left no record of what had been converted; and a retry overwrote it
      with the shorter run's, destroying the first batch's rollback data while `--verify` reported
      `N/N OK`. Now rewritten after every row with a `converted` flag, `--verify` reports rows that
      never converted, and the run refuses to start over an existing manifest without `--force`.
      test: no automated test · n/a — same reason.

- [x] 🟡 WARNING · fixed · impl-review F5 · `src/scripts/backfill-heic-media.ts:246` ·
      The snapshot — the only rollback — was never verified beyond `response.ok`. A 200 serving
      truncated bytes produced a snapshot that logs a green tick and is worthless for a tax-retained
      faktura. Now fails closed on 0 bytes, on a length that disagrees with `row.filesize`, and on a
      short write re-`stat`ed from disk.
      test: no automated test · n/a — same reason.

- [x] 🟡 WARNING · fixed · code-review · `src/scripts/backfill-heic-media.ts:83` ·
      The selector matched only `mimeType = 'image/heic'`, but `process-upload-file.ts` treats
      `image/heif` and a bare `.heic`/`.heif` suffix as HEIC too (browsers often report an empty
      `File.type`). The completeness check shared the blind spot, so it could report a clean sweep it
      never made. Widened to an `or` clause, reused by `verify`.
      Confirmed harmless on the real data: the widened selector finds the same 18 rows on the
      prod-dump copy and 0 on the already-converted staging set.
      test: no automated test · n/a — the selector is verified against the live dataset, which is the
      only place the gap could exist.

- [x] 🟡 WARNING · fixed · impl-review F7 · `context/foundation/manual-checks.md:1522` ·
      The `>4 MB` check asked for a **photo**, but the guard measures post-compression bytes, so no
      image can trip it — only PDFs (EX-457, and the sibling check at :1502 already says so). As
      written a human would log a false failure against correct code. Now names a PDF and says why.

- [x] 🟡 WARNING · fixed · impl-review F6 + code-review · `context/foundation/manual-checks.md:1530` ·
      My own manual check asserted „Notatka" would be _wyraźnie niższe_ than „Notatki"/„Opinia".
      It won't: `ui/textarea.tsx` carries `field-sizing-content` with `min-h-[68px]`, which absorbs
      `rows={2}` entirely and leaves `rows={3}` ~10px above the floor — and in `edit-transfer-form`
      „Notatka" is itself `rows={3}`, i.e. identical. Check reworded to assert no visible change.
      The `rows` forwarding itself stays: the prop is now honestly typed and reaches the DOM, which is
      the defect the mirror removal uncovered. Making it _visible_ would mean dropping
      `field-sizing-content` — a styling change this slice did not ask for.

- [x] 🟡 WARNING · fixed · impl-review F2 + code-review · `src/components/ui/file-input.tsx:93` ·
      `FileInput.handleChange` sets its displayed name from the pick _before_ delegating, and nothing
      reconciled that against the ingest outcome. After a blocked or failed ingest the picker read
      `IMG_1234.HEIC` while `files` was empty, and „Zapisz" saved the row with no attachment — the
      exact "you think it attached and it didn't" failure this slice exists to close, one layer up at
      the display. In `edit-transfer-form` it compounded: the existing-invoices preview button
      reappeared under the phantom name.
      Took Fix A over Fix B (keeps `ui/` dumb): `useFilePickIngest` now owns an `inputKey` it bumps
      whenever survivors ≠ picked, or on an unexpected failure, or on reset. Both forms key their
      `FileInput` on it. This also fixes `inspection-form`'s pre-existing `keepOpen` leak (it had no
      key at all, so a saved przegląd left the previous filenames on screen) and lets
      `edit-transfer-form` drop its own `fileInputKey` state.
      test: no automated test · e2e — the assertion is what the picker displays after a rejected
      pick, which is browser-level; folded into EX-732's scope rather than filed separately.

- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/forms/hooks/use-file-pick-ingest.ts:33` ·
      The hook documented a concurrency contract in prose ("`isIngesting` is what a caller does NOT
      get to ignore") without enforcing it: two overlapping picks race, and whichever settles first
      re-enables submit while the other is still converting. Unreachable today because both call
      sites disable the picker, but that made it a contract held up by its callers. Generation counter
      added — three lines, and now structural.

- [x] 🔵 OBSERVATION · fixed · code-review · `src/scripts/backfill-heic-media.ts:341` ·
      `--verify` exited 1 whenever any HEIC row remained, so the sane way to start on production — a
      `--limit` canary, then verify — always reported failure, contradicting the manual-checks line
      asking for exit 0. The sweep assertion is now gated on `LIMIT === 0`, and the canary is a step
      in the runbook.

- [x] 🔵 OBSERVATION · fixed · code-review · `src/scripts/backfill-heic-media.ts:150` ·
      The intermediate was `.jpg`, so `heif-convert` encoded JPEG at q100 and `magick` re-encoded at
      q60 — two lossy passes, where the comment claimed one. Now `.png`.

- [x] 🔵 OBSERVATION · fixed · impl-review F9 · `src/scripts/backfill-heic-media.ts` (six one-liners) ·
      Bare top-level `await main()` (a Phase A abort surfaced as `ERR_UNHANDLED_REJECTION` instead of
      the operator message the code carefully wrote); both temp files leaked on every row; no
      preflight for `heif-convert`/`magick`, so a missing binary failed all 18 rows _after_ a full
      snapshot download; `--limit abc` silently converted everything; filenames interpolated raw into
      URLs; one Polish line in otherwise-English operator output. All six applied, plus a fetch
      timeout — the Ctrl-C out of a hung download is exactly the interrupt that used to lose the
      manifest.

- [x] 🔵 OBSERVATION · fixed · impl-review F10 · `src/__tests__/lib/invoices/ingest-picked-files.test.ts:44` ·
      The Testing Strategy named four behaviours and three landed; the empty-pick case was missing.
      Added, asserting `processUploadFile` is never called.

- [x] 🔵 OBSERVATION · fixed · impl-review F8 · `context/changes/.../plan.md` ·
      Phase 2's automated criterion (`grep AppFieldComponentsT` → nothing) can never be met after the
      deviation, so it was dead text. Rewritten to what is true and checkable: the type is defined
      exactly once, in `form-hooks.ts`, as `typeof fieldComponents`.

- [x] fixed · structure-scatter · `AGENTS.md:211` ·
      The rule placing the three file-ingest hooks in three directories was folklore — only the
      per-form clause was written down. Written out: a hook's home follows its consumer count
      (1 form → `forms/<form>/`, 2+ → `forms/hooks/`, non-form → `src/hooks/`). This was the one
      unpredictable edge the slice left behind.

- [x] fixed · comment-noise · 3 files ·
      Two section banners in the backfill script restated the `console.log` on the next line; the
      spec comment restated its own `it()` title; `// Export form hook` (pre-existing freebie).
      Removed. The seven flagged-and-kept judgment calls were reviewed and kept — each carries a why
      the code cannot state.

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

- [x] fixed · simplify · `src/components/forms/hooks/use-file-pick-ingest.ts:61` ·
      **Latent wedge, found while deduping.** `reset()` bumped the generation counter, which makes the
      in-flight ingest's own `finally` a no-op — so `isIngesting` was never cleared and submit plus the
      picker stayed disabled until a remount. Reachable in the inspection form: „Wyczyść formularz"
      (`FormShell` → `FormClearButton` → `useManagedForm.onReset` → `resetFiles`) clicked mid-HEIC-convert.
      `reset()` now clears the flag itself, exactly as `use-register-balance.ts:27-33` documents for the
      same shape. Behavior-changing but not uncertain, so applied.
      test: no automated test · e2e — the assertion is that submit re-enables after a mid-convert clear,
      which needs a real conversion in a real browser; folded into EX-732's scope with the picker case.

- [x] fixed · simplify · `src/components/forms/edit-transfer-form/edit-transfer-form.tsx:126` ·
      `<FormClearButton />` was rendered with no `onReset`, so „Wyczyść formularz" in the edit dialog
      restored the row's original field values while leaving the picked files in `files` and their names
      in the picker — then „Zapisz" uploaded them anyway. The inspection form already resets them via
      `FormShell`; the divergence was unexplained. One line, `onReset={resetFiles}`.
      The simplify agent held this back as behavior-changing; taken anyway — it removes no capability, it
      makes a button named „clear the form" clear the form, and the sibling form is the in-repo precedent.
      test: no automated test · e2e — same surface as above, same EX-732 spec.

- [x] fixed · simplify · `src/components/forms/hooks/use-file-pick-ingest.ts:34` ·
      The generation counter I added earlier in this gate was a reinvention: `useLatestRequest()`
      (`src/hooks/use-latest-request.ts:12`) is exactly that primitive, `disown()` case included, and
      `use-register-balance.ts:14-30` is the existing idiom. Routed onto it — which is how the wedge above
      surfaced, since the primitive's doc spells out the reset case my hand-rolled version got wrong.

- [x] fixed · simplify · `edit-transfer-form.tsx:184` + `inspection-form.tsx:235` ·
      An identical 6-line `onChange` (read files → `e.target.value = ''` → ingest) plus
      `disabled={isIngesting}` was copy-pasted into both consumers — and the `value = ''` line is the
      non-obvious half (without it the same file cannot be re-picked after a rejection). The hook now
      returns a spreadable `fileInputProps` so the pick handler and the mid-ingest disable travel
      together and no call site can wire up half the contract. `ingestPicked` left the public surface.

- [x] fixed · simplify · `src/scripts/backfill-heic-media.ts:150` ·
      `payload.count({collection:'transactions', …})` appeared three times (dry-run, Phase B, verify) →
      `countLinkedTransactions()`. Load-bearing rather than cosmetic: `--verify` compares its count
      against the one Phase B recorded, so the two must ask literally the same question.

- [x] fixed · simplify · `src/scripts/backfill-heic-media.ts:48` ·
      `const fail = …: never` does not narrow control flow in TS — only a function declaration or an
      explicitly-typed const does — which is why `verify()` had needed `JSON.parse(raw as string)`. Made
      it a function declaration and dropped the cast. No guard text or exit behaviour changed.

- [x] fixed · simplify · `src/scripts/backfill-heic-media.ts:140` ·
      Dead `isProd` in `resolveTarget()`'s return, never read. Every refusal is a `fail()` _before_ that
      return, so removing it weakened nothing. Also: the file was failing `prettier --check` (two
      over-long lines) — formatted — and `Awaited<ReturnType<typeof getPayload>>` (3×) collapsed to
      `type PayloadT`.

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

- [x] 🟡 WARNING · fixed · code-review · `src/lib/invoices/delete-unreferenced-media.ts:20` ·
      sprzątanie sierot liczyło referencje tylko w `transactions`, a `vehicle-inspections.attachments`
      to druga relacja do `media` — po dodaniu w `5f1fe3ed` sprzątania na ścieżce throw formularz
      przeglądu mógł skasować własne, już podpięte załączniki (Blob bez undelete). Liczone są teraz
      obie kolekcje.
      test: test-driven-debugging · unit — `src/__tests__/lib/invoices/delete-unreferenced-media.test.ts`,
      4 przypadki; trzeci („spares an attachment still held by a vehicle inspection") to strażnik regresji.
- [x] 🟡 WARNING · fixed · code-review · `src/components/forms/form-fields/cash-register-field.tsx:22` ·
      `TName` był wnioskowany z `form`, więc domyślny `name = 'sourceRegister' as TName` nigdy nie był
      weryfikowany — na jedynym call site pomijającym `name` (deposit-form) kontrola nazwy pola,
      dla której ten typ powstał, w ogóle nie działała. `name` jest teraz wymagane, generyk bez
      domyślnej wartości; dwa call sites podają nazwę jawnie.
      test: no automated test · unit — kontrakt kompilacyjny; zweryfikowany empirycznie (rename
      `sourceRegister` → `sourceRegisterRENAMED` daje teraz błąd w `deposit-form.tsx:248`, wcześniej 0 błędów).
- [x] 🟡 WARNING · fixed · code-review · `src/components/forms/expense-form/expense-form.tsx:194` ·
      czwarta, ręczna kopia sekwencji upload→mutacja→sprzątanie: rzut z `createBulkTransferAction`
      zostawiał wszystkie strony w Blob na zawsze. Kształt `number[][]` nie pasował do prymitywu, więc
      rdzeń wyekstrahowany do `withOrphanCleanup`, a call site przepięty na nowe
      `submitWithInvoicePageRows`.
      test: no automated test · unit — ścieżka jest czysto kliencka (Blob + server action); pokrycie
      przez `submitWithInvoicePages` byłoby testem mocka, nie zachowania.
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/invoices/submit-with-invoice-pages.ts:29` ·
      dedup zmienił komunikat dla `use-invoice-upload`: błąd nie-`InvoiceUploadError` (np. chunk-load)
      pokazywał surowy, angielski `err.message` zamiast polskiego „spróbuj ponownie". Fallback zawężony
      — `err.message` tylko dla `InvoiceUploadError`, który jako jedyny formułuje się pod to UI.
- [x] 🔵 OBSERVATION · dismissed · code-review · `submit-with-invoice-pages.ts:29` · „pliku" → „plików"
      w treści błędu edit-transfer — formularz jest `multiple`, liczba mnoga jest poprawniejsza.
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/invoices/discard-orphaned-uploads.ts:10` ·
      sprzątanie jest best-effort i przy wygasłej sesji samo nie przejdzie auth. Sprzed tej zmiany,
      bez dostępnego lekarstwa po stronie klienta.
- [x] 🔵 OBSERVATION · fixed · code-review · `form-hooks.ts:47`, `cash-register-field.tsx:16` ·
      `listeners?: Record<string, any>` przyjmowało `{ onChange: 42 }`. Zawężone do
      `{ onChange?: (arg: { value: string }) => void }` — wszystkie call sites już tak wołały.
- [x] fixed · structure · `src/lib/utils/upload-file-client.ts`, `discard-orphaned-uploads.ts` ·
      moduły czysto fakturowe (wszystkie eksporty) siedziały w bezdomenowym `lib/utils/`, a nowy
      prymityw importował je przez ten szew. Przeniesione do `src/lib/invoices/`; 7 importów zaktualizowanych.
- [x] fixed · structure · `bulk-expense-form.ts:59`, `edit-transfer-form-api.ts:10` · ta sama sztuczka
      z probe `withForm` napisana dwa razy, z bliźniaczymi komentarzami. Wyciągnięta do
      `src/components/forms/hooks/form-api-of.ts` (`FormApiOfT<TValues>`); oba typy to teraz jedna linia.
- [x] dismissed · structure · `plane-amount-field.tsx:1`, `expense-category-field.tsx:1`,
      `line-items-field.tsx:26` · współdzielony `form-fields/` importuje konkretne typy API z folderów
      trzech formularzy — inwersja zależności. Świadoma: to wrappery jednego konsumenta, a unia nazw
      w `FormWithFieldT` odwróciłaby zależność w drugą stronę. Rozstrzygnięte w EX-733.
- [x] dropped · structure · `bulk-expense-form.ts:65` · `BulkExpenseFormApiT` nie mieszka w pliku
      `*-form-api.ts` jak dwa pozostałe. Po wyciągnięciu `FormApiOfT` to jedna linia typu w pliku,
      który i tak jest jego naturalnym domem — przenoszenie samo w sobie nic nie kupuje.
- [x] fixed · comment-noise · `form-hooks.ts:23,31,46` · trzy bloki, ~25 linii: docblock
      `AppFieldComponentsT`, docblock `FormWithFieldT` (połowa to narracja o stanie sprzed zmiany
      — „used to take `form: any`") i trzylinijkowy komentarz nad `listeners`. Przycięte do faktów,
      których kod nie niesie.
- [x] fixed · comment-noise · `deposit-form-api.ts:18`, `edit-transfer-form-api.ts:10` · 9- i 7-linijkowe
      docbloki, w tym akapit porównujący, jak _inny plik_ wyprowadza ten sam typ. Zostały jednolinijkowce
      (a duplikat sztuczki zniknął razem z dedupem powyżej).
- [x] fixed · comment-noise · `cash-register-field.tsx:19,24` · dwa komentarze o mechanice TS
      (`<TName extends string>`, dlaczego `as TName` się kompiluje) — usunięte; pierwszy był na dodatek
      niezgodny z faktami (mówił „four call sites … four different ones" i wyliczał trzy, przy pięciu call sites).
- [x] fixed · comment-noise · `entity-combobox-field.tsx:53`, `expense-category-field.tsx:6` · narracja
      o wyborze generyka i „wzięliśmy lepszy typ" — jedno i drugie mówi już sygnatura. Usunięte.
- [x] fixed · comment-noise · `plane-amount-field.tsx:7`, `use-field-value.ts:7`,
      `use-form-submit.ts:35`, `edit-transfer-form.tsx:88`, `submit-with-invoice-pages.ts:5` ·
      przycięte do jednego powodu każdy; wycięta narracja „tu tego brakowało" (stan sprzed commita,
      który git i tak zapisuje) i inwentarz trzech ścieżek błędu stojących sześć linii niżej.
- [x] dropped · comment-noise · `form-hooks.ts:53`, `deposit-form-api.ts:7` · dwa komentarze przeszły
      strip test bez zmian (jednolinijkowe uzasadnienie `store: unknown`; reguła domenowa o kwocie brutto).
- [ ] 🔵 OBSERVATION · surfaced · suite · `src/hooks/use-latest-request.ts:15` · `eslint` zgłasza
      **error** `react-hooks/refs` — „Cannot access refs during render". Plik nietknięty przez ten slice
      i przez ten change; zgłaszam, bo blokuje `pnpm lint` całego repo. **Nie naprawiam** — to inny
      podsystem i osobna decyzja.

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
nietknięta, backfill produkcyjny wykonuje człowiek. Jeden `[ ]` w tym przebiegu to świadomie
zgłoszona obserwacja spoza slice'a, nie dług tej zmiany.
