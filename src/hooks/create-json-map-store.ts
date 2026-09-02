'use client'

import { useMemo, useSyncExternalStore } from 'react'

// Shared localStorage-backed JSON-map store for the kosztorys column hooks (useColumnWidths,
// useHiddenColumns). Each was a hand-rolled copy of the same useSyncExternalStore + Set<listeners> +
// read/write/notify scaffolding; this is the one primitive they delegate to. usePersistedEnum is its
// scalar sibling.
//
// Own subscription (not a `storage` event, which doesn't fire in the same tab). getSnapshot returns
// the raw string so server and first client render agree on the empty snapshot → no hydration
// mismatch, and useSyncExternalStore's string equality skips redundant re-renders. Writes are
// updater-based: the updater re-reads the persisted map at write time, so two writes in one tick
// can't clobber each other through a stale render closure.

export const EMPTY_MAP_SNAPSHOT = '{}'

// Reject anything that isn't a plain object. JSON.parse('null') is null, and arrays/primitives parse
// fine too — any of them would make a later `map[id]` read throw and permanently white-screen the
// grid (nothing clears the key). A corrupt value throws and lands here as well. All degrade to an
// empty map, which is also the sparse-map default.
export function parseJsonMap<V>(json: string): Record<string, V> {
  try {
    const parsed: unknown = JSON.parse(json)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, V>
    }
  } catch {
    // corrupt localStorage value — fall through to the empty map
  }
  return {}
}

// The map without `keys`, or the SAME reference when none were present — identity is how update()
// tells "nothing to drop" from "dropped", so it skips a pointless write, and an unchanged map keeps
// the memoization of whatever the caller derives from it.
export function dropKeys<V>(map: Record<string, V>, keys: string[]): Record<string, V> {
  if (!keys.some((key) => key in map)) return map
  const next = { ...map }
  for (const key of keys) delete next[key]
  return next
}

export type JsonMapStoreT<V> = {
  subscribe: (callback: () => void) => () => void
  getSnapshot: () => string
  update: (updater: (prev: Record<string, V>) => Record<string, V>) => void
  // The two writes every domain hook on top of this needs, so none of them has to re-derive the
  // spread or remember that dropping goes through `dropKeys` to keep the skip-if-unchanged identity.
  // They are also stable references, which is what lets a hook hand them straight to a memoized
  // column without a per-render closure.
  set: (key: string, value: V) => void
  drop: (...keys: string[]) => void
}

export function createJsonMapStore<V>(storageKey: string): JsonMapStoreT<V> {
  const listeners = new Set<() => void>()

  function subscribe(callback: () => void) {
    listeners.add(callback)
    return () => {
      listeners.delete(callback)
    }
  }

  function getSnapshot(): string {
    try {
      return window.localStorage.getItem(storageKey) ?? EMPTY_MAP_SNAPSHOT
    } catch {
      return EMPTY_MAP_SNAPSHOT
    }
  }

  // Re-reads the persisted map before applying `updater`, so a write never rebuilds from a stale
  // render closure. An updater that returns its input unchanged (identity) skips persist + notify.
  function update(updater: (prev: Record<string, V>) => Record<string, V>) {
    const prev = parseJsonMap<V>(getSnapshot())
    const next = updater(prev)
    if (next === prev) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // no localStorage (SSR/private mode) — persistence skipped, state lives in subscribers' memory
    }
    for (const listener of listeners) listener()
  }

  return {
    subscribe,
    getSnapshot,
    update,
    set: (key, value) => update((prev) => ({ ...prev, [key]: value })),
    drop: (...keys) => update((prev) => dropKeys(prev, keys)),
  }
}

// The parsed map, re-derived only when the persisted string changes. Domain hooks layer their own
// reader/writer API (isHidden/toggleColumn, setWidth/dropWidth) on top of this.
export function useJsonMap<V>(store: JsonMapStoreT<V>): Record<string, V> {
  const json = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_MAP_SNAPSHOT)
  return useMemo(() => parseJsonMap<V>(json), [json])
}
