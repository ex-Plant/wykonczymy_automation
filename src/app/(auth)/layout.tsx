import '@/styles/globals.css'
import React from 'react'
import { abcFavorit, dmSans, spaceMono } from '@/fonts'
import { cn } from '@/lib/cn'
import { ThemeProvider } from '@/components/theme-provider'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pl"
      className={cn(abcFavorit.variable, dmSans.variable, spaceMono.variable, 'antialiased')}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground relative overscroll-none scroll-smooth">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <main className="flex min-h-screen items-center justify-center">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
