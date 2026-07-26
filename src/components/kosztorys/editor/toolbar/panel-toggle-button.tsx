'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  open: boolean
  onToggle: () => void
  children: ReactNode
}

// default variant has no border, outline does — keep the box identical so toggling doesn't shift
// the right-aligned neighbour by the border's width.
export function PanelToggleButton({ open, onToggle, children }: PropsT) {
  return (
    <Button
      size="sm"
      variant={open ? 'default' : 'outline'}
      className={cn(open && 'border border-transparent')}
      onClick={onToggle}
    >
      {children}
      <ChevronDown className={cn('transition-transform duration-200', open && 'rotate-180')} />
    </Button>
  )
}
