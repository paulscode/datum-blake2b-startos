import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'

const notes =
  'Fixes Set Payout Address, which failed on mainnet with a message telling you ' +
  'to start the service, and starting the service could not have helped. ' +
  ' ' +
  'Two faults, one behind the other. The gateway recorded which chain your node ' +
  'was on when it started, and the address check compared that against a list ' +
  'that spelled mainnet differently, so it never matched. Behind that, the ' +
  'recording had never worked at all: it crashed the start, which is also why ' +
  'the service would not stay running. ' +
  ' ' +
  'The address check now reads the chain from your node directly instead of ' +
  'from anything the gateway saved earlier. That also fixes the order you had ' +
  'to do things in: the payout address can be set before the first start, which ' +
  'is when it is needed, since the service will not start without one.'

export const current = VersionInfo.of({
  version: '1.0.0:38',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Re-file a payout address stored under the old spelling of mainnet.
    //
    // Addresses are keyed by chain, and this version renames that key from `main` to `mainnet` so
    // it matches what the node package calls the chain. The mismatch is the bug being fixed, but
    // anyone whose address was filed by the :36 migration has it under `main` already, and every
    // reader now looks for `mainnet`. Left alone their address would silently read as unset: the
    // gateway would refuse to start and the critical task would ask them to set it again.
    //
    // Only moved when there is nothing already under the new key, so an address set deliberately
    // since is never overwritten by an older one.
    up: async ({ effects }) => {
      const store = await storeJson.read().once()
      const byChain = store?.poolAddresses ?? {}
      const legacy = (byChain as Record<string, string>)['main']
      if (!legacy || byChain['mainnet']) return

      const { main: _dropped, ...rest } = byChain as Record<string, string>
      await storeJson.merge(effects, {
        poolAddresses: { ...rest, mainnet: legacy },
      })
    },
    down: IMPOSSIBLE,
  },
})
