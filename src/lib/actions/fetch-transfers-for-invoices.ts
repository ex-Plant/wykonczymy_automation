'use server'

import type { Where } from 'payload'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchAllTransferRows } from '@/lib/queries/fetch-transfer-rows'
import type { TransferRowT } from '@/types/transfers'
import type { ActionResultT } from '@/types/action'
import { getErrorMessage } from '@/lib/actions/run-action'
import { perfStart } from '@/lib/perf'

export async function fetchFilteredTransfers(where: Where): Promise<ActionResultT<TransferRowT[]>> {
  const elapsed = perfStart()

  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    // Always excludes cancelled transfers and cancellation records — they are audit
    // trail only and have no place in the invoice ZIP.
    const invoiceWhere: Where = {
      and: [where, { cancelled: { not_equals: true } }, { type: { not_equals: 'CANCELLATION' } }],
    }
    const rows = await fetchAllTransferRows(invoiceWhere)

    console.log(`[PERF] fetchFilteredTransfers ${elapsed()}ms (${rows.length} rows)`)
    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}
