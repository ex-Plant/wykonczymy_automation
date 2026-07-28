import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { DEFAULT_SECTION_NAME } from '@/lib/kosztorys/constants'
import { createBlankItem, type NewRowT } from '@/lib/kosztorys/create-item'

export type CreatedSectionWithItemT = { section: NewRowT; item: NewRowT }

// A section is never created alone: a 0-item section renders as 0 rows, so it would land invisible.
// Every path that mints one — append and insert-at — creates the pair, so the pair is one call.
// Passing `req` runs both creates on the caller's transaction, so
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
    req,
  }: { investmentId: number; displayOrder: number; req?: PayloadRequest },
): Promise<CreatedSectionWithItemT> {
  const section = await payload.create({
    collection: 'kosztorys-sections',
    req,
    data: {
      investment: investmentId,
      name: DEFAULT_SECTION_NAME,
      displayOrder,
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
