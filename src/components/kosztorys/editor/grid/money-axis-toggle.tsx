'use client'

import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import type { ClientMoneyAxisT } from '@/lib/kosztorys/money-axis'

// The client picks one plane at a time, not the editor's Widok dropdown — that one is a checkbox-pair
// surface wired to the editor context and carries the layer/etap axes too, none of which this view
// exposes. 'none' and 'both' are both absent: no prices at all leaves the client staring at
// quantities, and two money columns per figure is the owner's settling view, not an offer.
const OPTIONS: OptionT<ClientMoneyAxisT>[] = [
  { value: 'net', label: 'Netto' },
  { value: 'gross', label: 'Brutto' },
]

export function MoneyAxisToggle({
  value,
  onChange,
}: {
  value: ClientMoneyAxisT
  onChange: (value: ClientMoneyAxisT) => void
}) {
  return (
    <ToggleGroup
      options={OPTIONS}
      value={value}
      onChange={onChange}
      size="lg"
      aria-label="Kwoty netto lub brutto"
    />
  )
}
