import { Slash, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import type { StagePlaneT } from '@/lib/kosztorys/types'

// The subcontractor-plane glyphs, shared by the price-view toggle (VIEWS) and the etap header so the
// two can never drift: z narzędziami = wrench, bez narzędzi = crossed-wrench (no native glyph —
// overlay two mirrored Slashes into an X to read as "tools off").
export function planeIcon(plane: StagePlaneT, className = ''): ReactNode {
  if (plane === 'w_tools') return <Wrench className={className} />
  return (
    <span className="relative inline-flex">
      <Wrench className={className} />
      <Slash className="absolute inset-0" />
      <Slash className="absolute inset-0 -scale-x-100" />
    </span>
  )
}
