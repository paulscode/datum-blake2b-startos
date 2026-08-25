import { sdk } from '../sdk'
import { apiConfig } from './config/api'
import { bitcoindConfig } from './config/bitcoind'
import { datumConfig } from './config/datum'
import { loggerConfig } from './config/logger'
import { miningConfig } from './config/mining'
import { stratumConfig } from './config/stratum'
import { createCompatibilityReport } from './createCompatibilityReport'
import { setDashboardPassword } from './setDashboardPassword'
import { setPayoutAddress } from './setPayoutAddress'

// Order matters: the two that a new install needs come first, then the config
// group in the same order the official Datum Gateway package lists it, then
// this package's own extra.
export const actions = sdk.Actions.of()
  .addAction(setPayoutAddress)
  .addAction(setDashboardPassword)
  .addAction(bitcoindConfig)
  .addAction(stratumConfig)
  .addAction(miningConfig)
  .addAction(apiConfig)
  .addAction(loggerConfig)
  .addAction(datumConfig)
  .addAction(createCompatibilityReport)
