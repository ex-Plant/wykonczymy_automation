import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { iconVariants } from './icon-variants'

type PropsT = VariantProps<typeof iconVariants> & {
  className?: string
  containerClassName?: string
  color: 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'custom'
  customColor?: string
}

export default function DotIcon({ className, color, customColor, containerClassName }: PropsT) {
  const colorMap = {
    red: '#ff7b60',
    yellow: '#ffbf42',
    green: '#3ad199',
    blue: '#60b0ff',
    purple: '#af82e8',
    custom: customColor ?? 'currentColor',
  }

  return (
    <div
      data-slot="icon"
      data-icon="dot"
      className={cn('flex size-4 items-center justify-center', containerClassName)}
    >
      <div
        className={cn('size-1.5 shrink-0 grow-0 rounded-full', className)}
        style={{ backgroundColor: colorMap[color] ?? color }}
      />
    </div>
  )
}
