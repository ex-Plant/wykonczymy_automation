// Temporary: the investment page renders its financial figures two ways while the kosztorys plane is
// being reconciled against the transactions plane, and the owner needs to compare them side by side.
// Living in the URL rather than in state means the two readings are two links — open both in adjacent
// tabs — and v1 costs exactly what the page cost before the panel existed. Delete this whole axis
// once the owner calls the comparison over.
export const STATS_VERSION_PARAM = 'widok'

export type StatsVersionT = 'v1' | 'v2'

export const STATS_VERSION_DEFAULT: StatsVersionT = 'v2'

export function parseStatsVersion(raw: string | string[] | undefined): StatsVersionT {
  return raw === 'v1' ? 'v1' : STATS_VERSION_DEFAULT
}
