'use client'

import { useState } from 'react'
import { Ban, Banknote, Percent } from 'lucide-react'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { RabatValueField } from '@/components/kosztorys/summary/rabat-value-field'
import { SettingsSection } from '@/components/kosztorys/summary/settings-section'
import { globalDiscountForMode } from '@/lib/kosztorys/calc'
import { applyPercentRabatSchema } from '@/lib/kosztorys/percent-rabat'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'

type DiscountModeT = 'off' | 'amount' | 'percent'

const DISCOUNT_MODE_OPTIONS: SelectOptionT[] = [
  { value: 'off', label: 'Wyłączony', icon: Ban },
  { value: 'amount', label: 'Kwotowy', icon: Banknote },
  { value: 'percent', label: '%', icon: Percent },
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

// Locative of „pozycja" — „w 1 pozycji" vs „w 3 pozycjach".
function pozycji(count: number): string {
  return count === 1 ? 'pozycji' : 'pozycjach'
}

// Reads the setters straight from the editor context (the panel renders inside the provider), so no
// props thread through KosztorysTotalsPanel.
export function GlobalDiscountControl({ disabled = false }: { disabled?: boolean }) {
  const {
    globalDiscount,
    perItemDiscountTotal,
    itemsWithDiscountCount,
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
    <SettingsSection
      title="Rabat"
      subtitle="Wybierz rodzaj rabatu"
      hint={DISCOUNT_MODE_DESCRIPTIONS[mode]}
    >
      <SimpleSelect
        value={mode}
        onValueChange={changeMode}
        options={DISCOUNT_MODE_OPTIONS}
        disabled={disabled}
        variant="toolbarSm"
      />
      {mode === 'amount' && (
        <RabatValueField
          suffix="zł"
          // `String` is not a formatter — it prints all 17 digits of whatever is stored, which is
          // how a kwota persisted before the write-side rounding still reads „172024,28000000003".
          value={String(roundToCents(globalDiscount.value))}
          placeholder="zł"
          disabled={disabled}
          isValid={(n) => n >= 0}
          onApply={(n) => handleGlobalDiscountChange({ type: 'amount', value: n })}
        />
      )}
      {mode === 'percent' && (
        <RabatValueField
          suffix="%"
          value=""
          placeholder="%"
          disabled={disabled}
          isValid={(percent) => applyPercentRabatSchema.safeParse({ percent }).success}
          onApply={handleApplyPercentRabat}
          clearOnApply
          // Only asks when there is something to lose. With no rabat anywhere the write is not
          // destructive — it writes the same percent into rows that all read 0 — so a dialog there
          // would be a warning about nothing, and warnings that fire on nothing stop being read.
          confirm={
            itemsWithDiscountCount === 0
              ? undefined
              : (percent) => ({
                  title:
                    percent === 0
                      ? `Wyzerować rabat w ${itemsWithDiscountCount} ${pozycji(itemsWithDiscountCount)}?`
                      : `Wpisać ${percent}% w rabat każdej pozycji?`,
                  // Owner's ruling stands: the overwrite is not undoable and recovery is re-typing.
                  // The dialog is the guard in undo's place, so it has to say both what is lost and
                  // where the way back is — the version the action auto-saves before every apply.
                  description: `${
                    percent === 0
                      ? `Rabaty wpisane ręcznie w ${itemsWithDiscountCount} ${pozycji(itemsWithDiscountCount)} zostaną wyzerowane.`
                      : `Rabaty wpisane ręcznie w ${itemsWithDiscountCount} ${pozycji(itemsWithDiscountCount)} zostaną nadpisane.`
                  } Ctrl+Z tego nie cofnie — stan sprzed zmiany zapisuje się automatycznie w wersjach kosztorysu.`,
                  confirmLabel: percent === 0 ? 'Wyzeruj rabaty' : 'Nadpisz rabaty',
                })
          }
        />
      )}
    </SettingsSection>
  )
}
