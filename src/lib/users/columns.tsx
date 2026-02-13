import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/collections/users'
import type { UserRowT } from './types'

const col = createColumnHelper<UserRowT>()

export const userColumns = [
  col.accessor('name', {
    id: 'name',
    header: 'Imię',
    cell: (info) => (
      <Link href={`/uzytkownicy/${info.row.original.id}`} className="hover:underline">
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor('email', {
    id: 'email',
    header: 'Email',
  }),
  col.accessor('role', {
    id: 'role',
    header: 'Rola',
    cell: (info) => ROLE_LABELS[info.getValue() as RoleT]?.pl ?? info.getValue(),
  }),
  col.accessor('saldo', {
    id: 'saldo',
    header: () => <span className="block text-right">Saldo</span>,
    cell: (info) => (
      <span className="block text-right font-medium">{formatPLN(info.getValue())}</span>
    ),
  }),
]
