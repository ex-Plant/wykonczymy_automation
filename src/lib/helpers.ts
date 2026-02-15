/**
 * Merges param overrides into existing search params and returns a full URL.
 * Empty-string values delete the key.
 */
export function buildUrlWithParams(
  baseUrl: string,
  currentParams: string,
  overrides: Record<string, string>,
): string {
  const params = new URLSearchParams(currentParams)

  for (const [key, value] of Object.entries(overrides)) {
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
  }

  const qs = params.toString()
  return `${baseUrl}${qs ? `?${qs}` : ''}`
}

/**
 * Returns the first and last day of the given month as ISO date strings.
 */
export function getMonthDateRange(month: number, year: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}
