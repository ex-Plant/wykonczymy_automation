'use server'

import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import {
  sanitizeClientViewConfig,
  type ClientViewConfigT,
  type ClientViewModeT,
} from '@/lib/kosztorys/client-view-settings'
import { findClientViewRow } from '@/lib/queries/kosztorys-client-view'
import type { ActionResultT } from '@/types/action'

// Same narrowing as the share actions, for the same reason: this decides what a client is served.
const FORBIDDEN = 'Tylko właściciel może zmieniać ustawienia podglądu inwestora'

export async function saveClientViewSettingsAction(
  investmentId: number,
  config: ClientViewConfigT,
): Promise<ActionResultT> {
  return ownerOnlyAction('saveClientViewSettingsAction', FORBIDDEN, async ({ payload }) => {
    const data = sanitizeClientViewConfig(config)
    const row = await findClientViewRow(payload, investmentId)

    if (row) {
      await payload.update({ collection: 'kosztorys-client-view', id: row.id, data })
      return { success: true }
    }

    try {
      await payload.create({
        collection: 'kosztorys-client-view',
        data: { ...data, investment: investmentId },
      })
    } catch (error) {
      // find-then-create is not atomic and `investment` is unique — two saves at once race here.
      // The loser re-reads and updates rather than surfacing a raw constraint error. Logged because
      // a validation or FK failure lands here too and is indistinguishable from the race otherwise.
      // TODO(EX-449) SENTRY-REQUIRED:
      console.error('saveClientViewSettingsAction: create failed, retrying as update', error)
      const rowAfterRace = await findClientViewRow(payload, investmentId)
      if (!rowAfterRace) return { success: false, error: 'Nie udało się zapisać ustawień' }
      await payload.update({ collection: 'kosztorys-client-view', id: rowAfterRace.id, data })
    }
    // No revalidation: the settings are read outside the preview's cached payload, so the next
    // request already sees them.
    return { success: true }
  })
}

// Read-modify-write, one variant at a time: „Zapisz jako domyślne" on the offer must not wipe the
// firm-wide settlement default, which the owner is not even looking at when they press it.
export async function saveClientViewDefaultsAction(
  config: ClientViewConfigT,
  mode: ClientViewModeT,
): Promise<ActionResultT> {
  return ownerOnlyAction('saveClientViewDefaultsAction', FORBIDDEN, async ({ payload }) => {
    const current = sanitizeClientViewConfig(
      await payload.findGlobal({ slug: 'kosztorys-client-view-defaults', depth: 0 }),
    )

    await payload.updateGlobal({
      slug: 'kosztorys-client-view-defaults',
      data: sanitizeClientViewConfig({
        mode,
        variants: { ...current.variants, [mode]: config.variants[mode] },
      }),
    })
    return { success: true }
  })
}
