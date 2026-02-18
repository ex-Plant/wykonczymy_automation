import { z } from 'zod'

export const brandEvaluationSchema = z.object({
  rating: z.number({ message: 'Ocena jest wymagana' }).min(1, 'Ocena jest wymagana').max(5),
  reasons: z
    .array(z.string(), { message: 'Wybierz co najmniej jeden powód' })
    .min(1, 'Wybierz co najmniej jeden powód')
    .max(2, 'Możesz wybrać maksymalnie 2 powody'),
  other_reason: z.string().optional(),
})

export const surveySchema = z
  .object({
    // Step 1: Wybór producentów
    considered_brands: z
      .array(z.string())
      .min(1, 'Wybierz co najmniej jednego producenta')
      .max(3, 'Możesz wybrać maksymalnie 3 producentów'),
    rejected_brand: z.string().optional(),

    // Step 2: Ocena jakościowa
    brand_evaluations: z.record(z.string(), brandEvaluationSchema),

    // Reasons for rejection (P5)
    rejection_reasons: z.array(z.string()).max(2).optional(),
    rejection_other: z.string().optional(),

    // Contact (P6)
    contact_request: z.boolean(),
    contact_brands: z.array(z.string()).optional(),

    // Step 3: Informacje dodatkowe
    missing_brands: z.string().optional(),
    improvement_suggestion: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Ensure rejection_reasons is required if a brand is rejected
    if (data.rejected_brand && data.rejected_brand !== 'Brak') {
      if (!data.rejection_reasons || data.rejection_reasons.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Wybierz co najmniej jeden powód odrzucenia',
          path: ['rejection_reasons'],
        })
      }
    }

    // Ensure all considered brands have evaluations
    data.considered_brands.forEach((brand) => {
      const evaluation = data.brand_evaluations?.[brand]
      if (!evaluation || !evaluation.rating) {
        ctx.addIssue({
          code: 'custom',
          message: 'Ocena jest wymagana',
          path: ['brand_evaluations', brand, 'rating'],
        })
      }
      if (!evaluation || !evaluation.reasons || evaluation.reasons.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Wybierz co najmniej jeden powód',
          path: ['brand_evaluations', brand, 'reasons'],
        })
      }
    })
  })

export type SurveySchemaT = z.infer<typeof surveySchema>
export type BrandEvaluationT = z.infer<typeof brandEvaluationSchema>
