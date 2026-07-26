'use client'

import { SimpleSelect } from '@/components/ui/simple-select'
import { Description } from '@/components/ui/description'
import { ZeroVatWarning } from '@/components/kosztorys/summary/zero-vat-warning'
import { SETTLEMENT_MODE_OPTIONS, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'

type PropsT = {
  value: SettlementModeT
  onChange: (mode: SettlementModeT) => void
  vatRate: number
}

// The owner's only edit surface for the stored settlement mode — the panel renders it, the
// investment owns it. Pinned beside the view toggle rather than in the scrolling settings bar,
// because the reader who wonders why figures aren't moving is looking here.
export function SettlementModeSelect({ value, onChange, vatRate }: PropsT) {
  return (
    <div className="my-2 flex flex-col gap-2">
      <Description className="max-w-xs" size="sm" withIcon={false}>
        Wybierz jak rozliczana będzie inwestycja.
      </Description>
      <SimpleSelect
        value={value}
        onValueChange={(next) => onChange(next as SettlementModeT)}
        options={SETTLEMENT_MODE_OPTIONS}
        disabled={vatRate === 0}
        variant="toolbar"
      />
      {vatRate === 0 && <ZeroVatWarning />}
    </div>
  )
}
