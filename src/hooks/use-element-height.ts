'use client'

import { useCallback, useRef, useState, type RefObject } from 'react'

// View-filling height: from the element's top edge to the bottom of the window (minus gap).
// NOT from the element's own clientHeight —
// the top position depends on the navbar/header ABOVE the grid, which the grid doesn't change, so
// the value is stable. No ResizeObserver: measuring the grid container's clientHeight
// fell into a loop with react-datasheet-grid's internal resize detector (constant "flickering",
// thousands of Issues/s in DevTools). Measure only on mount and window resize; floor + gap so
// the grid is slightly shorter than the available space → no ancestor scrollbar → no oscillation.
// The node comes back alongside the height because the ref itself is a callback — a caller that
// also needs to read the element (the grid measures its own column widths off the DOM) has no other
// way in without attaching a second ref to the same node.
export function useElementHeight(
  gap = 8,
  fallback = 600,
): [(node: HTMLElement | null) => void, number, RefObject<HTMLElement | null>] {
  const [height, setHeight] = useState(fallback)
  const nodeRef = useRef<HTMLElement | null>(null)

  const measure = useCallback(() => {
    const node = nodeRef.current
    if (!node) return
    const top = node.getBoundingClientRect().top
    const next = Math.max(240, Math.floor(window.innerHeight - top - gap))
    setHeight((prev) => (prev === next ? prev : next))
  }, [gap])

  const ref = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node
      if (!node) return
      // rAF: measure after the layout settles, not during commit.
      const frame = requestAnimationFrame(measure)
      window.addEventListener('resize', measure)
      // React 19 calls this cleanup INSTEAD of `ref(null)`, so clearing the node here is the only
      // thing that stops a second reader (the grid measures its columns off it) from holding a
      // detached element.
      return () => {
        nodeRef.current = null
        cancelAnimationFrame(frame)
        window.removeEventListener('resize', measure)
      }
    },
    [measure],
  )

  return [ref, height, nodeRef]
}
