'use client'

import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'

export type CashRegisterRowT = {
  readonly id: number
  readonly name: string
  readonly ownerName: string
  readonly balance: number
}

const col = createColumnHelper<CashRegisterRowT>()

export const cashRegisterColumns = [
  col.accessor('name', {
    id: 'name',
    header: 'Nazwa',
    cell: (info) => (
      <Link href={`/kasa/${info.row.original.id}`} className="hover:underline">
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor('ownerName', {
    id: 'ownerName',
    header: 'Właściciel',
    cell: (info) => info.getValue() || '—',
  }),
  col.accessor('balance', {
    id: 'balance',
    header: () => <span className="block text-right">Saldo</span>,
    cell: (info) => (
      <span className="block text-right font-medium">{formatPLN(info.getValue())}</span>
    ),
  }),
]
