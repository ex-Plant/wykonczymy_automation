// The palette a section can be pinned to: the nine chart hues at three tints (globals.css
// `--color-section-*`). Written out as literals, never assembled from `${hue}-${tint}` — Tailwind
// can't scan a template string, so a generated `bg-…` class would ship without its rule.
//
// `fill` feeds recharts, which takes the raw CSS var as a `fill` prop (the same indirection
// CHART_FILLS uses). The mid-tint rows deliberately point at `--color-chart-*` rather than their own
// `--color-section-*` alias: paintSlices subtracts pinned fills from the positional pool by STRING
// equality against CHART_FILLS, so switching to the alias would silently let a pinned section and an
// unpinned one render the same wedge. `swatch` is the picker's background utility. `rowTint` washes every grid row of
// the section — it targets `.dsg-cell` because react-datasheet-grid paints each cell's background
// itself, so a background on the row element alone would sit entirely behind them.
export const SECTION_COLORS = [
  { key: 'blue-soft', fill: 'var(--color-section-blue-soft)', swatch: 'bg-section-blue-soft', rowTint: '[&_.dsg-cell]:bg-section-blue-soft/20' },
  {
    key: 'turquoise-soft',
    fill: 'var(--color-section-turquoise-soft)',
    swatch: 'bg-section-turquoise-soft', rowTint: '[&_.dsg-cell]:bg-section-turquoise-soft/20',
  },
  { key: 'teal-soft', fill: 'var(--color-section-teal-soft)', swatch: 'bg-section-teal-soft', rowTint: '[&_.dsg-cell]:bg-section-teal-soft/20' },
  { key: 'green-soft', fill: 'var(--color-section-green-soft)', swatch: 'bg-section-green-soft', rowTint: '[&_.dsg-cell]:bg-section-green-soft/20' },
  {
    key: 'yellow-soft',
    fill: 'var(--color-section-yellow-soft)',
    swatch: 'bg-section-yellow-soft', rowTint: '[&_.dsg-cell]:bg-section-yellow-soft/20',
  },
  {
    key: 'orange-soft',
    fill: 'var(--color-section-orange-soft)',
    swatch: 'bg-section-orange-soft', rowTint: '[&_.dsg-cell]:bg-section-orange-soft/20',
  },
  { key: 'red-soft', fill: 'var(--color-section-red-soft)', swatch: 'bg-section-red-soft', rowTint: '[&_.dsg-cell]:bg-section-red-soft/20' },
  { key: 'pink-soft', fill: 'var(--color-section-pink-soft)', swatch: 'bg-section-pink-soft', rowTint: '[&_.dsg-cell]:bg-section-pink-soft/20' },
  {
    key: 'purple-soft',
    fill: 'var(--color-section-purple-soft)',
    swatch: 'bg-section-purple-soft', rowTint: '[&_.dsg-cell]:bg-section-purple-soft/20',
  },

  { key: 'blue', fill: 'var(--color-chart-blue)', swatch: 'bg-section-blue', rowTint: '[&_.dsg-cell]:bg-section-blue/20' },
  { key: 'turquoise', fill: 'var(--color-chart-turquoise)', swatch: 'bg-section-turquoise', rowTint: '[&_.dsg-cell]:bg-section-turquoise/20' },
  { key: 'teal', fill: 'var(--color-chart-teal)', swatch: 'bg-section-teal', rowTint: '[&_.dsg-cell]:bg-section-teal/20' },
  { key: 'green', fill: 'var(--color-chart-green)', swatch: 'bg-section-green', rowTint: '[&_.dsg-cell]:bg-section-green/20' },
  { key: 'yellow', fill: 'var(--color-chart-yellow)', swatch: 'bg-section-yellow', rowTint: '[&_.dsg-cell]:bg-section-yellow/20' },
  { key: 'orange', fill: 'var(--color-chart-orange)', swatch: 'bg-section-orange', rowTint: '[&_.dsg-cell]:bg-section-orange/20' },
  { key: 'red', fill: 'var(--color-chart-red)', swatch: 'bg-section-red', rowTint: '[&_.dsg-cell]:bg-section-red/20' },
  { key: 'pink', fill: 'var(--color-chart-pink)', swatch: 'bg-section-pink', rowTint: '[&_.dsg-cell]:bg-section-pink/20' },
  { key: 'purple', fill: 'var(--color-chart-purple)', swatch: 'bg-section-purple', rowTint: '[&_.dsg-cell]:bg-section-purple/20' },

  { key: 'blue-deep', fill: 'var(--color-section-blue-deep)', swatch: 'bg-section-blue-deep', rowTint: '[&_.dsg-cell]:bg-section-blue-deep/20' },
  {
    key: 'turquoise-deep',
    fill: 'var(--color-section-turquoise-deep)',
    swatch: 'bg-section-turquoise-deep', rowTint: '[&_.dsg-cell]:bg-section-turquoise-deep/20',
  },
  { key: 'teal-deep', fill: 'var(--color-section-teal-deep)', swatch: 'bg-section-teal-deep', rowTint: '[&_.dsg-cell]:bg-section-teal-deep/20' },
  { key: 'green-deep', fill: 'var(--color-section-green-deep)', swatch: 'bg-section-green-deep', rowTint: '[&_.dsg-cell]:bg-section-green-deep/20' },
  {
    key: 'yellow-deep',
    fill: 'var(--color-section-yellow-deep)',
    swatch: 'bg-section-yellow-deep', rowTint: '[&_.dsg-cell]:bg-section-yellow-deep/20',
  },
  {
    key: 'orange-deep',
    fill: 'var(--color-section-orange-deep)',
    swatch: 'bg-section-orange-deep', rowTint: '[&_.dsg-cell]:bg-section-orange-deep/20',
  },
  { key: 'red-deep', fill: 'var(--color-section-red-deep)', swatch: 'bg-section-red-deep', rowTint: '[&_.dsg-cell]:bg-section-red-deep/20' },
  { key: 'pink-deep', fill: 'var(--color-section-pink-deep)', swatch: 'bg-section-pink-deep', rowTint: '[&_.dsg-cell]:bg-section-pink-deep/20' },
  {
    key: 'purple-deep',
    fill: 'var(--color-section-purple-deep)',
    swatch: 'bg-section-purple-deep', rowTint: '[&_.dsg-cell]:bg-section-purple-deep/20',
  },
] as const

export type SectionColorKeyT = (typeof SECTION_COLORS)[number]['key']

const BY_KEY = new Map(SECTION_COLORS.map((c) => [c.key as string, c]))

// A section's stored colour is validated on read, not just on write: the column is plain text (the
// palette grows without a migration), so a key retired from SECTION_COLORS must degrade to "unpinned"
// rather than paint a slice with a dead CSS var.
export function isSectionColorKey(value: unknown): value is SectionColorKeyT {
  return typeof value === 'string' && BY_KEY.has(value)
}

export function sectionColorFill(key: string | null | undefined): string | undefined {
  return key != null ? BY_KEY.get(key)?.fill : undefined
}

export function sectionColorSwatch(key: string | null | undefined): string | undefined {
  return key != null ? BY_KEY.get(key)?.swatch : undefined
}

export function sectionColorRowTint(key: string | null | undefined): string | undefined {
  return key != null ? BY_KEY.get(key)?.rowTint : undefined
}
