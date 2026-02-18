# M27: Settlement Relaxation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make investment optional in settlement form; add per-line-item category+note as an alternative to investment.

**Architecture:** Settlement form gets a radio toggle (investment vs category mode). Backend validation enforces `EMPLOYEE_EXPENSE` requires either `investment` OR (`otherCategory` + `otherDescription`). Server action handles both modes.

**Tech Stack:** Payload CMS collections, Zod schemas, TanStack Form, React Server Actions

---

### Task 1: Update transfer constants and Payload collection

**Files:**

- Modify: `src/lib/constants/transfers.ts:65`
- Modify: `src/collections/transfers.ts:49`

**Step 1: Update `needsOtherCategory` helper**

In `src/lib/constants/transfers.ts`, change:

```ts
export const needsOtherCategory = (type: string) => type === 'OTHER'
```

to:

```ts
export const needsOtherCategory = (type: string) => type === 'OTHER' || type === 'EMPLOYEE_EXPENSE'
```

**Step 2: Update Payload admin conditions**

In `src/collections/transfers.ts`, change the local `needsOtherCategory` function (line 49):

```ts
const needsOtherCategory = (data: Record<string, unknown>) => data?.type === 'OTHER'
```

to:

```ts
const needsOtherCategory = (data: Record<string, unknown>) =>
  data?.type === 'OTHER' || data?.type === 'EMPLOYEE_EXPENSE'
```

**Step 3: Verify**

Run: `pnpm typecheck`

**Step 4: Commit**

```bash
git commit -m "feat(M27): show otherCategory for EMPLOYEE_EXPENSE transfers"
```

---

### Task 2: Update transfer validation hook

**Files:**

- Modify: `src/hooks/transfers/validate.ts:40-62`

**Step 1: Update EMPLOYEE_EXPENSE validation**

Currently `requiresInvestment` does NOT include `EMPLOYEE_EXPENSE`, so investment is never enforced for it. The hook also doesn't validate `otherCategory` for `EMPLOYEE_EXPENSE`.

Add new validation rule after the existing `otherCategory` check (after line 62):

```ts
// EMPLOYEE_EXPENSE: requires either investment OR (otherCategory + otherDescription)
if (type === 'EMPLOYEE_EXPENSE') {
  const hasInvestment = !!d.investment
  const hasCategory = !!d.otherCategory
  if (!hasInvestment && !hasCategory) {
    errors.push('Employee expense requires either an investment or a category.')
  }
  if (hasInvestment && hasCategory) {
    // Auto-clear category when investment is set (investment takes precedence)
    d.otherCategory = null
    d.otherDescription = null
  }
}
```

**Step 2: Verify**

Run: `pnpm typecheck`

**Step 3: Commit**

```bash
git commit -m "feat(M27): validate EMPLOYEE_EXPENSE requires investment OR category"
```

---

### Task 3: Update settlement schemas

**Files:**

- Modify: `src/lib/schemas/settlements.ts:1-92`

**Step 1: Update line item schema to include category + note**

Change `lineItemClientSchema`:

```ts
const lineItemClientSchema = z.object({
  description: z.string(),
  amount: z.string(),
  category: z.string().optional(),
  note: z.string().optional(),
})
```

**Step 2: Add `mode` field and make `investment` optional**

Update `settlementFormSchema`:

```ts
export const settlementFormSchema = z
  .object({
    worker: z.string(),
    mode: z.enum(['investment', 'category']),
    investment: z.string().optional(),
    date: z.string(),
    paymentMethod: z.string(),
    invoiceNote: z.string(),
    lineItems: z.array(lineItemClientSchema),
  })
  .superRefine((data, ctx) => {
    if (!data.worker) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pracownik jest wymagany',
        path: ['worker'],
      })
    }

    if (data.mode === 'investment' && !data.investment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inwestycja jest wymagana',
        path: ['investment'],
      })
    }

    if (!data.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data jest wymagana',
        path: ['date'],
      })
    }

    if (data.lineItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Dodaj co najmniej jedną pozycję',
        path: ['lineItems'],
      })
    }

    data.lineItems.forEach((item, index) => {
      if (!item.description.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Opis jest wymagany',
          path: ['lineItems', index, 'description'],
        })
      }
      if (!item.amount || Number(item.amount) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kwota musi być większa niż 0',
          path: ['lineItems', index, 'amount'],
        })
      }
      if (data.mode === 'category') {
        if (!item.category) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Kategoria jest wymagana',
            path: ['lineItems', index, 'category'],
          })
        }
        if (!item.note?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Notatka jest wymagana',
            path: ['lineItems', index, 'note'],
          })
        }
      }
    })
  })
```

**Step 3: Update server-side schema**

```ts
export const createSettlementSchema = z.object({
  worker: z.number({ error: 'Pracownik jest wymagany' }).positive('Pracownik jest wymagany'),
  mode: z.enum(['investment', 'category']),
  investment: z.number().positive().optional(),
  date: z.string().min(1, 'Data jest wymagana'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  invoiceNote: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1, 'Opis jest wymagany'),
        amount: z.number().positive('Kwota musi być większa niż 0'),
        category: z.number().positive().optional(),
        note: z.string().optional(),
      }),
    )
    .min(1, 'Dodaj co najmniej jedną pozycję'),
})
```

**Step 4: Verify**

Run: `pnpm typecheck`

**Step 5: Commit**

```bash
git commit -m "feat(M27): update settlement schemas for optional investment + per-item category"
```

---

### Task 4: Update settlement server action

**Files:**

- Modify: `src/lib/actions/settlements.ts:69-96`

**Step 1: Update transfer creation to handle both modes**

In `createSettlementAction`, change the `payload.create` call inside the `Promise.all` map:

```ts
parsed.data.lineItems.map((item, i) =>
  payload.create({
    collection: 'transactions',
    data: {
      description: item.description,
      amount: item.amount,
      date: parsed.data.date,
      type: 'EMPLOYEE_EXPENSE',
      paymentMethod: parsed.data.paymentMethod,
      investment: parsed.data.mode === 'investment' ? parsed.data.investment : undefined,
      worker: parsed.data.worker,
      invoice: mediaIds[i],
      invoiceNote: parsed.data.invoiceNote,
      otherCategory: parsed.data.mode === 'category' ? item.category : undefined,
      otherDescription: parsed.data.mode === 'category' ? item.note : undefined,
      createdBy: user.id,
    },
    context: { skipBalanceRecalc: true },
  }),
)
```

**Step 2: Conditionally recalculate investment costs**

The existing recalc block already checks `if (parsed.data.investment)` — this works because in category mode `investment` is undefined. No change needed here.

**Step 3: Verify**

Run: `pnpm typecheck`

**Step 4: Commit**

```bash
git commit -m "feat(M27): handle investment/category modes in settlement action"
```

---

### Task 5: Update settlement form UI

**Files:**

- Modify: `src/components/forms/settlement-form/settlement-form.tsx`
- Modify: `src/components/dialogs/add-settlement-dialog.tsx`

**Step 1: Add `otherCategories` to settlement reference data**

In `add-settlement-dialog.tsx`, update `settlementReferenceData` to pass categories:

```ts
const settlementReferenceData = {
  users: referenceData.workers,
  investments: referenceData.investments,
  otherCategories: referenceData.otherCategories,
}
```

**Step 2: Update SettlementForm types**

In `settlement-form.tsx`, update `ReferenceDataT`:

```ts
type ReferenceDataT = {
  users: ReferenceItemT[]
  investments: ReferenceItemT[]
  otherCategories: ReferenceItemT[]
}
```

Update `FormValuesT`:

```ts
type FormValuesT = {
  worker: string
  mode: 'investment' | 'category'
  investment: string
  date: string
  paymentMethod: string
  invoiceNote: string
  lineItems: { description: string; amount: string; category: string; note: string }[]
}
```

**Step 3: Add mode radio toggle and conditional fields**

Update `defaultValues` to include `mode: 'investment' as const` and line items with `category: '', note: ''`.

Add radio toggle between worker selector and the metadata grid:

```tsx
<form.AppField name="mode">
  {(field) => (
    <div className="flex gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="settlementMode"
          value="investment"
          checked={field.state.value === 'investment'}
          onChange={() => field.handleChange('investment')}
        />
        Inwestycja
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="settlementMode"
          value="category"
          checked={field.state.value === 'category'}
          onChange={() => field.handleChange('category')}
        />
        Inne (kategoria)
      </label>
    </div>
  )}
</form.AppField>
```

Conditionally show investment dropdown only when mode is 'investment' (use `useStore` to read mode).

In line items: when mode is 'category', add category select + note textarea per item.

**Step 4: Update onSubmit data mapping**

```ts
const data: CreateSettlementFormT = {
  worker: Number(value.worker),
  mode: value.mode,
  investment: value.mode === 'investment' ? Number(value.investment) : undefined,
  date: value.date,
  paymentMethod: value.paymentMethod as PaymentMethodT,
  invoiceNote: value.invoiceNote || undefined,
  lineItems: value.lineItems.map((item) => ({
    description: item.description,
    amount: Number(item.amount),
    category: value.mode === 'category' ? Number(item.category) : undefined,
    note: value.mode === 'category' ? item.note : undefined,
  })),
}
```

**Step 5: Verify**

Run: `pnpm typecheck && pnpm lint`

**Step 6: Commit**

```bash
git commit -m "feat(M27): add investment/category mode toggle to settlement form"
```

---

### Task 6: Final verification

**Step 1: Run full checks**

```bash
pnpm typecheck && pnpm lint
```

**Step 2: Manual test**

- Open settlement dialog, verify radio toggle shows
- In investment mode: investment dropdown visible, category hidden
- In category mode: investment hidden, per-item category + note visible
- Submit in both modes, verify transfers created correctly

**Step 3: Update PLAN.md**

Mark M27 as done.
