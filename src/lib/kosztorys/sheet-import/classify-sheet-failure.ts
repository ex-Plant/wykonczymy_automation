import { MissingRobociznaTabError } from './read-sheet'

// Why the sheet could not be read, in the owner's terms — each one maps to a DIFFERENT thing to do,
// which is the whole point: „spróbuj później" is advice that can never work on a sheet nobody shared
// with the service account.
export type SheetFailureReasonT = 'forbidden' | 'not-found' | 'missing-tab' | 'unknown'

// A read that never happened, carried as DATA rather than as a red toast — the dialog needs
// somewhere to render the address a sheet has to be shared with, and a copy button beside it.
export type SheetFailureT = {
  reason: SheetFailureReasonT
  // Filled only for `forbidden`. Everywhere else the address is not the answer, and showing it would
  // send the owner off sharing a sheet that is already shared.
  serviceAccountEmail: string | null
}

const PERMISSION_DENIED = 'PERMISSION_DENIED'

// googleapis puts the status in a different place depending on which layer threw: the gaxios error
// carries `status`, the API error object carries `code` (number or a string enum), and a wrapped
// response keeps it on `response.status`. Reading only one of them silently degrades every 403 into
// the catch-all.
function errorCodes(error: unknown): (number | string)[] {
  if (typeof error !== 'object' || error === null) return []
  const candidate = error as { status?: unknown; code?: unknown; response?: { status?: unknown } }
  return [candidate.status, candidate.code, candidate.response?.status].flatMap((value) => {
    if (typeof value === 'number') return [value]
    if (typeof value !== 'string') return []
    return [/^\d+$/.test(value) ? Number(value) : value]
  })
}

export function classifySheetFailure(error: unknown): SheetFailureReasonT {
  if (error instanceof MissingRobociznaTabError) return 'missing-tab'
  const codes = errorCodes(error)
  if (codes.includes(403) || codes.includes(PERMISSION_DENIED)) return 'forbidden'
  if (codes.includes(404)) return 'not-found'
  return 'unknown'
}
