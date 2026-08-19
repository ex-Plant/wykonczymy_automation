// FTP backup → Vercel Blob restore (EX-459 Phase 3 / §5 of the runbook).
// Dependency-free for the same reason as blob-mirror.mjs: a recovery tool must not need
// node_modules to be intact — it runs when something is already broken.
//
// Uploads every file of a local backup dir back into a Blob store, keyed by its RELATIVE PATH,
// which IS the blob pathname AND `media.filename` in Postgres. So no DB rewrite is ever needed
// (`media.url` is relative — runbook §2).
//
// addRandomSuffix is forced to "0": with a suffix the key becomes `filename-xxxx` and
// `/api/media/file/<filename>` 404s. That is the one invariant that silently ruins a restore.
//
// SAFETY: put-only. Never deletes, never lists-then-prunes. Re-running overwrites with identical
// bytes, so it is idempotent and safe on a partially-repaired store.
//
// Usage:
//   BLOB_READ_WRITE_TOKEN=<target store token> node scripts/blob-restore.mjs \
//     --dir ./blob-restore [--concurrency 8] [--dry-run] [--limit 5]
//
//   --dir <path>        local backup dir (mirror of the store's pathnames)
//   --concurrency <n>   parallel uploads (default 8)
//   --skip-existing     list the target first and upload only what is missing (resume a run)
//   --dry-run           enumerate + report, upload nothing
//   --limit <n>         upload only the first n files (smoke test)

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const has = (name) => process.argv.includes(name)

const token = process.env.BLOB_READ_WRITE_TOKEN
if (!token) { console.error('BLOB_READ_WRITE_TOKEN missing (must be the TARGET store token)'); process.exit(1) }

const dir = arg('--dir')
if (!dir) { console.error('--dir <backup dir> required'); process.exit(1) }
const concurrency = Number(arg('--concurrency', '8'))
const limit = Number(arg('--limit', '0'))
const dryRun = has('--dry-run')
const skipExisting = has('--skip-existing')

const API = 'https://blob.vercel-storage.com'
const API_VERSION = '7'
const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

// Payload stores what the browser sent; these cover everything the media collection holds today.
const CONTENT_TYPES = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.heic': 'image/heic', '.avif': 'image/avif',
}

async function walk(root, sub = '') {
  const out = []
  for (const entry of await readdir(join(root, sub), { withFileTypes: true })) {
    const rel = sub ? join(sub, entry.name) : entry.name
    if (entry.isDirectory()) out.push(...(await walk(root, rel)))
    else out.push(rel)
  }
  return out
}

// The Blob API throws transient 5xx under sustained upload (13/2347 in the EX-459 drill).
// A recovery run must not need a human to notice and re-run, so retry with backoff.
const RETRIES = 4
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function put(pathname, bytes) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(`${API}/${encodeURI(pathname)}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'x-api-version': API_VERSION,
        'x-content-type': CONTENT_TYPES[extname(pathname).toLowerCase()] ?? 'application/octet-stream',
        'x-add-random-suffix': '0',
      },
      body: bytes,
    })
    if (res.ok) return res.json()
    const body = await res.text()
    if (attempt > RETRIES || res.status < 500) throw new Error(`${res.status} ${body}`)
    await sleep(500 * 2 ** (attempt - 1))
  }
}

async function listTarget() {
  const seen = new Set()
  let cursor
  do {
    const url = new URL(API)
    url.searchParams.set('limit', '1000')
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`)
    const page = await res.json()
    for (const blob of page.blobs) seen.add(blob.pathname)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return seen
}

let files = (await walk(dir)).sort()
if (skipExisting) {
  const present = await listTarget()
  const before = files.length
  files = files.filter((f) => !present.has(f))
  console.log(`\nskip-existing: target holds ${present.size} · ${before - files.length} already there`)
}
if (limit) files = files.slice(0, limit)
const totalBytes = (await Promise.all(files.map(async (f) => (await stat(join(dir, f))).size)))
  .reduce((sum, size) => sum + size, 0)
console.log(`\n${files.length} files, ${fmtMB(totalBytes)} → ${dryRun ? 'DRY RUN' : 'upload'} (concurrency ${concurrency})\n`)
if (dryRun) { console.log(files.slice(0, 10).join('\n')); process.exit(0) }

let done = 0
const failures = []
const queue = [...files]
await Promise.all(Array.from({ length: concurrency }, async () => {
  for (let next = queue.shift(); next; next = queue.shift()) {
    try {
      await put(next, await readFile(join(dir, next)))
      done += 1
      if (done % 100 === 0 || done === files.length) console.log(`  ${done}/${files.length}`)
    } catch (err) {
      console.error(`  FAIL ${next}: ${err.message}`)
      failures.push({ pathname: next, error: err.message })
    }
  }
}))

console.log(`\nUploaded ${done}/${files.length}`)
if (failures.length) { console.error(`FAIL: ${failures.length} uploads errored`); process.exit(1) }
console.log('OK\n')
