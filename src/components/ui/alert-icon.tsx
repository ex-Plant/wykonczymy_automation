import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// Two tones of ONE glyph, on purpose: the exclamation triangle is the app's alarm shape, and a
// warning that borrowed a different silhouette would read as a different KIND of problem rather than
// a lesser one. Only the colour separates them — destructive = blocked, warning = counts anyway.
export type AlertToneT = 'danger' | 'warning'

const TONE_CLASS: Record<AlertToneT, string> = {
  danger: 'text-destructive',
  warning: 'text-warning',
}

// `aria-hidden` because every call site pairs this with the text (a tooltip, a banner's own sentence)
// that already says what is wrong — announcing the icon too would read the alarm twice.
export function AlertIcon({ tone, className }: { tone: AlertToneT; className?: string }) {
  return <TriangleAlert className={cn('shrink-0', TONE_CLASS[tone], className)} aria-hidden />
}
