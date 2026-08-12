import type { Where } from 'payload'
import type { FilterConfigT } from '@/types/filters'

type ExportContextT = 'investment' | 'register'

export type HeaderFieldT = {
  label: string
  value: string
  amount?: number
}

export type FinancialFieldT = HeaderFieldT & { amount: number }

type TransferQueryT = {
  where: Where
  page: number
  limit: number
}

export type TransferTableConfigT = {
  query: TransferQueryT
  baseUrl: string
  excludeColumns?: string[]
  filters?: FilterConfigT
  context?: ExportContextT
  contextId?: number
  headerFields?: HeaderFieldT[]
  totalPayouts?: number
  totalFilteredAmount?: number
  /** Server-derived: the list shows cancelled rows but the sum's SQL never counts them. */
  listsCancelled?: boolean
  /** Defaults to true. Set to false to hide the "Suma kwot" button in TransferFilters. */
  showTotalAmount?: boolean
  cancelledTransactionAudit?: boolean
  /**
   * Opt in to the invoice-download button. Set it only where the table's own filter is a meaningful
   * invoice scope — the fetch behind it is unpaginated, so an unanchored `where` would ZIP every
   * invoice in the system.
   */
  invoiceDownload?: boolean
}
