import { sdk } from '../sdk'
import { createCompatibilityReport } from './createCompatibilityReport'
import { setDashboardPassword } from './setDashboardPassword'
import { setPayoutAddress } from './setPayoutAddress'

export const actions = sdk.Actions.of()
  .addAction(setPayoutAddress)
  .addAction(setDashboardPassword)
  .addAction(createCompatibilityReport)
