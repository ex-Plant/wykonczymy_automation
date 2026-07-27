'use client'

import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Separator } from '@/components/ui/separator'

type CollapsibleSectionSizeT = 'lg' | 'sm'

type CollapsibleSectionPropsT = {
  title: string
  id?: string
  defaultOpen?: boolean
  // 'sm' for a control block inside a denser surface (the summary panel's top bar), where a page-level
  // heading would outshout the content it hides.
  size?: CollapsibleSectionSizeT
  className?: string
  children: React.ReactNode
}

const TITLE_STYLE: Record<CollapsibleSectionSizeT, string> = {
  lg: 'text-lg font-semibold',
  sm: 'text-sm font-medium',
}

const CHEVRON_SIZE: Record<CollapsibleSectionSizeT, string> = {
  lg: 'size-5',
  sm: 'size-4',
}

export function CollapsibleSection({
  title,
  id,
  defaultOpen = true,
  size = 'lg',
  className,
  children,
}: CollapsibleSectionPropsT) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible.Root id={id} open={isOpen} onOpenChange={setIsOpen} className={cn(className)}>
      <Collapsible.Trigger className="flex w-full cursor-pointer items-center gap-2 py-2 text-left">
        <h2 className={cn('text-foreground', TITLE_STYLE[size])}>{title}</h2>
        <ChevronDown
          className={cn(
            'text-muted-foreground transition-transform duration-200',
            CHEVRON_SIZE[size],
            isOpen && 'rotate-180',
          )}
        />
      </Collapsible.Trigger>
      {isOpen && <Separator orientation="horizontal" />}
      <Collapsible.Content className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
