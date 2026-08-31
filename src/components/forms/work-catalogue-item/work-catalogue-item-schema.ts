import { z } from 'zod'

// Form-input layer: every field is a string, as the HTML controls produce them.
export const workCatalogueItemFormSchema = z.object({
  description: z.string().min(1, 'Opis pracy jest wymagany'),
  category: z.string(),
  unit: z.string().min(1, 'Jednostka miary jest wymagana'),
  clientPrice: z.string(),
  wToolsRate: z.string(),
  ownToolsRate: z.string(),
})

export type WorkCatalogueItemFormValuesT = z.infer<typeof workCatalogueItemFormSchema>

const money = (label: string) =>
  z.number({ message: `${label} musi być liczbą` }).min(0, `${label} nie może być ujemna`)

// Domain layer the action validates. `matchKey` is absent on purpose — it is derived server-side
// from opis + j.m., and Zod strips unknown keys, so a client that sends one is simply ignored.
export const workCatalogueItemSchema = workCatalogueItemFormSchema.extend({
  category: z.string().default(''),
  clientPrice: money('Cena j.m.'),
  wToolsRate: money('Stawka z narzędziami'),
  ownToolsRate: money('Stawka bez narzędzi'),
})

export type WorkCatalogueItemDataT = z.infer<typeof workCatalogueItemSchema>
