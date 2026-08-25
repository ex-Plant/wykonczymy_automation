import { Slash, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

// The subcontractor-plane glyphs, shared by the price-view toggle (VIEWS) and the etap header so the
// two can never drift: z narzędziami = wrench, bez narzędzi = crossed-wrench (no native glyph —
// overlay two mirrored Slashes into an X to read as "tools off").
export function planeIcon(plane: ToolPlaneT, className = ''): ReactNode {
  if (plane === 'w_tools') return <Wrench className={className} />
  return (
    // `shrink-0`: the two Slashes are absolutely positioned, so the span carries the glyph's whole
    // width — as a plain flex child beside a long wrapping label it gets squeezed to nothing, and the
    // crossed wrench vanishes while the plain one (an svg, shrink-0 by the menu's own rule) survives.
    <span className="relative inline-flex shrink-0">
      <Wrench className={className} />
      <Slash className="absolute inset-0" />
      <Slash className="absolute inset-0 -scale-x-100" />
    </span>
  )
}
