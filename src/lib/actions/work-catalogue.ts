'use server'

import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  workCatalogueItemSchema,
  type WorkCatalogueItemDataT,
} from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { protectedAction, validateAction } from './run-action'

const DUPLICATE_ERROR = 'Praca o tej nazwie i jednostce już jest w katalogu.'

// Everything the collection stores, derived from the validated form data. `matchKey` is computed
// here and nowhere else — the UNIQUE index only means something if the value it guards is produced
// by the same folding every reader uses.
const toRow = (data: WorkCatalogueItemDataT) => ({
  description: data.description.trim(),
  category: data.category.trim() || null,
  unit: data.unit.trim(),
  clientPrice: data.clientPrice,
  wToolsRate: data.wToolsRate,
  ownToolsRate: data.ownToolsRate,
  matchKey: catalogueKey(data.description, data.unit),
})

export async function createCatalogueItemAction(data: WorkCatalogueItemDataT) {
  return protectedAction(
    'createCatalogueItemAction',
    async ({ payload }) => {
      const parsed = validateAction(workCatalogueItemSchema, data)
      if (!parsed.success) return parsed

      const row = toRow(parsed.data)

      // The unique index would refuse it anyway, but a Polish sentence beats a driver error —
      // and this is the ordinary path, not an edge case: the katalog exists to be typed into twice.
      const existing = await payload.find({
        collection: 'work-catalogue-items',
        where: { matchKey: { equals: row.matchKey } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) return { success: false, error: DUPLICATE_ERROR }

      await payload.create({ collection: 'work-catalogue-items', data: row })

      return { success: true }
    },
    ['workCatalogue'],
  )
}

export async function updateCatalogueItemAction(id: number, data: WorkCatalogueItemDataT) {
  return protectedAction(
    'updateCatalogueItemAction',
    async ({ payload }) => {
      const parsed = validateAction(workCatalogueItemSchema, data)
      if (!parsed.success) return parsed

      const row = toRow(parsed.data)

      // Editing the opis or j.m. re-derives the key, so an edit can collide exactly like a create.
      // The row being edited is excluded — otherwise saving it unchanged would collide with itself.
      const existing = await payload.find({
        collection: 'work-catalogue-items',
        where: { and: [{ matchKey: { equals: row.matchKey } }, { id: { not_equals: id } }] },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) return { success: false, error: DUPLICATE_ERROR }

      await payload.update({ collection: 'work-catalogue-items', id, data: row })

      return { success: true }
    },
    ['workCatalogue'],
  )
}

export async function deleteCatalogueItemAction(id: number) {
  return protectedAction(
    'deleteCatalogueItemAction',
    async ({ payload }) => {
      // Nothing references a katalog row — prace copy the numbers at insert time and freeze them —
      // so a delete can never orphan a kosztorys.
      await payload.delete({ collection: 'work-catalogue-items', id })

      return { success: true }
    },
    ['workCatalogue'],
  )
}
