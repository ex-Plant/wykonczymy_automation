'use client'

import { createContext, useContext, useMemo } from 'react'
import type { LocaleT, TranslationsT } from './types'
import { getTranslations } from './translations'

type I18nContextT = {
  locale: LocaleT
  translations: TranslationsT
}

const I18nContext = createContext<I18nContextT | null>(null)

type I18nProviderPropsT = {
  locale: LocaleT
  children: React.ReactNode
}

export function TranslationsProvider({ locale, children }: I18nProviderPropsT) {
  const value = useMemo(
    () => ({
      locale,
      translations: getTranslations(locale),
    }),
    [locale],
  )

  return <I18nContext value={value}>{children}</I18nContext>
}

export function useI18nContext() {
  const context = useContext(I18nContext)

  if (!context) throw new Error('useI18nContext must be used within an I18nProvider')

  return context
}
