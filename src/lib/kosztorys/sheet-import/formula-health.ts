import { columnLetter } from '@/lib/google/sheet-configs'
import { fold, HEADER_BLOCK_ROWS } from './columns'
import { NON_ITEM_MARKER } from './parse-robocizna'
import type { ResolvedRobociznaT } from './resolve-columns'

export type FormulaClassT = 'measuredCopiedFromPlanned' | 'plannedReadFromStage' | 'errorValue'

export type FormulaSampleT = { row: number; description: string; klass: FormulaClassT }

export type FormulaHealthT = {
  // Pomiar copied from Przedmiar (`=N<own row>`): not a measurement, so no reference quantity is
  // stored — these rows are why zero rozjazdów proves nothing.
  measuredCopiedFromPlanned: number
  // Przedmiar read from an etap column (`=M<own row>`): the offer becomes a derivative of execution,
  // and an empty etap makes it a zero offer.
  plannedReadFromStage: number
  // #REF! / #DIV/0! arriving as strings from UNFORMATTED_VALUE and silently coerced to 0. Counted
  // per row, like the two classes above, so the three numbers are read on one scale.
  errorValues: number
  samples: FormulaSampleT[]
  totalRows: number
}

// Enough to recognise the pattern and go fix it in the sheet; the count above carries the scale.
const SAMPLE_CAP = 25

const ERROR_VALUE = /^#(REF|DIV\/0|VALUE|NAME\?|N\/A|NUM|NULL)!?$/

const text = (cell: unknown): string =>
  typeof cell === 'string' ? cell.trim() : cell == null ? '' : String(cell).trim()

/**
 * The column a formula copies wholesale from its OWN row, or null when it does anything else.
 * A bare `=N5` on row 5 is a column standing in for another; `=SUM(D5:M5)` and `=219,25+21,75` are
 * the owner doing real work and must not be reported — the whole point of the normalization written
 * down in `context/reference/kosztorys-sheet/formula-anomalies.md`.
 */
function ownRowReference(formula: unknown, rowNumber: number): string | null {
  if (typeof formula !== 'string' || !formula.startsWith('=')) return null
  const match = /^=\$?([A-Z]{1,2})\$?(\d+)$/.exec(formula.trim())
  if (!match || Number(match[2]) !== rowNumber) return null
  return match[1]
}

/**
 * Classify the formula grid the import already fetched. Report-only: nothing here changes what gets
 * imported — the parser's own refusals are unchanged, and this exists to say out loud which rows
 * those refusals silently swallowed.
 */
export function scanFormulaHealth(
  grid: unknown[][],
  formulas: unknown[][],
  resolved: ResolvedRobociznaT,
  footerStart: number,
): FormulaHealthT {
  const { columns, stages } = resolved
  const plannedLetter = columnLetter(columns.plannedQty)
  const stageLetters = new Set(
    Array.from({ length: stages.count }, (_, index) => columnLetter(stages.firstColumn + index)),
  )
  // Only the columns the app actually reads: an error parked in a column nobody imports changes no
  // figure, and reporting it would teach the owner to ignore the block.
  const readColumns = [
    columns.plannedQty,
    columns.measuredQty,
    columns.clientPrice,
    columns.discount,
    columns.netValue,
    ...Array.from({ length: stages.count }, (_, index) => stages.firstColumn + index),
  ].filter((column): column is number => column !== undefined)

  const health: FormulaHealthT = {
    measuredCopiedFromPlanned: 0,
    plannedReadFromStage: 0,
    errorValues: 0,
    samples: [],
    totalRows: 0,
  }

  const lastRow = footerStart < 0 ? grid.length : footerStart

  for (let rowIndex = HEADER_BLOCK_ROWS; rowIndex < lastRow; rowIndex++) {
    const row = grid[rowIndex] ?? []
    const formulaRow = formulas[rowIndex] ?? []
    const description = text(row[columns.description])
    // Same two gates the parser uses to decide a row is a praca — a section header or a spacer has
    // formulas of its own that say nothing about the prace.
    if (fold(row[columns.plannedQty]) === NON_ITEM_MARKER || !description) continue
    health.totalRows++

    const record = (klass: FormulaClassT) => {
      health[klass === 'errorValue' ? 'errorValues' : klass]++
      if (health.samples.length < SAMPLE_CAP) {
        health.samples.push({ row: rowIndex + 1, description, klass })
      }
    }

    if (
      columns.measuredQty !== undefined &&
      ownRowReference(formulaRow[columns.measuredQty], rowIndex + 1) === plannedLetter
    ) {
      record('measuredCopiedFromPlanned')
    }

    const plannedSource = ownRowReference(formulaRow[columns.plannedQty], rowIndex + 1)
    if (plannedSource !== null && stageLetters.has(plannedSource)) record('plannedReadFromStage')

    if (readColumns.some((column) => ERROR_VALUE.test(text(row[column])))) record('errorValue')
  }

  return health
}
