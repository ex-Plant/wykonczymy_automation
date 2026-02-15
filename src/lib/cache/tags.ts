export const CACHE_TAGS = {
  transactions: 'collection:transactions',
  cashRegisters: 'collection:cash-registers',
  investments: 'collection:investments',
  users: 'collection:users',
  otherCategories: 'collection:other-categories',
} as const

export type CacheTagT = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]
