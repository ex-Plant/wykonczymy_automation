/**
 * Downloads a file from an external URL via API route proxy.
 * Requires `/api/download` route handler to bypass CORS.
 * Must be called from a client component ('use client').
 */
export default async function downloadFile(
  fileUrl: string | undefined,
  fileName = 'file',
  baseUrl = '/api/download',
): Promise<void> {
  if (!fileUrl) throw new Error('Invalid file URL')

  const downloadUrl = `${baseUrl}?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName ?? 'download')}`

  const res = await fetch(downloadUrl)

  if (!res.ok) throw new Error(`Download failed: ${res.status}`)

  const blob = await res.blob()

  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
