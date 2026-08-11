'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

/** The width every toolbar search field shares — a layout value, so the caller passes it in. */
export const SEARCH_FILTER_TOOLBAR_WIDTH = 'w-40 lg:w-56'

type SearchFilterInputPropsT = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputMode?: 'text' | 'decimal' | 'numeric' | 'search'
  debounceMs?: number
}

export function SearchFilterInput({
  value,
  onChange,
  placeholder = 'Szukaj...',
  className,
  inputMode,
  debounceMs,
}: SearchFilterInputPropsT) {
  const [localValue, setLocalValue] = useState(value)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Sync external value → local state
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleChange(next: string) {
    if (!debounceMs) {
      onChange(next)
      return
    }

    setLocalValue(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChange(next)
    }, debounceMs)
  }

  const displayValue = debounceMs ? localValue : value

  return (
    <div className={cn('relative', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
      <Input
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-8 pl-8 text-sm"
      />
    </div>
  )
}
