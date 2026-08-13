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
  Share2,
  SheetIcon,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { KosztorysShareDialog } from '@/components/kosztorys/editor/dialogs/kosztorys-share-dialog'
import { SavePresetDialog } from '@/components/kosztorys/editor/dialogs/save-preset-dialog'
import { SaveVersionDialog } from '@/components/kosztorys/editor/dialogs/save-version-dialog'
import { ReloadFromPresetDialog } from '@/components/kosztorys/editor/dialogs/reload-from-preset-dialog'
import { SheetImportDialog } from '@/components/kosztorys/editor/dialogs/sheet-import-dialog'
import { SheetCompareDialog } from '@/components/kosztorys/editor/dialogs/sheet-compare-dialog'
import {
  compareWithSheet,
  previewKosztorysImport,
  type ImportPreviewT,
} from '@/lib/actions/kosztorys-import'
import type { SheetComparisonT } from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import { listPresetsAction } from '@/lib/actions/kosztorys-presets'
import { getShareLinkAction } from '@/lib/actions/kosztorys-share'
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
  const { investmentId, onOpenVersions, onTreeReplaced, undo, redo, canUndo, canRedo } =
    useKosztorysEditorContext()
  const [presetOpen, setPresetOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [reloadOpen, setReloadOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreviewT | null>(null)
  const [importLoaded, setImportLoaded] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [comparison, setComparison] = useState<SheetComparisonT | null>(null)
  const [compareLoaded, setCompareLoaded] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareLoaded, setShareLoaded] = useState(false)
  const [existingPresets, setExistingPresets] = useState<PresetMetaT[]>([])

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

  // Fired on the click for the same Radix reason as handleOpenShare: a programmatic `open` never
  // triggers onOpenChange, so the dialog cannot fetch its own report.
  function handleOpenImport() {
    setImportOpen(true)
    setImportLoaded(false)
    setImportPreview(null)
    void previewKosztorysImport(investmentId)
      .then((res) => {
        setImportPreview(res.success ? res.data : null)
        if (!res.success) toastMessage(res.error, 'error', 6000)
      })
      .catch(() => {
        setImportPreview(null)
        toastMessage('Nie udało się odczytać arkusza', 'error')
      })
      .finally(() => setImportLoaded(true))
  }

  function handleOpenCompare() {
    setCompareOpen(true)
    setCompareLoaded(false)
    setComparison(null)
    void compareWithSheet(investmentId)
      .then((res) => {
        setComparison(res.success ? res.data : null)
        if (!res.success) toastMessage(res.error, 'error', 6000)
      })
      .catch(() => {
        setComparison(null)
        toastMessage('Nie udało się odczytać arkusza', 'error')
      })
      .finally(() => setCompareLoaded(true))
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
          <DropdownMenuItem onSelect={undo} disabled={!canUndo}>
            <Undo2 />
            <MenuItemBody label="Cofnij" description="Cmd/Ctrl+Z" />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={redo} disabled={!canRedo}>
            <Redo2 />
            <MenuItemBody label="Ponów" description="Cmd/Ctrl+Shift+Z" />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
          <DropdownMenuItem onSelect={handleOpenPreset}>
            <FileStack />
            <MenuItemBody
              label="Zapisz jako szablon…"
              description="Zapisz jako wzór do użycia na innych inwestycjach."
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setReloadOpen(true)}>
            <FileDown />
            <MenuItemBody
              label="Wczytaj szablon…"
              description="Zastąp całą rozpiskę zapisanym szablonem."
            />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleOpenImport}>
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
              description="Sprawdź, czy arkusz i aplikacja liczą to samo — bez zapisywania czegokolwiek."
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/podglad-klienta/${investmentId}`} target="_blank">
              <Eye />
              <MenuItemBody
                label="Widok klienta"
                description="Zobacz kosztorys tak, jak widzi go klient."
              />
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleOpenShare}>
            <Share2 />
            <MenuItemBody
              label="Udostępnij"
              description="Wygeneruj link, którym klient otworzy kosztorys bez logowania."
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
      <SheetImportDialog
        investmentId={investmentId}
        open={importOpen}
        onOpenChange={setImportOpen}
        preview={importPreview}
        loaded={importLoaded}
        onImported={() => {
          setImportPreview(null)
          onTreeReplaced?.()
        }}
      />
      <SheetCompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        comparison={comparison}
        loaded={compareLoaded}
      />
      <ReloadFromPresetDialog
        investmentId={investmentId}
        open={reloadOpen}
        onOpenChange={setReloadOpen}
        onReloaded={() => onTreeReplaced?.()}
      />
      <KosztorysShareDialog
        investmentId={investmentId}
        open={shareOpen}
        onOpenChange={setShareOpen}
        token={shareToken}
        loaded={shareLoaded}
        onTokenChange={setShareToken}
      />
    </>
  )
}
