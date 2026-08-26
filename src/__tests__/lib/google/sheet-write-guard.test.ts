import { describe, expect, it } from 'vitest'
import { parseSheetWriteAllowlist, sheetWriteRefusal } from '@/lib/google/sheet-write-guard'

// Sheet ids are literals, never built from the allowlist under test — an id assembled from the
// same source as the rule would only prove the guard agrees with itself (same reason the blob
// guard's spec hardcodes its tokens).
const CLIENT_SHEET = '152HYswm1ESgQxbk8rMt9JSeX1R-ppj49rbcZZtyCNBs'
const OWN_TEST_SHEET = '1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4'

describe('sheetWriteRefusal', () => {
  it('allows any sheet in production, including one nobody listed', () => {
    expect(sheetWriteRefusal('production', CLIENT_SHEET, undefined)).toBeNull()
  })

  // Unset is what localhost, `pnpm test` and `pnpm test:e2e` all look like — the environments the
  // incident actually wrote from.
  it('refuses when VERCEL_ENV is unset and nothing is allowlisted', () => {
    const refusal = sheetWriteRefusal(undefined, CLIENT_SHEET, undefined)
    expect(refusal).toContain(CLIENT_SHEET)
    expect(refusal).toContain('GOOGLE_SHEETS_WRITE_ALLOWLIST')
  })

  it('refuses on preview', () => {
    expect(sheetWriteRefusal('preview', CLIENT_SHEET, undefined)).not.toBeNull()
  })

  it('refuses on development', () => {
    expect(sheetWriteRefusal('development', CLIENT_SHEET, undefined)).not.toBeNull()
  })

  it('allows an allowlisted sheet outside production, and still refuses its neighbours', () => {
    const allowlist = `${OWN_TEST_SHEET},1s5HKoWbXtY8Kw183ggTsacMq6dgJiuqA566wOjopwsA`
    expect(sheetWriteRefusal(undefined, OWN_TEST_SHEET, allowlist)).toBeNull()
    expect(sheetWriteRefusal(undefined, CLIENT_SHEET, allowlist)).not.toBeNull()
  })

  it('refuses on an empty allowlist', () => {
    expect(sheetWriteRefusal(undefined, CLIENT_SHEET, '')).not.toBeNull()
    expect(sheetWriteRefusal(undefined, CLIENT_SHEET, '  ,  ')).not.toBeNull()
  })

  // A prefix must not pass as the sheet it is a prefix of — the allowlist matches whole ids.
  it('does not accept a partial id', () => {
    expect(sheetWriteRefusal(undefined, CLIENT_SHEET.slice(0, 20), OWN_TEST_SHEET)).not.toBeNull()
    expect(sheetWriteRefusal(undefined, CLIENT_SHEET, CLIENT_SHEET.slice(0, 20))).not.toBeNull()
  })
})

describe('parseSheetWriteAllowlist', () => {
  it('trims entries and drops empty ones', () => {
    expect(parseSheetWriteAllowlist(` ${OWN_TEST_SHEET} , , ${CLIENT_SHEET},`)).toEqual([
      OWN_TEST_SHEET,
      CLIENT_SHEET,
    ])
  })

  it('yields nothing for unset or blank input', () => {
    expect(parseSheetWriteAllowlist(undefined)).toEqual([])
    expect(parseSheetWriteAllowlist('   ')).toEqual([])
  })
})
