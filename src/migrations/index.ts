import * as migration_20260211_202001 from './20260211_202001';
import * as migration_20260211_204911_add_user_role from './20260211_204911_add_user_role';
import * as migration_20260211_212425 from './20260211_212425';
import * as migration_20260211_213603 from './20260211_213603';

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
    name: '20260211_213603'
  },
];
