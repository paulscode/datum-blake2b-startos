import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'The Compatibility Report works on mainnet. It reports whether your node ' +
  'accepted the blocks your miner found, and to ask the node that it needs the ' +
  "node's RPC credentials. It looked for them in a directory that only exists " +
  'on a private chain, so on mainnet it never found them and reported block ' +
  'acceptance as "not checked". That is the one question the report exists to ' +
  'answer, and it went quiet rather than wrong, which is easy to miss. Reports ' +
  'made on mainnet before this update understated what your miner did. ' +
  ' ' +
  'On deployments without a settings form, such as Umbrel and plain Docker, ' +
  'the page this gateway serves now shows mainnet when no chain has been ' +
  'chosen, matching what the node actually runs. It showed the private chain, ' +
  'so the page and the node could disagree about which chain you were on.'

export const current = VersionInfo.of({
  version: '1.0.0:37',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. This version changes where the Compatibility Report
    // looks for the node's RPC cookie and what the settings page shows when no
    // chain has been chosen. Neither reads or writes stored state, so there is
    // nothing on disk to bring forward.
    //
    // The payout-address split that :36 needed lives in `v1_0_0_36.ts`, with the
    // version that introduced it, rather than being re-declared here.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
