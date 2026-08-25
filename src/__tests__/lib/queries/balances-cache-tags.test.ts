import { describe, it, expect } from 'vitest'
import { CACHE_TAGS, KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { KOSZTORYS_CLIENT_TOTALS_TAGS } from '@/lib/queries/balances'

// Nothing else asserts that the listing's kosztorys read subscribes to the writes that change it.
// The failure this guards is silent by construction: a reader missing a tag serves a stale figure and
// every test still passes, because the number it returns is a correct number — just an old one.

describe('kosztorys client-totals cache tags', () => {
  it('subscribes to exactly the collections the figures are built from', () => {
    // Hand-authored on purpose. Derived from the source it guards, this assertion would agree with any
    // future edit, including one that drops a tag.
    expect([...KOSZTORYS_CLIENT_TOTALS_TAGS].sort()).toEqual(
      [
        'collection:investments',
        'collection:kosztorys-items',
        'collection:kosztorys-sections',
        'collection:kosztorys-stages',
        'collection:stage-progress',
      ].sort(),
    )
  })

  it('covers every tag a whole-tree replacement invalidates', () => {
    // Snapshot restore, sheet import and preset reload all bump KOSZTORYS_TREE_TAGS. A tag added there
    // and not here means one of those three paths rewrites the kosztorys while the listing keeps
    // serving the pre-restore robocizna.
    for (const key of KOSZTORYS_TREE_TAGS) {
      expect(KOSZTORYS_CLIENT_TOTALS_TAGS).toContain(CACHE_TAGS[key])
    }
  })
})
