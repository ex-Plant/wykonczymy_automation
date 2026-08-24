import { type FooterComparisonT } from '@/lib/kosztorys/sheet-import/footer-totals'

// Half a grosz — below it the two sides differ only by float noise, which is not a finding.
const MATCHES = 0.005

/**
 * „R netto - suma prac wykonannych" names one figure and one only, so it is checked against that
 * figure rather than against whichever candidate it happens to equal. `compareFooterTotals` tries
 * every candidate on purpose — the owners' labels do not reliably say which total a row holds, and
 * that leniency is right for the import gate, which asks „did we parse this sheet at all". Here the
 * question is the opposite one: a footer that sums the wrong columns lands on the OFFER total, and
 * accepting that as agreement is exactly how a sheet that disagrees with itself reads as a clean one.
 *
 * „wartość netto" gets no such treatment: Przedmiar and Pomiar are both defensible readings of that
 * label, which is why the matching machinery exists at all.
 */
export const againstNamedFigure =
  (executedFromSheet: number) =>
  (total: FooterComparisonT): FooterComparisonT => {
    if (total.key !== 'executedNet' || total.sheetValue === null) return total
    const delta = total.sheetValue - executedFromSheet
    return {
      ...total,
      appValue: executedFromSheet,
      delta,
      matches: Math.abs(delta) < MATCHES,
    }
  }
