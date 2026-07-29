import { TriangleAlert } from 'lucide-react'
import { HintTooltip } from '@/components/ui/tooltip'

// The "etap plane not yet confirmed" scream — an etap with no explicitly picked rozliczenie belongs
// to neither crew's bill, and this sits next to the figure that omission leaves short (recon-mismatch
// pattern: render the number, scream next to it). Same construction as `LabelHintIcon`'s `mismatch`
// variant but its OWN aria-label — that one's "Niezgodność z transakcjami" is asserted by E2E and
// means something else. Shared by the etap header and „Podsumowanie podwykonawców".
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
