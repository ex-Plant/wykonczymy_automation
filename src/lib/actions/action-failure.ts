import { NotFound } from 'payload'
import type { ActionErrorCodeT } from '@/types/action'

// Payload's own NotFound sentence is the bare word „Nie znaleziono" (its pl `general:notFound`), which
// tells the user neither what is missing nor what to do about it. Re-worded here — and, the part that
// matters, tagged with a code the caller can branch on: a write refused because its row is GONE means
// the caller's whole copy of the data is stale, which is a reseed, not a per-field revert.
const STALE_ROW_ERROR = 'Ten rekord już nie istnieje — dane zmieniły się w innym miejscu.'

const DEFAULT_ERROR = 'Wystąpił błąd'

type ActionFailureT = { success: false; error: string; code?: ActionErrorCodeT }

/** Thrown error → the failure branch of `ActionResultT`. */
export function toActionFailure(err: unknown): ActionFailureT {
  if (err instanceof NotFound) return { success: false, error: STALE_ROW_ERROR, code: 'NOT_FOUND' }
  return { success: false, error: err instanceof Error ? err.message : DEFAULT_ERROR }
}
