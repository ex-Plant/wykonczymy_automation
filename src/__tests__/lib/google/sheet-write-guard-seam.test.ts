import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const valuesGetMock = vi.fn()
const valuesBatchUpdateMock = vi.fn()
const valuesAppendMock = vi.fn()
const valuesClearMock = vi.fn()
const spreadsheetsGetMock = vi.fn()
const batchUpdateMock = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: vi.fn().mockImplementation(function (this: object) {
        return this
      }),
    },
    sheets: vi.fn().mockReturnValue({
      spreadsheets: {
        get: spreadsheetsGetMock,
        batchUpdate: batchUpdateMock,
        values: {
          get: valuesGetMock,
          batchUpdate: valuesBatchUpdateMock,
          append: valuesAppendMock,
          clear: valuesClearMock,
        },
      },
    }),
  },
}))

// A real id from the incident: the sheets that got dirty were live client documents reached
// from a restored prod dump, so the spec names one rather than a placeholder.
const CLIENT_SHEET = '152HYswm1ESgQxbk8rMt9JSeX1R-ppj49rbcZZtyCNBs'
const OWN_TEST_SHEET = '1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4'

const HEADER = ['id', 'data', 'typ', 'opis', 'kwota', 'kategoria', 'notatka']

const everyApiMock = [
  valuesGetMock,
  valuesBatchUpdateMock,
  valuesAppendMock,
  valuesClearMock,
  spreadsheetsGetMock,
  batchUpdateMock,
]

beforeEach(() => {
  for (const mock of everyApiMock) mock.mockReset()
  valuesGetMock.mockResolvedValue({ data: { values: [HEADER] } })
  valuesBatchUpdateMock.mockResolvedValue({ data: {} })
  valuesAppendMock.mockResolvedValue({ data: {} })
  valuesClearMock.mockResolvedValue({ data: {} })
  spreadsheetsGetMock.mockResolvedValue({
    data: { properties: { locale: 'pl_PL' }, sheets: [] },
  })
  batchUpdateMock.mockResolvedValue({
    data: { replies: [{ addSheet: { properties: { sheetId: 99 } } }] },
  })
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'test@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIITEST\n-----END PRIVATE KEY-----\n',
  })
  delete process.env.VERCEL_ENV
  delete process.env.GOOGLE_SHEETS_WRITE_ALLOWLIST
})

afterEach(() => {
  delete process.env.GOOGLE_SHEETS_WRITE_ALLOWLIST
})

// The predicate itself is covered by sheet-write-guard.test.ts. What this spec pins is the thing
// the incident actually needed and nobody had: that the refusal lands BEFORE any request reaches
// Google. A guard that threw after readGrid would still have been a guard — and would still have
// let the append through on the paths that write first.
describe('the write seam refuses without touching Google', () => {
  it('applyTabRowsBatch throws and issues no API call at all', async () => {
    const { applyTabRowsBatch, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(
      applyTabRowsBatch(CLIENT_SHEET, EXPENSES_TAB_CONFIG, [
        {
          transferId: 102,
          date: '2026-06-01',
          typ: 'Materiały budowlane',
          description: 'x',
          amount: 100,
        },
      ]),
    ).rejects.toThrow(CLIENT_SHEET)

    for (const mock of everyApiMock) expect(mock).not.toHaveBeenCalled()
  })

  it('setupTab throws and issues no API call at all', async () => {
    const { setupTab, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(setupTab(CLIENT_SHEET, EXPENSES_TAB_CONFIG, [])).rejects.toThrow(
      'GOOGLE_SHEETS_WRITE_ALLOWLIST',
    )

    for (const mock of everyApiMock) expect(mock).not.toHaveBeenCalled()
  })

  it('lets an allowlisted sheet through in the same environment', async () => {
    process.env.GOOGLE_SHEETS_WRITE_ALLOWLIST = OWN_TEST_SHEET
    const { applyTabRowsBatch, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(
      applyTabRowsBatch(OWN_TEST_SHEET, EXPENSES_TAB_CONFIG, [
        {
          transferId: 102,
          date: '2026-06-01',
          typ: 'Materiały budowlane',
          description: 'x',
          amount: 100,
        },
      ]),
    ).resolves.toEqual({ added: 1, updated: 0, removed: 0 })

    expect(valuesBatchUpdateMock).toHaveBeenCalled()
  })

  // Reads must survive the gate — closing them would have made the guard unshippable, since
  // importing a kosztorys and previewing a sync both run from localhost.
  it('leaves reading open on a sheet it refuses to write', async () => {
    const { readTabTransferIds, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(readTabTransferIds(CLIENT_SHEET, EXPENSES_TAB_CONFIG)).resolves.toEqual(new Map())
    expect(valuesGetMock).toHaveBeenCalled()
  })
})
