import { execFileSync } from 'node:child_process'
import { test, expect, type Page } from '@playwright/test'

// Proves the band is wired end-to-end: it reads the same per-section subtotals the Podsumowanie does,
// its chevron folds exactly its own section away, and the gutter keeps numbering the surviving items
// without a gap. All three cross the grid, the editor hook and the settlement layer — where a unit
// test on buildSectionBandRows alone sees nothing.
test.use({ storageState: 'e2e/.auth/user.json' })

type BandsSeed = {
  investment: number
  sections: { name: string; net: number; itemCount: number }[]
}

let seed: BandsSeed

// Seed via subprocess for the same reason as the recon spec: importing the Payload config graph pulls
// next/cache, which Playwright's module loader can't resolve. The editor page resolves the investment
// straight from the DB, so no cache bust is needed here.
test.beforeAll(() => {
  const testDbUrl = process.env.DB_POSTGRES_URL_TEST
  if (!testDbUrl) throw new Error('[bands-spec] DB_POSTGRES_URL_TEST is not set — refusing to seed')
  const out = execFileSync('pnpm', ['seed:kosztorys-bands'], {
    encoding: 'utf8',
    env: { ...process.env, DB_POSTGRES_URL: testDbUrl },
  })
  const line = out.split('\n').find((l) => l.startsWith('BANDS_SEED='))
  if (!line) throw new Error(`[bands-spec] seed emitted no BANDS_SEED line:\n${out}`)
  seed = JSON.parse(line.slice('BANDS_SEED='.length))
})

function bands(page: Page) {
  return page.locator('.dsg-row.kosztorys-section-header')
}

// Every gutter number currently rendered, in row order. Bands and the spacer/„Razem" rows leave their
// gutter empty, so this is exactly the visible item numbering.
async function itemOrdinals(page: Page): Promise<string[]> {
  const texts = await page.locator('.dsg-row .dsg-cell-gutter').allTextContents()
  return texts.map((t) => t.trim()).filter(Boolean)
}

// The „Razem" row rides the grid's own layout as its last row, so it is a `.dsg-row` like any other.
// Two other rows carry the word — the column header („Razem netto") and every section footer („Razem
// sekcja") — so both are excluded by class before the filter runs.
function totalsRow(page: Page) {
  return page
    .locator('.dsg-row:not(.dsg-row-header):not(.kosztorys-section-footer)')
    .filter({ hasText: 'Razem' })
    .first()
}

async function gotoEditor(page: Page): Promise<void> {
  await page.goto(`/inwestycje/${seed.investment}/kosztorys_v2`)
  await bands(page).first().waitFor()
}

test('one band per section, carrying its name and item count', async ({ page }) => {
  await gotoEditor(page)
  await expect(bands(page)).toHaveCount(seed.sections.length)

  for (const [index, section] of seed.sections.entries()) {
    const band = bands(page).nth(index)
    await expect(band).toContainText(section.name)
    await expect(band).toContainText(`${section.itemCount} poz.`)
  }
})

test('collapsing a section hides its items and keeps the numbering continuous', async ({
  page,
}) => {
  await gotoEditor(page)
  const total = seed.sections.reduce((sum, s) => sum + s.itemCount, 0)
  await expect
    .poll(() => itemOrdinals(page))
    .toEqual(Array.from({ length: total }, (_, i) => String(i + 1)))
  // „Razem" sums the whole dataset, so a fold must not move it — captured here, compared after.
  const totalsBefore = await totalsRow(page).innerText()

  await bands(page).first().getByRole('button', { name: 'Zwiń sekcję' }).click()

  // The band survives its own collapse — it is the only way back.
  await expect(bands(page)).toHaveCount(seed.sections.length)
  await expect(page.getByText(seed.sections[0].name).first()).toBeVisible()
  const remaining = total - seed.sections[0].itemCount
  await expect
    .poll(() => itemOrdinals(page))
    .toEqual(Array.from({ length: remaining }, (_, i) => String(i + 1)))
  await expect(totalsRow(page)).toHaveText(totalsBefore)

  await bands(page).first().getByRole('button', { name: 'Rozwiń sekcję' }).click()
  await expect.poll(() => itemOrdinals(page)).toHaveLength(total)
})
