// Its own module rather than a constant on `investment-action.ts`, which is `server-only`: the
// transfers gate is a COLLECTION HOOK, so it is pulled into the Payload CLI graph, where
// `server-only` throws under `payload generate:types`. Both planes refuse in the same sentence.
export const INVESTMENT_LOCKED_MESSAGE =
  'Inwestycja jest zakończona i tylko do odczytu. Aby ją zmienić, ustaw jej status na „Aktywna".'

/**
 * The pickers' courtesy filter — a zakończona inwestycja is not offered for a new booking. The gate
 * is the collection hook; this only spares the user a refusal they could have seen coming.
 */
export const isBookableInvestment = (investment: { status: string }): boolean =>
  investment.status !== 'completed'
