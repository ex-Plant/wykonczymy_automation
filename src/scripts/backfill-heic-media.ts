// One-off (EX-394): replace every `image/heic` media row with a JPEG.
//
// HEIC→JPEG conversion (EX-457) is client-side only, so rows uploaded before it — plus the one that
// came through the edit-transfer hole — still hold raw HEIC. `sharp` here cannot decode HEIC
// (libvips 8.17.3, heif input is AVIF-only), which is why all of them carry NULL width/height and no
// thumbnail. Converting outside Node and re-uploading through Payload regenerates all of it.
//
//   # staging (preview DB + preview blob store — .env's BLOB_READ_WRITE_TOKEN is already preview)
//   source .env && DB_POSTGRES_URL="$DB_POSTGRES_URL_PREVIEW" \
//     node --env-file=.env --import tsx src/scripts/backfill-heic-media.ts --dry-run
//   source .env && DB_POSTGRES_URL="$DB_POSTGRES_URL_PREVIEW" \
//     node --env-file=.env --import tsx src/scripts/backfill-heic-media.ts
//   source .env && DB_POSTGRES_URL="$DB_POSTGRES_URL_PREVIEW" \
//     node --env-file=.env --import tsx src/scripts/backfill-heic-media.ts --verify
//
// Flags: --dry-run | --verify | --snapshot-dir <path> (default dumps/heic-backfill) | --limit <n>
//
// ROLLBACK is the snapshot dir, and nothing else. Payload's cloud-storage afterChange deletes the
// PREVIOUS blob before uploading the replacement, so the moment a row is updated its original is
// gone from the store. Every original is therefore downloaded BEFORE the first update, and a failed
// download aborts the whole run. To roll back: re-put the snapshot with
// `scripts/blob-restore.mjs --dir <snapshot-dir>` and restore the rows from `manifest.json`.
//
// Requires `heif-convert` (libheif) and `magick` (ImageMagick) on PATH: brew install libheif imagemagick
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { getPayload } from 'payload'
import config from '../payload.config'

const run = promisify(execFile)

// Mirrors compress-image.ts, which is what the browser applies to every upload today. Do not
// improvise these — a backfilled invoice should be indistinguishable from a freshly uploaded one.
const MAX_WIDTH = 1920
const MAX_HEIGHT = 1080
const QUALITY = 60

const arg = (name: string, fallback?: string) => {
  const index = process.argv.indexOf(name)
  const value = index !== -1 ? process.argv[index + 1] : undefined
  return value && !value.startsWith('--') ? value : fallback
}
const has = (name: string) => process.argv.includes(name)

const SNAPSHOT_DIR = path.resolve(arg('--snapshot-dir', 'dumps/heic-backfill') as string)
const MANIFEST = path.join(SNAPSHOT_DIR, 'manifest.json')
const LIMIT = Number(arg('--limit', '0'))

type ManifestEntryT = {
  id: number
  oldFilename: string
  newFilename: string
  oldFilesize: number
  newFilesize: number
  linkedTransactions: number
}

/**
 * `media.url` is relative (runbook §2), so the bytes have to be read from the store directly. A Blob
 * token names its store verbatim, and that store id IS the public host — which keeps this dependency
 * -free and, more usefully, makes it impossible to snapshot one store while updating another.
 */
function blobBaseUrl(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const store = token && /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(token)?.[1]
  if (!store)
    throw new Error('BLOB_READ_WRITE_TOKEN missing or unrecognised — cannot locate the store')
  return `https://${store}.public.blob.vercel-storage.com`
}

async function findHeicRows(payload: Awaited<ReturnType<typeof getPayload>>) {
  const { docs } = await payload.find({
    collection: 'media',
    where: { mimeType: { equals: 'image/heic' } },
    limit: 0,
    sort: 'id',
    pagination: false,
  })
  return LIMIT > 0 ? docs.slice(0, LIMIT) : docs
}

async function convert(source: string, target: string) {
  const intermediate = path.join(tmpdir(), `heic-backfill-${path.basename(target)}`)
  // -q 100 on the decode so the only quality loss is the resize/encode below, matching the client.
  await run('heif-convert', ['-q', '100', source, intermediate])
  // `-auto-orient` bakes the EXIF rotation into the pixels; without it a phone photo lands sideways,
  // because nothing downstream re-reads the orientation tag. `>` resizes only when oversized.
  await run('magick', [
    intermediate,
    '-auto-orient',
    '-resize',
    `${MAX_WIDTH}x${MAX_HEIGHT}>`,
    '-quality',
    String(QUALITY),
    target,
  ])
}

async function main() {
  const payload = await getPayload({ config })
  const base = blobBaseUrl()

  if (has('--verify')) {
    await verify(payload, base)
    return
  }

  const rows = await findHeicRows(payload)
  console.log(`${rows.length} media row(s) with mime_type = image/heic`)
  if (rows.length === 0) return

  if (has('--dry-run')) {
    for (const row of rows) {
      const linked = await payload.count({
        collection: 'transactions',
        where: { invoice: { equals: row.id } },
      })
      console.log(
        `  id=${row.id}  ${row.filename}  ${((row.filesize ?? 0) / 1_000_000).toFixed(2)} MB  ` +
          `→ transakcje: ${linked.totalDocs}`,
      )
    }
    console.log(`\nDry run — nothing written. Snapshot would land in ${SNAPSHOT_DIR}`)
    return
  }

  // --- Phase A: snapshot everything, or abort. ---
  await mkdir(SNAPSHOT_DIR, { recursive: true })
  console.log(`\nSnapshotting ${rows.length} original(s) → ${SNAPSHOT_DIR}`)

  for (const row of rows) {
    const response = await fetch(`${base}/${row.filename}`)
    if (!response.ok) {
      throw new Error(
        `ABORT before any write: ${row.filename} (id=${row.id}) is not in the store ` +
          `(${response.status}). Without its bytes there is no rollback for this row, so the whole ` +
          `run stops. Top the preview store up with \`pnpm blob:refresh:preview\` and retry.`,
      )
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    await writeFile(path.join(SNAPSHOT_DIR, row.filename as string), bytes)
    console.log(`  ✓ ${row.filename} (${(bytes.length / 1_000_000).toFixed(2)} MB)`)
  }

  // --- Phase B: convert and update. ---
  console.log(`\nConverting and updating`)
  const manifest: ManifestEntryT[] = []
  const failures: { id: number; filename: string; error: string }[] = []

  for (const row of rows) {
    const oldFilename = row.filename as string
    const newFilename = `${path.parse(oldFilename).name}.jpg`
    const target = path.join(tmpdir(), `heic-backfill-out-${newFilename}`)

    try {
      const linked = await payload.count({
        collection: 'transactions',
        where: { invoice: { equals: row.id } },
      })

      await convert(path.join(SNAPSHOT_DIR, oldFilename), target)
      const jpeg = await readFile(target)

      await payload.update({
        collection: 'media',
        id: row.id,
        data: {},
        file: { data: jpeg, mimetype: 'image/jpeg', name: newFilename, size: jpeg.length },
        // media's afterChange calls revalidateTag, which throws outside a request context
        // ("static generation store missing") and takes the whole transaction down with it. Same
        // opt-out the seed scripts use. Nothing to invalidate here anyway — this is a CLI run.
        context: { skipRevalidation: true },
      })

      manifest.push({
        id: row.id,
        oldFilename,
        newFilename,
        oldFilesize: row.filesize ?? 0,
        newFilesize: jpeg.length,
        linkedTransactions: linked.totalDocs,
      })
      const saved = 100 - Math.round((jpeg.length / (row.filesize || jpeg.length)) * 100)
      console.log(`  ✓ id=${row.id}  ${oldFilename} → ${newFilename}  (-${saved}%)`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push({ id: row.id, filename: oldFilename, error: message })
      console.error(`  ✗ id=${row.id}  ${oldFilename}: ${message}`)
    }
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2))
  console.log(`\n${manifest.length} converted, ${failures.length} failed. Manifest: ${MANIFEST}`)
  if (failures.length > 0) process.exitCode = 1
}

async function verify(payload: Awaited<ReturnType<typeof getPayload>>, base: string) {
  const manifest: ManifestEntryT[] = JSON.parse(await readFile(MANIFEST, 'utf8'))
  console.log(`Verifying ${manifest.length} row(s) against ${MANIFEST}\n`)

  let failed = 0
  for (const entry of manifest) {
    const problems: string[] = []
    const doc = await payload.findByID({ collection: 'media', id: entry.id, disableErrors: true })

    if (!doc) {
      problems.push('row is gone')
    } else {
      if (doc.mimeType !== 'image/jpeg') problems.push(`mime_type = ${doc.mimeType}`)
      if (!doc.filename?.endsWith('.jpg')) problems.push(`filename = ${doc.filename}`)
      if (!doc.width || !doc.height) problems.push('width/height still NULL')
      if (!doc.sizes?.thumbnail?.filename) problems.push('no thumbnail')

      // A green row with a 404 behind it is the failure mode this exists to catch: Payload's
      // afterChange deletes first and uploads second, so a half-failed update leaves exactly that.
      const response = await fetch(`${base}/${doc.filename}`)
      if (!response.ok) {
        problems.push(`blob ${response.status}`)
      } else {
        const head = Buffer.from(await response.arrayBuffer()).subarray(0, 3)
        if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff)
          problems.push('not JPEG bytes')
      }

      const linked = await payload.count({
        collection: 'transactions',
        where: { invoice: { equals: entry.id } },
      })
      if (linked.totalDocs !== entry.linkedTransactions) {
        problems.push(
          `transakcje ${linked.totalDocs} ≠ ${entry.linkedTransactions} przed konwersją`,
        )
      }
    }

    if (problems.length > 0) failed++
    console.log(
      problems.length === 0
        ? `  ✓ id=${entry.id}  ${entry.newFilename}`
        : `  ✗ id=${entry.id}  ${entry.newFilename}: ${problems.join('; ')}`,
    )
  }

  const remaining = await payload.count({
    collection: 'media',
    where: { mimeType: { equals: 'image/heic' } },
  })
  console.log(`\n${manifest.length - failed}/${manifest.length} OK`)
  console.log(`media rows still image/heic: ${remaining.totalDocs}`)

  if (failed > 0 || remaining.totalDocs > 0) process.exitCode = 1
}

await main()
process.exit(process.exitCode ?? 0)
