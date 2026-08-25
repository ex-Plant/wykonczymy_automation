# HEIC upload gap — Implementation Plan

## Overview

Three streams, in this order: close the one upload surface that skips HEIC conversion, delete the
hand-written `AppFieldComponentsT` mirror, then backfill the 18 legacy `image/heic` media rows to
JPEG — staging first, production by hand afterwards.

## Current State Analysis

HEIC→JPEG conversion (EX-457) lives **only** in the browser: `ingestFiles()` → `processUploadFile()`.
The server converts nothing — `collections/media.ts` only sanitizes the filename, and
`upload.mimeTypes: ['image/*']` admits `image/heic`. Every writer that reaches
`payload.create({collection:'media'})` without the browser pipeline stores raw bytes.

Of the six pick surfaces, five ingest correctly. `edit-transfer-form.tsx:87→96` does not — it reads
raw `fileRef.current.files` and hands them straight to `resolveInvoicePageIds()`. It therefore also
bypasses compression and the 4 MB guard (`413 FUNCTION_PAYLOAD_TOO_LARGE`, uncatchable in-function).
The hole is on `origin/main` and on `staging`; it admitted `media.id = 1052` four days after the fix
shipped.

`AppFieldComponentsT` (`forms/types/form-types.ts`) restates by hand the component map registered in
`form-hooks.ts` — 58 annotations across 14 files. Measured: an **extra** entry breaks every annotated
call site; a **missing** entry or a **wrong prop type** is caught only where that component/prop is
actually used, and there the mirror's declaration overrides the real component. Removing the
annotations entirely from `worker-form.tsx` leaves `tsc` green — TanStack infers `field` itself.

## Desired End State

No pick surface reaches `/api/upload-file` with an unconverted image. `AppFieldComponentsT` does not
exist and no form annotates its field callback. The `media` table holds zero `image/heic` rows;
each of the 18 carries a JPEG with dimensions and a thumbnail, its `transactions_rels` link intact.

### Key Discoveries

- **`media.filename` IS the blob key** (`scripts/blob-restore.mjs:4-7`; `media.url` is relative).
  `.HEIC` → `.jpg` is therefore always a new blob, never an in-place byte swap.
- **Payload deletes the old blob itself.** `plugin-cloud-storage/dist/hooks/afterChange.js` — on
  `operation === 'update'` carrying a file it deletes `previousDoc.filename` plus every
  `previousDoc.sizes[*].filename`, and does so **before** uploading the replacement. A separate
  deletion step is impossible via the Local API, and a failure in between leaves only the FTP backup.
  → the rollback window is a **local snapshot taken before the run**, not a window inside the store.
- **`sharp` here cannot decode HEIC**: `libvips 8.17.3`, `heif input fileSuffix: ['.avif']`. Hence
  18/18 rows with `width/height = NULL` and no thumbnail (617/617 JPEGs have both).
- **Conversion tool: `heif-convert`, not `sips`.** Measured on `IMG_5259-e53451.HEIC`: `sips -s
formatOptions 70` produced **3.52 MB — larger than the 2.79 MB HEIC** and left the rotation in EXIF
  (`orientation=upper-right`). `heif-convert` + `magick -auto-orient` bakes the rotation in.
- **Target pipeline matches the client's**: `heif-convert -q 100` → `magick -auto-orient -resize
1920x1080\> -quality 60`, mirroring `compress-image.ts` (`MAX_WIDTH 1920`, `MAX_HEIGHT 1080`,
  `QUALITY 0.6`). Measured: 2.67 MB → **82 KB (97% smaller)**.
- **Staging is a faithful rehearsal**: the preview DB holds the same 18 rows including `id=1052`, and
  the preview blob store holds the bytes.
- `inspection-form.tsx:72-86` already hand-rolls the pick→ingest→report→compact block that
  `edit-transfer-form` needs — extracting it is a real dedup, not a speculative one.

## What We're NOT Doing

- **Payload admin panel (`/admin`) and `POST /api/media`** stay unconverted. Both are Payload's own
  code; closing them needs server-side conversion in a collection hook. Owner's call: out of scope.
- No compat shim or two-step migration for the converted rows — `transactions_rels` links by
  `media_id`, which does not change.
- Not touching `AppFieldComponentsT`'s neighbour `FormControlPropsT`, which is a real shared type.

## Implementation Approach

Phase 1 closes the source before Phase 3 touches data, so the backfill cannot race a fresh HEIC
arriving through the same hole. Phase 2 sits between them because it rewrites
`edit-transfer-form.tsx` among 13 other files and would otherwise conflict with Phase 1.

---

## Phase 1: Close the edit-transfer upload hole

### Overview

Ingest at pick time, matching `inspection-form` — the closest sibling (same `FileInput`, same
apply-on-save semantics). Extract the shared block so both surfaces run one implementation.

### Changes Required:

#### 1. React-free ingest core

**File**: `src/lib/invoices/ingest-picked-files.ts` (new)

**Intent**: The non-row pick surfaces want "give me the files that survived ingest, plus what was
blocked" — `ingestFiles` returns a positional array with holes, so both callers compact it by hand.
Own that shape once.

**Contract**: `ingestPickedFiles(picked: File[]): Promise<{ files: File[]; blocked: BlockedFileError[] }>`.
No toasts, no React — reporting stays with the caller.

#### 2. Shared pick-ingest hook

**File**: `src/components/forms/hooks/use-file-pick-ingest.ts` (new)

**Intent**: The busy flag, the blocked-file toast and the load-bearing `finally` that releases the
form on an unexpected rejection are identical in both forms. One hook owns them.

**Contract**: `useFilePickIngest()` → `{ files, isIngesting, ingestPicked(picked: File[]), reset() }`.
Keeps `inspection-form`'s existing behaviour verbatim, including the `TODO(EX-449) SENTRY-REQUIRED`
marker and the `setFiles([])` fallback.

#### 3. Wire the edit-transfer form

**File**: `src/components/forms/edit-transfer-form/edit-transfer-form.tsx`

**Intent**: Replace the raw `fileRef.current.files` read at submit with the ingested files held in
state, so conversion, compression and the 4 MB guard all run at pick time.

**Contract**: `handleFileChange` calls `ingestPicked`; `onSubmit` passes `files` from the hook to
`resolveInvoicePageIds`. `hasPickedFiles` and `fileInputKey` re-anchor on the hook's state rather
than the ref. Submit must be disabled while `isIngesting`.

#### 4. Migrate the inspection form onto the hook

**File**: `src/components/forms/inspection-form/inspection-form.tsx`

**Intent**: Remove the now-duplicated local `ingestPicked` / `files` / `isIngesting`.

**Contract**: Behaviour unchanged — same toasts, same disabled-while-ingesting submit.

### Success Criteria:

#### Automated Verification:

- New spec passes: `pnpm exec vitest run src/__tests__/lib/invoices/ingest-picked-files.test.ts`
- Existing ingest specs still pass: `pnpm exec vitest run src/__tests__/lib/invoices/ingest-files.test.ts src/__tests__/process-upload-file.test.ts`

#### Manual Verification:

- Edycja przelewu → „Dodaj faktury" z plikiem HEIC z iPhone'a → zapis → podgląd pokazuje JPEG
- Plik >4 MB w tym samym dialogu jest odrzucony z komunikatem, a nie leci w 413
- Przegląd pojazdu — załączniki działają jak przed zmianą

---

## Phase 2: Delete the AppFieldComponentsT mirror

### Overview

Remove the hand-written duplicate and let TanStack's inference type `field`. Includes the already-
applied `FormFileInput` deletion, which is part of the same dead surface.

### Changes Required:

#### 1. Drop the type

**File**: `src/components/forms/types/form-types.ts`

**Intent**: Remove `AppFieldComponentsT`. `FormControlPropsT` stays — it is a genuine shared type.

**Contract**: The exported surface loses exactly one type.

#### 2. Drop the annotations

**Files**: the 13 form/field files that import it (`investment-form`, `inspection-form`,
`vehicle-form`, `worker-form`, `edit-transfer-form`, `line-items-field`, `plane-amount-field`,
`amount-field`, `date-field`, `cash-register-field`, `description-field`,
`entity-combobox-field`, `expense-category-field`)

**Intent**: `(field: AppFieldComponentsT) =>` becomes `(field) =>`; drop the now-unused import.

**Contract**: No behaviour change — inference replaces the annotation. Verified on `worker-form.tsx`:
annotations removed, `tsc` green.

### Success Criteria:

#### Automated Verification:

- No references remain: `grep -r "AppFieldComponentsT" src` returns nothing
- `FormFileInput` is gone: `grep -r "FormFileInput" src` returns nothing

#### Manual Verification:

- Formularze wydatku, przelewu, inwestycji, pracownika, pojazdu i przeglądu otwierają się i zapisują

---

## Phase 3: Backfill the 18 HEIC rows — staging

### Overview

A one-off script under `src/scripts/`, following the Local-API pattern of its neighbours. Snapshot
first, then convert and update through Payload so filename, mime, size, dimensions and thumbnail are
all regenerated by the framework.

### Changes Required:

#### 1. The backfill script

**File**: `src/scripts/backfill-heic-media.ts` (new)

**Intent**: For every `media` row with `mime_type = 'image/heic'`: download the original to a local
snapshot dir, convert, then `payload.update` with the JPEG so Payload rewrites the row and the Blob
adapter swaps the object.

**Contract**: Env-driven target (`DB_POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN`), matching the
`node --env-file=.env --import tsx` invocation its neighbours use. Flags: `--dry-run`,
`--snapshot-dir <path>` (default `dumps/heic-backfill/`), `--limit <n>`.

**Ordering — load-bearing:** the snapshot of ALL rows completes before the first `payload.update`.
Payload's `afterChange` deletes the previous blob _before_ uploading the replacement, so once an
update starts there is no in-store copy left to fall back on.

Conversion pipeline (matches `compress-image.ts` — do not improvise the numbers):

```
heif-convert -q 100 <in>.heic <tmp>.jpg
magick <tmp>.jpg -auto-orient -resize 1920x1080\> -quality 60 <out>.jpg
```

#### 2. Verification report

**File**: same script, `--verify` mode

**Intent**: Prove the run rather than assume it.

**Contract**: Asserts per row — `mime_type = 'image/jpeg'`, `width`/`height` non-null,
`sizes_thumbnail_filename` non-null, filename ends `.jpg`, the served bytes start with the JPEG magic
number, and the `transactions_rels` link still resolves. Exits non-zero on any failure.

### Success Criteria:

#### Automated Verification:

- Dry run enumerates exactly 18 rows: `node --env-file=.env --import tsx src/scripts/backfill-heic-media.ts --dry-run`
- Post-run verify is green against the preview DB: `--verify` exits 0 with 18/18
- No HEIC rows remain on staging: `select count(*) from media where mime_type='image/heic'` → 0

#### Manual Verification:

- Kilka przekonwertowanych faktur otwiera się na stagingu i jest czytelnych oraz poprawnie obróconych
- Miniatura pokazuje się w panelu `/admin`
- `transactions.id = 3626` dalej pokazuje swoją fakturę

---

## Phase 4: Backfill production

### Overview

Same script, production target, **run by a human** — AGENTS.md forbids the agent touching the Neon
prod URL or the production blob store.

### Changes Required:

#### 1. Runbook entry

**File**: `context/reference/blob-recovery-runbook.md`

**Intent**: Record the production invocation and its rollback so the step is repeatable and the
snapshot dir's purpose is not lost.

**Contract**: A section naming the exact command, the pre-run snapshot requirement, the verify step,
and the rollback (re-put the snapshot via `blob-restore.mjs --allow-prod`, then revert the rows).

### Success Criteria:

#### Automated Verification:

- None — this phase is executed by a human against production, gated on Phase 3's verify being green.

#### Manual Verification:

- Człowiek odpala backfill na prodzie i `--verify` zwraca 18/18
- Kilka faktur otwiera się na produkcji

---

## Testing Strategy

### Unit Tests:

- `ingestPickedFiles` — compacts blocked holes out, surfaces `BlockedFileError[]`, returns an empty
  result for an empty pick, and does not swallow a non-`BlockedFileError` rejection.

### Browser E2E:

Deferred to the E2E backlog (Linear, label `e2e-backlog`): pick a HEIC in the edit-transfer dialog,
save, assert the persisted `media` row is `image/jpeg`. Carries this test disposition:
`test-driven-debugging · e2e — the seam that failed is browser → /api/upload-file, which no unit
test crosses.`

## Migration Notes

Kosztorys data is throwaway; `media` is **not** — these are tax-retained invoices restored from prod
dumps. The snapshot dir is the rollback path and must exist before the first update.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Full suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Change identity + audit findings: `context/changes/2026-08-25-heic-upload-gap/change.md`
- Blob invariants: `scripts/blob-restore.mjs:1-30`, `context/reference/blob-recovery-runbook.md`
- Client conversion pipeline: `src/lib/utils/process-upload-file.ts`, `src/lib/utils/compress-image.ts`
- Sibling pick surface to mirror: `src/components/forms/inspection-form/inspection-form.tsx:72-86`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Close the edit-transfer upload hole

#### Automated

- [x] 1.1 New spec passes: ingest-picked-files.test.ts
- [x] 1.2 Existing ingest specs still pass
- [x] 1.3 Browser E2E filed to the E2E backlog — EX-732

### Phase 2: Delete the AppFieldComponentsT mirror

#### Automated

- [ ] 2.1 No references to AppFieldComponentsT remain
- [ ] 2.2 FormFileInput is gone

### Phase 3: Backfill the 18 HEIC rows — staging

#### Automated

- [ ] 3.1 Dry run enumerates exactly 18 rows
- [ ] 3.2 Post-run verify green against preview DB (18/18)
- [ ] 3.3 No HEIC rows remain on staging

### Phase 4: Backfill production

#### Automated

- [ ] 4.1 None — human-executed, gated on 3.2
