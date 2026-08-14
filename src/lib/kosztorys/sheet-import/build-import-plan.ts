import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
} from '@/lib/kosztorys/types'
import {
  FIELD_LABELS,
  fold,
  isOptionalField,
  type ColumnFieldT,
  type OptionalFieldT,
  type SheetColumnMappingT,
} from './columns'
import { deriveOverride } from './derive-override'
import { compareFooterTotals, type FooterComparisonT } from './footer-totals'
import { keyItems } from './item-key'
import { parseRobocizna } from './parse-robocizna'
import { type ImportGridsT } from './read-sheet'
import {
  resolveRobocizna,
  type CandidateColumnT,
  type MissingFieldT,
  type UnresolvedReasonT,
} from './resolve-columns'
import {
  isReported,
  readRateTabs,
  resolveItemRates,
  type ReportedRateResolutionT,
} from './resolve-rates'

export type MissingColumnT = {
  field: ColumnFieldT
  label: string
  reason: UnresolvedReasonT
  consequence: string
}

// What the kosztorys loses when an optional column can't be read. The report names the loss, not the
// column: „nie znaleziono kolumny rabat" is a fact about the sheet, „każda praca wejdzie bez rabatu"
// is what the owner is actually deciding whether to accept.
const MISSING_COLUMN_CONSEQUENCES: Record<OptionalFieldT, string> = {
  discount: 'prace wejdą bez rabatu',
  measuredQty: 'nie będzie z czym porównać etapów przy „Porównaj z arkuszem"',
  comment: 'komentarze z arkusza nie wejdą',
}

export type RetainedItemT = { section: string; description: string }

export type { ReportedRateResolutionT }

export type ImportReportT = {
  // Only the columns that did NOT come through. The recognised ones are the whole point of the
  // resolver and say nothing worth reading — every required column is resolved or the import is
  // refused, so a list of them was 14 lines nobody could act on.
  missingColumns: MissingColumnT[]
  // Header columns no field claimed — what the owner can point a missing field at.
  candidates: CandidateColumnT[]
  counts: { sections: number; items: number; stages: number }
  // Every decision that was NOT a plain agreement between the two price lists. Agreements are the
  // overwhelming majority and say nothing — listing them would bury the handful that need an eye.
  rateDecisions: ReportedRateResolutionT[]
  retained: RetainedItemT[]
  totals: FooterComparisonT[]
  // Non-fatal notes, e.g. a „zakres pracy" tab whose own header could not be read: its rates are
  // simply unavailable, which is a degraded import rather than a refused one.
  warnings: string[]
}

export type ImportFailureT = {
  ok: false
  problems: string[]
  missingFields: MissingFieldT[]
  candidates: CandidateColumnT[]
}

export type ImportPlanT =
  | { ok: true; tree: SnapshotPayloadT; report: ImportReportT }
  | ImportFailureT

function groupBy<ValueT, KeyT>(
  values: readonly ValueT[],
  key: (value: ValueT) => KeyT,
): Map<KeyT, ValueT[]> {
  const grouped = new Map<KeyT, ValueT[]>()
  for (const value of values) {
    const bucket = grouped.get(key(value))
    if (bucket) bucket.push(value)
    else grouped.set(key(value), [value])
  }
  return grouped
}

/**
 * Everything the preview shows and everything apply writes, from the sheet grids plus the
 * investment's current tree. Both actions call this so the two can never disagree about what an
 * import would do — the same reason `buildSyncPlan` exists on the materials side.
 */
export function buildImportPlan(
  grids: ImportGridsT,
  currentTree: SnapshotPayloadT,
  mapping?: SheetColumnMappingT,
): ImportPlanT {
  const resolvedRobocizna = resolveRobocizna(grids.robocizna, mapping)
  const { missingFields, candidates } = resolvedRobocizna
  if (!resolvedRobocizna.ok) {
    return { ok: false, problems: resolvedRobocizna.problems, missingFields, candidates }
  }

  // A resolved header can only be missing optional fields — a required one refuses the import above.
  const missingColumns: MissingColumnT[] = missingFields
    .filter((missing): missing is MissingFieldT & { field: OptionalFieldT } =>
      isOptionalField(missing.field),
    )
    .map(({ field, reason }) => ({
      field,
      label: FIELD_LABELS[field],
      reason,
      consequence: MISSING_COLUMN_CONSEQUENCES[field],
    }))

  const { tabs: rateTabs, warnings } = readRateTabs(grids.rateTabs)

  // Not a degraded import but a wrong one: with no cennik at all, `resolveItemRates` returns
  // `missing` for every praca and `deriveOverride` writes a flat 0 zł subcontractor cost onto each —
  // a number that looks deliberate in the editor and silently destroys the margin. A refusal the
  // owner can act on („popraw nagłówki cennika") beats a confirm button over 400 zeroes.
  if (rateTabs.length === 0) {
    return {
      ok: false,
      problems: [
        'Nie odczytałem żadnego cennika („zakres pracy") — wszystkie stawki podwykonawców trafiłyby do kosztorysu jako 0 zł.',
        ...warnings,
      ],
      missingFields,
      candidates,
    }
  }

  const parsed = parseRobocizna(grids.robocizna, resolvedRobocizna, grids.robociznaFormulas)
  const rates = resolveItemRates(
    parsed.items.map((item) => ({ description: item.description ?? '' })),
    rateTabs,
  )

  const missingRates = rates.filter((rate) => rate.kind === 'missing').length
  if (missingRates > 0) {
    warnings.push(`${missingRates} prac nie ma w żadnym cenniku — wejdą ze stawką 0 zł.`)
  }
  if (parsed.skippedBeforeFirstSection > 0) {
    warnings.push(
      `Pominięto ${parsed.skippedBeforeFirstSection} wierszy nad pierwszą sekcją — nie należą do żadnej sekcji.`,
    )
  }

  const sections: KosztorysSectionT[] = []
  const items: KosztorysItemT[] = []
  const progress: StageProgressT[] = []
  let nextSectionId = 1
  let nextItemId = 1

  const currentSectionName = new Map(
    currentTree.sections.map((section) => [section.id, section.name]),
  )
  const currentByKey = keyItems(
    currentTree.items,
    (item) => currentSectionName.get(item.sectionId) ?? '',
  )
  const matchedCurrentIds = new Set<number>()

  const parsedSectionName = new Map(parsed.sections.map((section) => [section.id, section.name]))
  const parsedKeys = keyItems(
    // `keyItems` wants full items; the parsed ones lack the four override fields, which it never
    // reads. Only the section, description and their order matter for keying.
    parsed.items as unknown as KosztorysItemT[],
    (item) => parsedSectionName.get(item.sectionId) ?? '',
  )
  const keyByParsedId = new Map<number, string>()
  for (const [key, item] of parsedKeys) keyByParsedId.set(item.id, key)

  const rateByItemId = new Map(parsed.items.map((item, index) => [item.id, rates[index]]))
  const parsedProgressByItem = groupBy(parsed.progress, (entry) => entry.itemId)
  const parsedItemsBySection = groupBy(parsed.items, (item) => item.sectionId)

  for (const sheetSection of parsed.sections) {
    const sectionId = nextSectionId++
    sections.push({ ...sheetSection, id: sectionId, displayOrder: sections.length })

    for (const sheetItem of parsedItemsBySection.get(sheetSection.id) ?? []) {
      const rate = rateByItemId.get(sheetItem.id)
      const current = currentByKey.get(keyByParsedId.get(sheetItem.id) ?? '')
      if (current) matchedCurrentIds.add(current.id)

      const wTools = deriveOverride(rate?.wToolsRate ?? 0, sheetItem.clientPrice)
      const ownTools = deriveOverride(rate?.ownToolsRate ?? 0, sheetItem.clientPrice)
      const itemId = nextItemId++
      items.push({
        ...sheetItem,
        id: itemId,
        sectionId,
        displayOrder: items.length,
        wToolsOverrideType: wTools.type,
        wToolsOverrideValue: wTools.value,
        ownToolsOverrideType: ownTools.type,
        ownToolsOverrideValue: ownTools.value,
        // The sheet has no column for either, so a matched praca keeps what the app holds rather
        // than having it blanked by an import that never had an opinion. `sheetMeasuredQty` gets
        // the opposite treatment on purpose — it rides the spread above and OVERWRITES, because it
        // is the sheet's own claim and the app never edits it: whatever the sheet says today is the
        // answer, including „nothing typed here any more".
        note: current?.note ?? null,
        hiddenInExport: current?.hiddenInExport ?? false,
      })

      for (const entry of parsedProgressByItem.get(sheetItem.id) ?? []) {
        progress.push({ itemId, stageId: entry.stageId, qtyDone: entry.qtyDone })
      }
    }
  }

  // Etapy come from the sheet, so a retained praca's wykonano survives only for the ordinals that
  // still exist.
  const stages: KosztorysStageT[] = parsed.stages
  const survivingOrdinals = new Set(stages.map((stage) => stage.ordinal))
  const currentOrdinal = new Map(currentTree.stages.map((stage) => [stage.id, stage.ordinal]))

  const retained: RetainedItemT[] = []
  const retainedItems = currentTree.items.filter((item) => !matchedCurrentIds.has(item.id))
  const currentProgressByItem = groupBy(currentTree.progress, (entry) => entry.itemId)
  const sectionIdByName = new Map(sections.map((section) => [fold(section.name), section.id]))

  for (const item of retainedItems) {
    const sectionName = currentSectionName.get(item.sectionId) ?? ''
    let sectionId = sectionIdByName.get(fold(sectionName))
    if (sectionId === undefined) {
      sectionId = nextSectionId++
      sectionIdByName.set(fold(sectionName), sectionId)
      const source = currentTree.sections.find((section) => section.id === item.sectionId)
      sections.push({
        id: sectionId,
        name: sectionName,
        displayOrder: sections.length,
        color: source?.color ?? null,
      })
    }

    const itemId = nextItemId++
    items.push({ ...item, id: itemId, sectionId, displayOrder: items.length })
    retained.push({ section: sectionName, description: item.description ?? '' })

    for (const entry of currentProgressByItem.get(item.id) ?? []) {
      const ordinal = currentOrdinal.get(entry.stageId)
      if (ordinal === undefined || !survivingOrdinals.has(ordinal)) continue
      progress.push({ itemId, stageId: ordinal, qtyDone: entry.qtyDone })
    }
  }

  return {
    ok: true,
    tree: {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      sections,
      items,
      stages,
      progress,
      // Import has no opinion on VAT or the global coefficients — the sheet doesn't carry them, and
      // `restoreKosztorys` rewrites whatever it is handed.
      settings: currentTree.settings,
    },
    report: {
      missingColumns,
      candidates,
      counts: {
        sections: parsed.sections.length,
        items: parsed.items.length,
        stages: stages.length,
      },
      rateDecisions: rates.filter(isReported),
      retained,
      totals: compareFooterTotals(grids.robocizna, resolvedRobocizna, parsed),
      warnings,
    },
  }
}
