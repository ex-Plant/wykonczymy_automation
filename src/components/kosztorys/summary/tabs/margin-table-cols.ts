import { SUMMARY_LABEL_COL } from '@/components/ui/summary-grid'

// Wider than the shared value track: these tables carry a single amount column, so at the shared
// width the row reads as a long label with a stub pinned to it. The withheld state also puts a
// sentence where a number normally goes.
export const MARGIN_TABLE_COLS = `${SUMMARY_LABEL_COL} 17rem`
