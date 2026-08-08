import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { nextSectionDisplayOrder } from '@/lib/kosztorys/display-order'
import { insertItems, insertSections } from '@/lib/kosztorys/insert-rows'
import type { KosztorysItemT, KosztorysSectionT } from '@/lib/kosztorys/types'

// One section from a preset payload + its items, ready to append. `section`/`items` still carry the
// preset's OLD ids — this helper mints new ones and returns the remapped slice.
export type SectionSliceT = { section: KosztorysSectionT; items: KosztorysItemT[] }

// The created slice with NEW ids, in the nested shape getKosztorysTree yields (section + its items),
// so the client can build grid rows without a refetch.
export type AppendedSliceT = (KosztorysSectionT & { items: KosztorysItemT[] })[]

// Append the chosen sections + their items to a (possibly non-empty) kosztorys, after the last
// section. Deliberately NOT a fork of applyPreset (EX-438): sections+items only — a section append
// has no stages/progress/settings. THE CALLER OWNS THE TRANSACTION (`req` carries the transactionID);
// a throw anywhere rolls it all back. Shares the bulk insert + natural-key id remap with
// insertKosztorysTree via insertSections/insertItems, which return new ids in input order.
//
// displayOrder base = MAX(display_order)+1 read inside the same transaction, then base+i per section.
// Concurrent appends can read the same base (no lock on a MAX select, no UNIQUE) — accepted, same
// class as seed-from-preset's empty-guard race: a duplicate display_order only makes relative order
// ambiguous, nothing corrupts. That tolerance is why the id remap in insert-rows.ts degrades on a
// key tie instead of refusing the batch — this race is its source.
export async function appendPresetSections(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  slices: SectionSliceT[],
): Promise<AppendedSliceT> {
  if (slices.length === 0) return []
  const db = await getDb(payload, req)

  const base = await nextSectionDisplayOrder(db, investmentId)

  const newSectionIds = await insertSections(
    db,
    investmentId,
    slices.map(({ section }, i) => ({ displayOrder: base + i, section })),
  )

  // Items keep the preset's per-section display_order — the offset is a section concern only.
  const itemRows = slices.flatMap((slice, i) =>
    slice.items.map((item) => ({ sectionId: newSectionIds[i], item })),
  )
  const newItemIds = await insertItems(db, investmentId, itemRows)

  // The cursor is only valid because itemRows above was flattened in this same slice order.
  let cursor = 0
  return slices.map(({ section: s, items }, i) => ({
    id: newSectionIds[i],
    name: s.name,
    displayOrder: base + i,
    // A preset/snapshot written before the colour column has no `color` key at all.
    color: s.color ?? null,
    items: items.map((it) => ({ ...it, id: newItemIds[cursor++], sectionId: newSectionIds[i] })),
  }))
}
