import { sdk } from '../sdk'
import { createCompatibilityReport } from './createCompatibilityReport'
import { setPayoutAddress } from './setPayoutAddress'

export const actions = sdk.Actions.of()
  .addAction(setPayoutAddress)
  .addAction(createCompatibilityReport)
