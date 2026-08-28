import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

const LOGO_ASPECT = 360 / 280

type PropsT = {
  // Intended height in px — it also drives the intrinsic width/height Next serves from, so the two
  // can't drift apart the way a CSS-only resize does (a taller render off a stale `width` gets an
  // upscaled, blurry source). A container narrower than the resulting width scales both axes down.
  height: number
  className?: string
  priority?: boolean
}

export function BrandLogo({ height, className, priority }: PropsT) {
  return (
    <Image
      src="/logo-wykonczymy.png"
      alt="Wykończymy"
      width={Math.round(height * LOGO_ASPECT)}
      height={height}
      priority={priority}
      // Both axes auto, never a pinned height: preflight's `img { max-width: 100% }` clamps the
      // width in a narrow container (the collapsed sidebar rail is 40px against this logo's 46px),
      // and a fixed height would hold while the width shrank — squashing the mark. Left to `auto`,
      // the height follows the clamp and the aspect ratio survives.
      className={cn('h-auto w-auto', className)}
    />
  )
}
