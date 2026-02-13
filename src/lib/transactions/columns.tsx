import { createColumnHelper } from '@tanstack/react-table'
import { FileText } from 'lucide-react'
import { formatPLN } from '@/lib/format-currency'
import {
  TRANSACTION_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type TransactionTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transactions'
import type { TransactionRowT } from './types'

const col = createColumnHelper<TransactionRowT>()

const allColumns = [
  col.accessor('description', {
    id: 'description',
    header: 'Opis',
    cell: (info) => info.getValue(),
  }),
  col.accessor('amount', {
    id: 'amount',
    header: () => <span className="block text-right">Kwota</span>,
    cell: (info) => (
      <span className="block text-right font-medium">{formatPLN(info.getValue())}</span>
    ),
  }),
  col.accessor('type', {
    id: 'type',
    header: 'Typ',
    cell: (info) => TRANSACTION_TYPE_LABELS[info.getValue() as TransactionTypeT] ?? info.getValue(),
  }),
  col.accessor('paymentMethod', {
    id: 'paymentMethod',
    header: 'Metoda',
    cell: (info) => PAYMENT_METHOD_LABELS[info.getValue() as PaymentMethodT] ?? info.getValue(),
  }),
  col.accessor('date', {
    id: 'date',
    header: 'Data',
    cell: (info) =>
      new Date(info.getValue()).toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
  }),
  col.accessor('cashRegisterName', {
    id: 'cashRegister',
    header: 'Kasa',
    cell: (info) => info.getValue(),
  }),
  col.accessor('investmentName', {
    id: 'investment',
    header: 'Inwestycja',
    cell: (info) => info.getValue(),
  }),
  col.accessor('workerName', {
    id: 'worker',
    header: 'Pracownik',
    cell: (info) => info.getValue(),
  }),
  col.accessor('otherCategoryName', {
    id: 'otherCategory',
    header: 'Kategoria',
    cell: (info) => info.getValue(),
  }),
  col.accessor('hasInvoice', {
    id: 'invoice',
    header: 'Faktura',
    enableSorting: false,
    cell: (info) =>
      info.getValue() ? (
        <FileText className="text-muted-foreground size-4" />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  }),
]

export type TransactionColumnIdT = (typeof allColumns)[number]['id']

/**
 * Returns transaction column definitions, excluding specified column IDs.
 */
export function getTransactionColumns(exclude: string[] = []) {
  if (exclude.length === 0) return allColumns
  const excludeSet = new Set(exclude)
  return allColumns.filter((c) => !excludeSet.has(c.id!))
}
