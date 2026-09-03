import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import {
  loadEquipmentAtLocation,
  loadEquipmentHistory,
  loadEquipmentOverview,
} from '@/lib/db/equipment'
import { assertCompletePage } from '@/lib/queries/assert-complete-page'
import type { EquipmentDetailT, EquipmentRowT } from '@/lib/equipment/types'

export type WarehouseOptionT = { id: number; name: string }

export type EquipmentDatasetT = {
  equipment: EquipmentRowT[]
  warehouses: WarehouseOptionT[]
}

/**
 * Date-free on purpose: nothing in the dataset is classified against „today", so the entry survives
 * midnight. The warranty window is decided one layer up, from a date resolved per request — the
 * mistake the fleet's `-v4` key documents is putting a shape (or a date) into a cache nobody
 * invalidates for it.
 *
 * Warehouses ride along rather than getting their own cached read: they exist only as the second
 * half of the „gdzie jest" filter, and a separate entry would let the dropdown and the rows be
 * invalidated at different moments.
 */
const getEquipmentDataset = unstable_cache(
  async (): Promise<EquipmentDatasetT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })

    const [equipment, warehouses] = await Promise.all([
      loadEquipmentOverview(payload),
      payload.find({
        collection: 'warehouses',
        sort: 'name',
        limit: 500,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    console.log(`[PERF] query.getEquipmentDataset ${elapsed()}ms`)

    return {
      equipment,
      warehouses: assertCompletePage(warehouses, 'getEquipmentDataset.warehouses').map(
        ({ id, name }) => ({ id: Number(id), name }),
      ),
    }
  },
  // Bump the suffix whenever the row SHAPE widens: an entry written under the old shape is still
  // valid JSON, so the tags alone would keep serving it once per revalidation.
  ['equipment-dataset-v1'],
  { tags: [CACHE_TAGS.equipment, CACHE_TAGS.equipmentEvents, CACHE_TAGS.warehouses] },
)

export async function fetchEquipmentOverview(): Promise<EquipmentDatasetT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')

  return getEquipmentDataset()
}

/** One item with its whole log. The history is uncached — it is read on one page, on demand. */
export async function fetchEquipmentDetail(id: number): Promise<EquipmentDetailT | null> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')

  const { equipment } = await getEquipmentDataset()
  const item = equipment.find((candidate) => candidate.id === id)
  if (!item) return null

  const history = await loadEquipmentHistory(await getPayload({ config }), id)

  return { equipment: item, history }
}

/** „Na stanie" for one person or one warehouse. */
export async function fetchEquipmentAtLocation(target: {
  kind: 'holder' | 'warehouse'
  id: number
}): Promise<EquipmentRowT[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')

  return loadEquipmentAtLocation(await getPayload({ config }), target)
}
