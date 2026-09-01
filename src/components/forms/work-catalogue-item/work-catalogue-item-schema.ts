import { z } from 'zod'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

// A blank „Cena j.m." must be refused HERE rather than by the domain schema below: `Number('')` is 0,
// so it would otherwise save a 0 zł pozycja — and a 0 zł cena also silences the 80% ceiling for that
// row, since a share of nothing has no value to show. Validating the string means the owner gets
// „jest wymagana" under the field he left empty, instead of the domain layer's „musi być liczbą"
// (true of a NaN, nonsense about a blank) arriving as a toast after the write was already attempted.
const moneyInput = (label: string) =>
  z.string().superRefine((value, ctx) => {
    const parsed = parseDecimalInput(value)
    if (parsed.kind === 'empty') {
      ctx.addIssue({ code: 'custom', message: `${label} jest wymagana` })
    } else if (parsed.kind === 'invalid') {
      ctx.addIssue({ code: 'custom', message: `${label} musi być liczbą` })
    } else if (parsed.value < 0) {
      ctx.addIssue({ code: 'custom', message: `${label} nie może być ujemna` })
    }
  })

// Form-input layer: every field is a string, as the HTML controls produce them.
export const workCatalogueItemFormSchema = z.object({
  description: z.string().min(1, 'Opis pracy jest wymagany'),
  category: z.string(),
  unit: z.string().min(1, 'Jednostka miary jest wymagana'),
  clientPrice: moneyInput('Cena j.m.'),
  wToolsRate: moneyInput('Stawka z narzędziami'),
  ownToolsRate: moneyInput('Stawka bez narzędzi'),
})

export type WorkCatalogueItemFormValuesT = z.infer<typeof workCatalogueItemFormSchema>

const money = (label: string) =>
  z.number({ message: `${label} musi być liczbą` }).min(0, `${label} nie może być ujemna`)

// Domain layer the action validates — the backstop for a payload that never passed through the form.
// `matchKey` is absent on purpose: it is derived server-side from opis + j.m., and Zod strips unknown
// keys, so a client that sends one is simply ignored.
export const workCatalogueItemSchema = workCatalogueItemFormSchema.extend({
  category: z.string().default(''),
  clientPrice: money('Cena j.m.'),
  // `null` = „auto": the katalog names no stawka and the praca prices off the target investment's
  // współczynnik. A blank field is NOT this — the form layer above still refuses it.
  wToolsRate: money('Stawka z narzędziami').nullable(),
  ownToolsRate: money('Stawka bez narzędzi').nullable(),
})

export type WorkCatalogueItemDataT = z.infer<typeof workCatalogueItemSchema>

/** „12,50" → 12.5; blank and garbage → NaN, which `money()` refuses. */
export function toMoney(value: string): number {
  const parsed = parseDecimalInput(value)
  return parsed.kind === 'value' ? parsed.value : NaN
}
