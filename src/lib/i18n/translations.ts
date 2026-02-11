import type { LocaleT, TranslationsT } from './types'
import plTranslations from './locales/pl.json'
import enTranslations from './locales/en.json'

export const translations: Record<LocaleT, TranslationsT> = {
  pl: plTranslations,
  en: enTranslations,
}

export function getTranslations(locale: LocaleT): TranslationsT {
  return translations[locale] ?? translations.pl
}
