import { fold, HEADER_BLOCK_ROWS } from './columns'
import type { ResolvedRatesT } from './resolve-columns'

export type RateRowT = {
  description: string
  wToolsRate: number
  ownToolsRate: number
  // Whether the cell was typed by hand rather than computed. A hand-typed rate is a decision the
  // owner made about THIS praca; a formula is the default markup applied to everything. That is why
  // a typed value outranks a derived one when the tabs disagree.
  wToolsTyped: boolean
  ownToolsTyped: boolean
}

export type RateTabT = { title: string; rows: RateRowT[] }

// Why a resolution came out the way it did — every value but `agree` is shown to the owner, because
// each one means the two price lists did not simply say the same thing.
export type RateDecisionKindT =
  | 'agree' // both tabs, same pair
  | 'single' // only one tab has this praca
  | 'auto' // tabs disagreed, one was hand-typed — resolved without asking
  | 'conflict' // both hand-typed and different — resolved, but the owner should look
  | 'missing' // no tab has it: the praca imports at 0 zł

// The kinds the preview lists one by one. `agree` says nothing, and `missing` is reported as a count
// instead — on a sheet whose cenniki are unreadable EVERY praca is missing, and 400 identical lines
// would bury the handful of real disagreements this list exists to surface.
export type ReportedRateKindT = Exclude<RateDecisionKindT, 'agree' | 'missing'>

export type RateResolutionT = {
  description: string
  wToolsRate: number
  ownToolsRate: number
  kind: RateDecisionKindT
  sourceTab: string | null
  // What the tab that lost said, for the preview. Only set on `auto` and `conflict`.
  rejected?: { tab: string; wToolsRate: number; ownToolsRate: number }
}

export type RateItemT = { description: string }

// Rates are money to six places at most; comparing raw floats would call 0.65×20 and 13 different.
const same = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6

// The praca's identity inside one tab: description plus which repetition of it this is. Descriptions
// repeat across sections („gładź" in two rooms at two prices), so neither the description alone nor
// the row index is enough — the row index in particular breaks the moment the tabs stop being
// row-for-row mirrors of each other, which nothing guarantees.
const occurrenceKey = (description: string, occurrence: number): string =>
  `${fold(description)}#${occurrence}`

function indexByOccurrence(rows: readonly RateRowT[]): Map<string, RateRowT> {
  const seen = new Map<string, number>()
  const byKey = new Map<string, RateRowT>()
  for (const row of rows) {
    const folded = fold(row.description)
    if (!folded) continue
    const occurrence = seen.get(folded) ?? 0
    seen.set(folded, occurrence + 1)
    byKey.set(occurrenceKey(row.description, occurrence), row)
  }
  return byKey
}

// A pair where the subcontractor who brings their own tools costs MORE than one we equip is
// arithmetically impossible — the tools are the difference. Such a pair means the two rate columns
// were read from a row that doesn't belong to this praca, so it is dropped before any comparison
// rather than scored against the other tab.
const isCoherent = (row: RateRowT): boolean => row.ownToolsRate <= row.wToolsRate

function decide(
  description: string,
  candidates: ReadonlyArray<{ tab: string; row: RateRowT }>,
): RateResolutionT {
  if (candidates.length === 0) {
    return { description, wToolsRate: 0, ownToolsRate: 0, kind: 'missing', sourceTab: null }
  }

  const coherent = candidates.filter(({ row }) => isCoherent(row))
  // Nothing coherent anywhere is not a reason to import 0 zł — it is a reason to import the
  // authoritative tab's figure and put the praca in front of the owner.
  const pool = coherent.length > 0 ? coherent : candidates
  const [winner, ...rest] = pool
  const base = {
    description,
    wToolsRate: winner.row.wToolsRate,
    ownToolsRate: winner.row.ownToolsRate,
    sourceTab: winner.tab,
  }

  if (candidates.length === 1) return { ...base, kind: 'single' }

  const other = rest.find(
    ({ row }) =>
      !same(row.wToolsRate, winner.row.wToolsRate) ||
      !same(row.ownToolsRate, winner.row.ownToolsRate),
  )
  if (!other) {
    if (coherent.length === candidates.length) return { ...base, kind: 'agree' }
    // The survivors agree, but the guard dropped a candidate to get here — that dropped pair is
    // exactly what the owner needs to see, so it rides along as the rejected side.
    const dropped = candidates.find(({ row }) => !isCoherent(row))
    return {
      ...base,
      kind: 'auto',
      ...(dropped && {
        rejected: {
          tab: dropped.tab,
          wToolsRate: dropped.row.wToolsRate,
          ownToolsRate: dropped.row.ownToolsRate,
        },
      }),
    }
  }

  const rejected = {
    tab: other.tab,
    wToolsRate: other.row.wToolsRate,
    ownToolsRate: other.row.ownToolsRate,
  }
  const winnerTyped = winner.row.wToolsTyped || winner.row.ownToolsTyped
  const otherTyped = other.row.wToolsTyped || other.row.ownToolsTyped

  // One side hand-typed: that side is the owner's decision about this praca and wins outright.
  if (otherTyped && !winnerTyped) {
    return {
      description,
      wToolsRate: other.row.wToolsRate,
      ownToolsRate: other.row.ownToolsRate,
      kind: 'auto',
      sourceTab: other.tab,
      rejected: {
        tab: winner.tab,
        wToolsRate: winner.row.wToolsRate,
        ownToolsRate: winner.row.ownToolsRate,
      },
    }
  }
  if (winnerTyped && !otherTyped) return { ...base, kind: 'auto', rejected }

  // Both typed and different, or both derived and different: pick the authoritative tab and say so.
  return { ...base, kind: 'conflict', rejected }
}

// Resolve one rate pair per praca. `tabs` is in PRIORITY order — the first tab supplies the value
// whenever the decision is otherwise a coin flip (a conflict between two hand-typed figures). The
// caller orders them; see `build-import-plan`.
export function resolveItemRates(
  items: readonly RateItemT[],
  tabs: readonly RateTabT[],
): RateResolutionT[] {
  const indexed = tabs.map((tab) => ({ title: tab.title, byKey: indexByOccurrence(tab.rows) }))
  const seen = new Map<string, number>()

  return items.map((item) => {
    const folded = fold(item.description)
    const occurrence = seen.get(folded) ?? 0
    seen.set(folded, occurrence + 1)
    const key = occurrenceKey(item.description, occurrence)

    const candidates = indexed.flatMap(({ title, byKey }) => {
      const row = byKey.get(key)
      return row ? [{ tab: title, row }] : []
    })
    return decide(item.description, candidates)
  })
}

// Turn one „zakres pracy" tab into rate rows. `formulas` is the same grid fetched with the formula
// render, which is the only way to tell a hand-typed rate from a computed one — the value render
// returns 13 either way.
export function readRateRows(
  grid: unknown[][],
  formulas: unknown[][],
  resolved: ResolvedRatesT,
): RateRowT[] {
  const { description, wToolsRate, ownToolsRate } = resolved.columns
  const rows: RateRowT[] = []

  for (let rowIndex = HEADER_BLOCK_ROWS; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex] ?? []
    const label = typeof row[description] === 'string' ? row[description].trim() : ''
    if (!label) continue

    const formulaRow = formulas[rowIndex] ?? []
    const isTyped = (column: number): boolean => {
      const cell = formulaRow[column]
      return cell != null && cell !== '' && !(typeof cell === 'string' && cell.startsWith('='))
    }
    const value = (column: number): number =>
      typeof row[column] === 'number' ? row[column] : Number(row[column]) || 0

    rows.push({
      description: label,
      wToolsRate: value(wToolsRate),
      ownToolsRate: value(ownToolsRate),
      wToolsTyped: isTyped(wToolsRate),
      ownToolsTyped: isTyped(ownToolsRate),
    })
  }

  return rows
}
