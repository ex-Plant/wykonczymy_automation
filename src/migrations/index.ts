import * as migration_20260211_202001 from './20260211_202001'
import * as migration_20260211_204911_add_user_role from './20260211_204911_add_user_role'
import * as migration_20260211_212425 from './20260211_212425'
import * as migration_20260211_213603 from './20260211_213603'
import * as migration_20260212_191046_add_deposit_type from './20260212_191046_add_deposit_type'
import * as migration_20260216_add_performance_indexes from './20260216_add_performance_indexes'
import * as migration_20260218_rename_advance_to_account_funding from './20260218_rename_advance_to_account_funding'
import * as migration_20260218_0_transaction_type_enums from './20260218_0_transaction_type_enums'
import * as migration_20260218_transaction_type_overhaul from './20260218_transaction_type_overhaul'
import * as migration_20260218_add_cash_register_type from './20260218_add_cash_register_type'

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
  {
    up: migration_20260218_rename_advance_to_account_funding.up,
    down: migration_20260218_rename_advance_to_account_funding.down,
    name: '20260218_rename_advance_to_account_funding',
  },
  {
    up: migration_20260218_0_transaction_type_enums.up,
    down: migration_20260218_0_transaction_type_enums.down,
    name: '20260218_0_transaction_type_enums',
  },
  {
    up: migration_20260218_transaction_type_overhaul.up,
    down: migration_20260218_transaction_type_overhaul.down,
    name: '20260218_transaction_type_overhaul',
  },
  {
    up: migration_20260218_add_cash_register_type.up,
    down: migration_20260218_add_cash_register_type.down,
    name: '20260218_add_cash_register_type',
  },
]
