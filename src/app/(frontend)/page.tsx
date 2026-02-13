import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { ManagerDashboard } from './_components/manager-dashboard'
import { EmployeeDashboard } from './_components/employee-dashboard'
import { getEmployeeMonthData } from '@/lib/transactions/actions'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (isManagementRole(user.role)) return <ManagerDashboard />

  // Employee: fetch initial data for current month
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const initialData = await getEmployeeMonthData(user.id, month, year)

  return (
    <EmployeeDashboard
      userId={user.id}
      initialMonth={month}
      initialYear={year}
      initialData={initialData}
    />
  )
}
