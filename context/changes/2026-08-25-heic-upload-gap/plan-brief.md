# HEIC upload gap — Plan Brief

> Full plan: `context/changes/2026-08-25-heic-upload-gap/plan.md`

## What & Why

HEIC→JPEG conversion is browser-only. One pick surface — the edit-transfer dialog — never runs it,
so it stores raw iPhone photos and also skips compression and the 4 MB guard. Eighteen legacy rows
are already HEIC, weighing ~2.8 MB each with no thumbnail. Close the hole, delete a hand-written type
mirror found alongside it, and convert the eighteen.

## Starting Point

Five of six pick surfaces call `ingestFiles()`. `edit-transfer-form.tsx:87` reads
`fileRef.current.files` raw and uploads them. The hole is on `main` and `staging`; it admitted
`media.id = 1052` four days after the fix shipped. Separately, `AppFieldComponentsT` restates the
TanStack component map by hand across 58 annotations in 14 files.

## Desired End State

No pick surface uploads an unconverted image. `AppFieldComponentsT` is gone and `field` is inferred.
`media` holds zero `image/heic` rows; all eighteen are JPEGs with dimensions and thumbnails, links
intact, on staging and then production.

## Key Decisions Made

| Decision           | Choice                                                         | Why                                                                                                | Source |
| ------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------ |
| Backfill mechanics | Payload Local API `update` with the JPEG                       | Payload regenerates filename/mime/size/dimensions/thumbnail; the Blob adapter swaps the object     | Plan   |
| Rollback window    | Local snapshot of all 18 originals **before** the first update | Payload deletes the old blob itself, _before_ the new upload — there is no in-store window to keep | Plan   |
| Old blob           | Deleted by Payload, not by us                                  | `plugin-cloud-storage/afterChange` already does it; a second deletion step is unreachable          | Plan   |
| Conversion tool    | `heif-convert` + `magick -auto-orient`                         | `sips` produced a file **larger** than the HEIC and left rotation in EXIF                          | Plan   |
| Conversion params  | 1920×1080 fit, q60                                             | Mirrors `compress-image.ts`, so backfilled files match fresh uploads. Measured 2.67 MB → 82 KB     | Plan   |
| #6 fix shape       | Ingest at pick time                                            | Matches `inspection-form`, the closest sibling; submit cannot race an unfinished conversion        | Plan   |
| Regression guard   | Unit on an extracted React-free helper + E2E filed to backlog  | Repo keeps React-free logic one layer out, which is why it has never needed `renderHook`           | Plan   |
| Order              | #6 → mirror → backfill                                         | Backfill must not race a fresh HEIC arriving through the open hole                                 | Plan   |
| Admin panel / REST | Left unconverted                                               | Payload's own code; needs server-side conversion. Owner's call                                     | Plan   |

## Scope

**In scope:** edit-transfer ingest + shared extraction; `AppFieldComponentsT` removal (58 sites, 14
files) incl. the `FormFileInput` deletion; backfill script with verify; staging run; production
runbook entry.

**Out of scope:** `/admin` and `POST /api/media`; server-side conversion; any change to the five
surfaces that already ingest correctly.

## Architecture / Approach

```
pick → ingestPickedFiles()  ← new React-free core, unit-tested
         ↑ used by
       useFilePickIngest()  ← busy flag + toasts, shared
         ↑ used by
       edit-transfer-form (fixed) + inspection-form (dedup)

backfill: snapshot ALL 18 → heif-convert → magick → payload.update → verify
          └── the snapshot IS the rollback; Payload deletes the old blob first
```

## Phases at a Glance

| Phase               | What it delivers                                 | Key risk                                                                                 |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 1. Close the hole   | Ingest at pick time, shared with inspection-form | Re-anchoring `hasPickedFiles`/`fileInputKey` off the ref can break the preview toggle    |
| 2. Drop the mirror  | `AppFieldComponentsT` and 58 annotations gone    | Mechanical but wide — 14 files; `tsc` is the gate                                        |
| 3. Backfill staging | 18 rows converted + verify report                | Payload deletes the old blob before uploading; the pre-run snapshot is the only fallback |
| 4. Backfill prod    | Same, human-run                                  | Tax-retained invoices, no undelete in Blob                                               |

**Prerequisites:** `heif-convert` + `magick` on the operator's machine (both present); preview DB and
preview blob store reachable; blob backup workflow green.
**Estimated effort:** ~1 session for phases 1–3; phase 4 is a short human-run step afterwards.

## Open Risks & Assumptions

- The 4 remaining `image/heic` rows' bytes are assumed present in the preview store; a file newer
  than the last preview restore would 404 and must be skipped rather than failing the run.
- `heif-convert` was validated on one real file (`IMG_5259-e53451.HEIC`). A HEIC variant it cannot
  decode must fail that row loudly and leave it untouched, not half-convert it.
- Phase 4 depends on a human; the change is not fully done until production is converted.

## Success Criteria (Summary)

- A HEIC picked in the edit-transfer dialog is stored as a JPEG, and an oversize file is refused with
  a message instead of a 413.
- `grep -r "AppFieldComponentsT" src` returns nothing and the app builds.
- `select count(*) from media where mime_type='image/heic'` returns 0 on staging, then on production.
