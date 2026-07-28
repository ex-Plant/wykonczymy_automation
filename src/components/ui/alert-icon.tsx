import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// The app's alarm shape, in the app's alarm colour. It used to carry a second, milder tone; the one
// rule that used it (a subcontractor price above the global multiplier) turned out to fire on
// perfectly ordinary rows, so both the tier and the tone are gone (owner, 2026-07-28).
//
// `aria-hidden` because every call site pairs this with the text (a tooltip, a banner's own sentence)
// that already says what is wrong — announcing the icon too would read the alarm twice.
export function AlertIcon({ className }: { className?: string }) {
  return <TriangleAlert className={cn('text-destructive shrink-0', className)} aria-hidden />
}
