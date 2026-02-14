import { EmployeeDashboard } from './employee-dashboard'
import { getEmployeeSaldo, getEmployeeMonthlyData } from '@/lib/transactions/get-employee-dashboard'

type EmployeeDashboardServerPropsT = {
  userId: number
}

export async function EmployeeDashboardServer({ userId }: EmployeeDashboardServerPropsT) {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [saldo, monthlyData] = await Promise.all([
    getEmployeeSaldo(userId),
    getEmployeeMonthlyData({ userId, month, year }),
  ])

  return (
    <EmployeeDashboard
      userId={userId}
      saldo={saldo}
      initialMonthlyData={monthlyData}
      month={month}
      year={year}
    />
  )
}
