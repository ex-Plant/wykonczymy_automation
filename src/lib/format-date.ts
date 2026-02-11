import { getTranslations } from '@/lib/i18n/translations'
import type { LocaleT } from '@/lib/i18n/types'

const MONTH_KEYS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const

export function formatLocalizedDate(
  dateString: string,
  locale: LocaleT,
  dateShort?: boolean,
  withTime?: boolean,
): string {
  const date = new Date(dateString)
  const day = date.getDate()
  const monthKey = MONTH_KEYS[date.getMonth()]
  const year = date.getFullYear()

  const t = getTranslations(locale)
  let month = t.date.months[monthKey]

  if (dateShort) month = month.slice(0, 3)

  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')

  const timeString = `${hours}:${minutes}`

  return withTime ? `${day} ${month} ${year}, ${timeString}` : `${day} ${month} ${year}`
}
