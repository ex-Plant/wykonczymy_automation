import { Fragment, type ReactNode } from 'react'
import { SummaryLabelCell, SummaryValueCell } from '@/components/ui/summary-grid'
import type { LabelHintT } from '@/components/ui/label-hint-icon'
import { SCOPE_MARKER_HINT } from '@/components/kosztorys/summary/scope-marker'
import { formatNet } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'

export type SummaryRowOptsT = {
  emphasize?: boolean
  bold?: boolean
  discount?: boolean
  // A row spanning both columns can be owed on one plane and overpaid on the other — the axes cross
  // zero independently — so the alarm resolves per cell. A bare boolean tones the whole row.
  danger?: boolean | { net: boolean; gross: boolean }
  // A formula/explanation rendered as an always-visible caption under the figure. Used by the
  // materiały rows to state that VAT is subtracted (netto derived from brutto) and by the settlement
  // steps to name what each row was computed from.
  hint?: string
  // When set, the figure screams via a red `!` icon (not a red value) whose tooltip is this string. Owner-only
  // — the EX-535 reconciliation check against the transaction ledger. The client footer never passes
  // it, which is what lets both surfaces share this row instead of keeping two copies.
  mismatch?: string
  // One centred figure across BOTH money tracks instead of a cell per plane. For a row that carries a
  // single amount entering both axes — materiały, wpłaty — where a value repeated in two columns
  // would read as two figures that happen to match, rather than as one that spans them.
  span?: boolean
  // Marks the figure as (partly) kosztorys-sourced, so it doesn't follow the host's transaction
  // filters — see `SCOPE_MARKER_HINT` (EX-600).
  scopeMarked?: boolean
}

type SummaryRowPropsT = SummaryRowOptsT & {
  label: ReactNode
  line: MoneyPairT
  axis: MoneyAxisT
}

/**
 * One row of a summary grid — emitted as a bare Fragment of cells, because every cell is a direct
 * child of ONE grid container (that is what makes `gap-px` paint the shared separators). Wrapping
 * the row in an element of its own would break the gridlines, so this cannot be a normal box.
 *
 * `emphasize` keeps the summary rows bold now that the shared gridlines already draw every row
 * separator.
 */
export function SummaryRow({ label, line, axis, ...opts }: SummaryRowPropsT) {
  const { net: showNet, gross: showGross } = axisShows(axis)
  const weight = opts.bold ? 'bold' : opts.emphasize ? 'medium' : 'default'
  const toneFor = (axis: 'net' | 'gross') => {
    if (opts.discount) return 'success' as const
    const danger = typeof opts.danger === 'object' ? opts.danger[axis] : opts.danger
    return danger ? ('error' as const) : ('default' as const)
  }
  // A hint rides the net cell (or gross, on a netto-less row) as an always-visible caption rather
  // than a hover-only tooltip: it explains how the figure beside it was reached, which is exactly
  // what a reader has to hover to discover they needed. Same primitive as the negative-remaining and
  // worker-qualifier notes.
  const note = opts.hint ? { text: opts.hint, tone: 'muted' as const } : undefined
  // The row states WHICH hints it wants; the cell owns how every one of them renders.
  const hints: LabelHintT[] = opts.mismatch
    ? [{ variant: 'mismatch' as const, content: opts.mismatch }]
    : []

  return (
    <Fragment>
      <SummaryLabelCell weight={weight} hints={hints}>
        {label}
        {opts.scopeMarked && (
          <sup className="text-destructive" title={SCOPE_MARKER_HINT}>
            *
          </sup>
        )}
      </SummaryLabelCell>
      {opts.span && showNet && showGross ? (
        <SummaryValueCell
          className="col-span-2 text-center"
          weight={weight}
          tone={toneFor('net')}
          note={note}
        >
          {formatNet(line.net)}
        </SummaryValueCell>
      ) : (
        <>
          {showNet && (
            <SummaryValueCell key="net" weight={weight} tone={toneFor('net')} note={note}>
              {formatNet(line.net)}
            </SummaryValueCell>
          )}
          {/* The note rides the net cell only — repeated on brutto it would read as two captions. */}
          {showGross && (
            <SummaryValueCell
              key="gross"
              weight={weight}
              tone={toneFor('gross')}
              note={showNet ? undefined : note}
            >
              {formatNet(line.gross)}
            </SummaryValueCell>
          )}
        </>
      )}
    </Fragment>
  )
}
