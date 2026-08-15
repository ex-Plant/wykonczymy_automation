'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Description } from '@/components/ui/description'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { CLIENT_VIEW_GROUPS } from '@/components/kosztorys/editor/dialogs/client-view-groups'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import {
  saveClientViewDefaultsAction,
  saveClientViewSettingsAction,
} from '@/lib/actions/kosztorys-client-view'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
import { toastMessage } from '@/lib/utils/toast'

type FormPropsT = {
  value: ClientViewSettingsT
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
 * The settings body on its own, so „Udostępnij" can render it as its first step rather than growing
 * a second copy that could drift from this one. It owns no persistence and no buttons — the caller
 * supplies both, which is what makes it reusable as a step.
 *
 * A tick means „klient to widzi", like every other picker in the editor; the stored shape is the
 * inverse (hidden keys), so the client's document is defined by what was taken away from the
 * allowlist and a column added to the allowlist later shows up on its own.
 */
export function ClientViewSettingsForm({ value, onChange, disabled }: FormPropsT) {
  const { conditionCounts } = useKosztorysEditorContext()
  const emptyCount = conditionCounts.get('client-empty') ?? 0
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

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  // Fetched by the parent on the menu click — Radix never fires onOpenChange for a programmatic
  // `open`, the same reason the share dialog takes its token from above.
  settings: ClientViewSettingsT | null
  onSaved: (settings: ClientViewSettingsT) => void
}

// Nothing is written until „Zapisz": closing the window leaves the client's link exactly as it was,
// so the owner can look through the list without deciding anything.
export function KosztorysClientViewDialog({
  investmentId,
  open,
  onOpenChange,
  settings,
  onSaved,
}: PropsT) {
  const [draft, setDraft] = useState<ClientViewSettingsT | null>(settings)
  const [propsSettings, setPropsSettings] = useState(settings)
  if (propsSettings !== settings) {
    setPropsSettings(settings)
    setDraft(settings)
  }
  const [pending, startTransition] = useTransition()

  const save = (asDefaults: boolean) =>
    startTransition(async () => {
      if (!draft) return
      // „Zapisz jako domyślne" saves this investment too, never only the firm-wide default: the
      // default applies to investments with no settings of their own, so writing it alone would
      // leave the kosztorys the owner is looking at unchanged by the button they just pressed.
      const res = await saveClientViewSettingsAction(investmentId, draft)
      if (!res.success) return toastMessage(res.error, 'error')
      if (asDefaults) {
        const defaults = await saveClientViewDefaultsAction(draft)
        if (!defaults.success) return toastMessage(defaults.error, 'error')
      }
      onSaved(draft)
      toastMessage(
        asDefaults ? 'Zapisano — te ustawienia są teraz domyślne.' : 'Zapisano ustawienia.',
        'success',
      )
      onOpenChange(false)
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader
          title="Ustawienia podglądu klienta"
          description="Zaznacz, co klient widzi w udostępnionym kosztorysie. Ceny podwykonawców nie pojawiają się w nim nigdy."
        />
        {!draft ? (
          <p className="text-muted-foreground text-sm">Wczytywanie…</p>
        ) : (
          <ClientViewSettingsForm value={draft} onChange={setDraft} disabled={pending} />
        )}
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={!draft || pending}
            onClick={() => save(true)}
          >
            Zapisz jako domyślne
          </Button>
          <Button size="sm" disabled={!draft || pending} onClick={() => save(false)}>
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
