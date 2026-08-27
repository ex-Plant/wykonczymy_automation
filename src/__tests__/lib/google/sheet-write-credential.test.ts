import { describe, it, expect, vi, beforeEach } from 'vitest'

const valuesGetMock = vi.fn()
const valuesBatchUpdateMock = vi.fn()
const valuesAppendMock = vi.fn()
const valuesClearMock = vi.fn()
const spreadsheetsGetMock = vi.fn()
const batchUpdateMock = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: vi.fn().mockImplementation(function (this: object, opts: { email: string }) {
        Object.assign(this, opts)
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

const SHEET = '152HYswm1ESgQxbk8rMt9JSeX1R-ppj49rbcZZtyCNBs'
const HEADER = ['id', 'data', 'typ', 'opis', 'kwota', 'kategoria', 'notatka']

const READER_JSON = JSON.stringify({
  client_email: 'kosztorys-sheets-reader@example.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nREADER\n-----END PRIVATE KEY-----\n',
})
const WRITER_JSON = JSON.stringify({
  client_email: 'kosztorys-sheets@example.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nWRITER\n-----END PRIVATE KEY-----\n',
})

const everyApiMock = [
  valuesGetMock,
  valuesBatchUpdateMock,
  valuesAppendMock,
  valuesClearMock,
  spreadsheetsGetMock,
  batchUpdateMock,
]

const ROW = {
  transferId: 102,
  date: '2026-06-01',
  typ: 'Materiały budowlane',
  description: 'x',
  amount: 100,
}

beforeEach(() => {
  for (const mock of everyApiMock) mock.mockReset()
  valuesGetMock.mockResolvedValue({ data: { values: [HEADER] } })
  valuesBatchUpdateMock.mockResolvedValue({ data: {} })
  valuesAppendMock.mockResolvedValue({ data: {} })
  valuesClearMock.mockResolvedValue({ data: {} })
  spreadsheetsGetMock.mockResolvedValue({ data: { properties: { locale: 'pl_PL' }, sheets: [] } })
  batchUpdateMock.mockResolvedValue({
    data: { replies: [{ addSheet: { properties: { sheetId: 99 } } }] },
  })
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = READER_JSON
  delete process.env.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON
  delete process.env.VERCEL_ENV
})

// What this pins is the shape of the gate, not a refusal message: writing needs a DIFFERENT
// credential than reading, and where that credential is absent nothing reaches Google at all.
// The real refusal lives in Google — the read account is a Viewer on these sheets — but a repo
// test cannot observe that, so it observes the thing it can: no Editor credential, no request.
describe('writes need the Editor credential', () => {
  it('applyTabRowsBatch throws and issues no API call when it is absent', async () => {
    const { applyTabRowsBatch, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(applyTabRowsBatch(SHEET, EXPENSES_TAB_CONFIG, [ROW])).rejects.toThrow(
      'GOOGLE_SERVICE_ACCOUNT_WRITE_JSON',
    )

    for (const mock of everyApiMock) expect(mock).not.toHaveBeenCalled()
  })

  it('setupTab throws and issues no API call when it is absent', async () => {
    const { setupTab, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(setupTab(SHEET, EXPENSES_TAB_CONFIG, [])).rejects.toThrow(
      'GOOGLE_SERVICE_ACCOUNT_WRITE_JSON',
    )

    for (const mock of everyApiMock) expect(mock).not.toHaveBeenCalled()
  })

  // VERCEL_ENV was the old gate and is now irrelevant — claiming to be production buys nothing,
  // because the thing that is missing is a credential, not a flag.
  it('stays shut when VERCEL_ENV claims production but no credential is present', async () => {
    process.env.VERCEL_ENV = 'production'
    const { applyTabRowsBatch, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(applyTabRowsBatch(SHEET, EXPENSES_TAB_CONFIG, [ROW])).rejects.toThrow(
      'GOOGLE_SERVICE_ACCOUNT_WRITE_JSON',
    )
    for (const mock of everyApiMock) expect(mock).not.toHaveBeenCalled()
  })

  it('writes with the Editor credential, never the reader one', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON = WRITER_JSON
    const { google } = await import('googleapis')
    const { applyTabRowsBatch, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(applyTabRowsBatch(SHEET, EXPENSES_TAB_CONFIG, [ROW])).resolves.toEqual({
      added: 1,
      updated: 0,
      removed: 0,
    })

    // Both tokens are minted here — the batch reads the grid before it writes — so the assertion
    // has to bind identity to SCOPE, not just count emails. The writable scope must never be
    // handed the reader's key, and the reader must stay on the readonly one.
    const byScope = Object.fromEntries(
      vi.mocked(google.auth.JWT).mock.calls.map((call) => [call[0]?.scopes?.[0], call[0]?.email]),
    )
    expect(byScope['https://www.googleapis.com/auth/spreadsheets']).toBe(
      'kosztorys-sheets@example.iam.gserviceaccount.com',
    )
    expect(byScope['https://www.googleapis.com/auth/spreadsheets.readonly']).toBe(
      'kosztorys-sheets-reader@example.iam.gserviceaccount.com',
    )
  })

  // Reading must survive: import, the sheet comparison and the inspector all run from a machine
  // that has only the Viewer credential.
  it('leaves reading open with no Editor credential at all', async () => {
    const { readTabTransferIds, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(readTabTransferIds(SHEET, EXPENSES_TAB_CONFIG)).resolves.toEqual(new Map())
    expect(valuesGetMock).toHaveBeenCalled()
  })
})
