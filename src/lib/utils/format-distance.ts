export const formatKm = (value: number) => `${value.toLocaleString('pl-PL')} km`

/** For a reading that may be unknown: „—" rather than „0 km", which would read as a real odometer. */
export const formatKmOrDash = (value: number | null) => (value === null ? '—' : formatKm(value))
