import { parseSheetColumnMapping } from '../../lib/kosztorys/sheet-import/sheet-column-mapping'
import { resolveLaborColumns } from '../../lib/kosztorys/sheet-import/resolve-columns'
import { parseLaborTab } from '../../lib/kosztorys/sheet-import/parse-labor-tab'
import { readRateTabs, resolveItemRates } from '../../lib/kosztorys/sheet-import/resolve-rates'
import type { SheetDumpT } from './dump-store'

export type ParsedWorkT = {
  description: string
  unit: string
  sectionName: string
  // Cena j.m. sprzed rabatu: rabat jest właściwością konkretnej budowy, nie pracy.
  clientPrice: number
  // `null` = auto. Kwota tylko wtedy, gdy cennik arkusza faktycznie ją rozstrzygnął.
  wToolsRate: number | null
  ownToolsRate: number | null
  // Dlaczego stawka jest „auto" — jedyna treść, którą raport ma o niej do powiedzenia.
  rateKind: 'agree' | 'single' | 'conflict' | 'missing'
}

export type ParsedSheetT = {
  googleSheetId: string
  sheetName: string
  investmentName: string | null
  works: ParsedWorkT[]
}

export type SheetParseFailureT = {
  googleSheetId: string
  sheetName: string
  investmentName: string | null
  reason: string
}

export type ParseResultT =
  | { ok: true; sheet: ParsedSheetT }
  | { ok: false; failure: SheetParseFailureT }

const failure = (dump: SheetDumpT, reason: string): ParseResultT => ({
  ok: false,
  failure: {
    googleSheetId: dump.googleSheetId,
    sheetName: dump.sheetName,
    investmentName: dump.investmentName,
    reason,
  },
})

/**
 * Odtworzenie ścieżki importu na zrzucie z dysku: rozpoznanie kolumn, parsowanie robocizny,
 * odczytanie cenników i rozstrzygnięcie stawek. Nic nie rzuca — arkusz, którego nie da się
 * przeczytać, wraca jako porażka z powodem, bo przy 57 arkuszach jeden wyjątek zabiłby przebieg.
 */
export function parseDumpedSheet(dump: SheetDumpT): ParseResultT {
  if (dump.failure) return failure(dump, `nie zassany: ${dump.failure.reason}`)
  if (!dump.grids) return failure(dump, 'zrzut bez siatek')

  const mapping = parseSheetColumnMapping(dump.columnMapping)
  const resolved = resolveLaborColumns(dump.grids.laborGrid, mapping)
  if (!resolved.ok) return failure(dump, `kolumny: ${resolved.problems.join(' ')}`)

  const parsed = parseLaborTab(dump.grids.laborGrid, resolved, dump.grids.laborGridFormulas)
  if (parsed.items.length === 0) return failure(dump, 'zero pozycji po sparsowaniu')

  // Brak cennika nie jest powodem do odrzucenia arkusza, inaczej niż przy imporcie do kosztorysu:
  // tam 400 zer wjechałoby na pozycje, tu każda stawka wychodzi jako „auto" i cena j.m. — po którą
  // tu przychodzimy — jest z cennika niezależna.
  const { tabs } = readRateTabs(dump.grids.rateTabs)
  const rates = resolveItemRates(
    parsed.items.map((item) => ({ description: item.description ?? '' })),
    tabs,
  )

  const sectionName = new Map(parsed.sections.map((section) => [section.id, section.name]))

  const works = parsed.items.flatMap((item, index): ParsedWorkT[] => {
    const description = item.description?.trim()
    if (!description) return []
    const rate = rates[index]
    const resolvedRate = rate.kind === 'agree' || rate.kind === 'single'
    return [
      {
        description,
        unit: item.unit?.trim() ?? '',
        sectionName: sectionName.get(item.sectionId) ?? '',
        clientPrice: item.clientPrice,
        wToolsRate: resolvedRate ? rate.wToolsRate : null,
        ownToolsRate: resolvedRate ? rate.ownToolsRate : null,
        rateKind: rate.kind,
      },
    ]
  })

  return {
    ok: true,
    sheet: {
      googleSheetId: dump.googleSheetId,
      sheetName: dump.sheetName,
      investmentName: dump.investmentName,
      works,
    },
  }
}
