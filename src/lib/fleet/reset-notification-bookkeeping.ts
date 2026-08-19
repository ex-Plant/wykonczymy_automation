type BookkeepingT = {
  notifiedThreshold?: null
  notifiedAt?: null
  odometerNotifiedAt?: null
}

type StoredFieldsT = {
  nextDueAt?: string | null
  nextDueOdometer?: number | null
  odometer?: number | null
}

/** A Payload `beforeChange` patch: only the fields the write actually names. */
type PatchT = Partial<StoredFieldsT>

/**
 * Which "already announced" stamps an edit invalidates.
 *
 * The stamps exist so one deadline earns one email, but they are keyed to the values that were
 * announced. Correct a km target typed as 101 000 instead of 130 000 and, without this, the row is
 * marked announced for a target that no longer exists — the mileage alarm never fires again for the
 * life of that oil change. Changing the figure means nobody has been told about the new one.
 *
 * `patch` is an UPDATE PATCH, not the next document: Payload hands a collection `beforeChange` the
 * raw incoming data, merged with the stored doc only later, in the field-level hooks. So an absent
 * key means untouched — a present `null` is the clear. Read it as a document instead and the
 * sweep's own three-field stamp write erases the stamp it is writing.
 */
export const resetNotificationBookkeeping = (
  stored: StoredFieldsT,
  patch: PatchT,
): BookkeepingT => {
  const changed = (field: keyof StoredFieldsT) =>
    field in patch && (stored[field] ?? null) !== (patch[field] ?? null)

  return {
    ...(changed('nextDueAt') && { notifiedThreshold: null, notifiedAt: null }),
    ...((changed('nextDueOdometer') || changed('odometer')) && { odometerNotifiedAt: null }),
  }
}
