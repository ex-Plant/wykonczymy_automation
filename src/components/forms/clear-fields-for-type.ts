import {
  canBeSettled,
  needsSourceRegister,
  needsTargetRegister,
  needsWorker,
  showsInvestment,
} from '@/lib/constants/transfers'

// TanStack Form keeps the values of unmounted fields, so a type change has to blank whatever the
// new type does not carry. It must blank them to EMPTY, never via form.resetField(): the dialog
// opened from /inwestycje/<id> defaults `investment` to that id and a restored draft defaults
// every field to what the draft held, so a reset re-armed the hidden field with the very value it
// was meant to drop (EX-709). Which field belongs to which type is read off the same predicates
// the server's auto-clear uses (hooks/transfers/validate.ts) — one rule, both planes.

const EMPTY_VALUE = {
  sourceRegister: '',
  targetRegister: '',
  worker: '',
  settled: false,
} as const

export type ConditionalFieldT = keyof typeof EMPTY_VALUE

const CARRIED_BY: Record<ConditionalFieldT, (type: string) => boolean> = {
  sourceRegister: needsSourceRegister,
  targetRegister: needsTargetRegister,
  worker: needsWorker,
  settled: canBeSettled,
}

export const EXPENSE_CONDITIONAL_FIELDS = [
  'sourceRegister',
  'targetRegister',
  'worker',
  'settled',
] as const satisfies readonly ConditionalFieldT[]

export function staleFieldsForType(
  type: string,
  fields: readonly ConditionalFieldT[],
): [ConditionalFieldT, '' | false][] {
  return fields.filter((f) => !CARRIED_BY[f](type)).map((f) => [f, EMPTY_VALUE[f]])
}

// Investment is the one field with a fallback rather than a blank: the URL the dialog was opened
// from names it, so a type that shows the field gets it back instead of making the user re-pick.
export function investmentForType(
  type: string,
  current: string | undefined,
  fromUrl: string,
): string {
  return showsInvestment(type) ? current || fromUrl : ''
}
