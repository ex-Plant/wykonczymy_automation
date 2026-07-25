export function buildUniqueFilename(
  date: string,
  description: string,
  originalFilename: string | null,
  usedNames: Set<string>,
): string {
  const dateStr = date.slice(0, 10).replace(/-/g, '')
  const safeDesc = sanitizeForFilename(description).slice(0, 40)
  const ext = getExtension(originalFilename)
  const base = `${dateStr}_${safeDesc}`

  let name = `${base}${ext}`
  let counter = 1
  while (usedNames.has(name)) {
    name = `${base}_${counter}${ext}`
    counter++
  }

  usedNames.add(name)
  return name
}

export function sanitizeForFilename(str: string): string {
  return str
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

export function getExtension(filename: string | null): string {
  if (!filename) return ''
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex >= 0 ? filename.slice(dotIndex) : ''
}

export type InvoiceZipTallyT = {
  // Rows the user asked for — the whole visible set, invoice or not.
  total: number
  // Of those, the ones carrying a URL to try.
  withInvoice: number
  // Of those, the ones whose blob actually made it into the archive.
  downloaded: number
}

/**
 * The closing toast. A bare success count reads as a complete set, so a partial result has to say
 * which of the two shortfalls it hit: rows that never had an invoice attached, and files that failed
 * to fetch. Pure, so the wording is testable without a browser.
 */
export function buildInvoiceZipMessage({
  total,
  withInvoice,
  downloaded,
}: InvoiceZipTallyT): string {
  if (withInvoice === 0) return 'Brak faktur do pobrania'
  if (downloaded === 0) return 'Nie udało się pobrać żadnej faktury'
  if (downloaded === total) return `Pobrano ${downloaded} ${pluralizeInvoice(downloaded)}`

  const reasons: string[] = []
  const missing = total - withInvoice
  const failed = withInvoice - downloaded
  if (missing > 0) reasons.push(`${missing} bez faktury`)
  if (failed > 0) reasons.push(`${failed} nie do pobrania`)

  return `Pobrano ${downloaded} z ${total} — ${reasons.join(', ')}`
}

/**
 * `faktury-<part>-<part>-<date>.zip`. Parts are caller-supplied context (investment name, dataset
 * label) and go through `sanitizeForFilename` because an investment name may carry `/` or `:`. No
 * parts yields the generic `faktury-<date>.zip` the transfers export has always produced.
 */
export function buildInvoiceArchiveName(parts: string[], date: string): string {
  const safeParts = parts.map(sanitizeForFilename).filter(Boolean)
  return ['faktury', ...safeParts, date].join('-') + '.zip'
}

export function pluralizeInvoice(count: number): string {
  if (count === 1) return 'fakturę'
  const lastTwo = count % 100
  const lastOne = count % 10
  if (lastOne >= 2 && lastOne <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'faktury'
  return 'faktur'
}
