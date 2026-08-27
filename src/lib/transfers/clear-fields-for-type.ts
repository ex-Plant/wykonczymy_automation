import {
  canBeSettled,
  carriesPaymentMethod,
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
  paymentMethod: '',
} as const

export type ConditionalFieldT = keyof typeof EMPTY_VALUE

const CARRIED_BY: Record<ConditionalFieldT, (type: string) => boolean> = {
  sourceRegister: needsSourceRegister,
  targetRegister: needsTargetRegister,
  worker: needsWorker,
  settled: canBeSettled,
  paymentMethod: carriesPaymentMethod,
}

export function staleFieldsForType(type: string): [ConditionalFieldT, '' | false][] {
  const fields = Object.keys(CARRIED_BY) as ConditionalFieldT[]
  return fields
    .filter((field) => !CARRIED_BY[field](type))
    .map((field) => [field, EMPTY_VALUE[field]])
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

// Same fallback shape, for the same reason: a detour through a type that carries no kasa blanks the
// field, and coming back would otherwise leave the user re-picking the kasa their profile already
// names as default.
export function sourceRegisterForType(
  type: string,
  current: string | undefined,
  fallback: string,
): string {
  return needsSourceRegister(type) ? current || fallback : ''
}
