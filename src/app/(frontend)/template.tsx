'use client'
import { useFontSizeStore } from '@/stores/font-size-store'
import { AnimatedWrapper } from '@/components/wrappers/animated-list'

export default function Template({ children }: { children: React.ReactNode }) {
  // It has to be a default export ❗
  // AnimatePresence is to animate elements when they mount / unmount
  // mode="wait": Waits for exit animation to complete before starting entry animation
  // mode="sync": Entry and exit animations happen simultaneously
  // mode="popLayout": Exit animation happens immediately, entry follows

  const { scale } = useFontSizeStore()

  return (
    <AnimatedWrapper animationKey={scale} id="template" className="grow" exitY={0}>
      {children}
    </AnimatedWrapper>
  )
}
