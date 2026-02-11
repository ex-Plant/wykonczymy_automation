/**
 * Font Size Store
 *
 * Manages font scale preference for WCAG accessibility compliance.
 * Persists user preference to localStorage and applies scaling to document root.
 * Scale range: 100% - 200% (WCAG 1.4.4 requires up to 200% without loss of functionality)
 *
 * @example
 * const scale = useFontSizeStore((s) => s.scale)
 * const { increment, decrement, setScale, reset } = useFontSizeStore()
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const FONT_SCALES = [100, 125, 150, 175, 200] as const
type FontScaleT = (typeof FONT_SCALES)[number]

const DEFAULT_SCALE: FontScaleT = 100

type FontSizeStoreT = {
  scale: FontScaleT
  increment: () => void
  decrement: () => void
  setScale: (scale: FontScaleT) => void
  reset: () => void
}

type FontSizeHookReturnT = FontSizeStoreT & {
  isMinSize: boolean
  isMaxSize: boolean
}

const applyScale = (scale: FontScaleT) => {
  if (typeof document !== 'undefined') {
    setTimeout(() => {
      // this is for smoother transition
      document.documentElement.style.fontSize = `${scale}%`
    }, 400)
  }
}

export const useFontSizeStoreBase = create<FontSizeStoreT>()(
  persist(
    (set) => ({
      scale: DEFAULT_SCALE,

      increment: () =>
        set((state) => {
          const currentIndex = FONT_SCALES.indexOf(state.scale)
          if (currentIndex >= FONT_SCALES.length - 1) return state
          const newScale = FONT_SCALES[currentIndex + 1]
          applyScale(newScale)
          return { scale: newScale }
        }),

      decrement: () =>
        set((state) => {
          const currentIndex = FONT_SCALES.indexOf(state.scale)
          if (currentIndex <= 0) return state
          const newScale = FONT_SCALES[currentIndex - 1]
          applyScale(newScale)
          return { scale: newScale }
        }),

      setScale: (scale) =>
        set(() => {
          if (!FONT_SCALES.includes(scale)) return {}
          applyScale(scale)
          return { scale }
        }),

      reset: () =>
        set(() => {
          applyScale(DEFAULT_SCALE)
          return { scale: DEFAULT_SCALE }
        }),
    }),
    {
      name: 'font-size-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) applyScale(state.scale)
      },
    },
  ),
)

export function useFontSizeStore(): FontSizeHookReturnT {
  const scale = useFontSizeStoreBase((s) => s.scale)
  const increment = useFontSizeStoreBase((s) => s.increment)
  const decrement = useFontSizeStoreBase((s) => s.decrement)
  const setScale = useFontSizeStoreBase((s) => s.setScale)
  const reset = useFontSizeStoreBase((s) => s.reset)

  const isMinSize = scale === FONT_SCALES[0]
  const isMaxSize = scale === FONT_SCALES[FONT_SCALES.length - 1]

  return { scale, increment, decrement, setScale, reset, isMinSize, isMaxSize }
}

export { FONT_SCALES, DEFAULT_SCALE }
export type { FontScaleT }
