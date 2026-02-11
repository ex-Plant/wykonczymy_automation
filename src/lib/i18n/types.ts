import type pl from './locales/pl.json'

// Infer translation keys from Polish (source of truth)
export type TranslationsT = typeof pl

// Supported locales
export type LocaleT = 'pl' | 'en'

// Namespace keys (top-level keys in translation files)
export type NamespaceT = keyof TranslationsT

// Get keys for a specific namespace - this is confusing because this actaullly narrows the key to a specific namespace not extends
// NS must be one of the namespaces in the TranslationsT
export type TranslationKeyT<NS extends NamespaceT> = keyof TranslationsT[NS]
