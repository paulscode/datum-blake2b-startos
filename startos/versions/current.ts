import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes = `Removes the "Get Address" task this service raised against the node.

It showed in the Dependencies section as Recommended, telling you to fetch a payout address from the node's own wallet. That is a habit from when this pair served a private test chain, where the node's wallet was the only wallet involved and the coins were worthless.

On mainnet it is advice that can cost real money. Mining solo pays a whole block subsidy to the single address you configure, so it should be an address from a wallet whose keys you hold and already back up, typically an external wallet such as Sparrow. The node's wallet lives on the server with no seed phrase in your hands.

The node's Get Address action is untouched and still there for anyone who wants it. This service simply no longer recommends it, and the payout form and instructions now point at a wallet you control instead.

An existing install has the old task cleared on its next start. StartOS does not remove tasks on its own, so dropping the code that created it is not enough to make it disappear.`

export const current = VersionInfo.of({
  version: '1.0.0:44',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. The task is cleared by `setDependencies` on every
    // init rather than here, so an install that never crosses this exact edge
    // is repaired too. The 1.0.0:43 store migration stays with :43.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
