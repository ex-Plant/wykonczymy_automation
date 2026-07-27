import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateTag = vi.hoisted(() => vi.fn())
const revalidateTag = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ updateTag, revalidateTag }))

const { revalidateCollections } = await import('@/lib/cache/revalidate')
const { CACHE_TAGS } = await import('@/lib/cache/tags')

// `deferRefresh` exists to drop the route re-render on per-cell autosaves (EX-597), NOT to skip
// invalidation. The distinction is invisible on the editor itself — it holds `rows` in local state
// either way — and only shows up on the OTHER routes that read these tags, chiefly the client share
// link. So the invariant worth pinning is that both branches expire every tag they are given; a
// "simplification" that turned the deferred branch into a no-op would leave shared kosztorys links
// serving stale figures indefinitely, with nothing in the editor to reveal it.
describe('revalidateCollections', () => {
  beforeEach(() => {
    updateTag.mockReset()
    revalidateTag.mockReset()
  })

  it('re-renders the calling route by default', () => {
    revalidateCollections(['investments', 'kosztorysItems'])

    expect(updateTag.mock.calls.map(([tag]) => tag)).toEqual([
      CACHE_TAGS['investments'],
      CACHE_TAGS['kosztorysItems'],
    ])
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('expires without re-rendering when deferRefresh is set', () => {
    revalidateCollections(['investments', 'kosztorysItems'], { deferRefresh: true })

    // The 'default' profile is what makes this expire-only; without it the call is not equivalent.
    expect(revalidateTag.mock.calls).toEqual([
      [CACHE_TAGS['investments'], 'default'],
      [CACHE_TAGS['kosztorysItems'], 'default'],
    ])
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('invalidates every tag on both branches — deferring the refresh never skips a tag', () => {
    const slugs = ['investments', 'kosztorysItems', 'stageProgress'] as const

    revalidateCollections([...slugs])
    const immediate = updateTag.mock.calls.map(([tag]) => tag)

    revalidateCollections([...slugs], { deferRefresh: true })
    const deferred = revalidateTag.mock.calls.map(([tag]) => tag)

    expect(deferred).toEqual(immediate)
    expect(deferred).toHaveLength(slugs.length)
  })
})
