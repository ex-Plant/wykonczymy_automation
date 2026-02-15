import Image from 'next/image'
import { cn } from '@/lib/cn'

type PropsT = {
  priority?: boolean
  src?: string
  alt: string
  imgClass?: string
  containerClass?: string
  fill?: boolean
  sizes: string
  quality?: number
  placeholder?: boolean
}

export const ImageMedia = ({
  src,
  alt,
  imgClass,
  fill,
  sizes,
  priority = false,
  containerClass,
  quality = 80,
  placeholder = true,
}: PropsT) => {
  const url = src

  return (
    <div className={cn('relative w-full', containerClass)}>
      {placeholder && <Placeholder />}
      {url && (
        <Image
          src={url}
          className={cn(`object-cover object-center`, imgClass)}
          alt={alt}
          priority={priority}
          sizes={sizes}
          fill={fill ?? true}
          quality={quality}
        />
      )}
    </div>
  )
}

function Placeholder() {
  return (
    <div className="outline-black-10 absolute inset-0 animate-pulse bg-linear-to-br from-white to-slate-300 outline-1" />
  )
}
