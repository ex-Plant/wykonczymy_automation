'use client'

import { ArrowLeft } from 'lucide-react'

import { SimpleTooltip } from '@/components/ui/tooltip'
import { useHistoryBack } from '@/components/ui/use-history-back'

// History back, not a link to a fixed parent — the reader may have arrived from the investment
// page's settings link, the listing, or anywhere else, and „wróć" should undo that navigation.
export function HistoryBackButton({ fallbackHref }: { fallbackHref: string }) {
  const goBack = useHistoryBack(fallbackHref)

  return (
    <SimpleTooltip content="Wróć">
      <button
        type="button"
        onClick={goBack}
        aria-label="Wróć"
        className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
      >
        <ArrowLeft className="size-4" />
      </button>
    </SimpleTooltip>
  )
}
