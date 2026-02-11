import { LocaleT } from './types'

/**
 * Converts WPML locale format to app's LocaleT.
 *
 * @example
 * parseLocale('en_US') // → 'en'
 * parseLocale('pl_PL') // → 'pl'
 * parseLocale()        // → 'pl' (default)
 */

export default function parseLocale(wpmlLocale?: string): LocaleT {
  if (!wpmlLocale) return 'pl'
  const locale = wpmlLocale.split('_')[0]
  return locale === 'en' ? 'en' : 'pl'
}
