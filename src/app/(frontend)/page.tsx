import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { ManagerDashboard } from './_components/manager-dashboard'
import { EmployeeDashboardServer } from './_components/employee-dashboard-server'
import { redirect } from 'next/navigation'
import { getMonthDateRange } from '@/lib/helpers'

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  const params = await searchParams

  if (isManagementRole(user.role)) return <ManagerDashboard searchParams={params} />

  // Employee dashboard always shows a month — redirect to add default date range
  if (!params.from || !params.to) {
    const now = new Date()
    const { from, to } = getMonthDateRange(now.getMonth() + 1, now.getFullYear())
    const qs = new URLSearchParams({ ...(params as Record<string, string>), from, to }).toString()
    redirect(`/?${qs}`)
  }

  return <EmployeeDashboardServer userId={user.id} searchParams={params} />
}
