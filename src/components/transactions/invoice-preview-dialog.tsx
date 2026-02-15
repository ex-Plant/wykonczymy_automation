'use client'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Printer } from 'lucide-react'
import NextImage from 'next/image'

type InvoicePreviewDialogPropsT = {
  readonly url: string
  readonly filename: string | null
  readonly mimeType: string | null
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function InvoicePreviewDialog({
  url,
  filename,
  mimeType,
  open,
  onOpenChange,
}: InvoicePreviewDialogPropsT) {
  const isImage = mimeType?.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'
  const displayName = filename ?? 'Faktura'

  function handlePrint() {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const content = isImage
      ? `<img src="${url}" alt="${displayName}" style="max-width:100%;height:auto" onload="window.print();window.close()" />`
      : isPdf
        ? `<iframe src="${url}" style="width:100%;height:100vh;border:none" onload="window.print();window.close()"></iframe>`
        : ''

    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>${displayName}</title></head><body style="margin:0">${content}</body></html>`,
    )
    printWindow.document.close()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{displayName}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
          {isImage && (
            <div className="relative h-[70vh] w-full">
              <NextImage src={url} alt={displayName} fill className="object-contain" />
            </div>
          )}
          {isPdf && (
            <iframe src={url} title={displayName} className="h-[70vh] w-full rounded border-0" />
          )}
          {!isImage && !isPdf && (
            <p className="text-muted-foreground text-sm">
              Podgląd niedostępny dla tego typu pliku.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handlePrint}>
            <Printer />
            Drukuj
          </Button>
          <Button variant="outline" asChild>
            <a href={url} download={filename ?? ''} target="_blank" rel="noopener noreferrer">
              <Download />
              Pobierz
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
