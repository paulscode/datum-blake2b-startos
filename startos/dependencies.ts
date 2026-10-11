import { knotsDependencyDescription } from './manifest/i18n-dependency'
import { sdk } from './sdk'

// MUST be our node, not the official `bitcoind`. Depending on `bitcoind`
// would bind this gateway to the user's mainnet node and generate templates
// for the wrong chain. This is a correctness requirement, not a naming one.
const knots = sdk.Dependency.required('knots-blake2b', {
  description: knotsDependencyDescription,
  metadata: {
    title: 'Bitcoin Knots (BLAKE2b) Companion',
    // A dependency icon is an absolute URL into the dependency's repo, not a
    // magic filename, so PNG is fine (E9). It is fetched by the StartOS UI,
    // which means the packaging repo has to be public for it to render.
    icon: 'https://raw.githubusercontent.com/paulscode/knots-blake2b-startos/4dcb43811bf695ce6631e3e43876b41db52300ed/dep-icon.png',
  },
  // 'running' rather than 'exists': the gateway needs live templates, not just
  // an installed node. This drives the warning UI only; it does not gate
  // startup.
  kind: 'running',
  // Raised from '>=1.0.0' for the long coinbase maturity rule. The gateway
  // takes its transaction list verbatim from the node's getblocktemplate and
  // has no selection or validation of its own, so a node that has not taken
  // the rule will hand it transactions that became invalid at height 973440
  // and every block it builds from them is rejected. Nothing in the gateway
  // can detect that, which is why the pairing is stated here instead.
  versionRange: '>=1.0.0:36',
  healthChecks: ['node'],
}).withInit(async (effects) => {
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
})

export const dependencies = sdk.Dependencies.of().addDependency(knots)
