import '@/styles/globals.css'
import React from 'react'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { abcFavorit, dmSans, spaceMono } from '@/fonts'
import { cn } from '@/lib/cn'
import { ThemeProvider } from '@/components/theme-provider'
import { ToastContainer } from 'react-toastify'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { LayoutShell } from './_components/layout-shell'
import type { ReferenceDataT } from '@/components/transactions/transaction-dialog-provider'

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')

  // Fetch reference data for the transaction dialog (management only)
  let referenceData: ReferenceDataT | undefined
  if (isManagementRole(user.role)) {
    const payload = await getPayload({ config })
    const [cashRegisters, investments, workers, otherCategories] = await Promise.all([
      payload.find({ collection: 'cash-registers', limit: 100 }),
      payload.find({
        collection: 'investments',
        where: { status: { equals: 'active' } },
        limit: 100,
      }),
      payload.find({ collection: 'users', limit: 100 }),
      payload.find({ collection: 'other-categories', limit: 100 }),
    ])

    referenceData = {
      cashRegisters: cashRegisters.docs.map((d) => ({ id: d.id, name: d.name })),
      investments: investments.docs.map((d) => ({ id: d.id, name: d.name })),
      workers: workers.docs.map((d) => ({ id: d.id, name: d.name })),
      otherCategories: otherCategories.docs.map((d) => ({ id: d.id, name: d.name })),
    }
  }

  return (
    <html
      lang="pl"
      className={cn(
        abcFavorit.variable,
        // climateCrisis.variable, # paid font not available yet  //todo: add later
        dmSans.variable,
        spaceMono.variable,
        'antialiased',
      )}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground relative overscroll-none scroll-smooth">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <LayoutShell user={user} referenceData={referenceData}>
            {children}
          </LayoutShell>
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  )
}
