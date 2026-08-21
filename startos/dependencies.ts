import { sdk } from './sdk'

export const setDependencies = sdk.setupDependencies(async ({ effects }) => ({
  // Our node, never the official `bitcoind`. Depending on `bitcoind` would bind
  // this gateway to the user's mainnet node and generate templates for the wrong
  // chain, which a Sia miner cannot mine and the node would reject.
  //
  // 'running' rather than 'exists': the gateway needs live templates, not just an
  // installed node. This drives the warning UI only; it does not gate startup.
  'knots-blake2b': {
    kind: 'running',
    versionRange: '>=1.0.0',
    healthChecks: ['node'],
  },
}))
