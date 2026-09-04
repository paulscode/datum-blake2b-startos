import { sdk } from '../sdk'
import { apiConfig } from './config/api'
import { bitcoindConfig } from './config/bitcoind'
import { datumConfig } from './config/datum'
import { loggerConfig } from './config/logger'
import { miningConfig } from './config/mining'
import { stratumConfig } from './config/stratum'
import { setDashboardPassword } from './setDashboardPassword'
import { setPayoutAddress } from './setPayoutAddress'

// Order matters: the two that a new install needs come first, then the config
// group in the same order the official Datum Gateway package lists it.
//
// This is now exactly that package's action list. Create Compatibility Report
// used to follow, and it was the one thing here with no counterpart there.
export const actions = sdk.Actions.of()
  .addAction(setPayoutAddress)
  .addAction(setDashboardPassword)
  .addAction(bitcoindConfig)
  .addAction(stratumConfig)
  .addAction(miningConfig)
  .addAction(apiConfig)
  .addAction(loggerConfig)
  .addAction(datumConfig)
