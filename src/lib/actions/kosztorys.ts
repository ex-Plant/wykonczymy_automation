'use server'

import { z } from 'zod'
import { sql } from '@payloadcms/db-vercel-postgres'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import {
  createSectionWithFirstItem,
  type CreatedSectionWithItemT,
} from '@/lib/kosztorys/create-section'
import { createBlankItem, sectionOwnerAndNextItemOrder } from '@/lib/kosztorys/create-item'
import {
  nextSectionDisplayOrder,
  shiftDisplayOrderFrom,
  swapDisplayOrder,
  swapDisplayOrderSchema,
} from '@/lib/kosztorys/display-order'
import { applyPercentRabatSchema } from '@/lib/kosztorys/percent-rabat'
import { isSectionColorKey, type SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { SETTLEMENT_MODES, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { ActionResultT } from '@/types/action'
import type { ItemPatchT, StagePatchT, ToolPlaneT } from '@/lib/kosztorys/types'

// Derived from TOOL_PLANES rather than re-listing the union, so a plane added to the pickers can't
// be silently rejected by validation.
const stagePlaneSchema = z.enum(TOOL_PLANES)
const overrideTypeSchema = z.enum(['coeff', 'amount'])

const SECTION_MISSING = 'Sekcja nie istnieje.'

// --- Patch schemas (all fields optional — autosave sends one field at a time) ---
// itemPatchSchema is shaped to match ItemPatchT (a single source of the type in lib/kosztorys/types.ts).

const itemPatchSchema = z
  .object({
    description: z.string().nullable(),
    unit: z.string().nullable(),
    plannedQty: z.coerce.number(),
    discountType: z.enum(['percent', 'amount']).nullable(),
    discountValue: z.coerce.number(),
    clientPrice: z.coerce.number(),
    wToolsOverrideType: overrideTypeSchema.nullable(),
    wToolsOverrideValue: z.coerce.number(),
    ownToolsOverrideType: overrideTypeSchema.nullable(),
    ownToolsOverrideValue: z.coerce.number(),
    costVariant: stagePlaneSchema.nullable(),
    hiddenInExport: z.boolean(),
    note: z.string().nullable(),
  })
  .partial()

const sectionPatchSchema = z
  .object({
    name: z.string(),
    defaultCostVariant: stagePlaneSchema,
    displayOrder: z.coerce.number(),
    // null clears the pin (back to the pie's positional palette).
    color: z.custom<SectionColorKeyT>(isSectionColorKey).nullable(),
  })
  .partial()

// Investment markup coefficients (edited from the panel).
const investmentCoeffsSchema = z
  .object({
    wToolsCoeff: z.coerce.number(),
    ownToolsCoeff: z.coerce.number(),
  })
  .partial()

// Per-investment VAT rate, stored as a fraction (0.08 = 8%). Edited from the Sekcje panel.
// Fraction bounds: a per-investment VAT rate below 0% or above 100% is never valid, so reject it
// at the action regardless of UI guarding — a bad rate feeds every brutto figure (net × (1 + vatRate)).
const investmentVatSchema = z.object({ vatRate: z.coerce.number().min(0).max(1) })

// Derived from SETTLEMENT_MODES so a mode added to the picker can't be silently rejected here.
const investmentSettlementModeSchema = z.object({
  settlementMode: z.enum(SETTLEMENT_MODES),
})

// Materiały billed netto instead of brutto, as a fraction; null clears the concession. Same fraction
// bounds as the VAT rate and for the same reason — the rate feeds both marża and bilans.
const investmentMaterialsNetRateSchema = z.object({
  materialsNetRate: z.coerce.number().min(0).max(1).nullable(),
})

// Per-investment global discount over the whole kosztorys. type null = none (clears the discount).
// Amount-only: value is netto PLN; never negative. A percent rabat isn't stored here —
// applyPercentRabatToAllItemsAction stamps it into each per-item rabat instead.
const investmentGlobalDiscountSchema = z.object({
  globalDiscountType: z.enum(['amount']).nullable(),
  globalDiscountValue: z.coerce.number().min(0),
})

export type SectionPatchT = z.infer<typeof sectionPatchSchema>
export type InvestmentCoeffsPatchT = z.infer<typeof investmentCoeffsSchema>
export type InvestmentGlobalDiscountPatchT = z.infer<typeof investmentGlobalDiscountSchema>

// --- Field updates (autosave) ---

// The three per-cell autosaves below defer the refresh. The editor holds `rows` in useState seeded
// once at mount and derives every panel figure from it, so the route re-render `updateTag` triggers
// reseeds nothing the editor reads — the grid keeps its own state and the panel has already
// recomputed optimistically. The only cached reader of these tags is the client share link
// (lib/queries/preview-kosztorys.ts), a different route, and `revalidateTag` still expires it for its
// next request. Measured on preview: the discarded re-render cost 90-193ms per debounced save,
// dominated by the uncached kosztorys tree (EX-597).
export async function updateItemFieldAction(itemId: number, patch: ItemPatchT) {
  return protectedAction(
    'updateItemFieldAction',
    async ({ payload }) => {
      const parsed = validateAction(itemPatchSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'kosztorys-items', id: itemId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysItems'],
    { deferRefresh: true },
  )
}

export async function updateSectionFieldAction(sectionId: number, patch: SectionPatchT) {
  return protectedAction(
    'updateSectionFieldAction',
    async ({ payload }) => {
      const parsed = validateAction(sectionPatchSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'kosztorys-sections', id: sectionId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysSections'],
    { deferRefresh: true },
  )
}

export async function updateInvestmentCoeffsAction(
  investmentId: number,
  patch: InvestmentCoeffsPatchT,
) {
  return protectedAction(
    'updateInvestmentCoeffsAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentCoeffsSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'investments', id: investmentId, data: parsed.data })
      return { success: true }
    },
    // Coeffs re-derive item and section figures, so bump their collection tags. 'investments'
    // also invalidates the cached readers of the mutated source row (getInvestment,
    // fetchReferenceData) immediately, rather than waiting on the investments afterChange hook.
    ['kosztorysItems', 'kosztorysSections', 'investments'],
  )
}

export async function updateInvestmentVatAction(investmentId: number, vatRate: number) {
  return protectedAction(
    'updateInvestmentVatAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentVatSchema, { vatRate })
      if (!parsed.success) return parsed
      await payload.update({ collection: 'investments', id: investmentId, data: parsed.data })
      return { success: true }
    },
    // vatRate is denormalized onto items only (not sections, unlike coeffs). 'investments' also
    // invalidates the cached readers of the mutated source row (getInvestment, fetchReferenceData)
    // immediately, rather than waiting on the investments afterChange hook.
    ['kosztorysItems', 'investments'],
  )
}

export async function updateInvestmentSettlementModeAction(
  investmentId: number,
  settlementMode: SettlementModeT,
) {
  return protectedAction(
    'updateInvestmentSettlementModeAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentSettlementModeSchema, { settlementMode })
      if (!parsed.success) return parsed
      await payload.update({ collection: 'investments', id: investmentId, data: parsed.data })
      return { success: true }
    },
    // Unlike vatRate, the mode isn't denormalized onto items — every reader projects it from the
    // tree, so invalidating the investment row is enough.
    ['investments'],
  )
}

export async function updateInvestmentMaterialsNetRateAction(
  investmentId: number,
  materialsNetRate: number | null,
) {
  return protectedAction(
    'updateInvestmentMaterialsNetRateAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentMaterialsNetRateSchema, { materialsNetRate })
      if (!parsed.success) return parsed
      await payload.update({ collection: 'investments', id: investmentId, data: parsed.data })
      return { success: true }
    },
    // Like the settlement mode, the rate isn't denormalized onto items — it only ever reaches the
    // financial aggregates, which read the investment row.
    ['investments'],
  )
}

export async function updateInvestmentGlobalDiscountAction(
  investmentId: number,
  patch: InvestmentGlobalDiscountPatchT,
) {
  return protectedAction(
    'updateInvestmentGlobalDiscountAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentGlobalDiscountSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'investments', id: investmentId, data: parsed.data })
      return { success: true }
    },
    // The active flag is denormalized onto items only (getKosztorysTree → globalDiscountActive),
    // like vatRate. 'investments' also invalidates the cached readers of the mutated source row
    // (getInvestment, fetchReferenceData) immediately, rather than waiting on the afterChange hook.
    ['kosztorysItems', 'investments'],
  )
}

// Percent rabat bulk-apply: stamps `percent X` on EVERY item of the investment's kosztorys in one
// SQL statement. A kosztorys can hold 1000+ items, so N Payload updates would be O(n) round-trips —
// raw SQL via the src/lib/db client, like the other financial bulk writes. One-shot tool, not stored
// state: the percent lands in per-item rabaty and nothing persists the percent itself.
export async function applyPercentRabatToAllItemsAction(
  investmentId: number,
  percent: number,
): Promise<ActionResultT> {
  return protectedAction(
    'applyPercentRabatToAllItemsAction',
    async ({ payload, user }) => {
      const parsed = validateAction(applyPercentRabatSchema, { percent })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      // The overwrite is irrecoverable by in-session undo (owner: recovery = re-typing), and it
      // flattens whatever per-item rabaty were there — hand-tuned amounts included. Snapshot the exact
      // current state first, every time, exactly like removeSectionAction's destructive-write guard.
      await captureAutoSnapshot(db, investmentId, user.id)
      await db.execute(sql`
        UPDATE kosztorys_items
        SET discount_type = 'percent', discount_value = ${parsed.data.percent}, updated_at = now()
        WHERE investment_id = ${investmentId}
      `)
      return { success: true }
    },
    ['kosztorysItems'],
  )
}

// --- Structure: sections / items ---

// Appends a section at the end, WITH its first blank item — see createSectionWithFirstItem for why
// the pair is one call (and one round trip for the client) rather than two actions.
export async function addSectionAction(
  investmentId: number,
): Promise<ActionResultT<CreatedSectionWithItemT>> {
  return protectedAction(
    'addSectionAction',
    async ({ payload }) => {
      const db = await getDb(payload)
      const displayOrder = await nextSectionDisplayOrder(db, investmentId)
      const created = await withPayloadTransaction(
        payload,
        (req) => createSectionWithFirstItem(payload, { investmentId, displayOrder, req }),
        { skipRevalidation: true },
      )
      return { success: true, data: created }
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}

export async function removeSectionAction(sectionId: number) {
  return protectedAction(
    'removeSectionAction',
    async ({ payload, user }) => {
      const db = await getDb(payload)
      // Deleting a populated section is allowed (EX-477) — the UI gates it behind a confirm. A
      // section delete FK-cascades through its items into stage_progress, irrecoverable by in-session
      // undo (S-07), so capture the exact current state as a snapshot first, every time.
      const res = await db.execute(sql`
        SELECT investment_id FROM kosztorys_sections WHERE id = ${sectionId}
      `)
      const investmentId = res.rows[0]?.investment_id
      if (investmentId != null) await captureAutoSnapshot(db, Number(investmentId), user.id)
      await payload.delete({ collection: 'kosztorys-sections', id: sectionId })
      return { success: true }
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}

const insertSectionSchema = z.object({
  investmentId: z.number(),
  atDisplayOrder: z.coerce.number().int().min(0),
})

// Section-level twin of insertItemAction (⋯ → Wstaw sekcję powyżej/poniżej): opens the slot, then
// creates the section and its first item there — all three inside one transaction.
export async function insertSectionAction(
  investmentId: number,
  atDisplayOrder: number,
): Promise<ActionResultT<CreatedSectionWithItemT>> {
  return protectedAction(
    'insertSectionAction',
    async ({ payload }) => {
      const parsed = validateAction(insertSectionSchema, { investmentId, atDisplayOrder })
      if (!parsed.success) return parsed
      const at = parsed.data.atDisplayOrder
      const created = await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          await shiftDisplayOrderFrom(txDb, 'kosztorys-sections', parsed.data.investmentId, at)
          return createSectionWithFirstItem(payload, {
            investmentId: parsed.data.investmentId,
            displayOrder: at,
            req,
          })
        },
        { skipRevalidation: true },
      )
      return { success: true, data: created }
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}

// ⋯ → Przesuń sekcję w górę/dół.
export async function swapSectionOrderAction(
  first: { id: number; displayOrder: number },
  second: { id: number; displayOrder: number },
): Promise<ActionResultT> {
  return protectedAction(
    'swapSectionOrderAction',
    async ({ payload }) => {
      const parsed = validateAction(swapDisplayOrderSchema, { first, second })
      if (!parsed.success) return parsed
      await swapDisplayOrder(payload, 'kosztorys-sections', parsed.data.first, parsed.data.second)
      return { success: true }
    },
    ['kosztorysSections'],
  )
}

export async function addItemAction(
  sectionId: number,
): Promise<ActionResultT<{ id: number; displayOrder: number }>> {
  return protectedAction(
    'addItemAction',
    async ({ payload }) => {
      const db = await getDb(payload)
      const owner = await sectionOwnerAndNextItemOrder(db, sectionId)
      if (!owner) return { success: false, error: SECTION_MISSING }
      const created = await createBlankItem(payload, {
        investmentId: owner.investmentId,
        sectionId,
        displayOrder: owner.nextDisplayOrder,
      })
      return { success: true, data: created }
    },
    ['kosztorysItems'],
  )
}

const insertItemSchema = z.object({
  sectionId: z.number(),
  atDisplayOrder: z.coerce.number().int().min(0),
})

// Insert a blank item at a specific display_order within a section (right-click → Wstaw pozycję
// powyżej/poniżej).
export async function insertItemAction(
  sectionId: number,
  atDisplayOrder: number,
): Promise<ActionResultT<{ id: number; displayOrder: number }>> {
  return protectedAction(
    'insertItemAction',
    async ({ payload }) => {
      const parsed = validateAction(insertItemSchema, { sectionId, atDisplayOrder })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      const owner = await sectionOwnerAndNextItemOrder(db, parsed.data.sectionId)
      if (!owner) return { success: false, error: SECTION_MISSING }
      const created = await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          await shiftDisplayOrderFrom(
            txDb,
            'kosztorys-items',
            parsed.data.sectionId,
            parsed.data.atDisplayOrder,
          )
          return createBlankItem(payload, {
            investmentId: owner.investmentId,
            sectionId: parsed.data.sectionId,
            displayOrder: parsed.data.atDisplayOrder,
            req,
          })
        },
        { skipRevalidation: true },
      )
      return { success: true, data: created }
    },
    ['kosztorysItems'],
  )
}

export async function removeItemAction(itemId: number) {
  return protectedAction(
    'removeItemAction',
    async ({ payload, user }) => {
      const db = await getDb(payload)
      // Deleting a populated item is allowed (EX-477) — the UI gates it behind a confirm. A delete
      // still drops the row's opis/przedmiar/cena/rabat (and cascades stage_progress), irrecoverable
      // by in-session undo (S-07), so capture a snapshot first, every time.
      const res = await db.execute(sql`
        SELECT investment_id FROM kosztorys_items WHERE id = ${itemId}
      `)
      const investmentId = res.rows[0]?.investment_id
      if (investmentId != null) await captureAutoSnapshot(db, Number(investmentId), user.id)
      await payload.delete({ collection: 'kosztorys-items', id: itemId })
      return { success: true }
    },
    ['kosztorysItems'],
  )
}

// ▲▼ move within a section.
export async function swapItemOrderAction(
  first: { id: number; displayOrder: number },
  second: { id: number; displayOrder: number },
): Promise<ActionResultT> {
  return protectedAction(
    'swapItemOrderAction',
    async ({ payload }) => {
      const parsed = validateAction(swapDisplayOrderSchema, { first, second })
      if (!parsed.success) return parsed
      await swapDisplayOrder(payload, 'kosztorys-items', parsed.data.first, parsed.data.second)
      return { success: true }
    },
    ['kosztorysItems'],
  )
}

// --- Stages (etapy) ---

// A new etap is created WITH its plane — the picker is forced at creation (the add menu offers
// „z narzędziami" / „bez narzędzi", never a plane-less „Etap"), so no new stage is ever null.
// Legacy stages keep their null and its unconfirmed warning until a human picks one.
export async function addStageAction(
  investmentId: number,
  plane: ToolPlaneT,
): Promise<ActionResultT<{ id: number; ordinal: number }>> {
  return protectedAction(
    'addStageAction',
    async ({ payload }) => {
      const parsed = validateAction(stagePatchSchema, { plane })
      if (!parsed.success) return parsed
      const existing = await payload.find({
        collection: 'kosztorys-stages',
        where: { investment: { equals: investmentId } },
        sort: '-ordinal',
        limit: 1,
        depth: 0,
      })
      const nextOrdinal = (existing.docs[0]?.ordinal ?? 0) + 1
      const created = await payload.create({
        collection: 'kosztorys-stages',
        data: { investment: investmentId, ordinal: nextOrdinal, plane },
      })
      return { success: true, data: { id: created.id, ordinal: nextOrdinal } }
    },
    ['kosztorysStages'],
  )
}

// stagePatchSchema is shaped to match StagePatchT (single source of the type in lib/kosztorys/types.ts).
const stagePatchSchema = z
  .object({
    label: z.string().nullable(),
    plane: stagePlaneSchema,
  })
  .partial()

// Stage autosave: the header patches one field at a time (rename → label, plane picker → plane).
// A plane patch only ever writes a concrete value — an explicit pick confirms the plane and clears
// the unconfirmed (null) warning; there is no "un-confirm" path.
export async function updateStageAction(
  stageId: number,
  patch: StagePatchT,
): Promise<ActionResultT> {
  return protectedAction(
    'updateStageAction',
    async ({ payload }) => {
      const parsed = validateAction(stagePatchSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'kosztorys-stages', id: stageId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysStages'],
  )
}

const stageIdSchema = z.object({ stageId: z.number() })

export async function removeStageAction(stageId: number): Promise<ActionResultT> {
  return protectedAction(
    'removeStageAction',
    async ({ payload, user }) => {
      const parsed = validateAction(stageIdSchema, { stageId })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      // Deleting a populated stage is allowed (EX-477) — the UI gates it behind a confirm. Dropping
      // the stage cascades its stage_progress, irrecoverable by in-session undo (S-07), so capture a
      // snapshot first, every time.
      const res = await db.execute(sql`
        SELECT investment_id FROM kosztorys_stages WHERE id = ${parsed.data.stageId}
      `)
      const investmentId = res.rows[0]?.investment_id
      if (investmentId != null) await captureAutoSnapshot(db, Number(investmentId), user.id)
      await payload.delete({ collection: 'kosztorys-stages', id: parsed.data.stageId })
      return { success: true }
    },
    ['kosztorysStages', 'stageProgress'],
  )
}

// --- Stage progress (upsert by item + stage; sparse — a missing row means 0) ---

const stageProgressSchema = z.object({
  itemId: z.number(),
  stageId: z.number(),
  qtyDone: z.coerce.number(),
})

export async function setStageProgressAction(
  itemId: number,
  stageId: number,
  qtyDone: number,
): Promise<ActionResultT> {
  return protectedAction(
    'setStageProgressAction',
    async ({ payload }) => {
      const parsed = validateAction(stageProgressSchema, { itemId, stageId, qtyDone })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      await db.execute(sql`
        INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
        VALUES (${parsed.data.itemId}, ${parsed.data.stageId}, ${parsed.data.qtyDone}, now(), now())
        ON CONFLICT (item_id, stage_id)
        DO UPDATE SET qty_done = ${parsed.data.qtyDone}, updated_at = now()
      `)
      return { success: true }
    },
    ['stageProgress'],
    // Same deferral as the two field autosaves above — this is the etap quantity cell, the most
    // frequent write in the editor.
    { deferRefresh: true },
  )
}
