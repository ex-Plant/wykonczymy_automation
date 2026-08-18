import type { Payload } from 'payload'
import { FRONTEND_URL } from '@/lib/env'
import { serverEnv } from '@/lib/env/server'
import { escapeHtml } from '@/lib/leads/escape-html'
import { INSPECTION_TYPE_LABELS } from '@/lib/fleet/inspection-types'
import type { DigestEntryT, FleetDigestT, OdometerEntryT } from '@/lib/fleet/reminder-sweep'
import type { MissingInspectionT } from '@/lib/fleet/missing-data'

const formatKm = (value: number) => `${value.toLocaleString('pl-PL')} km`

const daysLabel = (daysLeft: number): string => {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} dni po terminie`
  if (daysLeft === 0) return 'dziś'
  return `za ${daysLeft} dni`
}

const deadlineTable = (title: string, entries: DigestEntryT[]): string => {
  if (entries.length === 0) return ''

  const rows = entries
    .map(
      (entry) => `<tr>
        <td><strong>${escapeHtml(entry.registration)}</strong></td>
        <td>${escapeHtml(INSPECTION_TYPE_LABELS[entry.type].pl)}</td>
        <td>${escapeHtml(entry.nextDueAt)}</td>
        <td>${escapeHtml(daysLabel(entry.daysLeft))}</td>
      </tr>`,
    )
    .join('\n      ')

  return `
    <h3>${escapeHtml(title)}</h3>
    <table>
      ${rows}
    </table>`
}

// The mileage alarm is judged against a reading taken at some past inspection, not against the car's
// current odometer. Printing both is what stops it reading as a bug the day it arrives.
const odometerSection = (entries: OdometerEntryT[]): string => {
  if (entries.length === 0) return ''

  const rows = entries
    .map(
      (entry) => `<li>
        <strong>${escapeHtml(entry.registration)}</strong> — wymiana oleju przy
        ${escapeHtml(formatKm(entry.nextDueOdometer))}, ostatni odczyt
        ${escapeHtml(formatKm(entry.latestOdometer))} (pozostało
        ${escapeHtml(formatKm(entry.kmRemaining))}).
      </li>`,
    )
    .join('\n      ')

  return `
    <h3>Wymiana oleju — limit kilometrów</h3>
    <ul>
      ${rows}
    </ul>`
}

const missingSection = (entries: MissingInspectionT[]): string => {
  if (entries.length === 0) return ''

  const rows = entries
    .map(
      (entry) =>
        `<li><strong>${escapeHtml(entry.registration)}</strong> — ${escapeHtml(
          INSPECTION_TYPE_LABELS[entry.type].pl,
        )}</li>`,
    )
    .join('\n      ')

  return `
    <h3>Brak danych (podsumowanie tygodniowe)</h3>
    <p>Dla tych pozycji nie ma żadnego wpisu, więc żaden termin nie może się o nie upomnieć.</p>
    <ul>
      ${rows}
    </ul>`
}

const subjectFor = (digest: FleetDigestT): string => {
  if (digest.overdue.length > 0)
    return `🚨 Flota — ${digest.overdue.length} po terminie — Wykończymy`
  return 'Flota — nadchodzące terminy — Wykończymy'
}

/**
 * The daily digest, to the fleet inbox and the admin inbox as ONE message with two addresses — not
 * two sends, so the bookkeeping stamp the caller writes afterwards still describes one delivery.
 *
 * Throws on send failure so the caller can skip stamping: a deadline marked "announced" by a mail
 * that never left goes silent for a week.
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
    to: [serverEnv.FLEET_NOTIFICATION_EMAIL, serverEnv.ADMIN_EMAIL],
    subject: subjectFor(digest),
    html,
  })
}
