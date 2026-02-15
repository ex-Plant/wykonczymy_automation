'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { isManagementRole } from '@/lib/auth/permissions'
import type { RoleT } from '@/lib/auth/roles'
import type { ReferenceDataT } from '@/components/transactions/add-transaction-dialog'
import { AddTransactionDialog } from '@/components/transactions/add-transaction-dialog'
import { NAV_ITEMS } from '@/components/layouts/nav-items'
import { NavLink } from '@/components/layouts/nav-link'
import { logoutAction } from '@/lib/actions/auth'
import { MobileMenuToggle } from '@/components/layouts/mobile-menu-toggle'

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
  const [isPending, startTransition] = useTransition()
  const isManager = isManagementRole(user.role)

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles === 'all' || (item.roles === 'management' && isManager),
  )

  const close = useCallback(() => setIsOpen(false), [])

  function handleLogout() {
    startTransition(() => logoutAction())
  }

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  // Lock body scroll while menu is open
  useEffect(() => {
    if (!isOpen) return

    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
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
              <MobileMenuToggle isOpen={isOpen} onToggle={close} />
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

            <div className="border-border mt-auto border-t p-3">
              <button
                onClick={handleLogout}
                disabled={isPending}
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-3 rounded-md px-3 py-3 text-base transition-colors disabled:opacity-50"
              >
                <LogOut className="size-5" />
                Wyloguj
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
