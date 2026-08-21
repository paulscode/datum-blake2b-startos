import { getPayoutAddress } from 'knots-blake2b-startos/startos/actions/getPayoutAddress'
import { i18n } from './i18n'
import { sdk } from './sdk'

export const setDependencies = sdk.setupDependencies(async ({ effects }) => {
  // Point the user at the node's action for getting an address. Without this the
  // Set Payout Address form asks for something the box gives you no way to
  // obtain: the only other route is bitcoin-cli over SSH.
  await sdk.action.createTask(
    effects,
    'knots-blake2b',
    getPayoutAddress,
    'important',
    {
      reason: i18n('Get an address from your node to receive block rewards'),
    },
  )

  return {
    // Our node, never the official `bitcoind`. Depending on `bitcoind` would bind
    // this gateway to the user's mainnet node and generate templates for the
    // wrong chain, which a Sia miner cannot mine and the node would reject.
    //
    // 'running' rather than 'exists': the gateway needs live templates, not just
    // an installed node. This drives the warning UI only; it does not gate
    // startup.
    'knots-blake2b': {
      kind: 'running',
      versionRange: '>=1.0.0',
      healthChecks: ['node'],
    },
  }
})
