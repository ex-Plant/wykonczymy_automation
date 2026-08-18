'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { isAdminOrOwnerRole, type RoleT } from '@/lib/auth/roles'
import type { InvestmentRowT } from '@/types/table-rows'
import { BalanceCell } from '@/components/ui/balance-cell'
import { InvestmentStatusBadge } from '@/components/investments/investment-status-badge'
import { ContactLink } from '@/components/ui/contact-link'
import { LabelHintIcon } from '@/components/ui/label-hint-icon'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { SheetButton } from '@/components/dialogs/sheet-button'
import { OpenKosztorysV2Button } from '@/components/kosztorys/open-kosztorys-v2-button'

const col = createColumnHelper<InvestmentRowT>()

type InvestmentColumnOptionsT = {
  userRole: RoleT
}

export function getInvestmentColumns({ userRole }: InvestmentColumnOptionsT) {
  const isAdminOrOwner = isAdminOrOwnerRole(userRole)
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Nazwa',
      meta: { canHide: false, minWidth: 'min-w-56' },
    }),

    col.accessor('totalCosts', {
      id: 'totalCosts',
      header: 'Koszty inwestora',
      meta: { align: 'right' },
      cell: (info) => <span className="font-medium">{formatPLN(info.getValue())}</span>,
    }),
    // Every figure that exists on two planes is shown on BOTH, v1 beside v2: nothing here infers
    // which plane an investment „really" belongs to, because while investments are still being moved
    // off the spreadsheets one legitimately carries figures on both. Hide what you are not comparing
    // today with the column picker.
    col.accessor('balanceFromTransactions', {
      id: 'balanceFromTransactions',
      header: 'Bilans netto v1',
      meta: { align: 'right' },
      cell: (info) => <BalanceCell value={info.getValue()} />,
    }),
    col.accessor('balance', {
      id: 'balance',
      header: 'Bilans netto v2',
      meta: { align: 'right' },
      cell: (info) => <BalanceCell value={info.getValue()} />,
    }),
    // No v1 twin: brutto has only ever been computed on the plane its netto came from.
    col.accessor('balanceGross', {
      id: 'balanceGross',
      header: 'Bilans brutto v2',
      meta: { align: 'right' },
      cell: (info) => <BalanceCell value={info.getValue()} />,
    }),
    ...(isAdminOrOwner
      ? [
          col.accessor('margin', {
            id: 'margin',
            header: 'Marża v1',
            meta: { align: 'right' },
            cell: (info) => <BalanceCell value={info.getValue()} />,
          }),
          col.accessor('marginV2', {
            id: 'marginV2',
            // Without this the withheld rows go through the numeric comparator, which reads them as
            // 0 and scatters them among the genuine near-zero margins.
            sortUndefined: 'last',
            header: 'Marża v2',
            meta: { align: 'right' },
            // A row with an unsettled etap has no amount at all — zero would claim the crew works
            // for free. The prompt names what the owner has to do to get the number back.
            cell: (info) => {
              const value = info.getValue()
              return value === undefined ? (
                <span className="text-muted-foreground text-xs">ustaw etapy</span>
              ) : (
                <BalanceCell value={value} />
              )
            },
          }),
        ]
      : []),
    // The transition's work queue: the two planes side by side on the figure they actually disagree
    // about. Zero rozjazd everywhere means the move is done and both columns can go.
    col.accessor('totalLaborCostsFromTransactions', {
      id: 'laborCostsFromTransactions',
      header: 'Robocizna v1',
      meta: { align: 'right' },
      cell: (info) => formatPLN(info.getValue()),
    }),
    col.accessor('totalLaborCosts', {
      id: 'laborCostsFromKosztorys',
      header: 'Robocizna v2',
      meta: { align: 'right' },
      // The rozjazd rides on this cell rather than a column of its own: as a column it was a bare
      // number under a header nobody could decode, and it is only ever read against the v2 amount
      // standing next to it.
      cell: (info) => {
        // Rounded: both sides are independent float folds, so a fully migrated investment lands a
        // sub-grosz residue apart rather than exactly equal, and the icon would never disappear.
        const gap = roundToCents(
          info.getValue() - info.row.original.totalLaborCostsFromTransactions,
        )
        return (
          <span className="inline-flex items-center justify-end gap-1">
            {formatPLN(info.getValue())}
            {/* No icon at zero — „nothing left to move" is the answer that needs no explanation. */}
            {gap !== 0 && (
              <LabelHintIcon
                variant="mismatch"
                content={`Rozjazd z „Robocizna v1": ${formatPLN(gap)}. Tyle robocizny jest w kosztorysie ponad to, co zaksięgowano transferami — dodatnia kwota znaczy, że transfery są niedobite, ujemna, że praca nie jest jeszcze wpisana w kosztorys.`}
              />
            )}
          </span>
        )
      },
    }),

    col.accessor('totalInvestmentExpense', {
      id: 'totalInvestmentExpense',
      header: 'Wydatki inwestycyjne',
      meta: { align: 'right' },
      cell: (info) => <span className="font-medium">{formatPLN(info.getValue())}</span>,
    }),
    col.accessor('totalSettled', {
      id: 'totalSettled',
      header: 'Wydatki wliczone w robociznę',
      meta: { align: 'right' },
      cell: (info) => formatPLN(info.getValue()),
    }),
    // Wypłaty (payouts) is admin/owner-only, matching the detail page where it
    // sits alongside Marża behind the same role gate.
    ...(isAdminOrOwner
      ? [
          col.accessor('totalPayouts', {
            id: 'totalPayouts',
            header: 'Wypłaty',
            meta: { align: 'right' },
            cell: (info) => formatPLN(info.getValue()),
          }),
        ]
      : []),
    col.accessor('address', {
      id: 'address',
      header: 'Adres',
      meta: { minWidth: 'min-w-56' },
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('phone', {
      id: 'phone',
      header: 'Telefon',
      meta: { minWidth: 'min-w-36' },
      cell: (info) => <ContactLink type="phone" value={info.getValue()} />,
    }),
    col.accessor('email', {
      id: 'email',
      header: 'Email',
      cell: (info) => <ContactLink type="email" value={info.getValue()} />,
    }),
    col.accessor('contactPerson', {
      id: 'contactPerson',
      header: 'Osoba kontaktowa',
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('review', {
      id: 'review',
      header: 'Opinia',
      meta: { minWidth: 'min-w-56' },
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('status', {
      id: 'status',
      header: 'Status',
      meta: { align: 'right' },
      enableSorting: true,
      cell: (info) => <InvestmentStatusBadge status={info.getValue()} />,
    }),
    col.accessor('hasSheet', {
      id: 'hasSheet',
      header: 'Kosztorys',
      enableSorting: true,
      cell: (info) => (
        <SheetButton investmentId={info.row.original.id} hasSheet={!!info.getValue()} />
      ),
    }),
    col.display({
      id: 'kosztorysV2',
      header: 'Kosztorys_v2',
      cell: (info) => <OpenKosztorysV2Button investmentId={info.row.original.id} label="Otwórz" />,
    }),
    col.display({
      id: 'actions',
      header: 'Akcje',
      cell: (info) => <EditInvestmentDialog investment={info.row.original} />,
    }),
  ]
}
