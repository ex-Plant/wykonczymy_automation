'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/hooks/use-translation'
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
  const { t } = useTranslation('pagination')
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  const handleClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault()
    onNavigate?.(href)
  }

  return (
    <Pagination className={className} aria-label={t('pagination')}>
      <PaginationContent>
        {pages.map((page) => (
          <PaginationItem key={page}>
            <Link
              className={cn(page === currentPage && 'pointer-events-none')}
              href={`${baseUrl}?page=${page}`}
              scroll={false}
              onClick={(e) => handleClick(e, `${baseUrl}?page=${page}`)}
            >
              <PaginationLink isActive={page === currentPage} aria-label={`${t('page')} ${page}`}>
                {page}
              </PaginationLink>
            </Link>
          </PaginationItem>
        ))}
      </PaginationContent>
    </Pagination>
  )
}
