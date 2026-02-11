'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useI18nContext } from '../translations-provider'
import { i18n } from '../i18n'

export function useChangeLocale() {
  const { locale } = useI18nContext()
  const pathname = usePathname()
  const router = useRouter()

  function changeLocale(newLocale: string) {
    if (newLocale === locale) return

    // Remove current locale prefix if present
    let pathWithoutLocale = pathname

    for (const loc of i18n.locales) {
      // if not default locale
      if (pathname.startsWith(`/${loc}/`) || pathname === `/${loc}`) {
        // remove the locale prefix
        pathWithoutLocale = pathname.slice(loc.length + 1) || '/'
        break
      }
    }

    // Build new path
    const newPath =
      newLocale === i18n.defaultLocale ? pathWithoutLocale : `/${newLocale}${pathWithoutLocale}`

    router.push(newPath)
  }

  return { locale, changeLocale, locales: i18n.locales }
}
