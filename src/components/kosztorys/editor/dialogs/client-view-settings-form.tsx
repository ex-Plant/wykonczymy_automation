'use client'

import type { ReactNode } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Description } from '@/components/ui/description'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { CLIENT_VIEW_GROUPS, COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'

type PropsT = {
  // `null` while the caller's read is in flight — the placeholder is rendered here so both dialogs
  // don't each carry the same branch.
  value: ClientViewSettingsT | null
  onChange: (value: ClientViewSettingsT) => void
  disabled?: boolean
}

function CheckboxRow({
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <label className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(state) => onCheckedChange(state === true)}
      />
      {children}
    </label>
  )
}

/**
 * The settings body on its own, so „Ustawienia podglądu…" and „Udostępnij" render the same one
 * rather than growing a second copy that could drift. It owns no persistence and no buttons — the
 * caller supplies both, which is what makes it reusable as a step.
 *
 * A tick means „inwestor to widzi", like every other picker in the editor; the stored shape is the
 * inverse (hidden keys), so the client's document is defined by what was taken away from the
 * allowlist and a column added to the allowlist later shows up on its own.
 */
export function ClientViewSettingsForm({ value, onChange, disabled }: PropsT) {
  const { conditionCounts } = useKosztorysEditorContext()
  const emptyCount = conditionCounts.get('client-empty') ?? 0
  if (!value) return <p className="text-muted-foreground text-sm">Wczytywanie…</p>
  const hidden = new Set(value.hiddenColumns)

  const toggleColumn = (key: string, visible: boolean) => {
    const next = new Set(hidden)
    if (visible) next.delete(key)
    else next.add(key)
    onChange({ ...value, hiddenColumns: [...next] })
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
      {CLIENT_VIEW_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="text-muted-foreground px-2 text-xs font-medium">{group.label}</p>
          {group.keys.map((key) => (
            <CheckboxRow
              key={key}
              checked={!hidden.has(key)}
              disabled={disabled}
              onCheckedChange={(visible) => toggleColumn(key, visible)}
            >
              {COLUMN_LABELS[key] ?? key}
            </CheckboxRow>
          ))}
        </div>
      ))}
      <div className="flex flex-col gap-0.5 border-t pt-3">
        <p className="text-muted-foreground px-2 text-xs font-medium">Pozycje</p>
        <CheckboxRow
          checked={value.hideEmptyRows}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, hideEmptyRows: checked })}
        >
          Ukryj pozycje bez przedmiaru i bez wykonanej pracy ({emptyCount})
        </CheckboxRow>
        <Description size="xs">
          Takie pozycje nie wnoszą nic do żadnej kwoty, więc ukrycie ich nie zmienia podsumowania.
        </Description>
      </div>
    </div>
  )
}
