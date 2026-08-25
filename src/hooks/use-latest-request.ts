import { useState } from 'react'
import { createLatestRequest } from '@/lib/utils/latest-request'

/**
 * One `createLatestRequest` per component, kept for its lifetime. `useState` with a lazy initializer
 * rather than `useRef`: the counter is never a render input, and reading a ref during render is
 * impure — React may discard a render and re-run it.
 */
export function useLatestRequest() {
  const [request] = useState(createLatestRequest)
  return request
}
