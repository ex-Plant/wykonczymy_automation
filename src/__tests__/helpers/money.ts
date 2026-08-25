/**
 * Round a PLN figure to the grosz, for comparing two independently-summed money paths.
 *
 * Shared by the parity and golden-master specs on purpose: if they rounded differently,
 * a drift line could appear (or vanish) purely from float noise below a grosz, and the
 * two suites would disagree about whether a figure moved.
 */
export const round2 = (n: number) => Math.round(n * 100) / 100
