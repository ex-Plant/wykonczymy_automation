/**
 * What Enter commits when the highlight was never moved: the typed text, but under the list's own
 * spelling when one exists — otherwise „malowanie" would fork a second kategoria off „Malowanie".
 */
export function comboboxCommit(draft: string, options: readonly string[]): string {
  const trimmed = draft.trim()
  return options.find((option) => option.toLowerCase() === trimmed.toLowerCase()) ?? trimmed
}
