import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes = `Update the companion node as well as this app. If you mine against a node that has not taken the chain's new coinbase maturity rule, the blocks you find will be rejected.

The gateway takes its list of transactions straight from the node and does not check them, so this is not something it can protect you from. A node without the rule will offer transactions that stopped being valid at block 973440, and any block built from them is invalid. Bitcoin Knots (BLAKE2b) Companion 1.0.0:36 is the first version with the rule, and this release now says so as a dependency, so the interface will tell you if the pairing is wrong.

Nothing about how the gateway mines changes, and you do not need to reconfigure your miners.

This release also documents how long mined coins are locked, which the setup instructions did not say at all. The wait used to be 100 blocks, about 16 hours; it is now 6480 blocks, roughly 45 days at a ten minute block target, and it applies to coins already mined as well as new ones. Nothing is lost, but a first block arriving and then sitting unspendable is expected rather than a fault. Use a wallet that knows the rule; one that does not may offer the coins and then fail when you try to send them.`

export const current = VersionInfo.of({
  version: '1.0.0:52',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. The dupe table is rebuilt from nothing on every start,
    // so the corrupted state this fixes cannot survive the restart that installing
    // this performs, and the new reject counters start at zero by the same route.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
