import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { chainFromAddress } from '../payoutAddress'

/**
 * 1.0.0:36, spun off so its migration stays with the version that introduced it.
 *
 * The payout-address split shipped in :36. A migration belongs to the version
 * that needed it and is not carried forward into a successor, so :37 declares a
 * clean one and this file keeps the work :36 did. Someone installed below :36
 * still runs it on the way up: `VersionGraph` synthesizes a range vertex beneath
 * `current`, so the hop passes through here.
 *
 * It is idempotent anyway, thanks to the `poolAddresses` guard below, but that is
 * not the reason it is here. Carrying a migration forward means every later
 * version re-declares work that is already done, and the point at which it
 * stopped being needed gets harder to find with each release.
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
    up: async ({ effects }) => {
      // Move a pre-split payout address under the chain it belongs to.
      //
      // The old field recorded no chain, so the address itself is the only
      // evidence. `chainFromAddress` reads the prefix and answers null when the
      // prefix cannot decide, which is the honest answer for base58 test
      // addresses: regtest and the public test network share `m`, `n` and `2`,
      // and that shared prefix is precisely why a stale address was accepted on
      // the wrong chain instead of rejected.
      //
      // Undecidable means leave it unassigned. The critical task then asks for
      // one, which is a small interruption next to paying block rewards into a
      // wallet the operator may not have.
      const store = await storeJson.read().once()
      const legacy = store?.poolAddress?.trim()
      if (!legacy) return
      if (Object.keys(store?.poolAddresses ?? {}).length > 0) return

      const chain = chainFromAddress(legacy)
      if (!chain) return

      await storeJson.merge(effects, { poolAddresses: { [chain]: legacy } })
    },
    down: IMPOSSIBLE,
  },
})
