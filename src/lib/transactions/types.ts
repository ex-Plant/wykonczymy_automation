import type { TransactionTypeT, PaymentMethodT } from '@/lib/constants/transactions'

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
  readonly hasInvoice: boolean
}

export type PaginationMetaT = {
  readonly currentPage: number
  readonly totalPages: number
  readonly totalDocs: number
  readonly limit: number
}
