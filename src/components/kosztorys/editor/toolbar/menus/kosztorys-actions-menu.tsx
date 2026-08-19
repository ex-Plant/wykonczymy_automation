'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  Eye,
  FileDown,
  FileStack,
  History,
  Redo2,
  Save,
  Scale as ScaleIcon,
  SpellCheck,
  Settings2,
  Share2,
  SheetIcon,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useLatestRequest } from '@/hooks/use-latest-request'
import { KosztorysShareDialog } from '@/components/kosztorys/editor/dialogs/kosztorys-share-dialog'
import { KosztorysClientViewDialog } from '@/components/kosztorys/editor/dialogs/kosztorys-client-view-dialog'
import { SavePresetDialog } from '@/components/kosztorys/editor/dialogs/save-preset-dialog'
import { SaveVersionDialog } from '@/components/kosztorys/editor/dialogs/save-version-dialog'
import { ReloadFromPresetDialog } from '@/components/kosztorys/editor/dialogs/reload-from-preset-dialog'
import { ClearKosztorysDialog } from '@/components/kosztorys/editor/dialogs/clear-kosztorys-dialog'
import { SheetCompareDialog } from '@/components/kosztorys/editor/dialogs/sheet-compare-dialog'
import { compareWithSheet, type SheetCompareResultT } from '@/lib/actions/kosztorys-import'
import { cleanItemDescriptionsAction } from '@/lib/actions/kosztorys'
import { listPresetsAction } from '@/lib/actions/kosztorys-presets'
import { getShareLinkAction } from '@/lib/actions/kosztorys-share'
import { readClientViewSettings } from '@/lib/queries/client-view-settings-endpoint'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
import { toastMessage } from '@/lib/utils/toast'
import type { PresetMetaT } from '@/lib/db/presets'

// A menu item rendered as icon + label + a muted one-line explanation, so each action says what it
// does inline (a hover tooltip inside an already-open Radix menu fights it for focus).
function MenuItemBody({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground text-xs">{description}</span>
    </div>
  )
}

// The Save-preset dialog is a controlled sibling of the menu, not a child of DropdownMenuContent —
// onSelect closes the menu, so opening the dialog from inside it would fight the menu for focus.
export function KosztorysActionsMenu() {
  const { investmentId, onOpenVersions, onTreeReplaced, openImport, undo, redo, canUndo, canRedo } =
    useKosztorysEditorContext()
  const [presetOpen, setPresetOpen] = useState(false)
  const [reloadOpen, setReloadOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareResult, setCompareResult] = useState<SheetCompareResultT | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [compareLoaded, setCompareLoaded] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareLoaded, setShareLoaded] = useState(false)
  const [existingPresets, setExistingPresets] = useState<PresetMetaT[]>([])
  const [clientViewOpen, setClientViewOpen] = useState(false)
  const [clientView, setClientView] = useState<ClientViewSettingsT | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const settingsRequest = useLatestRequest()

  // Rewrites every opis in place, so the grid is reseeded off the investment's revision token — the
  // same signal the sheet compare uses after it writes.
  function handleCleanDescriptions() {
    setCleaning(true)
    void cleanItemDescriptionsAction(investmentId)
      .then((res) => {
        if (!res.success) return toastMessage(res.error, 'error')
        if (res.data === 0) return toastMessage('Nie znaleziono nic do poprawienia', 'info')
        toastMessage(`Poprawiono opisy: ${res.data}`, 'success')
        onTreeReplaced?.()
      })
      .catch(() => toastMessage('Nie udało się poprawić opisów', 'error'))
      .finally(() => setCleaning(false))
  }

  function handleOpenPreset() {
    setPresetOpen(true)
    void listPresetsAction().then((res) => {
      if (res.success) setExistingPresets(res.data)
    })
  }

  // Fetch on the click, not inside the dialog: Radix onOpenChange never fires for a programmatic
  // `open`, so the dialog can't fetch itself. Re-fetching each open avoids showing a link that may
  // have been rotated or revoked elsewhere since last time as though it were still live.
  function handleOpenShare() {
    setShareOpen(true)
    setShareLoaded(false)
    readSettings()
    void getShareLinkAction(investmentId)
      .then((res) => {
        setShareToken(res.success ? res.data : null)
        if (!res.success) toastMessage(res.error, 'error')
      })
      .catch(() => {
        setShareToken(null)
        toastMessage('Nie udało się sprawdzić linku', 'error')
      })
      .finally(() => setShareLoaded(true))
  }

  // Same Radix reason as handleOpenShare — and re-read on every open, so the window never shows a
  // set that another session has since changed.
  // Latest-wins: both „Udostępnij" and „Ustawienia podglądu…" feed this one state, so a slow first
  // read landing after a second one would put a stale set back into the dialog — and the next
  // „Zapisz" would write that stale set over what the owner had just saved.
  function readSettings() {
    const isCurrent = settingsRequest.start()
    setClientView(null)
    void readClientViewSettings(investmentId)
      .then((settings) => {
        if (isCurrent()) setClientView(settings)
      })
      .catch(() => {
        if (isCurrent()) toastMessage('Nie udało się odczytać ustawień podglądu', 'error')
      })
  }

  function handleOpenClientView() {
    setClientViewOpen(true)
    readSettings()
  }

  // Same Radix reason as handleOpenShare. The refresh rides along with the read, so a successful
  // fetch MAY have written rows — only then does the grid need reseeding. Signalling on every open
  // would arm a remount that has nothing to remount for, and it would fire on the next unrelated
  // edit instead, taking the owner's search and sort with it.
  // Also the re-read after the owner points a column, which is why it does not touch `open`.
  function readCompare() {
    setCompareLoaded(false)
    setCompareResult(null)
    setCompareError(null)
    void compareWithSheet(investmentId)
      .then((res) => {
        setCompareResult(res.success ? res.data : null)
        setCompareError(res.success ? null : res.error)
        if (res.success && (res.data.refresh?.updated ?? 0) + (res.data.refresh?.cleared ?? 0) > 0)
          onTreeReplaced?.()
      })
      .catch(() => {
        setCompareResult(null)
        setCompareError('Nie udało się odczytać arkusza Google.')
      })
      .finally(() => setCompareLoaded(true))
  }

  function handleOpenCompare() {
    setCompareOpen(true)
    readCompare()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Opcje
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Edycja</DropdownMenuLabel>
          <DropdownMenuItem onSelect={undo} disabled={!canUndo}>
            <Undo2 />
            <MenuItemBody label="Cofnij" description="Cmd/Ctrl+Z" />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={redo} disabled={!canRedo}>
            <Redo2 />
            <MenuItemBody label="Ponów" description="Cmd/Ctrl+Shift+Z" />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleCleanDescriptions} disabled={cleaning}>
            <SpellCheck />
            <MenuItemBody
              label="Popraw literówki w opisie prac"
              description="Poprawia literówki, zbędne spacje i wielkie litery w całej rozpisce."
            />
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setClearOpen(true)}>
            <Trash2 />
            <MenuItemBody
              label="Wyczyść kosztorys…"
              description="Usuwa całą rozpiskę. Stan sprzed zapisze się w „Wersje”."
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Wersje</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setVersionOpen(true)}>
            <Save />
            <MenuItemBody
              label="Zapisz"
              description="Zapisz bieżący stan jako nazwany punkt, do którego możesz wrócić."
            />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenVersions}>
            <History />
            <MenuItemBody
              label="Wczytaj"
              description="Przywróć kosztorys do wcześniej zapisanego stanu."
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Szablony</DropdownMenuLabel>
          <DropdownMenuItem onSelect={handleOpenPreset}>
            <FileStack />
            <MenuItemBody
              label="Zapisz jako szablon…"
              description="Zapisz jako wzór do użycia na innych inwestycjach."
            />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setReloadOpen(true)}>
            <FileDown />
            <MenuItemBody
              label="Wczytaj szablon…"
              description="Zastąp całą rozpiskę zapisanym szablonem."
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Arkusz Google</DropdownMenuLabel>
          <DropdownMenuItem onSelect={openImport}>
            <SheetIcon />
            <MenuItemBody
              label="Pobierz z arkusza Google…"
              description="Wczytaj sekcje, prace, stawki i etapy z arkusza podpiętego do tej inwestycji."
            />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleOpenCompare}>
            <ScaleIcon />
            <MenuItemBody
              label="Porównaj z arkuszem…"
              description="Sprawdź, czy arkusz i aplikacja liczą to samo, i odśwież zapisane Pomiary z natury."
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Inwestor</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/podglad-inwestora/${investmentId}`} target="_blank">
              <Eye />
              <MenuItemBody
                label="Widok inwestora"
                description="Zobacz kosztorys tak, jak widzi go inwestor."
              />
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleOpenClientView}>
            <Settings2 />
            <MenuItemBody
              label="Ustawienia podglądu…"
              description="Zdecyduj, które kolumny i pozycje widzi inwestor."
            />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleOpenShare}>
            <Share2 />
            <MenuItemBody
              label="Udostępnij"
              description="Wygeneruj link, którym inwestor otworzy kosztorys bez logowania."
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SaveVersionDialog
        investmentId={investmentId}
        open={versionOpen}
        onOpenChange={setVersionOpen}
      />
      <SavePresetDialog
        investmentId={investmentId}
        open={presetOpen}
        onOpenChange={setPresetOpen}
        existingPresets={existingPresets}
      />
      <SheetCompareDialog
        investmentId={investmentId}
        open={compareOpen}
        onOpenChange={setCompareOpen}
        result={compareResult}
        error={compareError}
        loaded={compareLoaded}
        onMappingSaved={readCompare}
      />
      <ReloadFromPresetDialog
        investmentId={investmentId}
        open={reloadOpen}
        onOpenChange={setReloadOpen}
        onReloaded={() => onTreeReplaced?.()}
      />
      <ClearKosztorysDialog
        investmentId={investmentId}
        open={clearOpen}
        onOpenChange={setClearOpen}
        onCleared={() => onTreeReplaced?.()}
      />
      <KosztorysClientViewDialog
        investmentId={investmentId}
        open={clientViewOpen}
        onOpenChange={setClientViewOpen}
        settings={clientView}
        onSaved={setClientView}
      />
      <KosztorysShareDialog
        investmentId={investmentId}
        open={shareOpen}
        onOpenChange={setShareOpen}
        token={shareToken}
        loaded={shareLoaded}
        onTokenChange={setShareToken}
        settings={clientView}
        onSettingsChange={setClientView}
      />
    </>
  )
}
