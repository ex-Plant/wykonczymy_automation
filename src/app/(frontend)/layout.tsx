import '@/styles/globals.css'
import React from 'react'
import { redirect } from 'next/navigation'

import { abcFavorit, dmSans, spaceMono } from '@/fonts'
import { cn } from '@/lib/cn'
import { ToastContainer } from 'react-toastify'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { Sidebar } from '@/components/layouts/sidebar/sidebar'

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')

  return (
    <html
      lang="pl"
      className={cn(abcFavorit.variable, dmSans.variable, spaceMono.variable, 'antialiased')}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground relative overscroll-none scroll-smooth">
        <div className="flex min-h-screen">
          <Sidebar user={user} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
        <ToastContainer style={{ zIndex: 10001 }} />
      </body>
    </html>
  )
}
