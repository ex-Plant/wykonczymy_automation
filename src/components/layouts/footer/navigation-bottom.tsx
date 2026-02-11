import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { Separator } from '@/components/ui/separator'
import Icon from '@/components/ui/icons/icon'

type NavigationBottomPropsT = {
  leftText: string
  rightText: string
  href: string
  icon?: React.ReactNode
  gradientFrom?: string
  gradientTo?: string
  className?: string
}

function NavigationBottom({
  leftText,
  rightText,
  href = '#',
  icon,
  gradientFrom = '#FF6756',
  gradientTo = '#AE3FCA',
  className,
}: NavigationBottomPropsT) {
  return (
    <Link
      href={href}
      data-slot="navigation-bottom"
      style={{ backgroundImage: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})` }}
      className={cn(
        'fest-label-small text-white-100 inline-flex h-8 items-center gap-2 rounded-md px-4 transition-all duration-200 hover:opacity-90',
        className,
      )}
    >
      <span>{leftText}</span>
      <Separator orientation="vertical" className="bg-white-100/30 h-4" />
      <span>{rightText}</span>
      {icon ?? <Icon iconName="plus" size="xxs" />}
    </Link>
  )
}

export { NavigationBottom }
