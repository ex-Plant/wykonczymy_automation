import { describe, expect, it } from 'vitest'
import { CLIENT_VIEW_GROUPS } from '@/components/kosztorys/editor/dialogs/client-view-groups'
import { COLUMN_LABELS, PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/column-config'

// The dialog offers exactly what a client may see — no more (a row for a column the allowlist bars
// would promise the owner a decision the render ignores) and no less (an ungrouped key is a column
// nobody can ever hide).
describe('the client-view column groups', () => {
  const grouped = CLIENT_VIEW_GROUPS.flatMap((group) => group.keys)

  it('covers every allowlisted column exactly once', () => {
    expect([...grouped].sort()).toEqual([...PREVIEW_VISIBLE_COLUMNS].sort())
  })

  it('names every row from the same source as the grid header', () => {
    for (const key of grouped) expect(COLUMN_LABELS[key]).toBeTypeOf('string')
  })
})
