'use server'

import type { Payload } from 'payload'
import { z } from 'zod'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import {
  findCatalogueItemByKey,
  getCatalogueSourceItem,
  listCatalogueItemsByIds,
} from '@/lib/db/work-catalogue'
import { toCatalogueCandidate } from '@/lib/kosztorys/work-catalogue/item-to-catalogue'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  appendCatalogueItems,
  type AppendedCatalogueSliceT,
} from '@/lib/kosztorys/work-catalogue/append-catalogue-items'
import { getWorkCatalogue } from '@/lib/queries/work-catalogue'
import type {
  CatalogueSavePreviewT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import type { ActionResultT } from '@/types/action'
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

// The cennik for the editor's picker — fetch-on-open, same cached read the /katalog-prac screen uses
// server-side, so both share one cache entry.
export async function listWorkCatalogueAction(): Promise<ActionResultT<WorkCatalogueItemT[]>> {
  return protectedAction('listWorkCatalogueAction', async () => {
    const data = await getWorkCatalogue()
    return { success: true, data }
  })
}

const insertCatalogueItemsSchema = z.object({
  sectionId: z.number().int().positive(),
  catalogueItemIds: z.array(z.number().int().positive()).min(1, 'Wybierz co najmniej jedną pracę'),
})

// „Dodaj → Praca z katalogu…". The client sends ONLY ids: every number that lands in the rozpiska is
// re-read from the cennik server-side, so a tampered payload cannot price a praca.
export async function insertCatalogueItemsAction(
  sectionId: number,
  catalogueItemIds: number[],
): Promise<ActionResultT<AppendedCatalogueSliceT>> {
  return protectedAction(
    'insertCatalogueItemsAction',
    async ({ payload }) => {
      const parsed = validateAction(insertCatalogueItemsSchema, { sectionId, catalogueItemIds })
      if (!parsed.success) return parsed

      const db = await getDb(payload)
      const items = await listCatalogueItemsByIds(db, parsed.data.catalogueItemIds)
      if (items.length !== parsed.data.catalogueItemIds.length)
        return { success: false, error: 'Część wybranych prac nie istnieje już w katalogu.' }

      const created = await withPayloadTransaction(
        payload,
        (req) => appendCatalogueItems(payload, req, parsed.data.sectionId, items),
        { skipRevalidation: true },
      )
      if (!created) return { success: false, error: 'Nie znaleziono sekcji' }

      return { success: true, data: created }
    },
    ['kosztorysItems'],
  )
}

const EMPTY_DESCRIPTION_ERROR = 'Praca bez opisu nie trafi do katalogu — najpierw ją nazwij.'
const MISSING_ITEM_ERROR = 'Nie znaleziono pozycji'

// Both „Zapisz do katalogu…" paths start here: the numbers are derived from the pozycja in the DB,
// never from the wire, so the dialog's preview and the save can never disagree about what is saved.
async function catalogueSaveState(payload: Payload, itemId: number) {
  const db = await getDb(payload)
  const source = await getCatalogueSourceItem(db, itemId)
  if (!source) return undefined

  const candidate = toCatalogueCandidate(source)
  const existing = await findCatalogueItemByKey(db, candidate.matchKey)
  return { candidate, existing: existing ?? null }
}

// Fetch-on-open for the dialog: what would be written, and what is already there under that klucz.
export async function catalogueSavePreviewAction(
  itemId: number,
): Promise<ActionResultT<CatalogueSavePreviewT>> {
  return protectedAction('catalogueSavePreviewAction', async ({ payload }) => {
    const state = await catalogueSaveState(payload, itemId)
    if (!state) return { success: false, error: MISSING_ITEM_ERROR }
    if (!state.candidate.description) return { success: false, error: EMPTY_DESCRIPTION_ERROR }

    return { success: true, data: state }
  })
}

const saveItemToCatalogueSchema = z.object({
  itemId: z.number().int().positive(),
  mode: z.enum(['new', 'overwrite']),
})

// The way back from a rozpiska into the cennik. `'overwrite'` updates the row holding the klucz in
// place — same id, same `created_at` — because the katalog entry is the same praca, re-priced.
export async function saveItemToCatalogueAction(itemId: number, mode: 'new' | 'overwrite') {
  return protectedAction(
    'saveItemToCatalogueAction',
    async ({ payload }) => {
      const parsed = validateAction(saveItemToCatalogueSchema, { itemId, mode })
      if (!parsed.success) return parsed

      const state = await catalogueSaveState(payload, parsed.data.itemId)
      if (!state) return { success: false, error: MISSING_ITEM_ERROR }

      const { candidate, existing } = state
      if (!candidate.description) return { success: false, error: EMPTY_DESCRIPTION_ERROR }

      if (parsed.data.mode === 'overwrite') {
        // The row may have been deleted between opening the dialog and confirming — then the
        // overwrite IS a create, and refusing it would be pedantry about a race nobody caused.
        if (!existing) {
          await payload.create({ collection: 'work-catalogue-items', data: candidate })
          return { success: true }
        }
        await payload.update({
          collection: 'work-catalogue-items',
          id: existing.id,
          data: candidate,
        })
        return { success: true }
      }

      if (existing) return { success: false, error: DUPLICATE_ERROR }

      await payload.create({ collection: 'work-catalogue-items', data: candidate })

      return { success: true }
    },
    ['workCatalogue'],
  )
}
