'use client'

import { createPortal } from 'react-dom'
import { ReactNode } from 'react'

export const FixedClientLoader = ({ children }: { children: ReactNode }) => {
  return createPortal(<>{children}</>, document.body)
}
