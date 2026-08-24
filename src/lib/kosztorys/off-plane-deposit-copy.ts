import {
  DEPOSIT_PLANE_INSTRUMENTAL,
  VAT_PLANE_LABELS,
  type VatPlaneT,
} from '@/lib/constants/transfers'
import { formatPLN } from '@/lib/utils/format-currency'
import { pluralize } from '@/lib/utils/polish-plural'
import type { StrandedDepositsT } from '@/lib/kosztorys/deposit-planes'

// The one sentence that names a plane mismatch, so the Podsumowanie banner and the listing's marker
// cannot say it two ways (EX-724). Two vocabularies inside it on purpose, because it compares two
// different things: the tryb the bill is settled in (netto / brutto) against the tor these wpłaty
// came by (gotówką / przelewem).
//
// Only tryb brutto loses money, and the sentence must not pretend otherwise: there a gotówka has no
// brutto kwota at all and — nothing being derived at VAT — the settlement counts it as zero. A
// przelew on a bill settled netto still pays the debt down at the netto its faktura names.
export function offPlaneDepositSentence({ count, amount }: StrandedDepositsT, mode: VatPlaneT) {
  const settledIn = VAT_PLANE_LABELS[mode].toLocaleLowerCase()
  const paidBy = DEPOSIT_PLANE_INSTRUMENTAL[mode === 'NET' ? 'GROSS' : 'NET']
  const noun = pluralize(count, ['wpłata', 'wpłaty', 'wpłat'])
  const verb = pluralize(count, ['jest', 'są', 'jest'])
  // Face value — what the client actually handed over, and in tryb brutto exactly what the
  // settlement is missing.
  const lost = mode === 'GROSS' ? ` — ${formatPLN(amount)} nie spłaca nic` : ''

  return `Rozliczenie ${settledIn}, a ${count} ${noun} ${verb} ${paidBy}${lost}. Jeśli klient płaci obiema drogami, ustaw rozliczenie mieszane.`
}
