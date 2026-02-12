import { formatPLN } from '@/lib/format-currency'
import {
  TRANSACTION_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type TransactionTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transactions'
import type { RoleT } from '@/collections/users'

type TransactionRowT = {
  id: number
  description: string
  amount: number
  type: string
  paymentMethod: string
  date: string
  cashRegisterName: string
}

type TransactionsTablePropsT = {
  transactions: TransactionRowT[]
  userRole: RoleT
}

export function TransactionsTable({ transactions, userRole }: TransactionsTablePropsT) {
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border bg-muted/50 border-b">
            <th className="text-muted-foreground px-4 py-3 text-left font-medium">Opis</th>
            <th className="text-muted-foreground px-4 py-3 text-right font-medium">Kwota</th>
            <th className="text-muted-foreground px-4 py-3 text-left font-medium">Typ</th>
            <th className="text-muted-foreground px-4 py-3 text-left font-medium">Metoda</th>
            <th className="text-muted-foreground px-4 py-3 text-left font-medium">Data</th>
            <th className="text-muted-foreground px-4 py-3 text-left font-medium">Kasa</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-muted-foreground px-4 py-8 text-center">
                Brak transakcji
              </td>
            </tr>
          ) : (
            transactions.map((tx) => (
              <tr key={tx.id} className="border-border border-b last:border-b-0">
                <td className="text-foreground px-4 py-3">{tx.description}</td>
                <td className="text-foreground px-4 py-3 text-right font-medium">
                  {formatPLN(tx.amount)}
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {TRANSACTION_TYPE_LABELS[tx.type as TransactionTypeT] ?? tx.type}
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {PAYMENT_METHOD_LABELS[tx.paymentMethod as PaymentMethodT] ?? tx.paymentMethod}
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {new Date(tx.date).toLocaleDateString('pl-PL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </td>
                <td className="text-muted-foreground px-4 py-3">{tx.cashRegisterName}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
