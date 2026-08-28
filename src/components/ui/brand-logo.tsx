import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

const LOGO_ASPECT = 360 / 280

type PropsT = {
  // Rendered height in px — it also drives the intrinsic width/height Next serves from, so the two
  // can't drift apart the way a CSS-only resize does (a taller render off a stale `width` gets an
  // upscaled, blurry source).
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
      className={cn('w-auto', className)}
      style={{ height }}
    />
  )
}
