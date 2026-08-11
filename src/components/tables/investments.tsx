'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/utils/format-currency'
import { isAdminOrOwnerRole, type RoleT } from '@/lib/auth/roles'
import type { ExpenseCategoryRefT, InvestmentStatusT } from '@/types/reference-data'
import type { CategoryCostT } from '@/types/investment-financials'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { costForCategory } from '@/lib/db/map-category-costs'
import { BalanceCell } from '@/components/ui/balance-cell'
import { InvestmentStatusBadge } from '@/components/investments/investment-status-badge'
import { ContactLink } from '@/components/ui/contact-link'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { SheetButton } from '@/components/dialogs/sheet-button'
import { OpenKosztorysV2Button } from '@/components/kosztorys/open-kosztorys-v2-button'

export type InvestmentRowT = {
  id: number
  name: string
  status: InvestmentStatusT
  totalCosts: number
  totalMaterialCosts: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  totalInvestmentExpense: number
  totalSettled: number
  /** Priced on the plane the client is billed on, not the raw receipts — so these columns and
   *  `totalInvestmentExpense` stand on the same plane and add up. */
  categoryCosts: CategoryCostT[]
  balance: number
  balanceGross: number
  margin: number
  address: string
  phone: string
  email: string
  contactPerson: string
  review: string
  notes: string
  hasSheet: boolean
  // No column renders these — the whole row is handed to EditInvestmentDialog, whose form needs
  // them. `vatRate` is the exception that also prices `balanceGross`.
  materialsNetRate: number | null
  settlementMode: SettlementModeT
  vatRate: number
}

const col = createColumnHelper<InvestmentRowT>()

type InvestmentColumnOptionsT = {
  userRole: RoleT
  expenseCategories: ExpenseCategoryRefT[]
}

export function getInvestmentColumns({ userRole, expenseCategories }: InvestmentColumnOptionsT) {
  const isAdminOrOwner = isAdminOrOwnerRole(userRole)
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Nazwa',
      meta: { canHide: false },
    }),

    col.accessor('totalCosts', {
      id: 'totalCosts',
      header: 'Koszty inwestora',
      meta: { align: 'right' },
      cell: (info) => <span className="font-medium">{formatPLN(info.getValue())}</span>,
    }),
    // Two fixed columns rather than one switched by tryb: in trybie mieszanym both planes are owed
    // at once, so a reader who sees only one of them cannot tell what the client still has to pay.
    col.accessor('balance', {
      id: 'balance',
      header: 'Bilans netto',
      meta: { align: 'right' },
      cell: (info) => <BalanceCell value={info.getValue()} />,
    }),
    col.accessor('balanceGross', {
      id: 'balanceGross',
      header: 'Bilans brutto',
      meta: { align: 'right' },
      cell: (info) => <BalanceCell value={info.getValue()} />,
    }),
    ...(isAdminOrOwner
      ? [
          col.accessor('margin', {
            id: 'margin',
            header: 'Marża',
            meta: { align: 'right' },
            cell: (info) => <BalanceCell value={info.getValue()} />,
          }),
        ]
      : []),
    // Mirrors the single-investment stats so labels stay 1:1 with the detail page.
    ...expenseCategories.map((cat) =>
      col.accessor((row) => costForCategory(row.categoryCosts, cat.id), {
        id: `category-${cat.id}`,
        header: cat.name,
        meta: { align: 'right' },
        cell: (info) => formatPLN(info.getValue()),
      }),
    ),
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
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('phone', {
      id: 'phone',
      header: 'Telefon',
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
