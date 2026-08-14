'use client'

import { useMemo } from 'react'
import { createJsonMapStore, useJsonMap, type JsonMapStoreT } from '@/hooks/create-json-map-store'

// Which row conditions are filtering, persisted in localStorage. Sparse: a key is present only while
// its condition is active, so an absent key is „off" and the unfiltered kosztorys is the default.
//
// Per investment, like usePriceView and unlike the globally-keyed column hooks: a filter describes
// the state of one budowa, and carrying it to the next one would hide rows nobody chose to hide.
const STORAGE_KEY_PREFIX = 'kosztorys-filters:'

// createJsonMapStore binds its key at module scope, so a per-investment store has to be cached rather
// than built during render — a store built per render hands useSyncExternalStore a new `subscribe`
// every time and it resubscribes forever.
const storesByKey = new Map<string, JsonMapStoreT<boolean>>()

function storeFor(investmentId: number): JsonMapStoreT<boolean> {
  const key = `${STORAGE_KEY_PREFIX}${investmentId}`
  let store = storesByKey.get(key)
  if (!store) {
    store = createJsonMapStore<boolean>(key)
    storesByKey.set(key, store)
  }
  return store
}

export function useActiveConditions(investmentId: number): {
  activeIds: Set<string>
  toggle: (id: string) => void
  clear: () => void
} {
  const store = storeFor(investmentId)
  const active = useJsonMap<boolean>(store)

  // Ids nobody recognises are carried through untouched rather than pruned here: rowsMatchingConditions
  // already ignores them, and deleting one would drop a filter the user set under a condition that is
  // only temporarily gone.
  const activeIds = useMemo(() => new Set(Object.keys(active).filter((id) => active[id])), [active])

  function toggle(id: string) {
    store.update((prev) => {
      if (!prev[id]) return { ...prev, [id]: true }
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function clear() {
    store.update((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }

  return { activeIds, toggle, clear }
}
