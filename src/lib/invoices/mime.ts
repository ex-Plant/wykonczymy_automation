// Whether an invoice page can be rendered at all, and how. Predicates rather than inline
// `startsWith` checks because the preview asks the same question in four places — for the page on
// screen, for the printable subset, again inside the print loop, and for the trigger's icon.
// `mimeType` is nullable: a media row uploaded before the field existed carries none.

export function isImageMime(mimeType: string | null | undefined): boolean {
  return mimeType?.startsWith('image/') ?? false
}

export function isPdfMime(mimeType: string | null | undefined): boolean {
  return mimeType === 'application/pdf'
}

export function isPreviewableMime(mimeType: string | null | undefined): boolean {
  return isImageMime(mimeType) || isPdfMime(mimeType)
}
