import * as migration_20260211_202001 from './20260211_202001';
import * as migration_20260211_204911_add_user_role from './20260211_204911_add_user_role';

export const migrations = [
  {
    up: migration_20260211_202001.up,
    down: migration_20260211_202001.down,
    name: '20260211_202001',
  },
  {
    up: migration_20260211_204911_add_user_role.up,
    down: migration_20260211_204911_add_user_role.down,
    name: '20260211_204911_add_user_role'
  },
];
