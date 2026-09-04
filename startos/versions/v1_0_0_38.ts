import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

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

export const v1_0_0_38 = VersionInfo.of({
  version: '1.0.0:38',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // A no-op since 1.0.0:43.
    //
    // This used to re-file a payout address stored under the old spelling of
    // mainnet. :36 filed it as `main`, :38 renamed the key to `mainnet` to match
    // what the node package called the chain, and left alone an address under
    // the old spelling would have read as unset: the gateway would refuse to
    // start and the critical task would ask for it again.
    //
    // Addresses are not keyed by chain any more. :43 collapsed the map back to a
    // single `poolAddress`, and its migration reads both spellings along with
    // the pre-:36 single field, so there is nothing left for this to do.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
