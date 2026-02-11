'use client'

import { cn } from '@/lib/cn'
import Icon from '@/components/ui/icons/icon'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

type PropsT = {
  className?: string
}

export function DarkModeToggle({ className }: PropsT) {
  const { setTheme, theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Button
      variant="default"
      type="button"
      data-slot="dark-mode-toggle"
      data-state={isDark ? 'dark' : 'light'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn('', className)}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
    >
      <Icon iconName="contrast" size="md" />
    </Button>
  )
}
