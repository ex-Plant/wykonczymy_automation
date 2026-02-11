'use client'

import { GridVisualHelper } from './grid-visual-helper'
import { DebugToolsTriggers } from './debug-tools-triggers'
import { cn } from '@/lib/cn'
import { useDebugTools } from './use-debug-tools'
import { ReactNode } from 'react'

export const DebugWrapper = ({ children }: { children: ReactNode }) => {
  const { layersVisible, outlinesVisible, gridVisible } = useDebugTools()

  const isDev = process.env.NODE_ENV === 'development'

  return (
    <>
      {isDev && gridVisible && <GridVisualHelper />}
      <div
        id="debug_wrapper"
        className={cn(
          `relative flex h-full flex-col`,
          outlinesVisible && `**:outline **:outline-lime-300`,
          layersVisible && `**:bg-[hsla(0,11%,2%,0)]`,
        )}
      >
        {children}
        {isDev && <DebugToolsTriggers />}
      </div>
    </>
  )
}
