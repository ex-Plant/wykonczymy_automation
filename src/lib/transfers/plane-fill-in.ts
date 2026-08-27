import {
  canFillVatPlane,
  planeFor,
  type PaymentMethodT,
  type VatPlaneT,
} from '@/lib/constants/transfers'
import type { TransferRowT } from '@/types/transfers'

// „Nie wiem", the DEFAULT answer on a legacy wpłata. A select cannot offer an empty option (Radix
// reserves `value=""`), so the unanswered state gets a name.
export const UNANSWERED_PAYMENT_METHOD = 'UNANSWERED'

export type PlaneFillInT = {
  paymentMethod: PaymentMethodT
  vatPlane?: VatPlaneT
  netAmount?: number
}

/**
 * What an edit of a wpłata may say about its netto/brutto side.
 *
 * The row gets exactly one chance, so a save that did not ASK the question must not answer it. The
 * trap this exists to close: the stored `paymentMethod` looks like the answer and is not one —
 * every plane-less wpłata in the data says gotówka, while rows that DO carry a plane include
 * gotówka tagged brutto. Pre-select a side and a save that came to attach a faktura freezes a guess.
 */
export function planeFillIn(
  row: Pick<TransferRowT, 'type' | 'vatPlane' | 'paymentMethod'>,
  answer: string,
  netAmount: string,
): PlaneFillInT {
  if (!canFillVatPlane(row) || answer === UNANSWERED_PAYMENT_METHOD) {
    // Left as booked — this asks how the client paid, it never claims the stored value was wrong.
    return { paymentMethod: row.paymentMethod }
  }

  const vatPlane = planeFor(row.type, answer)
  return {
    paymentMethod: answer as PaymentMethodT,
    vatPlane,
    // Gotówka IS the netto — no second kwota to name. Omitted rather than `undefined`, so „no
    // netto" is normalised in one place: where the action builds the write.
    ...(vatPlane === 'GROSS' && netAmount ? { netAmount: Number(netAmount) } : {}),
  }
}
