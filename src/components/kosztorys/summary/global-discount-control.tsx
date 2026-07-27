'use client'

import { useState } from 'react'
import { DecimalField } from '@/components/ui/decimal-field'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PercentRabatTool } from '@/components/kosztorys/summary/percent-rabat-tool'
import { LabeledModeSelect } from '@/components/ui/labeled-mode-select'
import type { SelectOptionT } from '@/components/ui/simple-select'

type DiscountModeT = 'off' | 'amount' | 'percent'

const DISCOUNT_MODE_OPTIONS: SelectOptionT[] = [
  { value: 'off', label: 'Wyłączony' },
  { value: 'amount', label: 'Kwotowy' },
  { value: 'percent', label: '%' },
]

// Rabat is a client concession only (calc.ts netForQtyForView) — it never reaches the subcontractor
// views, so their prices stay whatever the plane sets.
const DISCOUNT_MODE_DESCRIPTIONS: Record<DiscountModeT, string> = {
  off: 'Rabaty dodane do poszczególnych pozycji nadal wpływają na kwotę rozliczenia.',
  amount:
    'Kwota netto odejmowana raz od sumy wykonanych prac. Nie łączy się z rabatami per pozycja — zastępuje je. Rabat nie wpływa na ceny podwykonawców.',
  percent:
    'Jednorazowo wpisuje ten sam % w rabat każdej pozycji, nadpisując istniejące. Rabat nie wpływa na ceny podwykonawców.',
}

// Reads the setters straight from the editor context (the panel renders inside the provider), so no
// props thread through KosztorysTotalsPanel.
export function GlobalDiscountControl({ disabled = false }: { disabled?: boolean }) {
  const { globalDiscount, handleGlobalDiscountChange, handleApplyPercentRabat } =
    useKosztorysEditorContext()

  // Percent is a one-shot bulk-write with no stored footprint, so „off vs percent" can't be told apart
  // from globalDiscount alone — the picked mode is its own local state. A stored amount discount seeds
  // the group onto „Kwotowy".
  const [mode, setMode] = useState<DiscountModeT>(globalDiscount.type != null ? 'amount' : 'off')

  // A stored discount reappearing without the user picking it means the save failed and the optimistic
  // value rolled back — that revert reaches `globalDiscount` but has no way into this local state, so
  // without the resync the select reads „Wyłączony" while the data still applies the discount. Only the
  // null→stored direction is corrected; the reverse is the user's own `changeMode`, which may have gone
  // to „%" rather than „Wyłączony".
  const [seenType, setSeenType] = useState(globalDiscount.type)
  if (seenType !== globalDiscount.type) {
    setSeenType(globalDiscount.type)
    if (globalDiscount.type != null) setMode('amount')
  }

  function changeMode(next: string) {
    setMode(next as DiscountModeT)
    // Amount is the only stored mode; leaving it (→ off or %) clears the stored discount so the two
    // never coexist — that mutual exclusion is what keeps the percent one-shot always effective.
    if (next !== 'amount' && globalDiscount.type != null)
      handleGlobalDiscountChange({ type: null, value: 0 })
  }

  return (
    <LabeledModeSelect
      label="Rabat globalny"
      value={mode}
      onValueChange={changeMode}
      options={DISCOUNT_MODE_OPTIONS}
      description={DISCOUNT_MODE_DESCRIPTIONS[mode]}
      disabled={disabled}
    >
      {mode === 'amount' && (
        <div className="flex items-center gap-2">
          <DecimalField
            label="Kwota"
            value={globalDiscount.value}
            valueClassName="text-chart-green"
            min={0}
            emptyAs={0}
            disabled={disabled}
            onCommit={(n) => handleGlobalDiscountChange({ type: 'amount', value: n })}
          />
          <span className="text-muted-foreground text-xs">zł</span>
        </div>
      )}
      {mode === 'percent' && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Procent</span>
          <PercentRabatTool onApply={handleApplyPercentRabat} />
          <span className="text-muted-foreground text-xs">%</span>
        </div>
      )}
    </LabeledModeSelect>
  )
}
