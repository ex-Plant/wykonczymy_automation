import { useState } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { AlertIcon } from '@/components/ui/alert-icon'
import { cn } from '@/lib/utils/cn'
import { effectiveCoeff, viewPrice } from '@/lib/kosztorys/calc'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import { OVERRIDE_FIELDS } from '@/lib/kosztorys/constants'
import {
  modeChange,
  overrideSnapshot,
  priceKeystroke,
  priceSettle,
  withOverride,
  type OverrideSnapshotT,
} from '@/lib/kosztorys/subcontractor-price-edit'
import { toastMessage } from '@/lib/utils/toast'
import { formatNet as fmt } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT, SubcontractorOverrideTypeT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { KeyboardEvent, ReactNode } from 'react'

// Where the subcontractor price comes from (a column in the subcontractor views). Labels name the
// SOURCE of the multiplier, not the arithmetic: auto and 'coeff' both compute clientPrice × n and
// differ only in whether n is inherited — labels describing the maths read as synonyms.
const SUB_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'auto' },
  { value: 'coeff', label: 'własny mnożnik' },
  { value: 'amount', label: 'kwota stała' },
]

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

// The guard has one verdict — refused — which is the alarm the rest of the app spells „destructive".
const REFUSED_TONE = 'text-destructive font-medium'

// Reproduces the flex centring .dsg-cell applies to its direct children, which a plain wrapper span
// would otherwise take away from the cell body.
const CELL_WRAPPER = 'flex size-full items-center'

// A derived price carries the float tail of client × coeff; the cell edits grosze, not the tail. The
// comma is the separator the sheet and every other money field use, and `parseDecimalInput` reads it
// back — the thousands separator stays out, it would not survive the round trip.
const round2 = (value: number): string => String(Math.round(value * 100) / 100).replace('.', ',')

// Longer than the default 2s: this one reports work being undone, and it fires as the user's eyes
// are already moving to the next cell.
const REVERT_TOAST_MS = 5000

// The refusal explains itself where the user is typing rather than in a corner toast, mirroring the
// blocked-action tooltip in kosztorys-row-actions-menu.tsx. `open` is forced while a rejection stands
// because nobody hovers a cell they are typing into.
//
// The tree shape NEVER varies with `message`: returning bare children when there is nothing to say
// would change the element type at this position the moment a verdict appears, and React answers a
// changed type by unmounting the subtree — which destroys the input the user is typing into, one
// keystroke after they cross the threshold. Same reason `open` is driven by our own hover state
// rather than left uncontrolled some of the time: Radix would be switching controlled modes.
function CellTooltip({
  message,
  forceOpen,
  trailing,
  children,
}: {
  message: string | null
  forceOpen: boolean
  trailing?: ReactNode
  children: ReactNode
}) {
  const [reveal, setReveal] = useState(false)
  return (
    <SimpleTooltip content={message ?? ''} open={message != null && (forceOpen || reveal)}>
      <span
        // The gutter is owed only to a trailing glyph — without one it would just shave 8px off the
        // input's clickable width.
        className={cn(CELL_WRAPPER, 'min-w-0', trailing && 'pr-2')}
        onPointerEnter={() => setReveal(true)}
        onPointerLeave={() => setReveal(false)}
        // Taking `open` over from Radix took its focus handling with it, and a keyboard user tabbing
        // into a refused cell was left with a red number and no sentence.
        onFocusCapture={() => setReveal(true)}
        onBlurCapture={() => setReveal(false)}
      >
        {children}
        {trailing}
      </span>
    </SimpleTooltip>
  )
}

/**
 * The editing half of „Mnożnik" (`mode: 'coeff'`) and „Cena j.m." (`mode: 'amount'`) — one machine,
 * because both write the same field pair through the same guard and both hit the same trap.
 *
 * The trap: keystrokes commit as they go, so a value the guard refuses leaves the last accepted
 * PREFIX standing on the row. „Mnożnik" is the sharp end — its prefixes begin with the leading „0",
 * so a refused 0,9 strands the row at a multiplier of zero, a silent free row nobody chose. So the
 * text is held as a draft while the caret is in the cell, and leaving settles it: accepted values
 * stay, refused ones roll the row back to what it was on entry and say so out loud.
 */
function useOverrideEdit(
  rowData: KosztorysV2RowT,
  setRowData: (row: KosztorysV2RowT) => void,
  view: ToolPlaneT,
  mode: SubcontractorOverrideTypeT,
) {
  const [blockReason, setBlockReason] = useState<string | null>(null)
  // The text as typed, the override it started from, and the row it belongs to. Bound straight to
  // the row instead, anything the row won't accept (a cleared field, a half-typed „50,") snaps back
  // under the user's hands on the very next keystroke.
  const [edit, setEdit] = useState<{
    draft: string
    entry: OverrideSnapshotT
    rowId: number
  } | null>(null)

  const change = (draft: string) => {
    setEdit({ draft, entry: edit?.entry ?? overrideSnapshot(rowData, view), rowId: rowData.id })
    const result = priceKeystroke(draft, rowData, view, mode)
    setBlockReason(result.kind === 'blocked' ? result.message : null)
    if (result.kind === 'commit') setRowData(result.row)
  }

  const settle = () => {
    setBlockReason(null)
    setEdit(null)
    // The draft lives at a grid POSITION, and the row underneath it can change without the cell ever
    // losing focus (a filter, a refresh landing mid-edit). Settling then would write one row's entry
    // snapshot onto another.
    if (!edit || edit.rowId !== rowData.id) return
    const settled = priceSettle(edit.draft, rowData, view, mode, edit.entry)
    if (settled.kind === 'keep') return
    if (settled.kind === 'clear') {
      setRowData(settled.row)
      return
    }
    if (settled.row) setRowData(settled.row)
    // A refused value leaves an older number on screen in its place, so the revert says so out loud —
    // silently swapping the figure under the user is how they end up trusting a price they never
    // chose. Garbage that displaced nothing is the one case that stays quiet.
    if (settled.reason === 'blocked' || settled.row) {
      toastMessage(
        `${settled.reason === 'blocked' ? 'Wartość odrzucona' : 'Nieprawidłowa wartość'} — przywrócono ${fmt(settled.restoredPrice)}.`,
        'error',
        REVERT_TOAST_MS,
      )
    }
  }

  // Escape abandons the edit without a word — the user said so themselves. It does NOT blur: the
  // rollback has to be the last write, and a synchronous blur would settle the draft this render
  // still holds.
  const cancel = () => {
    setBlockReason(null)
    setEdit(null)
    if (edit && edit.rowId === rowData.id) setRowData(withOverride(rowData, view, edit.entry))
  }

  return {
    draft: edit?.draft ?? null,
    blockReason,
    onChange: change,
    onBlur: settle,
    // Enter hands over to blur rather than settling itself, so there is exactly one settle path.
    onEnter: (event: KeyboardEvent<HTMLInputElement>) => event.currentTarget.blur(),
    onEscape: cancel,
  }
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
  // „Mnożnik" carries no STANDING verdict — the rule is about the price, and a red multiplier would
  // point at the wrong cell when the client price is what moved.
  const edit = useOverrideEdit(rowData, setRowData, view, 'coeff')

  const type = rowData[typeField] as SubcontractorOverrideTypeT | null
  if (type === 'amount') {
    return <ReadOnlyCellText muted>—</ReadOnlyCellText>
  }
  // auto: the row carries no multiplier of its own — show the inherited investment default as a
  // placeholder, italic to read as "not set here".
  const inherited = type == null
  return (
    <CellTooltip message={edit.blockReason} forceOpen>
      <EditableCellInput
        className={
          edit.blockReason ? REFUSED_TONE : inherited ? 'text-muted-foreground italic' : undefined
        }
        value={edit.draft ?? (inherited ? '' : String(rowData[valueField] ?? ''))}
        placeholder={inherited ? String(effectiveCoeff(rowData, view)) : ''}
        inputMode="decimal"
        onBlur={edit.onBlur}
        onEnter={edit.onEnter}
        onEscape={edit.onEscape}
        onChange={(e) => edit.onChange(e.target.value)}
      />
    </CellTooltip>
  )
}

// The "Cena" column in the subcontractor view. Editable in EVERY mode — a hand-typed price IS „kwota
// stała", so the keystroke carries the mode with it rather than making the user set „Źródło" first.
// Clearing it reverts the row to „auto".
//
// This is also the one cell carrying the guard's STANDING verdict, in every mode: the rule is about
// the price, and a breach caused from outside these columns — a lowered client price, a raised global
// coefficient — has to surface without anyone opening them.
function SubcontractorPriceCell({
  rowData,
  setRowData,
  columnData,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view, typeField } = columnData
  const edit = useOverrideEdit(rowData, setRowData, view, 'amount')

  const inherited = rowData[typeField] == null
  // A live rejection outranks the standing verdict: it describes the value on screen, which the row
  // has not accepted.
  const message = edit.blockReason ?? checkSubcontractorPrice(rowData, view)

  const body = (
    <EditableCellInput
      // Italic muted mirrors „Mnożnik": the row carries no price of its own, it is showing the one
      // the investment default derives.
      className={message ? REFUSED_TONE : inherited ? 'text-muted-foreground italic' : undefined}
      value={edit.draft ?? round2(viewPrice(rowData, view))}
      inputMode="decimal"
      onBlur={edit.onBlur}
      onEnter={edit.onEnter}
      onEscape={edit.onEscape}
      onChange={(e) => edit.onChange(e.target.value)}
    />
  )

  // Colour alone can't carry the verdict — a red number is invisible to a colour-blind reader, and
  // across a thousand rows a tinted figure reads as a formatting quirk rather than an alarm.
  // The icon is a SIBLING after the body, never a wrapper around it — appearing at a fixed position
  // it leaves the body's own subtree untouched, where wrapping would remount it mid-keystroke.
  return (
    <CellTooltip
      message={message}
      forceOpen={edit.blockReason != null}
      trailing={message != null && <AlertIcon className="size-3.5" />}
    >
      {body}
    </CellTooltip>
  )
}

function SubcontractorModeCell({
  rowData,
  setRowData,
  columnData,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view, typeField } = columnData
  return (
    <CellSelectMenu
      value={(rowData[typeField] as string | null) ?? ''}
      options={SUB_MODE_OPTIONS}
      onChange={(value) =>
        setRowData(modeChange(rowData, (value || null) as SubcontractorOverrideTypeT | null, view))
      }
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
