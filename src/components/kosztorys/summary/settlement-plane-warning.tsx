import {
  DEPOSIT_PLANE_INSTRUMENTAL,
  VAT_PLANE_LABELS,
  type VatPlaneT,
} from '@/lib/constants/transfers'
import { formatPLN } from '@/lib/utils/format-currency'
import { pluralize } from '@/lib/utils/polish-plural'
import { AlertIcon } from '@/components/ui/alert-icon'
import type { DepositTransactionRowT } from '@/types/transfers'

// Owner-only, like the robocizna/rabat scream: a client can't act on the tryb and shouldn't see the
// doubt.
//
// Deliberately NOT the bordered `WarningBanner` this replaced (deleted 2026-08-19, owner: „tamten był
// paskudny"): a red block under the settlement, not a boxed paragraph above it. One sentence, no
// per-wpłata list (owner, 2026-08-23) — the wpłaty list sits right below and already marks those same
// rows, so listing them here answered „which ones?" twice.
//
// What it says is that the DEAL is mieszany and the tryb has not caught up, so the remedy it names is
// the tryb, not re-booking (owner, 2026-08-23). The two directions do not cost the same, and the
// sentence must not pretend they do: only in tryb brutto does the kwota vanish (a gotówka has no
// brutto kwota and nothing is derived at VAT). A przelew on a bill settled netto pays the debt down
// at the netto its faktura names — saying „nie spłaca nic" there, as this did until 2026-08-23, was
// simply false.
export function SettlementPlaneWarning({
  rows,
  mode,
}: {
  rows: DepositTransactionRowT[]
  mode: VatPlaneT
}) {
  // Two vocabularies on purpose, because the sentence compares two different things: the tryb the
  // bill is settled in (netto / brutto) against the tor these wpłaty came by (gotówką / przelewem).
  const settledIn = VAT_PLANE_LABELS[mode].toLocaleLowerCase()
  const paidBy = DEPOSIT_PLANE_INSTRUMENTAL[mode === 'NET' ? 'GROSS' : 'NET']
  const noun = pluralize(rows.length, ['wpłata', 'wpłaty', 'wpłat'])
  const verb = pluralize(rows.length, ['jest', 'są', 'jest'])
  // Face value — what the client actually handed over, and in tryb brutto exactly what the
  // settlement is missing.
  const atStake = rows.reduce((sum, row) => sum + row.amount, 0)

  return (
    <p
      role="alert"
      className="text-destructive flex max-w-lg items-start gap-2 text-xs font-semibold"
    >
      <AlertIcon className="mt-0.5 size-3.5" />
      <span>
        Rozliczenie {settledIn}, a {rows.length} {noun} {verb} {paidBy}
        {mode === 'GROSS' && <> — {formatPLN(atStake)} nie spłaca nic</>}. Jeśli klient płaci obiema
        drogami, ustaw rozliczenie mieszane.
      </span>
    </p>
  )
}
