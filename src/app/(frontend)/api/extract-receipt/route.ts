import { NextResponse } from 'next/server'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { scanReceipt } from '@/lib/ai/scan-receipt'
import { logError } from '@/lib/utils/log-error'

/**
 * POST /api/extract-receipt
 * Accepts FormData with N 'files' (the pages of ONE invoice, in order) and a JSON
 * 'otherCategoryNames' array. Returns { data } on success.
 *
 * An API route, not a server action: a multi-page scan blows past the server-action body cap,
 * which surfaces as an uncatchable 413 rather than an error the form can report. The scan itself
 * still persists NOTHING — the files are uploaded once, at submit.
 */
export async function POST(request: Request) {
  const user = await getCurrentUserJwt()
  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File)
    if (files.length === 0) {
      return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })
    }
    if (files.some((file) => !file.type)) {
      return NextResponse.json({ error: 'Nieobsługiwany typ pliku' }, { status: 400 })
    }

    const raw = formData.get('otherCategoryNames')
    const otherCategoryNames: string[] = typeof raw === 'string' ? JSON.parse(raw) : []

    return NextResponse.json({ data: await scanReceipt(files, otherCategoryNames) })
  } catch (err) {
    // TODO(EX-449) SENTRY-REQUIRED: receipt extraction failures must be captured once Sentry is
    // wired — they are silent AI/provider errors users can't self-report.
    logError('[extract-receipt] Scan failed:', err)
    const message = err instanceof Error ? err.message : 'Błąd odczytu paragonu'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
