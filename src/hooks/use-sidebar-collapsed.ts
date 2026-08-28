'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'

// Whether the desktop sidebar is collapsed to icons, persisted in localStorage so the choice
// survives navigation and reloads. The stable server snapshot is 'expanded', so the first client
// render matches the server one and a collapsed sidebar widens after hydration.
const STORAGE_KEY = 'nav:sidebar-collapsed'
const STATES = ['expanded', 'collapsed'] as const

export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  const [state, setState] = usePersistedEnum(STORAGE_KEY, STATES, 'expanded')
  return [state === 'collapsed', (collapsed) => setState(collapsed ? 'collapsed' : 'expanded')]
}
