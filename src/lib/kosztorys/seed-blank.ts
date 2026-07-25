import 'server-only'
import type { Payload } from 'payload'
import {
  DEFAULT_ITEM_DESCRIPTION,
  DEFAULT_UNIT,
  NEW_SECTION_DEFAULTS,
} from '@/lib/kosztorys/constants'

// The editor opens on a typable row instead of an empty grid (EX-463). No etap — its plane is forced
// at creation (addStageAction) and a seeded one could only guess: a guessed plane reads as confirmed
// while nobody chose it, an unconfirmed (null) one drops out of both subcontractor views. Field
// shapes mirror addSectionAction / addItemAction — a fresh investment has no sections/items, so
// displayOrder is always 0. The caller owns the non-fatal try/catch and revalidation (the investment
// isn't cached yet, so no tag here).
export async function seedBlankKosztorys(
  payload: Payload,
  investmentId: number,
  name: string = NEW_SECTION_DEFAULTS.name,
): Promise<void> {
  const section = await payload.create({
    collection: 'kosztorys-sections',
    data: {
      investment: investmentId,
      name,
      displayOrder: 0,
      defaultCostVariant: NEW_SECTION_DEFAULTS.defaultCostVariant,
    },
  })
  await payload.create({
    collection: 'kosztorys-items',
    data: {
      investment: investmentId,
      section: section.id,
      displayOrder: 0,
      description: DEFAULT_ITEM_DESCRIPTION,
      unit: DEFAULT_UNIT,
      plannedQty: 0,
      discountValue: 0,
      clientPrice: 0,
      hiddenInExport: false,
    },
  })
}
