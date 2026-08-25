// The two refusals the client-facing kosztorys actions return. They live outside those actions
// because a `'use server'` module may export nothing but async functions, and the menu needs the
// same sentence to put ON the door that the server would otherwise say only at the end of it.
export const OWNER_ONLY_SHARE_MESSAGE = 'Tylko właściciel może udostępniać kosztorys inwestorowi'

export const OWNER_ONLY_CLIENT_VIEW_MESSAGE =
  'Tylko właściciel może zmieniać ustawienia podglądu inwestora'
