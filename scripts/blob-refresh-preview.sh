#!/usr/bin/env bash
# Top up the PREVIEW Blob store from the FTP mirror, so a freshly imported prod dump has bytes
# to resolve against locally. The preview store is a point-in-time copy (restored 2026-08-19), so
# an invoice uploaded to production after that renders as a 404 in local dev until this runs.
#
# Delta-only in both hops: lftp mirror skips files it already has locally, and blob-restore's
# --skip-existing lists the target and uploads only what is missing. That matters — a put() is a
# Blob "advanced operation", and exceeding that quota is what suspended every store on the account
# on 2026-08-19 (runbook §2).
#
# Reads the PREVIEW token from BLOB_READ_WRITE_TOKEN (which is what .env holds outside production);
# never BLOB_READ_WRITE_TOKEN_PROD. The restore tool's own --allow-prod guard is the backstop.
#
#   pnpm blob:refresh:preview
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
source .env
[ -f .env.local ] && source .env.local
set +a

CACHE_DIR="${BLOB_MIRROR_DIR:-dumps/blob-mirror}"
REMOTE_MEDIA="${REMOTE_MEDIA_DIR:-/blob_backups/media/}"
HOST="${FTP_HOST:-${FTP:-}}"

: "${HOST:?FTP host missing — set FTP (or FTP_HOST) in .env}"
: "${FTP_USER:?FTP_USER missing in .env}"
: "${FTP_PASS:?FTP_PASS missing in .env}"
: "${BLOB_READ_WRITE_TOKEN:?BLOB_READ_WRITE_TOKEN missing in .env}"

mkdir -p "$CACHE_DIR"

echo "→ pulling ${REMOTE_MEDIA} into ${CACHE_DIR} (delta only)"
lftp -c "
  set ftp:ssl-auth TLS; set ftp:ssl-force true; set ftp:ssl-protect-data true;
  set ssl:verify-certificate no; set ftp:passive-mode on;
  open -u '${FTP_USER}','${FTP_PASS}' '${HOST}';
  lcd '${CACHE_DIR}';
  mirror --no-perms --only-missing '${REMOTE_MEDIA}' .;
  bye
"

echo "→ uploading what the preview store is missing"
node scripts/blob-restore.mjs --dir "$CACHE_DIR" --skip-existing "$@"
