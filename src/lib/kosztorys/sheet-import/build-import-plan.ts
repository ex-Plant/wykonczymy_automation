import { columnLetter } from '@/lib/google/sheet-configs'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
} from '@/lib/kosztorys/types'
import { FIELD_LABELS, HEADER_BLOCK_ROWS, fold, type ColumnFieldT } from './columns'
import { deriveOverride } from './derive-override'
import { compareFooterTotals, type FooterComparisonT } from './footer-totals'
import { parseRobocizna } from './parse-robocizna'
import { ROBOCIZNA_TAB, type ImportGridsT } from './read-sheet'
import { resolveRates, resolveRobocizna } from './resolve-columns'
import {
  readRateRows,
  resolveItemRates,
  type RateResolutionT,
  type RateTabT,
  type ReportedRateKindT,
} from './resolve-rates'

export type ColumnReportT = { tab: string; field: string; column: string; header: string }

export type RetainedItemT = { section: string; description: string }

export type ReportedRateResolutionT = RateResolutionT & { kind: ReportedRateKindT }

export type ImportReportT = {
  columns: ColumnReportT[]
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

export type ImportPlanT =
  | { ok: true; tree: SnapshotPayloadT; report: ImportReportT }
  | { ok: false; problems: string[] }

// The praca's identity across a re-import: which section it sits in, what it is called, and which
// repetition of that name it is. Ids can't do this job — the sheet has none — and the row number
// can't either, since inserting one praca would re-key every praca below it.
const itemKey = (section: string, description: string | null, occurrence: number): string =>
  `${fold(section)}|${fold(description)}#${occurrence}`

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

function keyItems(
  items: readonly KosztorysItemT[],
  sectionName: (item: KosztorysItemT) => string,
): Map<string, KosztorysItemT> {
  const seen = new Map<string, number>()
  const byKey = new Map<string, KosztorysItemT>()
  for (const item of items) {
    const section = sectionName(item)
    const base = `${fold(section)}|${fold(item.description)}`
    const occurrence = seen.get(base) ?? 0
    seen.set(base, occurrence + 1)
    byKey.set(itemKey(section, item.description, occurrence), item)
  }
  return byKey
}

/**
 * Everything the preview shows and everything apply writes, from the sheet grids plus the
 * investment's current tree. Both actions call this so the two can never disagree about what an
 * import would do — the same reason `buildSyncPlan` exists on the materials side.
 */
export function buildImportPlan(grids: ImportGridsT, currentTree: SnapshotPayloadT): ImportPlanT {
  const resolvedRobocizna = resolveRobocizna(grids.robocizna)
  if (!resolvedRobocizna.ok) return { ok: false, problems: resolvedRobocizna.problems }

  const columns: ColumnReportT[] = Object.entries(resolvedRobocizna.matchedLabels).map(
    ([field, header]) => ({
      tab: ROBOCIZNA_TAB,
      field: FIELD_LABELS[field as ColumnFieldT],
      column: columnLetter(resolvedRobocizna.columns[field as ColumnFieldT] ?? 0),
      header,
    }),
  )
  // Neither carries a header of its own — they are located by offset from the first etap column, and
  // that offset is the single most fragile guess in the whole resolver. Showing it lets the owner
  // catch a misread before it becomes 400 mis-sectioned prace.
  columns.push(
    {
      tab: ROBOCIZNA_TAB,
      field: 'nazwa sekcji',
      column: columnLetter(resolvedRobocizna.columns.section),
      header: '(bez nagłówka)',
    },
    {
      tab: ROBOCIZNA_TAB,
      field: 'opis pracy',
      column: columnLetter(resolvedRobocizna.columns.description),
      header: '(bez nagłówka)',
    },
  )

  const warnings: string[] = []
  const rateTabs: RateTabT[] = []
  for (const tab of grids.rateTabs) {
    const resolved = resolveRates(tab.grid)
    if (!resolved.ok) {
      warnings.push(`Pominięto zakładkę „${tab.title}": ${resolved.problems.join(' ')}`)
      continue
    }
    rateTabs.push({ title: tab.title, rows: readRateRows(tab.grid, tab.formulas, resolved) })
    for (const [field, column] of [
      ['cennik z narzędziami', resolved.columns.wToolsRate],
      ['cennik bez narzędzi', resolved.columns.ownToolsRate],
    ] as const) {
      columns.push({
        tab: tab.title,
        field,
        column: columnLetter(column),
        header: String(tab.grid[HEADER_BLOCK_ROWS - 1]?.[column] ?? '').trim(),
      })
    }
  }

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
    }
  }

  const parsed = parseRobocizna(grids.robocizna, resolvedRobocizna)
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
        // than having it blanked by an import that never had an opinion.
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
      columns,
      counts: {
        sections: parsed.sections.length,
        items: parsed.items.length,
        stages: stages.length,
      },
      rateDecisions: rates.filter(
        (rate): rate is ReportedRateResolutionT => rate.kind !== 'agree' && rate.kind !== 'missing',
      ),
      retained,
      totals: compareFooterTotals(grids.robocizna, resolvedRobocizna, parsed),
      warnings,
    },
  }
}
