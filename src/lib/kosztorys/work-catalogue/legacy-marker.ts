// A praca pulled in from an old investment sheet carries a visible note at the end of its
// `description`, which the owner deletes by hand while reviewing the katalog — no column, on
// purpose (owner ruling, 2026-09-01). A SUFFIX rather than a prefix so the listing, which sorts by
// `description`, stands the imported praca next to its wzór twin instead of piling every import
// under „[".
export const LEGACY_SUFFIX = ' [stary arkusz]'

/**
 * The note is display text, never identity: `catalogueKey` must see the bare name, or a marked row
 * stops matching the same praca elsewhere in the app — it would miss its twin in „Porównaj
 * z cennikiem", and an insert-only wsad, finding no such key, would add a second copy. Every writer
 * of `match_key` therefore strips it here, so the rule lives once instead of at each call site.
 */
export function stripLegacyMarker(description: string): string {
  return description.replace(/\s*\[stary arkusz\]\s*$/u, '')
}
