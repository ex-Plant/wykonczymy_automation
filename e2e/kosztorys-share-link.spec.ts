import { execFileSync } from 'node:child_process'
import { test, expect } from '@playwright/test'
import { waitForHydration } from './helpers'

// The share link is the one entrance with no session behind it: `(share)/layout.tsx` deliberately
// mounts no CurrentUserProvider, because the token IS the credential. `useCurrentUser` throws on a
// null context, and the totals panel below the grid is `forceMount`ed — so a session read added
// anywhere under KosztorysEditorBody → KosztorysTotalsPanel → SummaryPanelContent turns every
// investor link into a 500 while the authed app stays green (typecheck, units and every other spec
// run inside the provider). Nothing short of an anonymous browser hitting the real route sees it.
test.use({ storageState: 'e2e/.auth/user.json' })

type BandsSeed = {
  investment: number
  sections: { name: string; net: number; itemCount: number }[]
}

let seed: BandsSeed

// Same subprocess seeding as the bands spec: importing the Payload config graph pulls next/cache,
// which Playwright's module loader can't resolve. Reused rather than given its own seed — this spec
// needs any investment with a non-empty tree, and that is exactly what the bands seed builds.
test.beforeAll(() => {
  const testDbUrl = process.env.DB_POSTGRES_URL_TEST
  if (!testDbUrl) throw new Error('[share-spec] DB_POSTGRES_URL_TEST is not set — refusing to seed')
  const out = execFileSync('pnpm', ['seed:kosztorys-bands'], {
    encoding: 'utf8',
    env: { ...process.env, DB_POSTGRES_URL: testDbUrl },
  })
  const line = out.split('\n').find((l) => l.startsWith('BANDS_SEED='))
  if (!line) throw new Error(`[share-spec] seed emitted no BANDS_SEED line:\n${out}`)
  seed = JSON.parse(line.slice('BANDS_SEED='.length))
})

test('a generated share link renders the kosztorys for a visitor with no session', async ({
  page,
  browser,
  baseURL,
}) => {
  // Mint the token through the owner's real dialog rather than inserting a row — the action that
  // creates it is part of the path under test.
  await page.goto(`/inwestycje/${seed.investment}/kosztorys_v2`)
  // exact: „Opcje rozliczenia" in the totals panel matches the same prefix.
  const optionsMenu = page.getByRole('button', { name: 'Opcje', exact: true })
  await optionsMenu.waitFor()
  await waitForHydration(optionsMenu)
  await optionsMenu.click()
  await page.getByRole('menuitem', { name: 'Udostępnij' }).click()

  const dialog = page.getByRole('dialog').filter({ hasText: 'Udostępnij inwestorowi' })
  await dialog.getByRole('button', { name: 'Dalej' }).click()
  await dialog.getByRole('button', { name: 'Wygeneruj link' }).click()
  const linkField = dialog.getByRole('textbox')
  await expect(linkField).toHaveValue(/\/k\/.+/)
  const token = (await linkField.inputValue()).split('/k/')[1]

  // A context built here inherits nothing from `test.use` above, so it carries no payload-token
  // cookie — an investor opening the link in their own browser, which is the whole scenario.
  const anonymous = await browser.newContext({ storageState: undefined, baseURL })
  const visitor = await anonymous.newPage()
  try {
    const response = await visitor.goto(`/k/${token}`)
    // Catches a 404 from a token the route refuses. It does NOT catch the render throw this spec
    // exists for: verified by breaking it on purpose (a `useCurrentUser()` inside SummaryPanelContent)
    // — the server logged the throw and still answered 200, because Next had already begun streaming
    // and the failure lands in the client error boundary. The content assertions below are what went
    // red, so they are the load-bearing ones; keep them, and never trade them for a status check.
    expect(response?.status()).toBe(200)

    await expect(visitor.getByText(seed.sections[0].name).first()).toBeVisible()
    // The panel defaults to open, so its content is both mounted and visible on a fresh context —
    // the subtree the risk lives in, proven present rather than assumed.
    await expect(visitor.getByRole('radio', { name: 'Podsumowanie' })).toBeVisible()
  } finally {
    await anonymous.close()
  }
})
