// A kosztorys-plane figure carries no date, type or register, so it cannot follow the host's
// transaction filters. Under an active filter it gets a `*` (this hint) and the panel prints the
// footnote once — one copy of the copy, so the row marker and the explanation can't drift.
export const SCOPE_MARKER_HINT = 'Wartość z kosztorysu — nie reaguje na filtry transakcji'
export const SCOPE_MARKER_FOOTNOTE = '* Wartości z kosztorysu nie reagują na filtry transakcji.'
