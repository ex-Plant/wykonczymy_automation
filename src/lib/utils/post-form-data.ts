/**
 * POSTs multipart form data to one of our API routes and returns its parsed JSON body.
 *
 * The routes exist because a file payload outgrows the server-action body cap, and they all answer
 * a failure the same way: a JSON `{ error }` when the handler ran, and something unparseable (an
 * HTML 413/504 from the platform) when it didn't. `fallbackError` is the Polish message for that
 * second case — the only thing callers actually differ on.
 */
export async function postFormData<T>(
  route: string,
  formData: FormData,
  fallbackError: string,
): Promise<T> {
  const res = await fetch(route, { method: 'POST', body: formData })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: undefined }))
    throw new Error(body.error ?? `${fallbackError} (${res.status})`)
  }

  return res.json()
}
