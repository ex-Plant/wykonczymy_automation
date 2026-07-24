import { TriangleAlert } from 'lucide-react'
import { HintTooltip } from '@/components/ui/tooltip'

// The "etap plane not yet confirmed" scream — an etap with no explicitly picked rozliczenie is
// counted as z narzędziami, and this sits next to the figure that assumption feeds (recon-mismatch
// pattern: render the number, scream next to it). Same construction as ReconMismatchBadge but its
// OWN aria-label — the recon badge's "Niezgodność z transakcjami" is asserted by E2E and means
// something else. Shared by the etap header (Phase 3) and „Podsumowanie podwykonawców" (Phase 5).
export function PlaneUnconfirmedBadge({
  content,
  className = 'size-5',
}: {
  content: string
  className?: string
}) {
  return (
    <HintTooltip content={content} className="text-destructive">
      <TriangleAlert className={className} aria-label="Rozliczenie etapu niepotwierdzone" />
    </HintTooltip>
  )
}
