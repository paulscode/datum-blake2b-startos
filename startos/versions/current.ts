import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes = `Documents how long mined coins are locked before they can be spent, which the setup instructions did not say at all.

The wait used to be 100 blocks, about 16 hours, and was short enough that nobody noticed. The chain has deployed a temporary longer one of 6480 blocks, roughly 45 days at a ten minute block target, and it applies to coins already mined as well as new ones. So a payout that was spendable before nodes took the rule is not spendable after it.

Nothing is lost and nothing here changes how the gateway mines. This release only adds the explanation to the instructions, under "Get a payout address", so a first block arriving and then sitting unspendable is expected rather than alarming.

Use a wallet that knows the rule. One that does not may offer the coins and then fail when you try to send them.`

export const current = VersionInfo.of({
  version: '1.0.0:51',
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
