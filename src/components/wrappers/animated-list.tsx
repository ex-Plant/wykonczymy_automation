'use client'

import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type PropsT = {
  animationKey: string | number
  children: ReactNode
  className?: string
  id?: string
  exitY?: number
  duration?: number
}

export function AnimatedWrapper({
  animationKey,
  children,
  className,
  id,
  exitY = -20,
  duration = 0.5,
}: PropsT) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={animationKey}
        id={id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: exitY }}
        transition={{ duration, ease: 'easeInOut' }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
