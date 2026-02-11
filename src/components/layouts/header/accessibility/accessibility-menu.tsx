'use client'

import { Separator } from '@/components/ui/separator'
import { FontSizeControl } from './font-size-control'
import { DarkModeToggle } from './dark-mode-toggle'
import { LanguageSwitcher } from './language-switcher'
import { NavGroupWrapper } from '../nav-group-wrapper'

type PropsT = {
  className?: string
}

export function AccessibilityMenu({ className }: PropsT) {
  return (
    <NavGroupWrapper data-slot="accessibility-menu" className="flex items-center self-start">
      <FontSizeControl />

      <Separator variant="fest" orientation="vertical" />

      <DarkModeToggle />

      <Separator variant="fest" orientation="vertical" />

      <LanguageSwitcher />
    </NavGroupWrapper>
  )
}
