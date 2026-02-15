import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import { InvoiceCell } from '@/components/transactions/invoice-cell'
import {
  TRANSACTION_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type TransactionTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transactions'

export type TransactionRowT = {
  readonly id: number
  readonly description: string
  readonly amount: number
  readonly type: TransactionTypeT
  readonly paymentMethod: PaymentMethodT
  readonly date: string
  readonly cashRegisterName: string
  readonly investmentName: string
  readonly workerName: string
  readonly otherCategoryName: string
  readonly invoiceUrl: string | null
  readonly invoiceFilename: string | null
  readonly invoiceMimeType: string | null
}

/**
 * Maps a Payload transaction document (depth: 1) to a flat TransactionRowT.
 * Handles both populated (object) and non-populated (number) relationship fields.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTransactionRow(doc: any): TransactionRowT {
  return {
    id: doc.id,
    description: doc.description,
    amount: doc.amount,
    type: doc.type as TransactionTypeT,
    paymentMethod: doc.paymentMethod as PaymentMethodT,
    date: doc.date,
    cashRegisterName: getRelationName(doc.cashRegister),
    investmentName: getRelationName(doc.investment),
    workerName: getRelationName(doc.worker),
    otherCategoryName: getRelationName(doc.otherCategory),
    invoiceUrl: getMediaField(doc.invoice, 'url'),
    invoiceFilename: getMediaField(doc.invoice, 'filename'),
    invoiceMimeType: getMediaField(doc.invoice, 'mimeType'),
  }
}

function getRelationName(field: unknown): string {
  if (typeof field === 'object' && field !== null && 'name' in field) {
    return (field as { name: string }).name
  }
  return '—'
}

function getMediaField(field: unknown, key: string): string | null {
  if (typeof field === 'object' && field !== null && key in field) {
    return (field as Record<string, unknown>)[key] as string | null
  }
  return null
}

const col = createColumnHelper<TransactionRowT>()

const allColumns = [
  col.accessor('date', {
    id: 'date',
    header: 'Data',
    meta: { label: 'Data' },
    cell: (info) =>
      new Date(info.getValue()).toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
  }),
  col.accessor('description', {
    id: 'description',
    header: 'Opis',
    meta: { canHide: false, label: 'Opis' },
    cell: (info) => info.getValue(),
  }),
  col.accessor('amount', {
    id: 'amount',
    header: () => <span className="block text-right">Kwota</span>,
    meta: { label: 'Kwota' },
    cell: (info) => (
      <span className="block text-right font-medium">{formatPLN(info.getValue())}</span>
    ),
  }),
  col.accessor('type', {
    id: 'type',
    header: 'Typ',
    meta: { label: 'Typ' },
    cell: (info) => TRANSACTION_TYPE_LABELS[info.getValue() as TransactionTypeT] ?? info.getValue(),
  }),

  col.accessor('workerName', {
    id: 'worker',
    header: 'Pracownik',
    meta: { label: 'Pracownik' },
    cell: (info) => info.getValue(),
  }),

  col.accessor('invoiceUrl', {
    id: 'invoice',
    header: 'Faktura',
    meta: { label: 'Faktura' },
    enableSorting: false,
    cell: (info) => {
      const url = info.getValue()
      if (!url) return <span className="text-muted-foreground">—</span>
      const row = info.row.original
      return <InvoiceCell url={url} filename={row.invoiceFilename} mimeType={row.invoiceMimeType} />
    },
  }),
  col.accessor('investmentName', {
    id: 'investment',
    header: 'Inwestycja',
    meta: { label: 'Inwestycja' },
    cell: (info) => info.getValue(),
  }),
  col.accessor('cashRegisterName', {
    id: 'cashRegister',
    header: 'Kasa',
    meta: { label: 'Kasa' },
    cell: (info) => info.getValue(),
  }),
  col.accessor('otherCategoryName', {
    id: 'otherCategory',
    header: 'Kategoria',
    meta: { label: 'Kategoria' },
    cell: (info) => info.getValue(),
  }),
  col.accessor('paymentMethod', {
    id: 'paymentMethod',
    header: 'Metoda',
    meta: { label: 'Metoda' },
    cell: (info) => PAYMENT_METHOD_LABELS[info.getValue() as PaymentMethodT] ?? info.getValue(),
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
