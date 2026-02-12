export const TRANSACTION_TYPES = [
  'INVESTMENT_EXPENSE',
  'ADVANCE',
  'EMPLOYEE_EXPENSE',
  'OTHER',
] as const
export type TransactionTypeT = (typeof TRANSACTION_TYPES)[number]

export const TRANSACTION_TYPE_LABELS: Record<TransactionTypeT, string> = {
  INVESTMENT_EXPENSE: 'Wydatek inwestycyjny',
  ADVANCE: 'Zaliczka',
  EMPLOYEE_EXPENSE: 'Wydatek pracowniczy',
  OTHER: 'Inne',
}

export const PAYMENT_METHODS = ['CASH', 'BLIK', 'TRANSFER', 'CARD'] as const
export type PaymentMethodT = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodT, string> = {
  CASH: 'Gotówka',
  BLIK: 'BLIK',
  TRANSFER: 'Przelew',
  CARD: 'Karta',
}

export const needsInvestment = (type: string) =>
  type === 'INVESTMENT_EXPENSE' || type === 'EMPLOYEE_EXPENSE'

export const needsWorker = (type: string) => type === 'ADVANCE' || type === 'EMPLOYEE_EXPENSE'

export const needsOtherCategory = (type: string) => type === 'OTHER'
