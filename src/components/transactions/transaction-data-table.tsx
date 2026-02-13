'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { DataTable } from '@/components/ui/data-table'
import { UrlPagination } from '@/components/ui/url-pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getTransactionColumns } from '@/lib/transactions/columns'
import type { TransactionRowT, PaginationMetaT } from '@/lib/transactions/types'

const LIMIT_OPTIONS = [20, 50, 100] as const

type TransactionDataTablePropsT = {
  readonly data: readonly TransactionRowT[]
  readonly paginationMeta: PaginationMetaT
  readonly excludeColumns?: string[]
  readonly baseUrl: string
}

export function TransactionDataTable({
  data,
  paginationMeta,
  excludeColumns = [],
  baseUrl,
}: TransactionDataTablePropsT) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const columns = getTransactionColumns(excludeColumns)

  const buildUrl = useCallback(
    (overrides: Record<string, string>) => {
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
    },
    [searchParams, baseUrl],
  )

  const handleLimitChange = useCallback(
    (value: string) => {
      // Reset to page 1 when changing limit
      router.push(buildUrl({ limit: value, page: '' }))
    },
    [router, buildUrl],
  )

  return (
    <div className="space-y-4">
      <DataTable data={data} columns={columns} emptyMessage="Brak transakcji" />

      {/* Pagination footer */}
      {(paginationMeta.totalPages > 1 || paginationMeta.totalDocs > 0) && (
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
      )}
    </div>
  )
}
