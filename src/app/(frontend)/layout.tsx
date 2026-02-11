import '@/styles/globals.css'
import React from 'react'
import { abcFavorit, dmSans, spaceMono } from '@/fonts'
import { cn } from '@/lib/cn'
import { ThemeProvider } from '@/components/theme-provider'
import { Gradient } from '@/components/ui/gradient'
import { Header } from '@/components/layouts/header/header'
import { Footer } from '@/components/layouts/footer/footer'
import { DebugWrapper } from '@/components/debug_tools/debug-wrapper'
import { DebugScreens } from '@/components/debug_tools/debug-screens'
import { ToastContainer } from 'react-toastify'
import { TranslationsProvider } from '@/lib/i18n/translations-provider'
import { LocaleT } from '@/lib/i18n/types'

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
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
      <body
        className={
          'bg-background dark:bg-background-contrast dark:text-contrast relative overscroll-none scroll-smooth'
        }
      >
        <Gradient placement="top" />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TranslationsProvider locale={'pl' as LocaleT}>
            <DebugWrapper>
              <div className="flex min-h-screen flex-col">
                <Header />
                {children}
                <Footer />
              </div>

              <ToastContainer />
              <DebugScreens />
            </DebugWrapper>
          </TranslationsProvider>
        </ThemeProvider>
        <Gradient placement="bottom" />
      </body>
    </html>
  )
}
