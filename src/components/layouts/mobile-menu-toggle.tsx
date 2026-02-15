'use client'

import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type MobileMenuTogglePropsT = {
  isOpen: boolean
  onToggle: () => void
  className?: string
}

export function MobileMenuToggle({ isOpen, onToggle, className }: MobileMenuTogglePropsT) {
  return (
    <button
      onClick={onToggle}
      className={cn('text-foreground hover:bg-accent rounded-md p-3 transition-colors', className)}
      aria-label={isOpen ? 'Zamknij menu' : 'Otwórz menu'}
      aria-expanded={isOpen}
    >
      {isOpen ? <X className="size-6" /> : <Menu className="size-6" />}
    </button>
  )
}
