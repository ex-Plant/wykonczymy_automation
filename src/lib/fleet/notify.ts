import type { Payload } from 'payload'
import { FRONTEND_URL } from '@/lib/env'
import { requireRecipients } from '@/lib/email/recipients'
import { escapeHtml } from '@/lib/utils/escape-html'
import { daysLabel } from '@/lib/fleet/deadline-label'
import { INSPECTION_TYPE_LABELS } from '@/lib/fleet/inspection-types'
import { formatKm } from '@/lib/utils/format-distance'
import type { DigestEntryT, FleetDigestT, OdometerEntryT } from '@/lib/fleet/reminder-sweep'
import type { MissingInspectionT } from '@/lib/fleet/missing-data'

/** Empty in, empty out — an absent section prints nothing rather than an empty heading. */
const section = <T>(
  title: string,
  entries: readonly T[],
  tag: 'table' | 'ul',
  row: (entry: T) => string,
  lead = '',
): string =>
  entries.length === 0
    ? ''
    : `
    <h3>${escapeHtml(title)}</h3>${lead}
    <${tag}>
      ${entries.map(row).join('\n      ')}
    </${tag}>`

const deadlineTable = (title: string, entries: DigestEntryT[]): string =>
  section(
    title,
    entries,
    'table',
    (entry) => `<tr>
        <td><strong>${escapeHtml(entry.registration)}</strong></td>
        <td>${escapeHtml(INSPECTION_TYPE_LABELS[entry.type].pl)}</td>
        <td>${escapeHtml(entry.nextDueAt)}</td>
        <td>${escapeHtml(daysLabel(entry.daysLeft))}</td>
      </tr>`,
  )

const remainingLabel = (kmRemaining: number): string =>
  kmRemaining < 0
    ? `przekroczono o ${formatKm(Math.abs(kmRemaining))}`
    : `pozostało ${formatKm(kmRemaining)}`

// The mileage alarm is judged against a reading taken at some past inspection, not against the car's
// current odometer. Printing both is what stops it reading as a bug the day it arrives.
const odometerSection = (entries: OdometerEntryT[]): string =>
  section(
    'Wymiana oleju — limit kilometrów',
    entries,
    'ul',
    (entry) => `<li>
        <strong>${escapeHtml(entry.registration)}</strong> — wymiana oleju przy
        ${escapeHtml(formatKm(entry.targetOdometer))}, ostatni odczyt
        ${escapeHtml(formatKm(entry.latestOdometer))} (${escapeHtml(remainingLabel(entry.kmRemaining))}).
      </li>`,
  )

const missingSection = (entries: MissingInspectionT[]): string =>
  section(
    'Brak danych (podsumowanie tygodniowe)',
    entries,
    'ul',
    (entry) =>
      `<li><strong>${escapeHtml(entry.registration)}</strong> — ${escapeHtml(
        INSPECTION_TYPE_LABELS[entry.type].pl,
      )}</li>`,
    '\n    <p>Dla tych pozycji nie ma żadnego wpisu, więc żaden termin nie może się o nie upomnieć.</p>',
  )

const subjectFor = (digest: FleetDigestT): string => {
  if (digest.overdue.length > 0)
    return `🚨 Flota — ${digest.overdue.length} po terminie — Wykończymy`
  return 'Flota — nadchodzące terminy — Wykończymy'
}

/**
 * The daily digest, to the whole `fleetDigest` list as ONE message with N addresses — not N sends,
 * so the bookkeeping stamp the caller writes afterwards still describes one delivery.
 *
 * Throws on send failure so the caller can skip stamping: a deadline marked "announced" by a mail
 * that never left goes silent for a week. Throws for the same reason when the list is empty.
 */
export async function notifyFleetDigest(payload: Payload, digest: FleetDigestT): Promise<void> {
  const html = `
    <h2>Terminy floty</h2>
    ${deadlineTable('Po terminie', digest.overdue)}
    ${deadlineTable('W ciągu 7 dni', digest.within7)}
    ${deadlineTable('W ciągu 30 dni', digest.within30)}
    ${odometerSection(digest.odometer)}
    ${missingSection(digest.missing)}
    <p><a href="${FRONTEND_URL}/flota">Otwórz flotę</a></p>
  `

  await payload.sendEmail({
    to: await requireRecipients(payload, 'fleetDigest'),
    subject: subjectFor(digest),
    html,
  })
}
