export function getVisiblePages(
  currentPage: number,
  totalPages: number,
  maxVisiblePages: number,
): (number | 'ellipsis')[] {
  if (maxVisiblePages < 5) throw new Error('maxVisiblePages must be at least 4')

  const dynamicPagesNumber = maxVisiblePages - 2

  console.log('totalPages', totalPages)
  console.log('maxVisiblePages', maxVisiblePages)
  console.log('currentPage', currentPage)

  if (totalPages <= maxVisiblePages) {
    console.log('totalPages <= maxVisiblePages')
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis')[] = []

  const lowerEnd = Math.floor(dynamicPagesNumber / 2)
  const upperEnd = dynamicPagesNumber - lowerEnd

  console.log('lowerEnd', lowerEnd)
  console.log('upperEnd', upperEnd)

  // start from 2 or the current page minus the half of the dynamic pages number
  let start = Math.max(2, currentPage - lowerEnd)

  if (currentPage > totalPages - lowerEnd) {
    console.log('currentPage > totalPages - halfVisible')
    start = totalPages - dynamicPagesNumber
  }

  console.log('start', start)

  const end = Math.min(start + upperEnd, totalPages)

  console.log('end', end)

  for (let i = start; i <= end; i++) {
    if (i === totalPages) break
    pages.push(i)
  }

  // Always show page 1 and last page
  pages.unshift(1)
  pages.push(totalPages)

  return pages
}
