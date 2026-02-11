import * as React from 'react'

import { cn } from '@/lib/cn'
import Icon from '../icons/icon'
import { getVisiblePages } from './get-visible-pages'

// --- Styling primitives (no navigation logic) ---

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn('mx-auto flex w-full flex-wrap justify-center', className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-row flex-wrap items-center gap-2', className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLabelsT = {
  previous?: string
  next?: string
  goToPreviousPage?: string
  goToNextPage?: string
  page?: string
  morePages?: string
  paginationLabel?: string
}

type PaginationLinkPropsT = {
  isActive?: boolean
  isDisabled?: boolean
  children?: React.ReactNode
  className?: string
  'aria-label'?: string
}

function PaginationLink({ className, isActive, isDisabled, ...props }: PaginationLinkPropsT) {
  return (
    <span
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={isDisabled}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        'fest-label-small inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-all duration-200 select-none',
        isActive && 'border-black-100 text-black-100 border',
        !isActive && !isDisabled && 'border-black-10 text-black-100 hover:bg-black-5 border',
        isDisabled && 'text-black-30 pointer-events-none cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}

type PaginationPreviousPropsT = PaginationLinkPropsT & { label?: string }

function PaginationPrevious({
  className,
  label = 'Go to previous page',
  ...props
}: PaginationPreviousPropsT) {
  return (
    <PaginationLink aria-label={label} className={cn('w-auto gap-1 px-3', className)} {...props}>
      <Icon iconName="arrowLeft" className="size-4" />
    </PaginationLink>
  )
}

type PaginationNextPropsT = PaginationLinkPropsT & { label?: string }

function PaginationNext({ className, label = 'Go to next page', ...props }: PaginationNextPropsT) {
  return (
    <PaginationLink aria-label={label} className={cn('w-auto gap-1 px-3', className)} {...props}>
      <Icon iconName="arrowRight" className="size-4" />
    </PaginationLink>
  )
}

type PaginationEllipsisPropsT = React.ComponentProps<'span'> & { srLabel?: string }

function PaginationEllipsis({
  className,
  srLabel = 'More pages',
  ...props
}: PaginationEllipsisPropsT) {
  return (
    <PaginationLink
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn('pointer-events-none w-auto gap-1 px-3', className)}
      {...props}
    >
      <Icon iconName="menuDots" className="size-4" />
      <span className="sr-only">{srLabel}</span>
    </PaginationLink>
  )
}

// --- Shared page calculation ---

// --- Client-side pagination (onClick, no URL changes) ---

type SimplePaginationPropsT = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  labels?: PaginationLabelsT
  className?: string
  maxVisiblePages?: number
}

function SimplePagination({
  currentPage,
  totalPages,
  onPageChange,
  labels,
  className,
  maxVisiblePages = 4,
}: SimplePaginationPropsT) {
  const visiblePages = getVisiblePages(currentPage, totalPages, maxVisiblePages)
  const isFirstPage = currentPage <= 1
  const isLastPage = currentPage >= totalPages

  return (
    <Pagination className={className} aria-label={labels?.paginationLabel}>
      <PaginationContent>
        <PaginationItem>
          <button
            type="button"
            disabled={isFirstPage}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <PaginationPrevious isDisabled={isFirstPage} label={labels?.goToPreviousPage} />
          </button>
        </PaginationItem>

        {visiblePages.map((page, index) =>
          page === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis srLabel={labels?.morePages} />
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <button type="button" onClick={() => onPageChange(page)}>
                <PaginationLink
                  isActive={page === currentPage}
                  aria-label={`${labels?.page ?? 'Page'} ${page}`}
                >
                  {page}
                </PaginationLink>
              </button>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <button type="button" disabled={isLastPage} onClick={() => onPageChange(currentPage + 1)}>
            <PaginationNext isDisabled={isLastPage} label={labels?.goToNextPage} />
          </button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

export type { PaginationLabelsT }
export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  getVisiblePages,
  SimplePagination,
}
