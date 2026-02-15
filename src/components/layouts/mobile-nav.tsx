'use client'

import { MobileMenuToggle } from '@/components/layouts/mobile-menu-toggle'
import { NAV_ITEMS } from '@/components/layouts/nav-items'
import { NavLink } from '@/components/layouts/nav-link'
import type { ReferenceDataT } from '@/components/transactions/add-transaction-dialog'
import { AddTransactionDialog } from '@/components/transactions/add-transaction-dialog'
import { isManagementRole } from '@/lib/auth/permissions'
import type { RoleT } from '@/lib/auth/roles'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { SidebarUser } from './sidebar/sidebar-user'

type MobileNavPropsT = {
  user: { name: string; email: string; role: RoleT }
  referenceData?: ReferenceDataT
}

const panelVariants = {
  hidden: { x: '-100%' },
  visible: { x: 0 },
}

const transition = {
  type: 'tween' as const,
  duration: 0.3,
  ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
}

export function MobileNav({ user, referenceData }: MobileNavPropsT) {
  const [isOpen, setIsOpen] = useState(false)
  const isManager = isManagementRole(user.role)

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles === 'all' || (item.roles === 'management' && isManager),
  )

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  return (
    <header className="border-border bg-background sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b px-3 md:hidden">
      {/* Left: menu toggle */}
      <MobileMenuToggle isOpen={isOpen} onToggle={() => setIsOpen(true)} />

      {/* Right: add transaction button */}
      {referenceData && <AddTransactionDialog referenceData={referenceData} />}

      {/* Full-screen sliding panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Menu nawigacji"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={transition}
            className="bg-background fixed inset-0 z-50 flex flex-col"
          >
            {/* Panel header — mirrors main header layout */}
            <div className="border-border flex h-14 items-center justify-between gap-3 border-b px-3">
              <MobileMenuToggle isOpen={isOpen} onToggle={() => setIsOpen(false)} />
              {referenceData && <AddTransactionDialog referenceData={referenceData} />}
            </div>

            <nav className="flex-1 space-y-1 px-3 py-2">
              {visibleItems.map(({ label, href, icon }) => (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  size="base"
                  onClick={close}
                />
              ))}
            </nav>

            <SidebarUser user={user} />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
