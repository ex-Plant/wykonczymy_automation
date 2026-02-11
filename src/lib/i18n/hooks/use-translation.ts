import { useI18nContext } from '../translations-provider'
import { NamespaceT, TranslationKeyT } from '../types'

// Main translation hook

//Generic constraints (extends) ≠ class inheritance.
// "NS must be assignable to NamespaceT"
export function useTranslation<NS extends NamespaceT>(namespace: NS) {
  const { locale, translations } = useI18nContext()

  // "K must be assignable to TranslationKeyT<NS>"
  function t<K extends TranslationKeyT<NS>>(key: K): string {
    const namespaceTranslations = translations[namespace]
    const value = namespaceTranslations[key]

    if (typeof value !== 'string') {
      console.warn(`Translation key "${String(key)}" not found in namespace "${String(namespace)}"`)
      return String(key)
    }

    return value
  }

  return { t, locale }
}
