// The palette a section can be pinned to: the nine chart hues at three tints (globals.css
// `--color-section-*`). Written out as literals, never assembled from `${hue}-${tint}` — Tailwind
// can't scan a template string, so a generated `bg-…` class would ship without its rule.
//
// `fill` feeds recharts, which takes the raw CSS var as a `fill` prop (the same indirection
// CHART_FILLS uses). The mid-tint rows deliberately point at `--color-chart-*` rather than their own
// `--color-section-*` alias: paintSlices subtracts pinned fills from the positional pool by STRING
// equality against CHART_FILLS, so switching to the alias would silently let a pinned section and an
// unpinned one render the same wedge. `swatch` is the picker's background utility; `label` is its
// Polish name, stored rather than derived from the key so the palette's vocabulary has one home.
//
// `rowTint` washes every grid row of the section. It descends to `.dsg-cell` because
// react-datasheet-grid paints each cell's own background — a background on the row element alone
// would sit entirely behind them. The `!` is load-bearing, NOT specificity padding: dsg's
// stylesheet is UNLAYERED, and unlayered CSS outranks every `@layer utilities` rule no matter how
// specific, so a normal-weight utility here loses to plain `.dsg-cell` and renders white.
export const SECTION_COLORS = [
  {
    key: 'blue-soft',
    label: 'niebieski jasny',
    fill: 'var(--color-section-blue-soft)',
    swatch: 'bg-section-blue-soft',
    rowTint: '[&_.dsg-cell]:bg-section-blue-soft/20!',
  },
  {
    key: 'turquoise-soft',
    label: 'turkusowy jasny',
    fill: 'var(--color-section-turquoise-soft)',
    swatch: 'bg-section-turquoise-soft',
    rowTint: '[&_.dsg-cell]:bg-section-turquoise-soft/20!',
  },
  {
    key: 'teal-soft',
    label: 'morski jasny',
    fill: 'var(--color-section-teal-soft)',
    swatch: 'bg-section-teal-soft',
    rowTint: '[&_.dsg-cell]:bg-section-teal-soft/20!',
  },
  {
    key: 'green-soft',
    label: 'zielony jasny',
    fill: 'var(--color-section-green-soft)',
    swatch: 'bg-section-green-soft',
    rowTint: '[&_.dsg-cell]:bg-section-green-soft/20!',
  },
  {
    key: 'yellow-soft',
    label: 'żółty jasny',
    fill: 'var(--color-section-yellow-soft)',
    swatch: 'bg-section-yellow-soft',
    rowTint: '[&_.dsg-cell]:bg-section-yellow-soft/20!',
  },
  {
    key: 'orange-soft',
    label: 'pomarańczowy jasny',
    fill: 'var(--color-section-orange-soft)',
    swatch: 'bg-section-orange-soft',
    rowTint: '[&_.dsg-cell]:bg-section-orange-soft/20!',
  },
  {
    key: 'red-soft',
    label: 'czerwony jasny',
    fill: 'var(--color-section-red-soft)',
    swatch: 'bg-section-red-soft',
    rowTint: '[&_.dsg-cell]:bg-section-red-soft/20!',
  },
  {
    key: 'pink-soft',
    label: 'różowy jasny',
    fill: 'var(--color-section-pink-soft)',
    swatch: 'bg-section-pink-soft',
    rowTint: '[&_.dsg-cell]:bg-section-pink-soft/20!',
  },
  {
    key: 'purple-soft',
    label: 'fioletowy jasny',
    fill: 'var(--color-section-purple-soft)',
    swatch: 'bg-section-purple-soft',
    rowTint: '[&_.dsg-cell]:bg-section-purple-soft/20!',
  },

  {
    key: 'blue',
    label: 'niebieski',
    fill: 'var(--color-chart-blue)',
    swatch: 'bg-section-blue',
    rowTint: '[&_.dsg-cell]:bg-section-blue/20!',
  },
  {
    key: 'turquoise',
    label: 'turkusowy',
    fill: 'var(--color-chart-turquoise)',
    swatch: 'bg-section-turquoise',
    rowTint: '[&_.dsg-cell]:bg-section-turquoise/20!',
  },
  {
    key: 'teal',
    label: 'morski',
    fill: 'var(--color-chart-teal)',
    swatch: 'bg-section-teal',
    rowTint: '[&_.dsg-cell]:bg-section-teal/20!',
  },
  {
    key: 'green',
    label: 'zielony',
    fill: 'var(--color-chart-green)',
    swatch: 'bg-section-green',
    rowTint: '[&_.dsg-cell]:bg-section-green/20!',
  },
  {
    key: 'yellow',
    label: 'żółty',
    fill: 'var(--color-chart-yellow)',
    swatch: 'bg-section-yellow',
    rowTint: '[&_.dsg-cell]:bg-section-yellow/20!',
  },
  {
    key: 'orange',
    label: 'pomarańczowy',
    fill: 'var(--color-chart-orange)',
    swatch: 'bg-section-orange',
    rowTint: '[&_.dsg-cell]:bg-section-orange/20!',
  },
  {
    key: 'red',
    label: 'czerwony',
    fill: 'var(--color-chart-red)',
    swatch: 'bg-section-red',
    rowTint: '[&_.dsg-cell]:bg-section-red/20!',
  },
  {
    key: 'pink',
    label: 'różowy',
    fill: 'var(--color-chart-pink)',
    swatch: 'bg-section-pink',
    rowTint: '[&_.dsg-cell]:bg-section-pink/20!',
  },
  {
    key: 'purple',
    label: 'fioletowy',
    fill: 'var(--color-chart-purple)',
    swatch: 'bg-section-purple',
    rowTint: '[&_.dsg-cell]:bg-section-purple/20!',
  },

  {
    key: 'blue-deep',
    label: 'niebieski ciemny',
    fill: 'var(--color-section-blue-deep)',
    swatch: 'bg-section-blue-deep',
    rowTint: '[&_.dsg-cell]:bg-section-blue-deep/20!',
  },
  {
    key: 'turquoise-deep',
    label: 'turkusowy ciemny',
    fill: 'var(--color-section-turquoise-deep)',
    swatch: 'bg-section-turquoise-deep',
    rowTint: '[&_.dsg-cell]:bg-section-turquoise-deep/20!',
  },
  {
    key: 'teal-deep',
    label: 'morski ciemny',
    fill: 'var(--color-section-teal-deep)',
    swatch: 'bg-section-teal-deep',
    rowTint: '[&_.dsg-cell]:bg-section-teal-deep/20!',
  },
  {
    key: 'green-deep',
    label: 'zielony ciemny',
    fill: 'var(--color-section-green-deep)',
    swatch: 'bg-section-green-deep',
    rowTint: '[&_.dsg-cell]:bg-section-green-deep/20!',
  },
  {
    key: 'yellow-deep',
    label: 'żółty ciemny',
    fill: 'var(--color-section-yellow-deep)',
    swatch: 'bg-section-yellow-deep',
    rowTint: '[&_.dsg-cell]:bg-section-yellow-deep/20!',
  },
  {
    key: 'orange-deep',
    label: 'pomarańczowy ciemny',
    fill: 'var(--color-section-orange-deep)',
    swatch: 'bg-section-orange-deep',
    rowTint: '[&_.dsg-cell]:bg-section-orange-deep/20!',
  },
  {
    key: 'red-deep',
    label: 'czerwony ciemny',
    fill: 'var(--color-section-red-deep)',
    swatch: 'bg-section-red-deep',
    rowTint: '[&_.dsg-cell]:bg-section-red-deep/20!',
  },
  {
    key: 'pink-deep',
    label: 'różowy ciemny',
    fill: 'var(--color-section-pink-deep)',
    swatch: 'bg-section-pink-deep',
    rowTint: '[&_.dsg-cell]:bg-section-pink-deep/20!',
  },
  {
    key: 'purple-deep',
    label: 'fioletowy ciemny',
    fill: 'var(--color-section-purple-deep)',
    swatch: 'bg-section-purple-deep',
    rowTint: '[&_.dsg-cell]:bg-section-purple-deep/20!',
  },
] as const

export type SectionColorKeyT = (typeof SECTION_COLORS)[number]['key']

// The picker lays the palette out `grid-cols-9` — hue across, tint down — so SECTION_COLORS is stored
// row-major (nine jasne, nine bazowe, nine ciemne). Auto-assignment walks it COLUMN-major instead:
// down a hue's three tints, then on to the next hue. Derived from the array rather than written out a
// second time — these are plain key strings, so unlike `swatch`/`rowTint` there is no Tailwind
// scanner to satisfy, and a hand-kept second list would be one more thing to drift.
const TINTS_PER_HUE = 3
const HUE_COUNT = SECTION_COLORS.length / TINTS_PER_HUE

export const SECTION_COLOR_SEQUENCE: readonly SectionColorKeyT[] = SECTION_COLORS.map(
  (_, i) => SECTION_COLORS[(i % TINTS_PER_HUE) * HUE_COUNT + Math.floor(i / TINTS_PER_HUE)].key,
)

// Nth section's colour, wrapping once the palette runs out — 28 sections is rarer than a crash would
// be forgivable, so it cycles rather than returning null.
export function sectionColorForIndex(index: number): SectionColorKeyT {
  return SECTION_COLOR_SEQUENCE[index % SECTION_COLOR_SEQUENCE.length]
}

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

export function sectionColorRowTint(key: string | null | undefined): string | undefined {
  return key != null ? BY_KEY.get(key)?.rowTint : undefined
}
