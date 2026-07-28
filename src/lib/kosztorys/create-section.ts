import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { NEW_SECTION_DEFAULTS } from '@/lib/kosztorys/constants'
import { createBlankItem, type NewRowT } from '@/lib/kosztorys/create-item'

export type CreatedSectionWithItemT = { section: NewRowT; item: NewRowT }

// A section is never created alone: a 0-item section renders as 0 rows, so it would land invisible.
// Every path that mints one — append, insert-at, and the EX-463 new-investment auto-seed — creates
// the pair, so the pair is one call. Passing `req` runs both creates on the caller's transaction, so
// a section can't survive a failed first item.
//
// No etap is seeded — a stage's plane is forced at creation (addStageAction) and a guess would read
// as confirmed while nobody chose it, while an unconfirmed (null) one drops out of both
// subcontractor views.
export async function createSectionWithFirstItem(
  payload: Payload,
  {
    investmentId,
    displayOrder,
    name = NEW_SECTION_DEFAULTS.name,
    req,
  }: { investmentId: number; displayOrder: number; name?: string; req?: PayloadRequest },
): Promise<CreatedSectionWithItemT> {
  const section = await payload.create({
    collection: 'kosztorys-sections',
    req,
    data: {
      investment: investmentId,
      name,
      displayOrder,
      defaultCostVariant: NEW_SECTION_DEFAULTS.defaultCostVariant,
    },
  })
  const item = await createBlankItem(payload, {
    investmentId,
    sectionId: section.id,
    displayOrder: 0,
    req,
  })
  return { section: { id: section.id, displayOrder }, item }
}
