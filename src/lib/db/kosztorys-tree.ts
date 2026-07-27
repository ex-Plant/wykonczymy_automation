import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import { isSectionColorKey } from '@/lib/kosztorys/section-colors'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type {
  DiscountTypeT,
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
  SubcontractorOverrideTypeT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'
import type { DbExecutorT } from './get-db'

// The four kosztorys reads behind the editor tree, as raw SQL rather than payload.find. The ORM path
// measured 0.53ms per row of hydration on Neon — at the 1000+-item bar this editor targets that is
// the dominant term in the whole page, and none of it buys anything: the tree is a flat projection
// with depth 0, so every field Payload hydrates is one we immediately discard (EX-597).
//
// Row values arrive as strings for numeric columns (node-postgres does not narrow numerics to JS
// floats), which is why every figure goes through `num` rather than a bare cast.

const num = (v: unknown): number => Number(v ?? 0)
const str = (v: unknown): string | null => (v == null ? null : String(v))

export type InvestmentKosztorysSettingsT = {
  wToolsCoeff: number | null
  ownToolsCoeff: number | null
  vatRate: number | null
  settlementMode: SettlementModeT
  materialsNetRate: number | null
  globalDiscountType: string | null
  globalDiscountValue: number
  updatedAt: string
}

export async function selectKosztorysSections(
  db: DbExecutorT,
  investmentId: number,
): Promise<KosztorysSectionT[]> {
  const res = await db.execute(sql`
    SELECT id, name, display_order, color, default_cost_variant
    FROM kosztorys_sections
    WHERE investment_id = ${investmentId}
    ORDER BY display_order, id
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name ?? ''),
    displayOrder: num(row.display_order),
    // Validated on read, not trusted: a key retired from the palette reads as unpinned rather than
    // painting with a CSS var that no longer exists.
    color: isSectionColorKey(row.color) ? row.color : null,
    defaultCostVariant: (str(row.default_cost_variant) as ToolPlaneT | null) ?? 'w_tools',
  }))
}

export async function selectKosztorysItems(
  db: DbExecutorT,
  investmentId: number,
): Promise<(KosztorysItemT & { sectionId: number })[]> {
  const res = await db.execute(sql`
    SELECT id, section_id, display_order, description, unit, planned_qty,
           discount_type, discount_value, client_price,
           w_tools_override_type, w_tools_override_value,
           own_tools_override_type, own_tools_override_value,
           cost_variant, hidden_in_export, note
    FROM kosztorys_items
    WHERE investment_id = ${investmentId}
    ORDER BY display_order, id
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    sectionId: Number(row.section_id),
    displayOrder: num(row.display_order),
    description: str(row.description),
    unit: str(row.unit),
    plannedQty: num(row.planned_qty),
    discountType: str(row.discount_type) as DiscountTypeT | null,
    discountValue: num(row.discount_value),
    clientPrice: num(row.client_price),
    wToolsOverrideType: str(row.w_tools_override_type) as SubcontractorOverrideTypeT | null,
    wToolsOverrideValue: num(row.w_tools_override_value),
    ownToolsOverrideType: str(row.own_tools_override_type) as SubcontractorOverrideTypeT | null,
    ownToolsOverrideValue: num(row.own_tools_override_value),
    costVariant: str(row.cost_variant) as ToolPlaneT | null,
    hiddenInExport: Boolean(row.hidden_in_export),
    note: str(row.note),
  }))
}

export async function selectKosztorysStages(
  db: DbExecutorT,
  investmentId: number,
): Promise<KosztorysStageT[]> {
  const res = await db.execute(sql`
    SELECT id, ordinal, label, plane
    FROM kosztorys_stages
    WHERE investment_id = ${investmentId}
    ORDER BY ordinal, id
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    ordinal: num(row.ordinal),
    label: str(row.label),
    plane: str(row.plane) as ToolPlaneT | null,
  }))
}

// stage_progress carries no investment column, so it reaches the investment through its item — the
// same join Payload was expressing as `where: { 'item.investment': … }`.
export async function selectStageProgress(
  db: DbExecutorT,
  investmentId: number,
): Promise<StageProgressT[]> {
  const res = await db.execute(sql`
    SELECT sp.item_id, sp.stage_id, sp.qty_done
    FROM stage_progress sp
    JOIN kosztorys_items i ON i.id = sp.item_id
    WHERE i.investment_id = ${investmentId}
    ORDER BY sp.item_id, sp.stage_id
  `)
  return res.rows.map((row) => ({
    itemId: Number(row.item_id),
    stageId: Number(row.stage_id),
    qtyDone: num(row.qty_done),
  }))
}

// Returns null for a missing investment so the caller owns the error message; `findByID` used to
// throw a Payload NotFound here.
export async function selectInvestmentKosztorysSettings(
  db: DbExecutorT,
  investmentId: number,
): Promise<InvestmentKosztorysSettingsT | null> {
  const res = await db.execute(sql`
    SELECT w_tools_coeff, own_tools_coeff, vat_rate, settlement_mode, materials_net_rate,
           global_discount_type, global_discount_value, updated_at
    FROM investments
    WHERE id = ${investmentId}
  `)
  const row = res.rows[0]
  if (!row) return null
  return {
    wToolsCoeff: row.w_tools_coeff == null ? null : num(row.w_tools_coeff),
    ownToolsCoeff: row.own_tools_coeff == null ? null : num(row.own_tools_coeff),
    vatRate: row.vat_rate == null ? null : num(row.vat_rate),
    settlementMode: String(row.settlement_mode) as SettlementModeT,
    materialsNetRate: row.materials_net_rate == null ? null : num(row.materials_net_rate),
    globalDiscountType: str(row.global_discount_type),
    globalDiscountValue: num(row.global_discount_value),
    // Payload handed callers an ISO string; the driver hands back a Date. The revision token is
    // compared by value in the editor shell, so the format has to stay stable.
    updatedAt: new Date(row.updated_at as string).toISOString(),
  }
}
