import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { uploadFile } from '@/lib/utils/upload-file'
import { logError } from '@/lib/utils/log-error'

/**
 * POST /api/upload-file
 * Accepts FormData with a single 'file' field.
 * Returns { mediaId } on success.
 *
 * Uses an API route (not a server action) to avoid the server action body size limit.
 * Client-side compression reduces file size before upload, but this route
 * has no artificial cap — PDFs and edge cases pass through without issues.
 */
export async function POST(request: Request) {
  const auth = await requireAuth(MANAGEMENT_ROLES)
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const mediaId = await uploadFile(payload, file)

    return NextResponse.json({ mediaId })
  } catch (err) {
    logError('[upload-file] Upload failed:', err)
    const message = err instanceof Error ? err.message : 'Upload nie powiódł się'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
