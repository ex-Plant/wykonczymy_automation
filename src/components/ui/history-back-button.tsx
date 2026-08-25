'use client'

import { ArrowLeft } from 'lucide-react'

import { useHistoryBack } from '@/components/ui/use-history-back'

// History back, not a link to a fixed parent — the reader may have arrived from the investment
// page's settings link, the listing, or anywhere else, and „wróć" should undo that navigation.
export function HistoryBackButton({ fallbackHref }: { fallbackHref: string }) {
  const goBack = useHistoryBack(fallbackHref)

  return (
    <button
      type="button"
      onClick={goBack}
      className="text-muted-foreground hover:text-foreground flex shrink-0 cursor-pointer items-center gap-1 text-xs"
    >
      <ArrowLeft className="size-4" />
      Wróć
    </button>
  )
}
