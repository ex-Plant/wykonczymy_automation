import type { Payload } from 'payload'
import type { Investment } from '@/payload-types'

// Every DB spec needs an investment to hang its rows off, and none of them is asserting anything
// about the investment itself — so `status` / `settlementMode` are noise that each new required
// column taxes across ~20 specs (vatRate, then settlementMode). Defaulting them here makes the next
// column a one-line change (EX-592).
type InvestmentOverridesT = Partial<Omit<Investment, 'id' | 'name' | 'createdAt' | 'updatedAt'>>

// `skipRevalidation` matters: the specs run outside a request scope, where Payload's revalidation
// hooks throw.
export async function createTestInvestment(
  payload: Payload,
  name: string,
  overrides: InvestmentOverridesT = {},
): Promise<number> {
  const created = await payload.create({
    collection: 'investments',
    data: { name, status: 'active', settlementMode: 'NET', ...overrides },
    overrideAccess: true,
    context: { skipRevalidation: true },
  })
  return Number(created.id)
}

// Paired with the create so a spec's teardown can't drift from it — the specs share one database,
// so an investment left behind is visible to every other spec's queries.
export async function deleteTestInvestment(payload: Payload, id: number): Promise<void> {
  await payload.delete({
    collection: 'investments',
    id,
    overrideAccess: true,
    context: { skipRevalidation: true },
  })
}
