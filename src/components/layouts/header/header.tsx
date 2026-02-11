'use client'

import Link from 'next/link'
import NavDesktop from './nav-desktop'
import Logo from '@/components/Logo'
const NAV_DATA = [
  {
    id: 'group-1',
    items: [
      { label: 'Dołącz', link: '/join', variant: 'primary' }, // The black button
      { label: 'Program', link: '/program' },
      { label: 'Goście', link: '/guests' },
    ],
  },
  {
    id: 'group-2',
    items: [
      { label: 'Idea', link: '/idea' },
      { label: 'Aktualności', link: '/news' },
    ],
  },
  {
    id: 'group-3',
    items: [
      { label: 'Społeczność', link: '/community' },
      // User and Notifications would likely be separate components or special items
    ],
  },
]

export type NavDataT = typeof NAV_DATA

//todo gradient etc
// todo blend-mode: difference
export const Header = () => {
  return (
    <header className="fixed top-0 right-0 left-0 z-10000">
      <div className={`fest-container flex items-center justify-between gap-1 py-2 md:py-4`}>
        <Link className={``} href="/">
          {/* <Logo /> */}
        </Link>

        <NavDesktop data={NAV_DATA} />
        {/* <AccessibilityMenu /> */}

        {/* <NavMobile items={NAV_DATA} /> */}

        {/* <ModeToggle /> */}
      </div>
    </header>
  )
}
