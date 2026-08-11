'use client'

import { useHistoryBack } from '@/components/ui/use-history-back'

type BackButtonPropsT = {
  label: string
  fallbackHref: string
}

export function BackButton({ label, fallbackHref }: BackButtonPropsT) {
  const goBack = useHistoryBack(fallbackHref)

  return (
    <button
      type="button"
      onClick={goBack}
      className="text-muted-foreground hover:text-foreground w-fit cursor-pointer text-sm"
    >
      &larr; {label}
    </button>
  )
}
