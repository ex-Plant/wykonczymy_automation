import * as migration_20260211_202001 from './20260211_202001'
import * as migration_20260211_204911_add_user_role from './20260211_204911_add_user_role'
import * as migration_20260211_212425 from './20260211_212425'
import * as migration_20260211_213603 from './20260211_213603'
import * as migration_20260212_191046_add_deposit_type from './20260212_191046_add_deposit_type'
import * as migration_20260216_add_performance_indexes from './20260216_add_performance_indexes'

export const migrations = [
  {
    up: migration_20260211_202001.up,
    down: migration_20260211_202001.down,
    name: '20260211_202001',
  },
  {
    up: migration_20260211_204911_add_user_role.up,
    down: migration_20260211_204911_add_user_role.down,
    name: '20260211_204911_add_user_role',
  },
  {
    up: migration_20260211_212425.up,
    down: migration_20260211_212425.down,
    name: '20260211_212425',
  },
  {
    up: migration_20260211_213603.up,
    down: migration_20260211_213603.down,
    name: '20260211_213603',
  },
  {
    up: migration_20260212_191046_add_deposit_type.up,
    down: migration_20260212_191046_add_deposit_type.down,
    name: '20260212_191046_add_deposit_type',
  },
  {
    up: migration_20260216_add_performance_indexes.up,
    down: migration_20260216_add_performance_indexes.down,
    name: '20260216_add_performance_indexes',
  },
]
