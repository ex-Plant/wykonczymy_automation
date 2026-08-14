'use client'

import { useCallback, useState } from 'react'
import { previewKosztorysImport, type ImportPreviewT } from '@/lib/actions/kosztorys-import'
import { toastMessage } from '@/lib/utils/toast'

type OptionsT = { investmentId: number; onTreeReplaced?: () => void }

/**
 * „Pobierz z arkusza Google" as a single piece of state, because it now has two triggers — the
 * „Opcje" menu and the empty-kosztorys screen, which sit in different subtrees. One owner above both
 * keeps one dialog on the page; a copy per trigger would mean two sheet reads racing each other.
 *
 * The preview is fetched on the click rather than by the dialog: a programmatically-opened Radix
 * dialog never fires `onOpenChange`, so it cannot fetch its own report.
 */
export function useSheetImport({ investmentId, onTreeReplaced }: OptionsT) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<ImportPreviewT | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Also the re-read after the owner points a column: the pointing is stored per kosztorys, so the
  // same preview call answers with it in place and the window updates without being reopened.
  const readPreview = useCallback(() => {
    setLoaded(false)
    setPreview(null)
    void previewKosztorysImport(investmentId)
      .then((res) => {
        setPreview(res.success ? res.data : null)
        if (!res.success) toastMessage(res.error, 'error', 6000)
      })
      .catch(() => {
        setPreview(null)
        toastMessage('Nie udało się odczytać arkusza', 'error')
      })
      .finally(() => setLoaded(true))
  }, [investmentId])

  const openImport = useCallback(() => {
    setOpen(true)
    readPreview()
  }, [readPreview])

  return {
    openImport,
    importDialogProps: {
      investmentId,
      open,
      onOpenChange: setOpen,
      preview,
      loaded,
      onMappingSaved: readPreview,
      onImported: () => {
        setPreview(null)
        onTreeReplaced?.()
      },
    },
  }
}
