import type { Where } from 'payload'
import type { FilterConfigT } from '@/types/filters'
import type { PaginationParamsT } from '@/lib/utils/pagination'

type TransferQueryT = PaginationParamsT & { where: Where }

export type TransferTableConfigT = {
  query: TransferQueryT
  baseUrl: string
  excludeColumns?: string[]
  filters?: FilterConfigT
  totalFilteredAmount?: number
  /** Server-derived: the list shows cancelled rows but the sum's SQL never counts them. */
  listsCancelled?: boolean
  /** Defaults to true. Set to false to hide the "Suma kwot" button in TransferFilters. */
  showTotalAmount?: boolean
  cancelledTransactionAudit?: boolean
  /**
   * Opt in to the invoice-download button. The fetch behind it is unpaginated over the table's own
   * `where`, so on an unanchored filter (`/raporty` with nothing applied) it ZIPs every invoice in
   * the system — deliberate there, but weigh it before opting a new page in.
   */
  invoiceDownload?: boolean
}
