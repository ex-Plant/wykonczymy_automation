import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAuth = vi.fn()
const redirect = vi.fn()

vi.mock('@/lib/auth/require-auth', () => ({ requireAuth }))
vi.mock('next/navigation', () => ({ redirect }))

const { requireManagementPage } = await import('@/lib/auth/require-management-page')

const OWNER = { id: 1, role: 'OWNER' as const, email: 'o@x.pl', name: 'O' }

beforeEach(() => {
  requireAuth.mockReset()
  redirect.mockReset()
})

// The regression this guard exists for: `kosztorys_v2` sat two failure modes in one Promise.all —
// getKosztorysTree throws, requireInvestmentOr404 redirects — and whichever rejected first decided
// what a non-management session saw. Throwing wins that race, so an EMPLOYEE landed on error.tsx
// instead of the login page. A page guard has exactly one correct answer here, and it is a redirect.
describe('requireManagementPage', () => {
  it.each([
    ['a session without the role', { success: false, error: 'Brak uprawnień' }],
    ['no session at all', { success: false, error: 'Nie jesteś zalogowany' }],
  ])('redirects to the login page on %s — never throws', async (_case, authResult) => {
    requireAuth.mockResolvedValue(authResult)

    await expect(requireManagementPage()).resolves.toBeUndefined()
    expect(redirect).toHaveBeenCalledWith('/zaloguj')
  })

  it('returns the session user on a management session, without redirecting', async () => {
    requireAuth.mockResolvedValue({ success: true, user: OWNER })

    await expect(requireManagementPage()).resolves.toEqual(OWNER)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('refuses an EMPLOYEE — the role set it asks for is the management one', async () => {
    requireAuth.mockResolvedValue({ success: false, error: 'Brak uprawnień' })

    await requireManagementPage()

    const [allowedRoles] = requireAuth.mock.calls[0]
    expect(allowedRoles).not.toContain('EMPLOYEE')
  })
})
