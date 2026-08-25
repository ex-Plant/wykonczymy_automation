import { netFromGross } from '@/lib/kosztorys/net-gross-amounts'

/**
 * The netto to write into the field, or null when the kwota standing there is the owner's.
 *
 * Ownership is read off the value — it is his as soon as it stops matching the last kwota the field
 * wrote — rather than latched when a keystroke arrives. A latch answers the wrong question twice: a
 * reopened draft mounts with a fresh `false` over a netto typed off the faktura, and the empty string
 * a programmatic clear pushes reads as a keystroke that raises it for good.
 */
export function netSuggestion(
  currentNet: string,
  gross: string,
  lastSuggested: string | null,
  rate: number,
): string | null {
  if (currentNet !== '' && currentNet !== lastSuggested) return null
  return netFromGross(gross, rate)
}
