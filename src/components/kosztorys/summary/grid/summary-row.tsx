import { Fragment, type ReactNode } from 'react'
import { SummaryLabelCell, SummaryValueCell } from '@/components/ui/summary-grid'
import type { LabelHintT } from '@/components/ui/label-hint-icon'
import { formatNet } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { MoneyPairT, SummaryLineT } from '@/lib/kosztorys/summary-economics'

export type SummaryRowOptsT = {
  emphasize?: boolean
  bold?: boolean
  discount?: boolean
  danger?: boolean
  // No-VAT figure: one amount, no netto/brutto axis. The sheet gives brutto its own row only for
  // prace + the R+M total; materiały/korekta/wpłaty have no brutto figure at all. The Brutto cell
  // repeats the netto amount rather than blanking, which also keeps the row readable in a
  // brutto-only widok, where blanking dropped its only value.
  noBrutto?: boolean
  // A custom formula/explanation, independent of `noBrutto`, rendered as an always-visible caption
  // under the figure. Used by the materiały rows to state that VAT is subtracted (netto derived from
  // brutto) — the inverse of the prace direction, so the generic bez-VAT copy would be wrong here.
  hint?: string
  // When set, the figure screams via a red `!` icon (not a red value) whose tooltip is this string. Owner-only
  // — the EX-535 reconciliation check against the transaction ledger. The client footer never passes
  // it, which is what lets both surfaces share this row instead of keeping two copies.
  mismatch?: string
}

type SummaryRowPropsT = SummaryRowOptsT & {
  label: ReactNode
  line: SummaryLineT | MoneyPairT
  axis: MoneyAxisT
}

/**
 * One row of a summary grid — emitted as a bare Fragment of cells, because every cell is a direct
 * child of ONE grid container (that is what makes `gap-px` paint the shared separators). Wrapping
 * the row in an element of its own would break the gridlines, so this cannot be a normal box.
 *
 * `emphasize` keeps the summary rows bold now that the shared gridlines already draw every row
 * separator. A line's `share` is not rendered here — it feeds the charts.
 */
export function SummaryRow({ label, line, axis, ...opts }: SummaryRowPropsT) {
  const { net: showNet, gross: showGross } = axisShows(axis)
  const weight = opts.bold ? 'bold' : opts.emphasize ? 'medium' : 'default'
  const tone = opts.discount ? 'success' : opts.danger ? 'error' : 'default'
  // `hint` used to hide behind a hover-only tooltip icon; it now rides the net cell (or gross, on a
  // netto-less row) as an always-visible caption, the same primitive the negative-remaining and
  // worker-qualifier notes use.
  const note = opts.hint ? { text: opts.hint, tone: 'muted' as const } : undefined
  // The row states WHICH hints it wants; the cell owns how every one of them renders. `noVat` flags
  // the brutto cell repeating its netto figure, so the repetition reads as „ta pozycja nie ma VAT-u"
  // rather than as a rendering slip.
  const hints: LabelHintT[] = [
    ...(opts.mismatch ? [{ variant: 'mismatch' as const, content: opts.mismatch }] : []),
    ...(opts.noBrutto && showGross ? [{ variant: 'noVat' as const }] : []),
  ]

  return (
    <Fragment>
      <SummaryLabelCell weight={weight} hints={hints}>
        {label}
      </SummaryLabelCell>
      {showNet && (
        <SummaryValueCell key="net" weight={weight} tone={tone} note={note}>
          {formatNet(line.net)}
        </SummaryValueCell>
      )}
      {/* A no-VAT row repeats its netto figure in the brutto cell rather than blanking: the amount
          IS the brutto (VAT doesn't apply), so restating it reads clearer than an absence. The note
          rides the net cell only — repeating it on brutto too would read as two separate captions. */}
      {showGross && (
        <SummaryValueCell key="gross" weight={weight} tone={tone} note={showNet ? undefined : note}>
          {formatNet(opts.noBrutto ? line.net : line.gross)}
        </SummaryValueCell>
      )}
    </Fragment>
  )
}
