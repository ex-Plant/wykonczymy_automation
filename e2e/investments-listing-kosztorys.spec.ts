import { execFileSync } from 'node:child_process'
import { test, expect, type Page } from '@playwright/test'
import { formatNet } from '@/lib/kosztorys/format'
import { parsePln, waitForHydration } from './helpers'

// The staleness guard for the read-switch (EX-555): since the listing reads robocizna from the
// kosztorys, a kosztorys write has to invalidate the listing's cached figures. Nothing below the
// browser can see that — the SQL is right, the TS is right, and the page still shows yesterday's
// number because the write never touched the tag the listing is cached under.
//
// So the one thing this spec must never do is click „Odśwież dane" between the edit and the read.
// That button revalidates the whole layout by hand; a test that presses it proves the app can be
// forced to be correct, which is not the property in question.
test.use({ storageState: 'e2e/.auth/user.json' })

type ReconSeed = { mismatch: number; match: number; matchName: string; sumaPracNet: number }

let seed: ReconSeed

// Reuses the reconciliation seed: its „match" investment is one no-discount item at 100 × qtyDone 5,
// so „Suma prac wykonanych" is exactly 500 and a qty change moves marża by a number we can name.
//
// The single „Odśwież dane" here is a SETUP step, not the workaround this spec forbids: a freshly
// seeded investment is invisible to the warm reference-data cache, so without it the baseline read
// has nothing to read. It happens before the measurement — the edit that follows gets no such help.
test.beforeAll(async ({ browser }) => {
  const testDbUrl = process.env.DB_POSTGRES_URL_TEST
  if (!testDbUrl)
    throw new Error('[listing-kosztorys] DB_POSTGRES_URL_TEST is not set — refusing to seed')
  const out = execFileSync('pnpm', ['seed:kosztorys-recon'], {
    encoding: 'utf8',
    env: { ...process.env, DB_POSTGRES_URL: testDbUrl },
  })
  const line = out.split('\n').find((l) => l.startsWith('RECON_SEED='))
  if (!line) throw new Error(`[listing-kosztorys] seed emitted no RECON_SEED line:\n${out}`)
  seed = JSON.parse(line.slice('RECON_SEED='.length))

  const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' })
  try {
    await page.goto('/')
    const refresh = page.getByRole('button', { name: 'Odśwież dane' })
    await waitForHydration(refresh)
    await refresh.click()
    await page.getByText('Dane odświeżone').waitFor()
  } finally {
    await page.close()
  }
})

// Marża for the seeded investment, read off the listing. The row is found by the investment's name
// cell; marża is the column headed „Marża" (ADMIN/OWNER only — the E2E user is OWNER).
async function readMargin(page: Page, investmentName: string): Promise<number> {
  await page.goto('/inwestycje')
  const headers = page.locator('table thead th')
  await headers.first().waitFor()
  const headerTexts = await headers.allTextContents()
  const marginIndex = headerTexts.findIndex((text) => text.trim().startsWith('Marża'))
  if (marginIndex < 0)
    throw new Error(`no „Marża" column on /inwestycje: ${headerTexts.join(' | ')}`)

  const row = page.locator('table tbody tr').filter({ hasText: investmentName }).first()
  await row.waitFor()
  return parsePln((await row.locator('td').nth(marginIndex).textContent()) ?? '')
}

// Overwrite the „Etap 1" quantity on the single seeded item. Column position is read from the header
// rather than hard-coded: the stage columns sit after a variable block of item columns, and pinning
// an index here would make this spec fail on an unrelated column change instead of on staleness.
async function setStageQty(page: Page, investmentId: number, qty: number): Promise<void> {
  await page.goto(`/inwestycje/${investmentId}/kosztorys_v2`)
  const headerCells = page.locator('.dsg-row.dsg-row-header .dsg-cell')
  await headerCells.first().waitFor()
  const headerTexts = await headerCells.allTextContents()
  const stageIndex = headerTexts.findIndex((text) => text.trim() === 'Etap 1')
  if (stageIndex < 0)
    throw new Error(`no „Etap 1" column in the editor: ${headerTexts.join(' | ')}`)

  // Podsumowanie is a bottom panel that opens to full height OVER the grid, so while it is open every
  // click on a cell lands on the panel instead. Fold it away before editing, unfold it after. Its
  // toggle stacks both labels in one button, so the accessible name carries „Pokaż" and „Schowaj" at
  // once — the panel's own Collapsible `data-state` is the only honest read of which way it is.
  const summaryToggle = page.getByRole('button', { name: /podsumowanie/i }).first()
  const summaryPanel = page.locator('.shadow-panel[data-state]').first()
  await summaryToggle.waitFor()
  if ((await summaryPanel.getAttribute('data-state')) === 'open') await summaryToggle.click()
  await expect(summaryPanel).toHaveAttribute('data-state', 'closed')

  // Section bands and the „Razem" footer ride the grid as ordinary `.dsg-row`s, so „the first
  // non-header row" is the band, not the item — excluding them by class is what makes `.first()` the
  // seeded Pozycja 1.
  const itemRow = page
    .locator(
      '.dsg-row:not(.dsg-row-header):not(.kosztorys-section-header):not(.kosztorys-section-footer)',
    )
    .first()
  const cell = itemRow.locator('.dsg-cell').nth(stageIndex)
  await cell.click()
  await cell.locator('input').fill(String(qty))
  await page.keyboard.press('Enter')

  // The write is a server action fired from the grid. Confirm it landed HERE — otherwise a listing
  // that never moved could mean the edit never happened, and the spec would blame the cache.
  await summaryToggle.click()
  await expect(page.getByText(formatNet(qty * 100)).first()).toBeVisible({ timeout: 15_000 })
}

test('a kosztorys qty change moves marża on the listing without a manual refresh', async ({
  page,
}) => {
  const before = await readMargin(page, seed.matchName)

  await setStageQty(page, seed.match, 10)

  // Straight back to the listing — no „Odśwież dane". The delta is the seeded item's client price
  // times the added quantity: 100 × 5.
  await expect.poll(() => readMargin(page, seed.matchName), { timeout: 20_000 }).toBe(before + 500)
})
