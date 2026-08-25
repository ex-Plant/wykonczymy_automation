'use client'

import { useRef, useState } from 'react'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// A long-text cell nobody can edit — the client preview, or a locked row. The editing overlay is the
// only way to read past the truncation there, and it never opens, so the full value gets a popover
// instead. Click, not hover: the preview is read on a phone as often as on a desktop, and a hover
// tooltip has no touch equivalent.
export function ReadOnlyLongText({ value }: { value: string | null }) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)

  if (!value) return <ReadOnlyCellText>{''}</ReadOnlyCellText>

  return (
    <Popover
      open={open}
      // Measured on open, not on render: the column is resizable, so whether the value fits is a
      // fact about this moment. A value that fits has nothing to disclose — no popover.
      onOpenChange={(next) => setOpen(next && isTruncated(textRef.current))}
    >
      <PopoverTrigger asChild>
        <span className="block w-full min-w-0">
          <ReadOnlyCellText ref={textRef} className="cursor-pointer">
            {value}
          </ReadOnlyCellText>
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        // w-80, not wider: 320px still clears the narrowest phone, and the preview is read on one.
        className="max-h-64 w-80 overflow-auto p-3 text-sm whitespace-pre-wrap"
      >
        {value}
      </PopoverContent>
    </Popover>
  )
}

function isTruncated(node: HTMLSpanElement | null): boolean {
  return node != null && node.scrollWidth > node.clientWidth
}
