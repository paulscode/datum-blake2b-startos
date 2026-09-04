import { getaddress } from 'knots-blake2b-startos/startos/actions/getaddress'
import { i18n } from './i18n'
import { sdk } from './sdk'

export const setDependencies = sdk.setupDependencies(async ({ effects }) => {
  // Clear the task this service used to create against the node's old action.
  //
  // StartOS does not garbage-collect tasks. A task created by an earlier version
  // stays in this service's record and keeps rendering in the Dependencies
  // section, pointing at `knots-blake2b:get-payout-address`, which the node
  // removed when it adopted the official Bitcoin Knots action set in its
  // 1.0.0:31. Creating the replacement below does not displace it: they have
  // different replay ids, so both appear and one of them is broken.
  //
  // Kept here rather than in a migration on purpose. A migration would fire only
  // for installs crossing one particular version boundary, and this needs to
  // repair any install that has ever held the old task. Clearing an id that is
  // not there is a no-op, so the cost of leaving it in the init path is one call.
  await sdk.action.clearTask(effects, 'knots-blake2b:get-payout-address')

  // Point the user at the node's action for getting an address. Without this the
  // Set Payout Address form asks for something the box gives you no way to
  // obtain: the only other route is bitcoin-cli over SSH.
  //
  // `getaddress` (id `get-address`), not the `getPayoutAddress` this used to
  // name. That action was replaced by the official Get Address, which also
  // returns bech32 and is therefore still an address DATUM can pay to.
  await sdk.action.createTask(
    effects,
    'knots-blake2b',
    getaddress,
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
