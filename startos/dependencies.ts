import { sdk } from './sdk'

export const setDependencies = sdk.setupDependencies(async ({ effects }) => {
  // Clear the two tasks this service used to create against the node.
  //
  // StartOS does not garbage-collect tasks, so dropping a `createTask` call
  // does nothing for an install that already ran it: the task stays in this
  // service's record and keeps rendering in the Dependencies section forever.
  // Removing a task means clearing it by replay id, which is
  // `${packageId}:${actionId}`.
  //
  //   knots-blake2b:get-payout-address  an action the node removed in its
  //                                     1.0.0:31, so the task pointed at
  //                                     nothing.
  //   knots-blake2b:get-address         the node's current Get Address, raised
  //                                     here as "Recommended". Removed
  //                                     deliberately; see below.
  //
  // Kept in the init path rather than in a migration on purpose. A migration
  // fires only for installs crossing one particular version boundary, and this
  // needs to repair any install that has ever held either task. Clearing an id
  // that is not there is a no-op.
  await sdk.action.clearTask(
    effects,
    'knots-blake2b:get-payout-address',
    'knots-blake2b:get-address',
  )

  // NOTHING RECOMMENDS THE NODE'S ADDRESS ANY MORE, AND NOTHING SHOULD.
  //
  // This used to raise the node's Get Address action as an `important` task, so
  // the Dependencies section told you to fetch a payout address from the node.
  // That made sense when this package served a private regtest chain, where the
  // node's wallet was the only wallet in play and the coins were worthless.
  //
  // On mainnet it is advice that costs money. A payout address should be one
  // whose keys you hold in a wallet you back up, which for most people is an
  // external wallet such as Sparrow, not the node's own wallet sitting on the
  // server. Solo mining pays a whole block subsidy to that single address.
  //
  // The node's Get Address action still exists and still works for anyone who
  // wants it. This package simply no longer points at it.

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
