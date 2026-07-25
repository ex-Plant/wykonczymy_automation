'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { applyPercentRabatSchema } from '@/lib/kosztorys/percent-rabat'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

type PropsT = {
  // Resolves true when the bulk write landed — the input clears only then.
  onApply: (percent: number) => Promise<boolean>
}

// One-shot percent-rabat bulk-apply: the typed value stamps into every item's per-item rabat
// (destructive — the parent handler owns the snapshot + optimistic rollback). Rendered only when the
// summary's global-discount toggle group is on „%"; the controlled input clears on success.
export function PercentRabatTool({ onApply }: PropsT) {
  const [raw, setRaw] = useState('')
  const [pending, setPending] = useState(false)

  const parsed = parseDecimalInput(raw)
  const percent = parsed.kind === 'value' ? parsed.value : null
  const valid = percent != null && applyPercentRabatSchema.safeParse({ percent }).success

  async function apply() {
    if (!valid || pending) return
    setPending(true)
    const ok = await onApply(percent)
    setPending(false)
    if (ok) setRaw('')
  }

  return (
    <div className="flex items-center gap-2">
      <DecimalInput
        value={raw}
        placeholder="%"
        disabled={pending}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void apply()
        }}
        className="text-chart-green"
      />
      <Button variant="outline" size="sm" disabled={!valid || pending} onClick={() => void apply()}>
        Zastosuj
      </Button>
    </div>
  )
}
