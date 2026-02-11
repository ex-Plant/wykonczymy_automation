'use client'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useFontSizeStore } from '@/stores/font-size-store'
import { useTranslation } from '@/lib/i18n/hooks/use-translation'

type PropsT = {
  className?: string
}

export function FontSizeControl({ className }: PropsT) {
  const { increment, decrement, isMinSize, isMaxSize } = useFontSizeStore()
  const { t } = useTranslation('accessibility')

  return (
    <>
      <Button
        variant="default"
        type="button"
        onClick={decrement}
        aria-label={t('decreaseFontSize')}
        disabled={isMinSize}
      >
        A-
      </Button>
      <Separator variant="fest" orientation="vertical" />

      <Button
        variant="default"
        type="button"
        onClick={increment}
        aria-label={t('increaseFontSize')}
        disabled={isMaxSize}
      >
        A+
      </Button>
    </>
  )
}
