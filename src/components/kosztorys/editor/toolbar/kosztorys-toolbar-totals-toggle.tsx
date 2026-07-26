'use client'

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'
import { cn } from '@/lib/utils/cn'

export function KosztorysToolbarTotalsToggle() {
  const [totalsOpen, setTotalsOpen] = useTotalsPanelOpen()

  return (
    <Button
      size="sm"
      variant={totalsOpen ? 'default' : 'outline'}
      // default variant has no border, outline does — keep the box identical so toggling doesn't
      // shift the right-aligned neighbour by the border's width.
      className={cn(totalsOpen && 'border border-transparent')}
      onClick={() => setTotalsOpen(!totalsOpen)}
    >
      Podsumowanie
      <ChevronDown
        className={cn('transition-transform duration-200', totalsOpen && 'rotate-180')}
      />
    </Button>
  )
}
