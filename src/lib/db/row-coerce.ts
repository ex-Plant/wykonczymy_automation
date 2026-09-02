/**
 * A nullable numeric column, coerced without losing the null. Shared rather than re-typed per mapper
 * because `?? 0` is the exact mistake it exists to prevent: for a stawka podwykonawcy, an unset
 * column means „derive it", and 0 zł is a price someone chose (EX-766).
 */
export const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v))
