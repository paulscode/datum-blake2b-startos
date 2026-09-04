import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

/**
 * 1.0.0:36, kept in the graph so an install coming from below it still has a
 * node to walk through on the way to current.
 *
 * A migration belongs to the version that needed it and is not carried forward
 * into a successor. Carrying one forward means every later version re-declaring
 * work that is already done, and the point at which it stopped being needed gets
 * harder to find with each release.
 */
export const v1_0_0_36 = VersionInfo.of({
  version: '1.0.0:36',
  releaseNotes: {
    en_US:
      'Mainnet support, a payout address kept per chain, an editable Primary ' +
      'Coinbase Tag, mainnet and storage controls on the settings page, clean ' +
      'shutdown, and an explanation for the zero-subsidy case.',
  },
  migrations: {
    // A no-op since 1.0.0:43.
    //
    // This used to move a pre-split payout address under the chain its own
    // prefix identified, because the field it came from recorded no chain and
    // the address was the only evidence left.
    //
    // Addresses are not keyed by chain any more: :43 collapsed the map back to a
    // single `poolAddress`, since the node package follows BLAKE2b on mainnet
    // and nothing else. That version's migration reads every shape this key has
    // ever had, including the one this file used to produce, so doing the work
    // here as well would mean writing a field the schema no longer has.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
