import { sdk } from '../sdk'
import { setPayoutAddress } from './setPayoutAddress'

export const actions = sdk.Actions.of().addAction(setPayoutAddress)
