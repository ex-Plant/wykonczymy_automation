export type InvestmentRowT = {
  readonly id: number
  readonly name: string
  readonly status: 'active' | 'completed'
  readonly totalCosts: number
  readonly address: string
  readonly phone: string
  readonly email: string
  readonly contactPerson: string
}
