import { Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type DescriptionSizeT = 'sm' | 'xs' | '2xs'
type DescriptionToneT = 'muted' | 'error'

type DescriptionPropsT = {
  children: React.ReactNode
  className?: string
  withIcon?: boolean
  size?: DescriptionSizeT
  // `error` is the same note in the alarm colour and the alarm shape — a wrong state explained inline,
  // where a bordered WarningBanner would be too loud for one line under a table cell.
  tone?: DescriptionToneT
}

// The icon rides the text size: the base layer pins every Lucide glyph to 1rem, which next to 0.625rem
// copy stops reading as a mark on the line and starts reading as a second element.
const SIZE: Record<DescriptionSizeT, { text: string; icon: string }> = {
  sm: { text: 'text-sm', icon: 'mt-0.5' },
  xs: { text: 'text-xs', icon: '' },
  '2xs': { text: 'text-2xs', icon: 'size-3 mt-px' },
}

const TONE: Record<DescriptionToneT, { color: string; Icon: typeof Info }> = {
  muted: { color: 'text-muted-foreground', Icon: Info },
  error: { color: 'text-destructive', Icon: TriangleAlert },
}

export function Description({
  children,
  className,
  withIcon = true,
  size = 'sm',
  tone = 'muted',
}: DescriptionPropsT) {
  const { color, Icon } = TONE[tone]

  return (
    <p className={cn('flex items-start gap-1 font-normal', color, SIZE[size].text, className)}>
      {/* `items-start` keeps the icon on the FIRST line of a note that wraps, so each size carries its
          own downward nudge instead of centring — only xs happens to need none. */}
      {withIcon && <Icon className={cn('shrink-0', SIZE[size].icon)} aria-hidden />}
      <span>{children}</span>
    </p>
  )
}
