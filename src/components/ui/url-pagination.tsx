'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from './pagination/pagination'
import { cn } from '@/lib/cn'

type UrlPaginationPropsT = {
  currentPage: number
  totalPages: number
  baseUrl: string
  onNavigate?: (href: string) => void
  className?: string
  maxVisiblePages?: number
}

export function UrlPagination({
  currentPage,
  totalPages,
  baseUrl,
  onNavigate,
  className,
}: UrlPaginationPropsT) {
  const searchParams = useSearchParams()
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page > 1) {
      params.set('page', String(page))
    } else {
      params.delete('page')
    }
    const qs = params.toString()
    return `${baseUrl}${qs ? `?${qs}` : ''}`
  }

  const handleClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault()
    onNavigate?.(href)
  }

  return (
    <Pagination className={className} aria-label="Nawigacja po stronach">
      <PaginationContent>
        {pages.map((page) => {
          const href = buildPageUrl(page)
          return (
            <PaginationItem key={page}>
              <Link
                className={cn(page === currentPage && 'pointer-events-none')}
                href={href}
                scroll={false}
                onClick={(e) => handleClick(e, href)}
              >
                <PaginationLink
                  isActive={page === currentPage}
                  aria-label={`Przejdź do strony ${page}`}
                >
                  {page}
                </PaginationLink>
              </Link>
            </PaginationItem>
          )
        })}
      </PaginationContent>
    </Pagination>
  )
}
