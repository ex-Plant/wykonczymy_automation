// A kosztorys-plane figure carries no date, type or register, so it cannot follow the host's
// transaction filters. The hint says „zawiera" rather than „jest" because the marker also rides the
// mixed totals (Łącznie, Do zapłaty), where only the kosztorys share is filter-blind.
export const SCOPE_MARKER_HINT = 'Zawiera wartość z kosztorysu — nie reaguje na filtry transakcji'
export const SCOPE_MARKER_FOOTNOTE = 'Pola oznaczone gwiazdką nie reagują na filtry transakcji'
