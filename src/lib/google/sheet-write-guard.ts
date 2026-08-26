// The environment gate for every write to Google Sheets. A `spreadsheetId` reaches the sync from
// `kosztoryses.google_sheet_id`, and every non-production database is a restored production dump —
// so a local or preview run holds real client sheet ids and writes to them with the production
// service account. Nothing in the data distinguishes a client's sheet from a scratch one, which is
// why the gate keys on the environment plus an explicit opt-in, never on the id alone.
//
// Keyed on VERCEL_ENV, never NODE_ENV: a local `next build` sets NODE_ENV=production and would
// switch the guard off on exactly the machine it protects.
//
// The allowlist applies OUTSIDE production only — production writes to any sheet. That asymmetry is
// deliberate: an allow-list consulted in production would turn a newly linked sheet into a refused
// write (the same trap as a stale blob store id refusing a production boot). Outside production the
// polarity has to invert, because there the safe default is "write nowhere".

export function parseSheetWriteAllowlist(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

// Returns the refusal text, or null when the write is allowed.
export function sheetWriteRefusal(
  vercelEnv: string | undefined,
  spreadsheetId: string,
  allowlist: string | undefined,
): string | null {
  if (vercelEnv === 'production') return null

  if (parseSheetWriteAllowlist(allowlist).includes(spreadsheetId)) return null

  return (
    `Refusing to write to Google Sheet ${spreadsheetId} outside production ` +
    `(VERCEL_ENV=${vercelEnv ?? 'unset'}). Every non-production database carries real client sheet ` +
    'ids, so this would edit a live client document. To work on sheets locally, put YOUR OWN test ' +
    "sheet's id in GOOGLE_SHEETS_WRITE_ALLOWLIST — never a client's."
  )
}
