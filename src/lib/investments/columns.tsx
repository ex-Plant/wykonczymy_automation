'use client'

import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import type { InvestmentRowT } from './types'

const col = createColumnHelper<InvestmentRowT>()

export const investmentColumns = [
  col.accessor('name', {
    id: 'name',
    header: 'Nazwa',
    cell: (info) => (
      <Link href={`/inwestycje/${info.row.original.id}`} className="hover:underline">
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor('status', {
    id: 'status',
    header: 'Status',
    cell: (info) => {
      const isActive = info.getValue() === 'active'
      return (
        <span
          className={
            isActive
              ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium'
          }
        >
          {isActive ? 'Aktywna' : 'Zakończona'}
        </span>
      )
    },
  }),
  col.accessor('totalCosts', {
    id: 'totalCosts',
    header: () => <span className="block text-right">Koszty</span>,
    cell: (info) => (
      <span className="block text-right font-medium">{formatPLN(info.getValue())}</span>
    ),
  }),
  col.accessor('address', {
    id: 'address',
    header: 'Adres',
    cell: (info) => info.getValue() || '—',
  }),
  col.accessor('phone', {
    id: 'phone',
    header: 'Telefon',
    cell: (info) => info.getValue() || '—',
  }),
  col.accessor('email', {
    id: 'email',
    header: 'Email',
    cell: (info) => info.getValue() || '—',
  }),
  col.accessor('contactPerson', {
    id: 'contactPerson',
    header: 'Osoba kontaktowa',
    cell: (info) => info.getValue() || '—',
  }),
]
