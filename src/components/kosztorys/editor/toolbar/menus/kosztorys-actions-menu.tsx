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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { KosztorysShareDialog } from '@/components/kosztorys/editor/dialogs/kosztorys-share-dialog'
import { SavePresetDialog } from '@/components/kosztorys/editor/dialogs/save-preset-dialog'
import { SaveVersionDialog } from '@/components/kosztorys/editor/dialogs/save-version-dialog'
import { ReloadFromPresetDialog } from '@/components/kosztorys/editor/dialogs/reload-from-preset-dialog'
import { SheetCompareDialog } from '@/components/kosztorys/editor/dialogs/sheet-compare-dialog'
import { compareWithSheet, type SheetCompareResultT } from '@/lib/actions/kosztorys-import'
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
  const { investmentId, onOpenVersions, onTreeReplaced, openImport, undo, redo, canUndo, canRedo } =
    useKosztorysEditorContext()
  const [presetOpen, setPresetOpen] = useState(false)
  const [reloadOpen, setReloadOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareResult, setCompareResult] = useState<SheetCompareResultT | null>(null)
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

  // Same Radix reason as handleOpenShare. The refresh rides along with the read, so a successful
  // fetch MAY have written rows — only then does the grid need reseeding. Signalling on every open
  // would arm a remount that has nothing to remount for, and it would fire on the next unrelated
  // edit instead, taking the owner's search and sort with it.
  function handleOpenCompare() {
    setCompareOpen(true)
    setCompareLoaded(false)
    setCompareResult(null)
    void compareWithSheet(investmentId)
      .then((res) => {
        setCompareResult(res.success ? res.data : null)
        if (!res.success) toastMessage(res.error, 'error', 6000)
        else if (res.data.refresh.updated + res.data.refresh.cleared > 0) onTreeReplaced?.()
      })
      .catch(() => {
        setCompareResult(null)
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
          <DropdownMenuLabel>Edycja</DropdownMenuLabel>
          <DropdownMenuItem onSelect={undo} disabled={!canUndo}>
            <Undo2 />
            <MenuItemBody label="Cofnij" description="Cmd/Ctrl+Z" />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={redo} disabled={!canRedo}>
            <Redo2 />
            <MenuItemBody label="Ponów" description="Cmd/Ctrl+Shift+Z" />
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
          <DropdownMenuLabel>Klient</DropdownMenuLabel>
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
      <SheetCompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        result={compareResult}
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
