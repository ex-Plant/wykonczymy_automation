'use client'

import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { useChangeLocale } from '@/lib/i18n/hooks/use-change-locale'
import { useTranslation } from '@/lib/i18n/hooks/use-translation'

type PropsT = {
  className?: string
}

export function LanguageSwitcher({ className }: PropsT) {
  const { changeLocale, locale } = useChangeLocale()
  const { t } = useTranslation('accessibility')

  function toggleLanguage() {
    if (locale === 'pl') {
      changeLocale('en')
    } else {
      changeLocale('pl')
    }
  }

  return (
    <Button
      variant="default"
      type="button"
      data-slot="language-switcher"
      onClick={toggleLanguage}
      className={cn('flex cursor-pointer items-center justify-center px-2', className)}
      aria-label={t('toggleLanguage')}
    >
      {locale === 'pl' ? 'EN' : 'PL'}
    </Button>
  )
}
