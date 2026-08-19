# Blob store isolation — Implementation Plan

## Overview

Local dev currently holds the **production** Vercel Blob token, so a routine `delete` on localhost
permanently destroys a real, tax-retained faktura. This change points local dev (and the Vercel
Development environment) at the preview store, then makes the mistake structurally impossible: the
env layer refuses a production Blob token outside production, and the restore tool refuses to write
to the production store without an explicit flag.

## Current State Analysis

- `.env` carries `BLOB_READ_WRITE_TOKEN=vercel_blob_rw_oJHLWhvHKJrsgWiN_…` — the **production**
  store (`wykonczymy-blob`, fra1, public, 2345 blobs).
- The local DB is a restored prod dump, so `media.filename` values are the real invoice keys. A
  local delete therefore targets the real production object, not a lookalike.
- Three live paths reach `del()` on that store, all through the plugin's `handleDelete`:
  - `src/hooks/transfers/delete-invoice-media.ts` — `afterDelete` on an expense
  - `src/lib/invoices/delete-unreferenced-media.ts`
  - `src/lib/utils/discard-orphaned-uploads.ts`
- Vercel Blob has **no versioning, no undelete, no PITR**. `del()` and same-key `put()` are final.
- Databases are already isolated per environment (prod Neon / dev 5433 / e2e 5435). The Blob store
  is the single plane still shared with production.
- **Preview/staging is already switched** — the Preview environment resolves
  `BLOB_READ_WRITE_TOKEN` to `store_rNjU0fDb7Sz8bHVA` (`wykonczymy-blob-preview`, fra1, public,
  2347 blobs restored 2026-08-19). Nothing to do there.
- `src/lib/env/schema.ts:16` validates the token as `z.string().min(1)` only — but the same schema
  already declares `VERCEL_ENV: z.enum(['production','preview','development']).optional()`, so the
  env layer knows which environment it is running in.
- `src/lib/env/server.ts` does `serverSchema.parse(process.env)` eagerly at import, and
  `(frontend)/layout.tsx` imports it as the build gate — a refinement here fails loudly at startup.
- `next.config.ts:38` allows `*.public.blob.vercel-storage.com` (wildcard), so the preview store's
  host needs no config change.
- `scripts/blob-{mirror,restore,snapshot}.mjs` read `process.env.BLOB_READ_WRITE_TOKEN` directly and
  do **not** import the env layer — the app-side guard cannot protect them.

### Key Discoveries:

- The store id is **public** (it is the CDN hostname: `ojhlwhvhkjrsgwin.public.blob.vercel-storage.com`)
  and appears verbatim inside the token (`vercel_blob_rw_<STORE_ID>_…`). It can be hardcoded in the
  schema without leaking anything.
- `serverSchema.parse()` is a non-strict zod object, so an extra `BLOB_READ_WRITE_TOKEN_PROD` key in
  `process.env` passes through untouched — no schema entry needed for it.
- `src/__tests__/lib/env/` does not exist yet. `schema.ts` is deliberately side-effect-free and does
  **not** import `server-only`, so it is directly unit-testable without the env stubs that
  `AGENTS.md` describes for the entry modules.
- The incident this change prevents already happened once: on 2026-08-19 a stale `tok.txt` in a
  scratchpad sent 7 `put()` calls to production instead of preview. Bytes were identical so nothing
  was lost — the safety was luck, not design.

## Desired End State

- Local dev and the Vercel Development environment read and write the **preview** store only.
- Booting the app anywhere except production with a production Blob token **fails immediately** with
  a message naming the problem.
- Writing to the production store from `blob-restore.mjs` requires an explicit `--allow-prod`.
- Refreshing the preview store from the FTP mirror is one documented command.

Verify by: `pnpm dev` boots on the preview token; temporarily pasting the prod token makes it refuse
to start; `blob-restore.mjs` with a prod token and no flag exits non-zero without issuing a `put()`.

## What We're NOT Doing

- Not touching the Preview/staging environment — already switched.
- Not changing production behaviour, the plugin config, or `next.config.ts`.
- Not adding a placeholder UI for media missing from the preview store — a 404 stays a 404.
- Not scheduling an automatic preview-store refresh (rejected: constant Blob operation spend the day
  after exceeding that exact quota took production down).
- Not backfilling or reconciling the preview store against prod beyond the existing restore.
- Not touching `blob-snapshot.mjs` / `blob-mirror.mjs`, which are read-only against their store.

## Implementation Approach

Swap first, then lock. The guard must land **after** the token swap, or local dev stops booting in
between. Each subsequent phase narrows the blast radius one layer further out: env layer for the
app, an explicit flag for the write tool, documentation for the human.

## Critical Implementation Details

**Ordering is load-bearing.** Phase 2's refinement rejects the token that Phase 1 removes. Landing
Phase 2 first breaks `pnpm dev`, `pnpm build`, and every server-touching test on the machine until
Phase 1 lands. Do not reorder.

**The guard keys on `VERCEL_ENV !== 'production'`.** Locally `VERCEL_ENV` is absent (so the guard is
active), on preview it is `'preview'` (active), and in a production build it is `'production'`
(inactive). Do not reach for `NODE_ENV` — a local `next build` sets it to `production` while still
being a developer's machine, which would silently disable the guard exactly where it matters most.

---

## Phase 1: Point non-prod at the preview store

### Overview

Move the production token out of the way and put the preview token in its place, locally and in the
Vercel Development environment.

### Changes Required:

#### 1. Local environment file

**File**: `.env` (gitignored, not committed)

**Intent**: Local dev must resolve `BLOB_READ_WRITE_TOKEN` to the preview store, while the backup
and restore scripts keep a deliberate route to production.

**Contract**: `BLOB_READ_WRITE_TOKEN` = the `store_rNjU0fDb7Sz8bHVA` token (preview). The existing
production token moves verbatim to a new key `BLOB_READ_WRITE_TOKEN_PROD`. No other key changes.
The preview token is readable with `vercel env pull` against the Preview environment.

#### 2. Vercel Development environment

**File**: Vercel project settings (no repo file)

**Intent**: Stop `vercel env pull` from restoring the production token onto a developer machine —
otherwise the next pull quietly undoes Phase 1.

**Contract**: The Development-scoped `BLOB_READ_WRITE_TOKEN` holds the preview store token.
Production and Preview scopes are left untouched.

**Note**: `vercel env rm NAME <env>` deletes the variable across _all_ environments it spans, not
just the named one (this bit us on 2026-08-19). Add/overwrite with
`vercel env add NAME development --value "$TOK" --force --yes` rather than removing first.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check exists: this phase edits a gitignored secrets file and a Vercel
  dashboard setting, neither of which is reachable from a test. Stated explicitly rather than padded
  with a whole-tree gate.

#### Manual Verification:

- `pnpm dev` boots and an existing invoice renders (bytes now served by the preview store)
- Uploading a new invoice locally succeeds, and the file appears in `wykonczymy-blob-preview`, not in `wykonczymy-blob`
- `vercel env pull` into a scratch file yields the preview token for Development, not the production one

---

## Phase 2: Refuse a production Blob token outside production

### Overview

Make the swap self-enforcing, so re-introducing the production token is a startup failure rather
than a silent hazard.

### Changes Required:

#### 1. Env schema refinement

**File**: `src/lib/env/schema.ts`

**Intent**: Reject a `BLOB_READ_WRITE_TOKEN` belonging to the production store whenever the runtime
is not production, with an error that names the store and says what to do. The store id is public
(it is the CDN hostname), so it belongs in the schema as a named constant.

**Contract**: `serverSchema` gains a `.superRefine()` (it must read two fields, so a field-level
`.refine()` will not do) that fails on
`VERCEL_ENV !== 'production' && BLOB_READ_WRITE_TOKEN.startsWith('vercel_blob_rw_oJHLWhvHKJrsgWiN_')`.
The issue is attached to `path: ['BLOB_READ_WRITE_TOKEN']`. Export the store-id constant so the test
and any future tooling reference one definition.

#### 2. Unit test

**File**: `src/__tests__/lib/env/schema.test.ts` (new; creates `src/__tests__/lib/env/`)

**Intent**: Pin the guard's behaviour in both directions so a later refactor of the schema cannot
quietly drop it.

**Contract**: Parse a minimal valid env object three ways — production token + `VERCEL_ENV:
'production'` passes; production token + `VERCEL_ENV` absent fails on
`BLOB_READ_WRITE_TOKEN`; preview token + `VERCEL_ENV` absent passes. Build the base object from a
fixture helper so unrelated required vars do not obscure the assertion.

### Success Criteria:

#### Automated Verification:

- Guard spec passes: `pnpm exec vitest run src/__tests__/lib/env/schema.test.ts`

#### Manual Verification:

- Temporarily pasting the production token into `.env` makes `pnpm dev` refuse to start, and the error names `BLOB_READ_WRITE_TOKEN`

---

## Phase 3: Refresh command, and a write guard on the restore tool

### Overview

The app is protected by Phase 2, but the scripts are not — they read `process.env` directly and
never import the env layer. Close the write path, and make keeping the preview store current a
single command.

### Changes Required:

#### 1. Production-write guard in the restore tool

**File**: `scripts/blob-restore.mjs`

**Intent**: The one tool that issues `put()` must refuse to target production unless the operator
says so in the command line. This is the exact accident of 2026-08-19, where a stale token variable
pointed at prod and nothing objected.

**Contract**: Before any upload, derive the target store id from the token
(`vercel_blob_rw_<STORE_ID>_…`); if it is the production store and `--allow-prod` was not passed,
print what was detected and `process.exit(1)` **without** issuing a request. With the flag, print a
one-line banner naming the target store and continue. Keep the script dependency-free.

#### 2. Preview-store refresh command

**File**: `package.json`

**Intent**: Give the 404-on-fresh-invoice problem a one-command answer, so the staleness cost of
this change is bounded.

**Contract**: A `blob:refresh:preview` script that pulls `/blob_backups/media/` from FTP into a
local scratch directory and runs `scripts/blob-restore.mjs --skip-existing` against the preview
token — delta only, so cost scales with what is new, not with store size. It reads the preview token
from `.env` (`BLOB_READ_WRITE_TOKEN`, which after Phase 1 _is_ the preview one) and never touches
`BLOB_READ_WRITE_TOKEN_PROD`.

### Success Criteria:

#### Automated Verification:

- Guard refuses production without the flag: running the tool with the prod token and `--dry-run` exits non-zero and prints no upload lines
- Guard allows the preview store: the same invocation against the preview token proceeds past the check

#### Manual Verification:

- `pnpm blob:refresh:preview` completes and reports the delta it uploaded (0 immediately after a fresh restore)
- After a `pnpm db:import` from a newer dump, the same command makes previously-404ing invoices render locally

---

## Phase 4: Write the rule down where it is read

### Overview

The failure mode is an agent or a human pasting the production token back. Phase 2 stops the app and
Phase 3 stops the tool; this phase stops the intent.

### Changes Required:

#### 1. Repo instructions

**File**: `AGENTS.md`

**Intent**: State that the production Blob token belongs to production only, that local and preview
use the preview store, and that the guard exists — so the next agent reads the rule before it reads
a token out of a stray file.

**Contract**: A short block under "Databases And Live Data" (where the equivalent Postgres rule
already lives), naming both stores, `BLOB_READ_WRITE_TOKEN_PROD`, the env-layer guard, and
`--allow-prod`. Cross-reference the runbook rather than restating it.

#### 2. Backup runbook

**File**: `context/changes/blob-backup/runbook.md`

**Intent**: The runbook's §5 already tells the operator to assert the store id from the token; point
it at the mechanised version of that instruction now that one exists.

**Contract**: Update §5 step 2 to reference `--allow-prod` as the enforcement, and note in §2 that
non-prod environments no longer hold the production token.

#### 3. Local-dev expectations

**File**: `context/foundation/lessons.md`

**Intent**: Record that a 404 on a recently-uploaded invoice in local dev is expected — the preview
store is a point-in-time copy — together with the command that fixes it.

**Contract**: One entry naming the symptom, the cause, and `pnpm blob:refresh:preview`.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check: this phase is prose only.

#### Manual Verification:

- A reader following `AGENTS.md` alone can tell which store each environment uses and how to reach production deliberately

---

## Testing Strategy

### Unit Tests:

- The env guard, both directions (production token rejected outside production; preview token
  accepted; production token accepted when `VERCEL_ENV === 'production'`).

### Integration Tests:

- None. The change has no DB surface and no server-action surface; the meaningful boundaries are a
  zod parse (covered above) and a CLI exit code (covered by the Phase 3 automated checks).

### Manual Testing Steps:

1. Boot `pnpm dev`, open a transfer with an invoice, confirm it renders from the preview store.
2. Upload a new invoice locally; confirm it lands in `wykonczymy-blob-preview` and **not** in `wykonczymy-blob`.
3. Delete that test expense; confirm the blob disappears from the **preview** store and the production store's file count is unchanged.
4. Paste the production token into `.env` temporarily; confirm `pnpm dev` refuses to boot; restore the preview token.
5. Run `scripts/blob-restore.mjs` with the production token and no `--allow-prod`; confirm it exits without uploading.

## Performance Considerations

None on the request path. The only cost is Blob **Advanced Operations** during a refresh — one
`put()` per new file, delta-only via `--skip-existing`. Relevant because exceeding that quota is what
suspended every store on the account on 2026-08-19.

## Migration Notes

No data migration. The preview store already holds a full restore (2347 files, 2026-08-19). Media
uploaded to production after that date will 404 locally until a refresh — expected, documented in
Phase 4, fixed by Phase 3's command.

Rollback is a one-line revert of `.env` plus reverting the Phase 2 commit; nothing is destroyed by
this change and no production state is touched.

## Whole-tree Gate

Run **once**, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Test suite passes: `pnpm test`

## References

- Change identity: `context/changes/2026-08-19-blob-store-isolation/change.md`
- Backup & recovery runbook (EX-459): `context/changes/blob-backup/runbook.md`
- Delete paths: `src/hooks/transfers/delete-invoice-media.ts`, `src/lib/invoices/delete-unreferenced-media.ts`, `src/lib/utils/discard-orphaned-uploads.ts`
- Env layer: `src/lib/env/schema.ts:16`, `src/lib/env/server.ts`
- Plugin delete handler: `@payloadcms/storage-vercel-blob/dist/handleDelete.js`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Point non-prod at the preview store

#### Automated

- [x] 1.1 No phase-scoped automated check (secrets file + Vercel dashboard only) — e2980b2b

### Phase 2: Refuse a production Blob token outside production

#### Automated

- [x] 2.1 Guard spec passes: `pnpm exec vitest run src/__tests__/lib/env/schema.test.ts`

### Phase 3: Refresh command, and a write guard on the restore tool

#### Automated

- [x] 3.1 Guard refuses production without the flag (non-zero exit, no upload lines)
- [x] 3.2 Guard allows the preview store (proceeds past the check)

### Phase 4: Write the rule down where it is read

#### Automated

- [x] 4.1 No phase-scoped automated check (prose only)
