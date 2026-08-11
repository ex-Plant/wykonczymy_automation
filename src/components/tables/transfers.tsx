import { createColumnHelper } from '@tanstack/react-table'
import { OptionalLink } from '@/components/ui/optional-link'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'
import { InvoiceCell } from '@/components/transfers/invoice-cell'
import { NotePopover } from '@/components/transfers/note-popover'
import { CancelTransferButton } from '@/components/transfers/cancel-transfer-button'
import { EditTransferDialog } from '@/components/dialogs/edit-transfer-dialog'
import { canMutateTransfer, type RoleT } from '@/lib/auth/roles'
import {
  TRANSFER_TYPE_LABELS,
  TRANSFER_TYPE_COLORS,
  PAYMENT_METHOD_LABELS,
  isCancellationType,
  EXPENSE_CATEGORY_LABEL,
  SETTLED_TYPE,
  VAT_PLANE_LABELS,
  billsNetAmount,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { TransferRowT } from '@/types/transfers'

const col = createColumnHelper<TransferRowT>()

const allColumns = [
  col.accessor('id', {
    id: 'id',
    header: 'ID',
    cell: (info) => `#${info.getValue()}`,
  }),
  col.accessor('date', {
    id: 'date',
    header: 'Data',
    cell: (info) => formatPLDate(info.getValue()),
  }),
  col.accessor('amount', {
    id: 'amount',
    header: 'Kwota',
    cell: (info) => {
      const { type, cancelled, settled, netAmount } = info.row.original
      const isMuted = cancelled || type === 'CANCELLATION'
      const color = settled ? SETTLED_TYPE.color : TRANSFER_TYPE_COLORS[type]
      // Brutto stays the primary figure: this column is summed against the kasa balance, and only
      // the amount that left the register reconciles there.
      const showsNet = billsNetAmount(type) && netAmount !== null
      return (
        <span
          className="flex flex-col font-medium"
          style={isMuted ? undefined : { color: `var(--color-${color})` }}
        >
          {formatPLN(info.getValue())}
          {showsNet && (
            <span className="text-muted-foreground text-xs">netto {formatPLN(netAmount)}</span>
          )}
        </span>
      )
    },
  }),
  col.accessor('vatPlane', {
    id: 'vatPlane',
    header: 'Rozliczenie netto/brutto',
    cell: (info) => {
      const value = info.getValue()
      return value ? VAT_PLANE_LABELS[value] : '—'
    },
  }),
  col.accessor('investmentName', {
    id: 'investment',
    header: 'Inwestycja',
    cell: (info) => {
      const id = info.row.original.investmentId
      const name = info.getValue()
      return (
        <OptionalLink href={name !== '—' && id ? `/inwestycje/${id}` : undefined}>
          {name}
        </OptionalLink>
      )
    },
  }),
  col.accessor('type', {
    id: 'type',
    header: 'Typ',
    cell: (info) => {
      const { settled, type, originalType } = info.row.original
      if (settled) return SETTLED_TYPE.label
      const label = TRANSFER_TYPE_LABELS[type] ?? type
      // For a cancellation, append what it reversed: "Anulowanie (Wydatek inwestycyjny)"
      if (type === 'CANCELLATION' && originalType) {
        return `${label} (${TRANSFER_TYPE_LABELS[originalType] ?? originalType})`
      }
      return label
    },
  }),
  col.accessor('expenseCategoryName', {
    id: 'expenseCategory',
    header: EXPENSE_CATEGORY_LABEL,
    cell: (info) => info.getValue(),
  }),
  // TODO: add click-to-expand for long descriptions.
  // Tried a `<DescriptionCell>` client component with `useState` + `line-clamp-3`
  // toggle on a `<button>` inside this cell. Click handler appeared not to update
  // the rendered output (button "rendered once and not responding"). Root cause
  // unclear — suspects: React Compiler memoization of the cell render, TanStack
  // Table re-creating the cell node per parent render, or a Tailwind `display`
  // conflict between `block` and `line-clamp-3`. Revisit when overflow becomes
  // a real problem.
  col.accessor('description', {
    id: 'description',
    header: 'Opis',
    cell: (info) => <span className="whitespace-pre-line">{info.getValue()}</span>,
  }),
  col.accessor('otherCategoryName', {
    id: 'otherCategory',
    header: 'Kategoria (inne wydatki)',
    cell: (info) => info.getValue(),
  }),

  col.accessor('invoices', {
    id: 'invoice',
    header: 'Faktura',
    enableSorting: false,
    meta: { align: 'center' },
    cell: (info) => <InvoiceCell transactionId={info.row.original.id} invoices={info.getValue()} />,
  }),
  col.accessor('invoiceNote', {
    id: 'invoiceNote',
    header: 'Notatka',
    enableSorting: false,
    meta: { align: 'center' },
    cell: (info) => <NotePopover note={info.getValue()} />,
  }),

  col.accessor('sourceRegisterName', {
    id: 'sourceRegister',
    header: 'Kasa źródłowa',
    cell: (info) => {
      const id = info.row.original.sourceRegisterId
      const name = info.getValue()
      return (
        <OptionalLink href={name !== '—' && id ? `/kasa/${id}` : undefined}>{name}</OptionalLink>
      )
    },
  }),
  col.accessor('targetRegisterName', {
    id: 'targetRegister',
    header: 'Kasa docelowa',
    cell: (info) => {
      const id = info.row.original.targetRegisterId
      const name = info.getValue()
      return (
        <OptionalLink href={name !== '—' && id ? `/kasa/${id}` : undefined}>{name}</OptionalLink>
      )
    },
  }),

  col.accessor('paymentMethod', {
    id: 'paymentMethod',
    header: 'Metoda',
    cell: (info) => PAYMENT_METHOD_LABELS[info.getValue() as PaymentMethodT] ?? info.getValue(),
  }),
  col.accessor('workerName', {
    id: 'worker',
    header: 'Pracownik',
    cell: (info) => {
      const id = info.row.original.workerId
      const name = info.getValue()
      return (
        <OptionalLink href={name !== '—' && id ? `/pracownicy/${id}` : undefined}>
          {name}
        </OptionalLink>
      )
    },
  }),
  col.accessor('createdByName', {
    id: 'createdBy',
    header: 'Dodane przez',
    cell: (info) => info.getValue(),
  }),
  col.accessor('createdAt', {
    id: 'createdAt',
    header: 'Czas dodania',
    cell: (info) => formatPLDateTime(info.getValue()),
  }),
]

type ColumnOptionsT = {
  referenceData?: ReferenceDataBaseT
  currentUserId?: number
  currentUserRole?: RoleT
}

/**
 * Returns transfer column definitions, excluding specified column IDs.
 */
export function getTransferColumns(exclude: string[] = [], options: ColumnOptionsT = {}) {
  const { referenceData, currentUserId, currentUserRole } = options

  const actionsColumn = col.display({
    id: 'actions',
    header: 'Akcje',
    enableSorting: false,
    cell: (info) => {
      const row = info.row.original
      if (row.cancelled || isCancellationType(row.type)) return null

      const canEdit =
        !!currentUserRole &&
        currentUserId !== undefined &&
        canMutateTransfer({
          role: currentUserRole,
          userId: currentUserId,
          transferType: row.type,
          createdById: row.createdById,
        })

      return (
        <div className="flex items-center gap-1">
          {referenceData && (
            <EditTransferDialog row={row} referenceData={referenceData} canEdit={canEdit} />
          )}
          <CancelTransferButton transactionId={row.id} />
        </div>
      )
    },
  })

  const columns = [...allColumns, actionsColumn]

  if (exclude.length === 0) return columns
  const excludeSet = new Set(exclude)
  return columns.filter((c) => !excludeSet.has(c.id!))
}
