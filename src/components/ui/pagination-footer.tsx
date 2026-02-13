'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { UrlPagination } from './url-pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'
import type { PaginationMetaT } from '@/lib/transactions/types'

const LIMIT_OPTIONS = [20, 50, 100] as const

type PaginationFooterPropsT = {
  readonly paginationMeta: PaginationMetaT
  readonly baseUrl: string
}

export function PaginationFooter({ paginationMeta, baseUrl }: PaginationFooterPropsT) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const buildUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(overrides)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    const qs = params.toString()
    return `${baseUrl}${qs ? `?${qs}` : ''}`
  }

  const handleLimitChange = (value: string) => {
    router.push(buildUrl({ limit: value, page: '' }))
  }

  if (paginationMeta.totalPages <= 1 && paginationMeta.totalDocs === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <p className="text-muted-foreground text-sm">
          {paginationMeta.totalDocs} wyników
        </p>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Pokaż</span>
          <Select
            value={String(paginationMeta.limit)}
            onValueChange={handleLimitChange}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {paginationMeta.totalPages > 1 && (
        <UrlPagination
          currentPage={paginationMeta.currentPage}
          totalPages={paginationMeta.totalPages}
          baseUrl={baseUrl}
        />
      )}
    </div>
  )
}
