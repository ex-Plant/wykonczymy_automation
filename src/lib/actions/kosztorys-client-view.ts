'use server'

import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/column-config'
import type { ClientViewSettingsT } from '@/lib/queries/kosztorys-client-view'
import type { ActionResultT } from '@/types/action'

// Same narrowing as the share actions, for the same reason: this decides what a client is served.
const FORBIDDEN = 'Tylko właściciel może zmieniać ustawienia podglądu klienta'

// The ceiling is enforced on write as well as on read, so a stored row never carries a key that
// would start meaning something if the allowlist later grew.
function sanitize(settings: ClientViewSettingsT): ClientViewSettingsT {
  return {
    hiddenColumns: settings.hiddenColumns.filter((key) => PREVIEW_VISIBLE_COLUMNS.has(key)),
    hideEmptyRows: settings.hideEmptyRows,
  }
}

export async function saveClientViewSettingsAction(
  investmentId: number,
  settings: ClientViewSettingsT,
): Promise<ActionResultT> {
  return ownerOnlyAction('saveClientViewSettingsAction', FORBIDDEN, async ({ payload }) => {
    const data = sanitize(settings)
    const existing = await payload.find({
      collection: 'kosztorys-client-view',
      where: { investment: { equals: investmentId } },
      depth: 0,
      limit: 1,
    })
    const row = existing.docs[0]

    if (row) {
      await payload.update({ collection: 'kosztorys-client-view', id: row.id, data })
      return { success: true }
    }

    try {
      await payload.create({
        collection: 'kosztorys-client-view',
        data: { ...data, investment: investmentId },
      })
    } catch {
      // find-then-create is not atomic and `investment` is unique — two saves at once race here.
      // The loser re-reads and updates rather than surfacing a raw constraint error.
      const raced = await payload.find({
        collection: 'kosztorys-client-view',
        where: { investment: { equals: investmentId } },
        depth: 0,
        limit: 1,
      })
      const rowAfterRace = raced.docs[0]
      if (!rowAfterRace) return { success: false, error: 'Nie udało się zapisać ustawień' }
      await payload.update({ collection: 'kosztorys-client-view', id: rowAfterRace.id, data })
    }
    return { success: true }
    // No revalidation: the settings are read outside the preview's cached payload, so the next
    // request already sees them.
  })
}

export async function saveClientViewDefaultsAction(
  settings: ClientViewSettingsT,
): Promise<ActionResultT> {
  return ownerOnlyAction('saveClientViewDefaultsAction', FORBIDDEN, async ({ payload }) => {
    await payload.updateGlobal({
      slug: 'kosztorys-client-view-defaults',
      data: sanitize(settings),
    })
    return { success: true }
  })
}
