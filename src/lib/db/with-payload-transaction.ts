import type { Payload, PayloadRequest } from 'payload'

type TransactionContextT = Record<string, unknown>

// Payload hands `beginTransaction`'s options straight to drizzle's `transaction(fn, config)`, so this
// is where a caller reaches Postgres's isolation level. Narrowed to the one level anybody here asks
// for rather than re-exporting drizzle's whole config surface.
type TransactionOptionsT = { isolationLevel?: 'repeatable read' }

/**
 * Runs `work` inside a single Payload transaction: begins it, builds the transaction-scoped `req`,
 * commits on success and returns `work`'s value, or rolls back and rethrows on any error.
 *
 * `context` rides on `req.context`, which Payload forwards to afterChange hooks — each caller states
 * its own policy (`skipRevalidation` for the kosztorys writes, `skipSheetSync` for the batched transfer
 * create); this generic primitive holds no default so no caller silently inherits another's. Read the
 * transaction-scoped DB inside `work` with `getDb(payload, req)` so raw SQL joins the same tx.
 *
 * `options` defaults to the connection's own level (READ COMMITTED), where every statement takes a
 * fresh snapshot — fine for work that reads and writes in one pass, wrong for anything that reads a
 * state and then acts on it (see `replaceTreeWithSnapshot`).
 */
export async function withPayloadTransaction<T>(
  payload: Payload,
  work: (req: PayloadRequest) => Promise<T>,
  context: TransactionContextT,
  options?: TransactionOptionsT,
): Promise<T> {
  const transactionId = await payload.db.beginTransaction(options)
  if (!transactionId) throw new Error('Nie udało się rozpocząć transakcji.')
  const req = { transactionID: transactionId, context } as unknown as PayloadRequest
  try {
    const result = await work(req)
    await payload.db.commitTransaction(transactionId)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(transactionId)
    throw error
  }
}
