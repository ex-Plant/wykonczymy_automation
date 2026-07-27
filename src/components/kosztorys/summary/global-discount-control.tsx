'use client'

import { useState } from 'react'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { RabatValueField } from '@/components/kosztorys/summary/rabat-value-field'
import { globalDiscountForMode } from '@/lib/kosztorys/calc'
import { applyPercentRabatSchema } from '@/lib/kosztorys/percent-rabat'
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
  const {
    globalDiscount,
    perItemDiscountTotal,
    handleGlobalDiscountChange,
    handleApplyPercentRabat,
  } = useKosztorysEditorContext()

  // Percent is a one-shot bulk-write with no stored footprint, so „off vs percent" can't be told apart
  // from globalDiscount alone — the picked mode is its own local state. A stored amount discount seeds
  // the group onto „Kwotowy".
  const [mode, setMode] = useState<DiscountModeT>(globalDiscount.type != null ? 'amount' : 'off')

  // The stored type can move without the user touching the select — a failed save rolling the
  // optimistic value back, or Ctrl+Z replaying an earlier discount. Neither reaches this local state,
  // so without the resync the select reads „Wyłączony" while the data still applies the discount (or
  // „Kwotowy" over a kwota that is no longer stored). Clearing only pulls „Kwotowy" back to
  // „Wyłączony": „%" also sits at null and is not something an undo should walk away from.
  const [seenType, setSeenType] = useState(globalDiscount.type)
  if (seenType !== globalDiscount.type) {
    setSeenType(globalDiscount.type)
    if (globalDiscount.type != null) setMode('amount')
    else if (mode === 'amount') setMode('off')
  }

  // The mode itself is the decision — „Kwotowy" suppresses per-item rabat at any kwota — so entering
  // it must write straight away rather than wait for a kwota that may never be typed. Leaving it
  // (→ „Wyłączony" or „%") clears the stored discount so the two never coexist; that mutual exclusion
  // is what keeps the percent one-shot always effective.
  function changeMode(next: string) {
    const nextMode = next as DiscountModeT
    setMode(nextMode)
    handleGlobalDiscountChange(globalDiscountForMode(nextMode, perItemDiscountTotal))
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
          <span className="text-muted-foreground text-xs">Kwota</span>
          <RabatValueField
            value={String(globalDiscount.value)}
            placeholder="zł"
            disabled={disabled}
            isValid={(n) => n >= 0}
            onApply={(n) => handleGlobalDiscountChange({ type: 'amount', value: n })}
          />
          <span className="text-muted-foreground text-xs">zł</span>
        </div>
      )}
      {mode === 'percent' && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Procent</span>
          <RabatValueField
            value=""
            placeholder="%"
            disabled={disabled}
            isValid={(percent) => applyPercentRabatSchema.safeParse({ percent }).success}
            onApply={handleApplyPercentRabat}
            clearOnApply
          />
          <span className="text-muted-foreground text-xs">%</span>
        </div>
      )}
    </LabeledModeSelect>
  )
}
