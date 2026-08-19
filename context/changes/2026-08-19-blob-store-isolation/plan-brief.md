# Plan Brief: Blob store isolation

**Change:** `blob-store-isolation` · **Complexity:** LOW · **Phases:** 4

## The problem in one line

Local dev holds the production Vercel Blob token, so deleting a test expense on localhost
permanently destroys a real, tax-retained faktura — Blob has no undelete.

## What we're doing

Swap non-prod onto the preview store, then make the mistake structurally impossible.

| #   | Phase                                                                  | Lands in                                                                               |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Point non-prod at the preview store                                    | `.env` (gitignored), Vercel Development env var                                        |
| 2   | Env layer refuses a prod Blob token outside production                 | `src/lib/env/schema.ts` + new spec `src/__tests__/lib/env/schema.test.ts`              |
| 3   | `--allow-prod` guard in the restore tool + `pnpm blob:refresh:preview` | `scripts/blob-restore.mjs`, `package.json`                                             |
| 4   | Write the rule down                                                    | `AGENTS.md`, `context/changes/blob-backup/runbook.md`, `context/foundation/lessons.md` |

## Decisions taken

- **Guard lives in the env layer**, not in a script or a comment — `serverSchema` is parsed eagerly
  behind the build gate, so a wrong token is a startup failure, not a latent hazard.
- **Guard keys on `VERCEL_ENV !== 'production'`**, never `NODE_ENV` — a local `next build` sets
  `NODE_ENV=production` and would silently disable the guard exactly where it matters.
- **The prod token stays in `.env`**, renamed `BLOB_READ_WRITE_TOKEN_PROD`, so the backup scripts
  keep working. That is why Phase 3 exists: the scripts bypass the env layer, so the write tool
  needs its own `--allow-prod`.
- **Refresh is manual** (`pnpm blob:refresh:preview`, delta-only via `--skip-existing`). Rejected an
  automatic schedule: exceeding the Blob advanced-ops quota is what suspended every store on the
  account on 2026-08-19.
- **A missing file stays a plain 404.** The preview store is a point-in-time copy; no placeholder UI.

## Ordering is load-bearing

Phase 2 rejects the token Phase 1 removes. Landing 2 first breaks `pnpm dev`, `pnpm build` and every
server-touching test until 1 lands. Do not reorder.

## Not doing

Preview/staging (already switched) · production behaviour · `next.config.ts` (wildcard host already
covers the preview store) · automatic refresh · placeholder UI for missing media.

Full plan: `plan.md`
