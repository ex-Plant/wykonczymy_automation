const DEFAULT_VISIBLE = 5

export function getWindowedPages(
  currentPage: number,
  totalPages: number,
  visibleCount = DEFAULT_VISIBLE,
): number[] {
  if (totalPages <= visibleCount) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const half = Math.floor(visibleCount / 2)
  let start = Math.max(1, currentPage - half)
  const end = Math.min(totalPages, start + visibleCount - 1)

  if (end - start + 1 < visibleCount) {
    start = Math.max(1, end - visibleCount + 1)
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}
