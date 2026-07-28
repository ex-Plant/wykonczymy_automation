import type { Where } from 'payload'

/** Detects the NO_RESULTS sentinel ({ id: { equals: -1 } }) in a Where clause. */
export const isNoResultsSentinel = (where: Where): boolean => {
  const id = where.id as Record<string, unknown> | undefined
  return id !== undefined && 'equals' in id && id.equals === -1
}

const FIELD_TO_COLUMN: Record<string, string> = {
  type: 'type',
  sourceRegister: 'source_register_id',
  targetRegister: 'target_register_id',
  investment: 'investment_id',
  createdBy: 'created_by_id',
  expenseCategory: 'expense_category_id',
  otherCategory: 'other_category_id',
  worker: 'worker_id',
  paymentMethod: 'payment_method',
  date: 'date',
  cancelled: 'cancelled',
  amount: 'amount',
}

/**
 * Translates a flat Payload Where object to SQL AND clauses.
 *
 * Handles exactly the operators in OPERATORS below — an unknown one throws rather than
 * being skipped (EX-574). It used to fall through silently, which meant a filter could
 * vanish between the Where and the query: `less_than` was unhandled, so an amount search
 * ran as an unbounded `amount >= 500` and „Suma wybranych transakcji" reported millions
 * over a list of twenty rows. Every Where reaching here is built in-repo by
 * buildTransferFilters(), so the operator set is closed and a throw can only mean a
 * coding change that this module hasn't been taught yet.
 *
 * All values come from buildTransferFilters() which validates against known enums
 * and parses numeric IDs. escapeValue provides SQL injection protection as a second layer.
 */
export function buildSqlConditions(where: Where): string {
  const clauses: string[] = []

  for (const [field, condition] of Object.entries(where)) {
    if (field === 'id') continue // skip impossible-condition sentinel

    // Handle OR conditions (e.g. sourceRegister OR targetRegister)
    if (field === 'or' && Array.isArray(condition)) {
      const orParts = condition.map((sub: Where) => buildFieldCondition(sub)).filter(Boolean)
      if (orParts.length > 0) {
        clauses.push(`AND (${orParts.join(' OR ')})`)
      }
      continue
    }

    const part = buildFieldCondition({ [field]: condition })
    if (part) clauses.push(`AND ${part}`)
  }

  return clauses.join('\n      ')
}

const OPERATORS: Record<string, (column: string, value: unknown) => string> = {
  equals: (column, value) => `${column} = ${escapeValue(value)}`,
  not_equals: (column, value) => `${column} != ${escapeValue(value)}`,
  in: (column, value) => `${column} IN (${(value as unknown[]).map(escapeValue).join(', ')})`,
  not_in: (column, value) =>
    `${column} NOT IN (${(value as unknown[]).map(escapeValue).join(', ')})`,
  greater_than: (column, value) => `${column} > ${escapeValue(value)}`,
  greater_than_equal: (column, value) => `${column} >= ${escapeValue(value)}`,
  less_than: (column, value) => `${column} < ${escapeValue(value)}`,
  less_than_equal: (column, value) => `${column} <= ${escapeValue(value)}`,
  // Prefix match on numeric columns (e.g. amount): cast to text, then LIKE '15%'
  // Callers must pre-validate values — this path uses sql.raw(), not parameterized queries
  like: (column, value) => `${column}::text LIKE ${escapeValue(value)} || '%'`,
}

/** Builds a single-field condition string (without AND prefix). Only handles the first matched field. */
function buildFieldCondition(where: Where): string | null {
  for (const [field, condition] of Object.entries(where)) {
    const column = FIELD_TO_COLUMN[field]
    if (!column || typeof condition !== 'object' || condition === null) continue

    const parts = Object.entries(condition as Record<string, unknown>).map(([operator, value]) => {
      const render = OPERATORS[operator]
      if (!render) throw new Error(`where-to-sql: unsupported operator "${operator}" on "${field}"`)
      if ((operator === 'in' || operator === 'not_in') && !Array.isArray(value)) {
        throw new Error(`where-to-sql: "${operator}" on "${field}" expects an array`)
      }
      return render(column, value)
    })

    if (parts.length > 0) return parts.join(' AND ')
  }
  return null
}

function escapeValue(val: unknown): string {
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
  return 'NULL'
}
