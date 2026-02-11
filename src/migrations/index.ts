import * as migration_20260211_202001 from './20260211_202001';

export const migrations = [
  {
    up: migration_20260211_202001.up,
    down: migration_20260211_202001.down,
    name: '20260211_202001'
  },
];
