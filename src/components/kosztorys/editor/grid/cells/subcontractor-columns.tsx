import { useState } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { effectiveCoeff, viewPrice } from '@/lib/kosztorys/calc'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import { formatNet as fmt } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT, SubcontractorOverrideTypeT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { ReactNode } from 'react'

// Where the subcontractor price comes from (a column in the subcontractor views). Labels name the
// SOURCE of the multiplier, not the arithmetic: auto and 'coeff' both compute clientPrice × n and
// differ only in whether n is inherited — labels describing the maths read as synonyms.
const SUB_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'auto' },
  { value: 'coeff', label: 'własny mnożnik' },
  { value: 'amount', label: 'kwota stała' },
]

const OVERRIDE_FIELDS: Record<
  ToolPlaneT,
  { type: keyof KosztorysV2RowT; value: keyof KosztorysV2RowT }
> = {
  w_tools: { type: 'wToolsOverrideType', value: 'wToolsOverrideValue' },
  own_tools: { type: 'ownToolsOverrideType', value: 'ownToolsOverrideValue' },
}

// Everything the three cells need to know about which plane they are editing. Travels via
// `columnData` so each component keeps ONE identity across renders — an inline `component:
// ({rowData}) => …` is a fresh function type on every assembleV2Columns call, which makes
// react-datasheet-grid remount the cell's DOM instead of reconciling it, losing both the typed text
// and the rejection state below (EX-422, lessons.md:119-135).
type SubcontractorCellDataT = {
  view: ToolPlaneT
  typeField: keyof KosztorysV2RowT
  valueField: keyof KosztorysV2RowT
}

const cellData = (view: ToolPlaneT): SubcontractorCellDataT => ({
  view,
  typeField: OVERRIDE_FIELDS[view].type,
  valueField: OVERRIDE_FIELDS[view].value,
})

const TONE = {
  error: 'text-destructive font-medium',
  warning: 'text-warning font-medium',
} as const

// Reproduces the flex centring .dsg-cell applies to its direct children, which a plain wrapper span
// would otherwise take away from the cell body.
const CELL_WRAPPER = 'flex size-full items-center'

/**
 * The rejection half of the guard, shared by both editable cells: would this write breach the
 * ceiling, and if so what do we tell the user?
 *
 * Returns the message to block with, or `null` to let the write through. A `warning` commits
 * normally — it is a colour, not a refusal — and the standing state on „Cena" is what shows it.
 */
function blockedBy(candidate: KosztorysV2RowT, view: ToolPlaneT): string | null {
  const issue = checkSubcontractorPrice(candidate, view)
  return issue?.severity === 'error' ? issue.message : null
}

// The refusal explains itself where the user is typing rather than in a corner toast, mirroring the
// blocked-action tooltip in kosztorys-row-actions-menu.tsx. `open` is forced while a rejection stands
// because nobody hovers a cell they are typing into.
function CellTooltip({
  message,
  forceOpen,
  children,
}: {
  message: string | null
  forceOpen: boolean
  children: ReactNode
}) {
  if (message == null) return <>{children}</>
  return (
    <SimpleTooltip content={message} open={forceOpen ? true : undefined}>
      <span className={CELL_WRAPPER}>{children}</span>
    </SimpleTooltip>
  )
}

// Mnożnik and Cena j.m. both write the SAME pair of fields (overrideType + overrideValue) — the
// column you type into is what picks the type. That's why each is editable only in the modes where
// it carries the input: a mnożnik is meaningless under 'amount' (flat price), and a hand-typed price
// is meaningless under 'coeff'/auto (it's derived). The read-only side still renders its value so
// the row is legible in every mode.
function SubcontractorCoeffCell({
  rowData,
  setRowData,
  columnData,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view, typeField, valueField } = columnData
  // Per-cell and deliberately not lifted: it describes a keystroke, not the row, and dies with the
  // cell. „Mnożnik" carries no STANDING state either — the rule is about the price, and a red
  // multiplier would point at the wrong cell when the client price is what moved.
  const [blockReason, setBlockReason] = useState<string | null>(null)

  const type = rowData[typeField] as SubcontractorOverrideTypeT | null
  if (type === 'amount') {
    return <ReadOnlyCellText muted>—</ReadOnlyCellText>
  }
  // auto: the row carries no multiplier of its own — show the inherited investment default as a
  // placeholder, italic to read as "not set here".
  const inherited = type == null
  return (
    <CellTooltip message={blockReason} forceOpen>
      <EditableCellInput
        className={
          blockReason ? TONE.error : inherited ? 'text-muted-foreground italic' : undefined
        }
        value={inherited ? '' : String(rowData[valueField] ?? '')}
        placeholder={inherited ? String(effectiveCoeff(rowData, view)) : ''}
        inputMode="decimal"
        onBlur={() => setBlockReason(null)}
        onChange={(e) => {
          const parsed = parseDecimalInput(e.target.value)
          if (parsed.kind === 'empty') {
            setBlockReason(null)
            setRowData({ ...rowData, [typeField]: null, [valueField]: 0 })
            return
          }
          if (parsed.kind === 'invalid') return
          const candidate = { ...rowData, [typeField]: 'coeff', [valueField]: parsed.value }
          const reason = blockedBy(candidate, view)
          setBlockReason(reason)
          if (reason == null) setRowData(candidate)
        }}
      />
    </CellTooltip>
  )
}

// The "Cena" column in the subcontractor view: shows either the derived price (greyed out when
// the override is null) or the entered override value. Entering a value while in the null state
// creates an 'amount' (flat) override; clearing it reverts to the derived price (null). The
// coeff vs amount mode is set by a separate "Tryb" column.
//
// This is the one cell carrying the guard's STANDING verdict, in every mode: the rule is about the
// price, and a breach caused from outside these columns — a lowered client price, a raised global
// coefficient — has to surface without anyone opening them.
function SubcontractorPriceCell({
  rowData,
  setRowData,
  columnData,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view, typeField, valueField } = columnData
  const [blockReason, setBlockReason] = useState<string | null>(null)

  const issue = checkSubcontractorPrice(rowData, view)
  const type = rowData[typeField] as SubcontractorOverrideTypeT | null
  // A live rejection outranks the standing verdict: it describes the value on screen, which the row
  // has not accepted.
  const message = blockReason ?? issue?.message ?? null
  const tone = blockReason ? TONE.error : issue ? TONE[issue.severity] : undefined

  const body =
    type !== 'amount' ? (
      <ReadOnlyCellText muted={tone == null} className={tone}>
        {fmt(viewPrice(rowData, view))}
      </ReadOnlyCellText>
    ) : (
      <EditableCellInput
        className={tone}
        value={String(rowData[valueField] ?? '')}
        inputMode="decimal"
        onBlur={() => setBlockReason(null)}
        onChange={(e) => {
          const parsed = parseDecimalInput(e.target.value)
          if (parsed.kind === 'empty') {
            setBlockReason(null)
            setRowData({ ...rowData, [typeField]: null, [valueField]: 0 })
            return
          }
          if (parsed.kind === 'invalid') return
          const candidate = { ...rowData, [typeField]: 'amount', [valueField]: parsed.value }
          const reason = blockedBy(candidate, view)
          setBlockReason(reason)
          if (reason == null) setRowData(candidate)
        }}
      />
    )

  return (
    <CellTooltip message={message} forceOpen={blockReason != null}>
      {body}
    </CellTooltip>
  )
}

// Switching to auto zeroes the override value. Switching auto→coeff seeds the inherited multiplier
// as the starting point — leaving it at 0 would silently collapse the row's price to zero.
function SubcontractorModeCell({
  rowData,
  setRowData,
  columnData,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view, typeField, valueField } = columnData
  return (
    <CellSelectMenu
      value={(rowData[typeField] as string | null) ?? ''}
      options={SUB_MODE_OPTIONS}
      onChange={(value) => {
        const next = (value || null) as SubcontractorOverrideTypeT | null
        const seed =
          next === 'coeff' && !rowData[valueField]
            ? { [valueField]: effectiveCoeff(rowData, view) }
            : {}
        setRowData({
          ...rowData,
          [typeField]: next,
          ...(next === null ? { [valueField]: 0 } : seed),
        })
      }}
    />
  )
}

export function subcontractorCoeffColumn(
  view: ToolPlaneT,
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'priceCoeff',
    title: titleNode,
    keepFocus: true,
    columnData: cellData(view),
    component: SubcontractorCoeffCell,
    copyValue: ({ rowData }) =>
      (rowData[typeField] as string | null) === 'amount'
        ? ''
        : String(effectiveCoeff(rowData, view)),
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
  }
}

export function subcontractorPriceColumn(
  view: ToolPlaneT,
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'price',
    title: titleNode,
    keepFocus: true,
    columnData: cellData(view),
    component: SubcontractorPriceCell,
    copyValue: ({ rowData }) => String(viewPrice(rowData, view)),
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
  }
}

export function subcontractorModeColumn(
  view: ToolPlaneT,
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'priceMode',
    title: titleNode,
    // Fits the header label next to the sort icon — below this the title truncates.
    minWidth: 185,
    keepFocus: true,
    columnData: cellData(view),
    component: SubcontractorModeCell,
    copyValue: ({ rowData }) => (rowData[typeField] as string | null) ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
  }
}
