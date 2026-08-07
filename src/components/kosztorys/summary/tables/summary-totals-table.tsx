'use client'

import Link from 'next/link'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import { faceValue } from '@/lib/kosztorys/summary-economics'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'

// One step of the settlement, on ONE plane — the plane is in the label, not in a column. Two money
// columns can't render this table: a wpłata exists on the plane it was made on and nowhere else, so
// the other column would have to invent a figure (or blank), and both readings mislead. A single
// „Kwota" column with named rows says exactly what happened and in what order.
export type SettlementRowT = {
  label: string
  amount: number
  // Formula/qualifier under the figure, for the steps a reader can't reconstruct from the row above.
  hint?: string
  discount?: boolean
  bold?: boolean
  danger?: boolean
  // Links the label to the investment's filtered wpłaty list — the deposit rows only.
  linkToDeposits?: boolean
  scopeMarked?: boolean
}

// A settlement tor rendered as one table. Mieszany has two — the cash side and the invoice side — and
// the split is what keeps a wpłata next to the debt it actually pays down.
export type SettlementGroupT = { caption?: string; rows: SettlementRowT[] }

// One settlement tor: wpłaty and what they leave to pay, on a single plane. Sits under the breakdown
// grid, which is where the two money columns live — that grid prices the job, these resolve it.
export function SummaryTotalsTable({
  cols,
  caption,
  rows,
  investmentId,
  preview,
}: {
  cols: string
  // Names the tor. Omitted where the settlement has only one, and a header would label nothing.
  caption?: string
  rows: SettlementRowT[]
  investmentId: number
  preview: boolean
}) {
  return (
    <SummaryTable cols={cols} className="w-fit">
      {caption && (
        <>
          <SummaryHeaderCell variant="label">{caption}</SummaryHeaderCell>
          <SummaryHeaderCell>Kwota</SummaryHeaderCell>
        </>
      )}
      {rows.map((row) => (
        <SummaryRow
          key={row.label}
          label={
            row.linkToDeposits && !preview ? (
              <Link
                href={investmentTransfersHref(investmentId, { types: DEPOSIT_TYPES })}
                className="hover:underline"
              >
                {row.label}
              </Link>
            ) : (
              row.label
            )
          }
          line={faceValue(row.amount)}
          axis="net"
          hint={row.hint}
          discount={row.discount}
          bold={row.bold}
          danger={row.danger}
          scopeMarked={row.scopeMarked}
        />
      ))}
    </SummaryTable>
  )
}
