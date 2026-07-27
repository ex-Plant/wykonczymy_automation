'use client'

import type { ReactNode } from 'react'
import { LabeledModeSelect } from '@/components/kosztorys/summary/labeled-mode-select'
import { ZeroVatWarning } from '@/components/kosztorys/summary/zero-vat-warning'
import { SETTLEMENT_MODE_OPTIONS, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'

const MODE_DESCRIPTIONS: Record<SettlementModeT, ReactNode> = {
  GROSS: 'Kwota do zapłaty dla inwestora liczona po cenach brutto.',
  NET: (
    <>
      Kwota do zapłaty dla inwestora liczona po cenach netto.{' '}
      <strong className="font-semibold">Sposób liczenia materiałów ustawiasz poniżej.</strong>
    </>
  ),
  MIXED: (
    <>
      Kwota do zapłaty dla inwestora rozbita na brutto i netto. {'\n'}
      Dodając wydatek inwestycyjny określasz czy ma on trafiać do puli netto czy puli brutto, na tej
      podstawie liczy się suma do zapłaty poszczególnych kategorii. {'\n'}
      <strong className="font-semibold">Sposób liczenia materiałów ustawiasz poniżej.</strong>
    </>
  ),
}

type PropsT = {
  value: SettlementModeT
  onChange: (mode: SettlementModeT) => void
  vatRate: number
  disabled?: boolean
}

// The owner's only edit surface for the stored settlement mode — the panel renders it, the
// investment owns it. Pinned beside the view toggle rather than in the scrolling settings bar,
// because the reader who wonders why figures aren't moving is looking here.
export function SettlementModeSelect({ value, onChange, vatRate, disabled = false }: PropsT) {
  return (
    <LabeledModeSelect
      label="Rozliczenie robocizny"
      value={value}
      onValueChange={(next) => onChange(next as SettlementModeT)}
      options={SETTLEMENT_MODE_OPTIONS}
      description={MODE_DESCRIPTIONS[value]}
      disabled={disabled || vatRate === 0}
    >
      {vatRate === 0 && <ZeroVatWarning />}
    </LabeledModeSelect>
  )
}
