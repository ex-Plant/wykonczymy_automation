# Review-gate ledger — blob-store-isolation · 2026-08-19

Scope: 5 commits on `konradantonik/blob-store-isolation` vs `staging`.
Fan-out: `/10x-impl-review`, `/code-review`, structure+comment-noise (combined), then `/simplify`.
Dropped checks: `tailwind-v4-audit` (no UI in the diff), Step 0.5 verification pass
(no browser-verification skill installed in this project).

_Trimmed at archive (2026-08-19). Pre-trim tally: 20 fixed, 6 dismissed, 5 dropped, 1 skipped · 0 open._
_The 20 `fixed` findings were dropped: a fix's durable record is its commit and the code itself. What survives below is the negative space git cannot hold — what was looked at and deliberately left alone._

## Findings

- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/env/schema.ts:37` · `VERCEL_ENV` is an ordinary env var, so one `vercel env pull --environment=production` into `.env.local` poisons **both** of the guard's inputs at once (Next prefers `.env.local`). Hardening it — also demanding a genuine Vercel runtime signal such as `VERCEL_DEPLOYMENT_ID` — adds a second way to refuse a production boot for a scenario that needs someone to hand-swap a token in production. Dropped on your call, 2026-08-19; the `.env.local` trap stays documented in `AGENTS.md` and the runbook.

- [x] dropped · simplify · `scripts/blob-restore.mjs` ↔ `blob-mirror.mjs` ↔ `blob-snapshot.mjs` · `arg` / `fmtMB` / `sleep` / the API base URL / cursor pagination are each written 2–3×. Real, but predates this slice and a shared `scripts/blob-store.mjs` is a review-worthy refactor of three recovery tools, not a cleanup.
- [x] dismissed · simplify · `scripts/blob-restore.mjs:51` ↔ `blob-snapshot.mjs:35` · the token regex written twice: no `.mjs` under `scripts/` has ever imported a sibling, and "copy one file anywhere and run it" is the property that gets used during an incident. Two one-line call sites is under the threshold.
- [x] dismissed · simplify · lftp FTPS preamble across five files · the copies are not identical (they diverge on `xfer:clobber` / `passive-mode`), the workflows already factor theirs into `LFTP_OPTS`, and this slice's copy is deliberately different — it alone routes the password through `--env-password`.
- [x] dismissed · simplify · `scripts/blob-restore.mjs:166` · the two consecutive failure exits look redundant but emit different diagnostics; the second is fail-closed insurance against exactly the green-no-op this slice fixed.
- [x] dismissed · code-review · `src/lib/env/schema.ts:41` · `serverSchema` is no longer a `ZodObject`, so `.shape` / `.extend` are gone. Nothing in the tree uses them.
- [x] dismissed · simplify · `scripts/blob-refresh-preview.sh:22` · `[ -f .env.local ] && source .env.local` under `set -euo pipefail` looks like the classic guarded-command trap; tested rather than assumed — bash does not exit, since a failing `&&` list only trips `set -e` on its final command.
- [x] dropped · simplify · `scripts/blob-mirror.mjs:25` · its `arg()` copy still has the flag-as-value bug this slice fixed elsewhere. No possible caller: the script is CI-only and the workflow passes fixed, well-formed arguments.
- [x] dropped · code-review · `src/__tests__/lib/env/schema.test.ts:13` · `baseEnv` hand-mirrors the required-var list, so a new required var breaks all four tests at once. Fails loudly rather than silently, and no full-env factory exists to reuse.
- [x] dropped · code-review · `vitest.config.ts:17` · regex aliases would remove the declaration-order dependency, but the ordering is documented in place and exact-match regexes change resolution semantics for no behavioural gain.
- [x] skipped · code-review · `scripts/blob-refresh-preview.sh:52` · `ssl:verify-certificate no` leaves the FTPS session unauthenticated against MITM. Matches the two existing workflows against the same host; changing it here alone risks breaking the mirror on that host's certificate, and the fix belongs to all five call sites at once.
- [x] dismissed · feature-first-structure / module-cohesion / structure-scatter · zero findings across all three: every file landed in its correct home, `src/__tests__/lib/env/` is the mandated mirror rather than a new home, and `PROD_BLOB_STORE_ID` sits with the only rule that consumes it.

## Simplify pass

Ran `/simplify` (with `primitive-reuse-scan`) — 2 applied, 1 proposed, 7 dismissed; each folded into `## Findings` above tagged `simplify`. The single proposal (a caller's `--limit` being silently ignored) was resolved in-thread by refusing the flag rather than deferring it.

## Tests & suite

- `pnpm exec vitest run src/__tests__/lib/env/schema.test.ts` — 9 passed (was 4; the guard predicate and the store-id pin are new).
- `pnpm typecheck` — clean.
- `pnpm generate:types` — clean, twice: the 🔴 fix introduces the first import of `@/lib/env/schema` into the Payload CLI graph, which `server-only` would have broken.
- `scripts/blob-restore.mjs` guard, by hand with fake tokens: prod-shaped → exit 1; unparseable → exit 1 (was exit 0, the fail-open); preview → exit 0; `--concurrency abc` → exit 1. No network call in any branch.
- `scripts/blob-refresh-preview.sh`: `bash -n` clean; `--allow-prod` → exit 1; `--limit` → exit 1. Both refuse before touching FTP.
- Whole-tree gate, after the symmetric-guard fix: `pnpm typecheck` clean · `pnpm test` 2544 passed / 134 skipped (221 files) · `pnpm build` clean. `pnpm lint` not re-run — its 2 errors predate this branch (`src/hooks/use-latest-request.ts:15`, `test.js:255`).
- `pnpm test:e2e` deliberately not run: this slice ships no UI, and the guards it adds are asserted at the unit layer and by hand at the CLI. No E2E obligation, so nothing owed to the E2E backlog.
- The build is itself evidence the new branch does not over-fire: `next build` sets `NODE_ENV=production` while `.env` holds the preview token, and the guard correctly stayed silent because it keys on `VERCEL_ENV`.
