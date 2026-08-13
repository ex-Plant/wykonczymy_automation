import {
  FIELD_LABELS,
  FIELD_MATCHERS,
  HEADER_BLOCK_ROWS,
  OPTIONAL_FIELDS,
  RATE_GROUP_LABELS,
  RATE_GROUP_MATCHERS,
  RATE_UNIT_PRICE_MATCHER,
  STAGE_MARKER,
  fold,
  type ColumnFieldT,
  type RateGroupT,
} from './columns'

export type StageColumnsT = { firstColumn: number; count: number }

export type ResolveFailureT = { ok: false; problems: string[] }

export type ResolvedRobociznaT = {
  ok: true
  columns: { section: number; description: number } & Partial<Record<ColumnFieldT, number>> & {
      plannedQty: number
      unit: number
      clientPrice: number
      netValue: number
    }
  stages: StageColumnsT
  // The header text actually found, per field — the preview shows it so the owner can confirm we
  // read the column they meant rather than a same-named neighbour.
  matchedLabels: Partial<Record<ColumnFieldT, string>>
}

// No `stages` here on purpose. A rates tab carries its own „wykonano" run and it can be SHORTER
// than the kosztorys' — Białostocka's „z narzędziami" tab has 6 markers against 10 etapy. The run
// is read only to locate the description column beside it; the etap count comes from
// `kosztorys_robocizny` and nowhere else.
export type ResolvedRatesT = {
  ok: true
  columns: { description: number; wToolsRate: number; ownToolsRate: number }
}

type FieldHitT = { column: number; label: string }

// Scan the whole header block for one field. A field may be labelled on any row, and the same field
// is often labelled on two rows with different wording — those agree on the column, so they are one
// hit, not two.
function findField(block: unknown[][], matches: (value: string) => boolean): FieldHitT[] {
  const byColumn = new Map<number, string>()
  for (const row of block) {
    row.forEach((cell, column) => {
      const raw = typeof cell === 'string' ? cell.trim() : cell == null ? '' : String(cell).trim()
      if (raw && matches(fold(cell)) && !byColumn.has(column)) byColumn.set(column, raw)
    })
  }
  return [...byColumn].map(([column, label]) => ({ column, label }))
}

// The contiguous run of columns marked „wykonano" on row 2. Contiguous on purpose: a stray
// „wykonano" elsewhere in the row would otherwise stretch the range across unrelated columns.
function findStages(block: unknown[][]): StageColumnsT | null {
  const markerRow = block.find((row) => row.some((cell) => fold(cell) === STAGE_MARKER))
  if (!markerRow) return null

  const firstColumn = markerRow.findIndex((cell) => fold(cell) === STAGE_MARKER)
  let count = 0
  while (fold(markerRow[firstColumn + count]) === STAGE_MARKER) count += 1
  return { firstColumn, count }
}

function resolveFields(
  block: unknown[][],
  fields: readonly ColumnFieldT[],
): {
  columns: Partial<Record<ColumnFieldT, number>>
  labels: Partial<Record<ColumnFieldT, string>>
} & {
  problems: string[]
} {
  const columns: Partial<Record<ColumnFieldT, number>> = {}
  const labels: Partial<Record<ColumnFieldT, string>> = {}
  const problems: string[] = []

  for (const field of fields) {
    const hits = findField(block, FIELD_MATCHERS[field])
    if (hits.length === 1) {
      columns[field] = hits[0].column
      labels[field] = hits[0].label
      continue
    }
    // An optional field is one the import can do without, and that holds for BOTH ways of failing to
    // pin it down: absent, or matching two headers. Blocking the whole import over an ambiguous
    // optional column would reject sheets that imported fine before the column existed.
    if (OPTIONAL_FIELDS.has(field)) continue
    if (hits.length === 0) {
      // A required one names itself so the owner knows which cell to fix, rather than getting a
      // guess written into their kosztorys.
      problems.push(`Nie znaleziono kolumny „${FIELD_LABELS[field]}".`)
      continue
    }
    problems.push(
      `Kolumna „${FIELD_LABELS[field]}" pasuje do ${hits.length} kolumn — zmień nazwę dodatkowej.`,
    )
  }

  return { columns, labels, problems }
}

const ROBOCIZNA_FIELDS = [
  'plannedQty',
  'measuredQty',
  'unit',
  'clientPrice',
  'discount',
  'netValue',
  'comment',
] as const

// Resolve the `kosztorys_robocizny` header block. Total by design — an unresolvable header is a
// value the preview renders and a confirm button it disables, not an exception.
export function resolveRobocizna(grid: unknown[][]): ResolvedRobociznaT | ResolveFailureT {
  const block = grid.slice(0, HEADER_BLOCK_ROWS)
  const { columns, labels, problems } = resolveFields(block, ROBOCIZNA_FIELDS)

  const stages = findStages(block)
  if (!stages) {
    problems.push(`Nie znaleziono etapów — brak wiersza z oznaczeniem „${STAGE_MARKER}".`)
  }

  // „Nazwa sekcji" and „opis pracy" carry no header label of their own — row 1 of those columns
  // holds the client's address. They are the columns immediately left of the first etap: opis is
  // one back, then the ordinal, then the section name. A tab with only two leading columns (the
  // `zakres pracy` tabs) has no section column at all.
  const description = stages ? stages.firstColumn - 1 : -1
  const section = stages ? stages.firstColumn - 3 : -1
  if (stages && section < 0) {
    problems.push('Brak kolumny z nazwą sekcji przed kolumnami etapów.')
  }

  const { plannedQty, unit, clientPrice, netValue } = columns
  // The four required fields are re-checked here rather than asserted: `resolveFields` already
  // pushed a problem for each missing one, so this narrows the types on the same condition that
  // made `problems` non-empty.
  if (
    problems.length > 0 ||
    !stages ||
    plannedQty === undefined ||
    unit === undefined ||
    clientPrice === undefined ||
    netValue === undefined
  ) {
    return { ok: false, problems }
  }

  return {
    ok: true,
    columns: { section, description, ...columns, plannedQty, unit, clientPrice, netValue },
    stages,
    matchedLabels: labels,
  }
}

// The per-unit price column inside a rate group: the banner spans two columns (cena + wartość
// suma) and the last header row tells them apart. The banner is looked for on any row but the last
// — sheets merge it across rows 1–2, others put it on one of them alone — while the sub-label is
// always on the last row, which is what keeps the banner scan from swallowing „cena j.m." itself.
function findRateColumn(block: unknown[][], group: RateGroupT): number | null {
  const subLabels = block[HEADER_BLOCK_ROWS - 1] ?? []

  const inGroup = new Set<number>()
  for (const row of block.slice(0, HEADER_BLOCK_ROWS - 1)) {
    row.forEach((cell, column) => {
      if (RATE_GROUP_MATCHERS[group](fold(cell))) inGroup.add(column)
    })
  }

  const priced = [...inGroup].filter((column) => RATE_UNIT_PRICE_MATCHER(fold(subLabels[column])))
  return priced.length === 1 ? priced[0] : null
}

export function resolveRates(grid: unknown[][]): ResolvedRatesT | ResolveFailureT {
  const block = grid.slice(0, HEADER_BLOCK_ROWS)
  const problems: string[] = []

  const stages = findStages(block)
  if (!stages) {
    problems.push(`Nie znaleziono etapów — brak wiersza z oznaczeniem „${STAGE_MARKER}".`)
  }

  const wToolsRate = findRateColumn(block, 'wToolsRate')
  const ownToolsRate = findRateColumn(block, 'ownToolsRate')
  for (const [group, column] of [
    ['wToolsRate', wToolsRate],
    ['ownToolsRate', ownToolsRate],
  ] as const) {
    if (column === null) {
      problems.push(`Nie znaleziono kolumny „cena j.m." w grupie „${RATE_GROUP_LABELS[group]}".`)
    }
  }

  if (problems.length > 0 || !stages || wToolsRate === null || ownToolsRate === null) {
    return { ok: false, problems }
  }

  return {
    ok: true,
    columns: { description: stages.firstColumn - 1, wToolsRate, ownToolsRate },
  }
}
