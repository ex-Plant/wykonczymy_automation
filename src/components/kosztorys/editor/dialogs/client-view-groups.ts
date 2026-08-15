import {
  STAGES_COLUMN_GROUP,
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGE_VALUE_PERCENT_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'

export type ClientViewGroupT = {
  label: string
  keys: readonly string[]
}

// The allowlist rearranged for reading, nothing more: same toggle keys `PREVIEW_VISIBLE_COLUMNS`
// uses, so the spec beside this file can assert the two describe the same set of columns. A key that
// drifts out of one of them shows up as an ungrouped row rather than as a silent omission.
export const CLIENT_VIEW_GROUPS: readonly ClientViewGroupT[] = [
  {
    label: 'Opis i ilości',
    keys: ['sectionName', 'description', 'plannedQty', 'stageQtySum', 'unit'],
  },
  {
    label: 'Ceny i rabat',
    keys: [
      'price',
      'priceGross',
      'discountType',
      'discountValue',
      'discountAmount',
      'discountAmountGross',
    ],
  },
  {
    label: 'Wartości',
    keys: ['plannedNet', 'plannedGross', 'net', 'gross', 'remaining', 'remainingGross'],
  },
  {
    label: 'Etapy i postęp',
    keys: [
      STAGES_COLUMN_GROUP,
      STAGE_VALUE_NET_COLUMN_GROUP,
      STAGE_VALUE_GROSS_COLUMN_GROUP,
      STAGE_VALUE_PERCENT_COLUMN_GROUP,
      'donePercent',
    ],
  },
]
