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

const SIZE: Record<CollapsibleSectionSizeT, { title: string; chevron: string }> = {
  lg: { title: 'text-lg font-semibold', chevron: 'size-5' },
  sm: { title: 'text-sm font-medium', chevron: 'size-4' },
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
        <h2 className={cn('text-foreground', SIZE[size].title)}>{title}</h2>
        <ChevronDown
          className={cn(
            'text-muted-foreground transition-transform duration-200',
            SIZE[size].chevron,
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
