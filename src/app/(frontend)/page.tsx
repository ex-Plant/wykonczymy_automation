import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { ManagerDashboard } from './_components/manager-dashboard'
import { EmployeeDashboardServer } from './_components/employee-dashboard-server'
import { redirect } from 'next/navigation'

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  const params = await searchParams

  if (isManagementRole(user.role)) return <ManagerDashboard searchParams={params} />

  return <EmployeeDashboardServer userId={user.id} searchParams={params} />
}
