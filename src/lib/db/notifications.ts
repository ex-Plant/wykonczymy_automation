import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload } from 'payload'
import { getDb } from './get-db'

export const STREAMS = {
  leads: 'leads',
  fleet: 'fleet',
} as const

export type StreamT = (typeof STREAMS)[keyof typeof STREAMS]

// Fallback cursor for a user who has never opened the stream's page (no notification_reads
// row yet): treat everything before the feature's deploy as already seen, so nobody
// gets a scary "247 unread" badge on rollout. Only items that became unread after this
// instant count until the user's first visit writes a real cursor.
const EPOCHS: Record<StreamT, string> = {
  leads: '2026-07-08T00:00:00Z',
  fleet: '2026-08-18T00:00:00Z',
}

/**
 * Unread new-lead count for one user: leads created after their read cursor
 * (or after the leads epoch if they've never visited). Powers the nav badge.
 */
export const countUnreadLeads = async (payload: Payload, userId: number): Promise<number> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT COUNT(*) AS count
    FROM leads
    WHERE created_at > COALESCE(
      (SELECT seen_at FROM notification_reads
       WHERE user_id = ${userId} AND stream = ${STREAMS.leads}),
      ${EPOCHS.leads}::timestamptz
    )
  `)

  return Number(result.rows[0].count)
}

/**
 * How many deadlines have become urgent since the user last looked at the fleet.
 *
 * A deadline has no creation event to count — it slides into urgency as the calendar moves — so
 * "unread" is read off the date it entered the 30-day window: next_due_at minus 30 days. Later than
 * the cursor means it started mattering after the user's last visit. Only the newest entry per
 * (vehicle, type) counts, and only for vehicles still in use; a renewed inspection therefore drops
 * out of the badge by itself, exactly as it drops off the listing.
 */
export const countUnreadFleetDeadlines = async (
  payload: Payload,
  userId: number,
): Promise<number> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    WITH read_cursor AS (
      SELECT COALESCE(
        (SELECT seen_at FROM notification_reads
         WHERE user_id = ${userId} AND stream = ${STREAMS.fleet}),
        ${EPOCHS.fleet}::timestamptz
      ) AS seen_at
    ),
    current_deadlines AS (
      SELECT DISTINCT ON (i.vehicle_id, i.type) i.next_due_at
      FROM vehicle_inspections i
      JOIN vehicles v ON v.id = i.vehicle_id AND v.status = 'ACTIVE'
      ORDER BY i.vehicle_id, i.type, i.performed_at DESC
    )
    SELECT COUNT(*) AS count
    FROM current_deadlines, read_cursor
    WHERE current_deadlines.next_due_at IS NOT NULL
      AND current_deadlines.next_due_at <= now() + interval '30 days'
      AND current_deadlines.next_due_at - interval '30 days' > read_cursor.seen_at
  `)

  return Number(result.rows[0].count)
}

/** Advance the user's read cursor for one stream to now — called when they open its page. */
export const markSeen = async (
  payload: Payload,
  userId: number,
  stream: StreamT,
): Promise<void> => {
  const db = await getDb(payload)

  await db.execute(sql`
    INSERT INTO notification_reads (user_id, stream, seen_at)
    VALUES (${userId}, ${stream}, now())
    ON CONFLICT (user_id, stream)
    DO UPDATE SET seen_at = now()
  `)
}
