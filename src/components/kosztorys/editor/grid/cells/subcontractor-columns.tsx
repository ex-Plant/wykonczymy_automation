import { useState } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { AlertIcon } from '@/components/ui/alert-icon'
import { cn } from '@/lib/utils/cn'
import { decimalText } from '@/lib/utils/decimal-text'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { viewPrice } from '@/lib/kosztorys/calc'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import { OVERRIDE_FIELDS } from '@/lib/kosztorys/constants'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { modeChange, subcontractorPolicy } from '@/lib/kosztorys/subcontractor-price-edit'
import { cellPaste } from '@/lib/kosztorys/cell-edit'
import { useCellDraft } from '@/components/kosztorys/editor/grid/cells/use-cell-draft'
import type { KosztorysV2RowT, SubcontractorOverrideTypeT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { ReactNode } from 'react'

// Where the subcontractor price comes from (a column in the subcontractor views). Labels name the
// SOURCE, not the arithmetic: auto derives the rate from the investment's mnożnik, „kwota stała" is
// the number typed into „Cena j.m.".
const SUB_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'auto' },
  { value: 'amount', label: 'kwota stała' },
]

// Everything the cells need to know about which plane they are editing. Travels via
// `columnData` so each component keeps ONE identity across renders — an inline `component:
// ({rowData}) => …` is a fresh function type on every assembleV2Columns call, which makes
// react-datasheet-grid remount the cell's DOM instead of reconciling it, losing both the typed text
// and the rejection state below (EX-422, lessons.md — „A `react-datasheet-grid` column's `component`
// must be a STABLE reference").
type SubcontractorCellDataT = {
  view: ToolPlaneT
  typeField: keyof KosztorysV2RowT
}

const cellData = (view: ToolPlaneT): SubcontractorCellDataT => ({
  view,
  typeField: OVERRIDE_FIELDS[view].type,
})

// The guard has one verdict — refused — which is the alarm the rest of the app spells „destructive".
const REFUSED_TONE = 'text-destructive font-medium'

// Reproduces the flex centring .dsg-cell applies to its direct children, which a plain wrapper span
// would otherwise take away from the cell body.
const CELL_WRAPPER = 'flex size-full items-center'

// A derived price carries the float tail of client × coeff; the cell edits grosze, not the tail.
const priceText = (value: number): string => decimalText(roundToCents(value))

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

// The "Cena" column in the subcontractor view. Editable in both modes — a hand-typed price IS „kwota
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
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view, typeField } = columnData
  const edit = useCellDraft(
    rowData,
    setRowData,
    subcontractorPolicy<KosztorysV2RowT>(view),
    stopEditing,
  )

  const inherited = rowData[typeField] == null
  // A live rejection outranks the standing verdict: it describes the value on screen, which the row
  // has not accepted.
  const message = edit.blockReason ?? checkSubcontractorPrice(rowData, view)

  const body = (
    <EditableCellInput
      {...edit.inputProps}
      // Italic muted: the row carries no price of its own, it is showing the one the investment
      // default derives.
      className={message ? REFUSED_TONE : inherited ? 'text-muted-foreground italic' : undefined}
      value={edit.draft ?? priceText(viewPrice(rowData, view))}
      focus={focus}
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
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view, typeField } = columnData
  // Two ways in, one way out. The grid opens the menu through `focus` (Enter, or typing over the
  // cell); a click opens it through Radix's own trigger, which the grid never sees — hence the local
  // flag, without which wiring `focus` alone would have cost mouse users the single click they have
  // today. Either way the close is what tells the grid the edit is over: leave it out and the cell
  // stays „editing" with nothing on screen, so the next Enter closes an already-closed menu.
  const [openedByClick, setOpenedByClick] = useState(false)
  return (
    <CellSelectMenu
      value={(rowData[typeField] as string | null) ?? ''}
      options={SUB_MODE_OPTIONS}
      open={focus || openedByClick}
      onOpenChange={(open) => {
        setOpenedByClick(open)
        // Explicit, because the grid's own default is `nextRow: true` — picking a source must leave
        // the cursor on the row whose source was just picked.
        if (!open) stopEditing({ nextRow: false })
      }}
      onChange={(value) =>
        setRowData(modeChange(rowData, (value || null) as SubcontractorOverrideTypeT | null, view))
      }
    />
  )
}

export function subcontractorPriceColumn(
  view: ToolPlaneT,
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const policy = subcontractorPolicy<KosztorysV2RowT>(view)
  return {
    id: planePriceKey('price', view),
    title: titleNode,
    columnData: cellData(view),
    component: SubcontractorPriceCell,
    copyValue: ({ rowData }) => priceText(viewPrice(rowData, view)),
    pasteValue: ({ rowData, value }) => cellPaste(value, rowData, policy),
    deleteValue: ({ rowData }) => policy.clear(rowData),
  }
}

export function subcontractorModeColumn(
  view: ToolPlaneT,
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField } = OVERRIDE_FIELDS[view]
  const { clear } = subcontractorPolicy<KosztorysV2RowT>(view)
  return {
    id: planePriceKey('priceMode', view),
    title: titleNode,
    // Fits the header label next to the sort icon — below this the title truncates.
    minWidth: 185,
    // The menu is a portal outside the grid, so a click on one of its items reads as a click away —
    // without this the grid would end the edit before the pick lands.
    keepFocus: true,
    // Hands Enter and the arrow keys to the open menu; the grid claims them otherwise and the
    // keyboard could open the list but never walk it.
    disableKeys: true,
    columnData: cellData(view),
    component: SubcontractorModeCell,
    copyValue: ({ rowData }) => (rowData[typeField] as string | null) ?? '',
    deleteValue: ({ rowData }) => clear(rowData),
  }
}
