import { afterAll, describe, expect, it } from 'vitest'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'

const ORIGINAL_TZ = process.env.TZ
afterAll(() => {
  // Assigning `undefined` back would leave the literal string „undefined" in TZ for later specs.
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

// The reader's clock, not the reader's choice: Vercel runs UTC and the office runs Europe/Warsaw, so
// a formatter that follows whoever is running it renders the same row two ways — the server writes
// 22:30 into the HTML, the browser rehydrates it to 00:30 and React tears the tree down (#418).
// „Czas dodania" is a Polish company's clock wherever it is read.
function inTimeZone<T>(timeZone: string, render: () => T): T {
  process.env.TZ = timeZone
  return render()
}

const LATE_EVENING = '2026-08-25T22:30:00.000Z'

describe('formatPLDateTime', () => {
  it('reads the same on a UTC server as in a Warsaw browser', () => {
    expect(inTimeZone('UTC', () => formatPLDateTime(LATE_EVENING))).toBe(
      inTimeZone('Europe/Warsaw', () => formatPLDateTime(LATE_EVENING)),
    )
  })

  it("names the Warsaw hour, not the runtime's", () => {
    expect(inTimeZone('America/New_York', () => formatPLDateTime(LATE_EVENING))).toBe(
      '26.08.2026, 00:30',
    )
  })
})

describe('formatPLDate', () => {
  // A date column arrives as a bare 'YYYY-MM-DD', which Date reads as UTC midnight — one step west
  // of Greenwich and it renders as the day before.
  it('keeps a date-only value on its own day west of UTC', () => {
    expect(inTimeZone('America/New_York', () => formatPLDate('2026-03-01'))).toBe('01.03.2026')
  })

  it('keeps it there east of Warsaw too', () => {
    expect(inTimeZone('Pacific/Auckland', () => formatPLDate('2026-03-01'))).toBe('01.03.2026')
  })
})
