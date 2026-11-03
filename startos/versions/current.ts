import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'If the Bitcoin Knots BLAKE2b node fails to update, StartOS puts its data ' +
  'back by swapping folders, and the gateway kept reading the old copy: it ' +
  "kept the node's old RPC credentials, so every template request failed " +
  'and every share was rejected while miners stayed connected. When the ' +
  'node starts again and its new credentials have not reached the gateway ' +
  '30 seconds after the node is ready, the gateway now restarts and reads ' +
  'them again. Needs StartOS 0.4.0.2 or newer. ' +
  'From 1.0.0:57: the gateway is built on CONVOY v0.5.0 beta, and changing ' +
  'the Extranonce2 size is marked as needing a restart. From 1.0.0:56: the ' +
  'gateway no longer misses a payout split the pool sends before it is ' +
  'ready, and no longer changes the empty job sent on a new block while ' +
  'miners are working on it.'

export const current = VersionInfo.of({
  version: '1.0.0:58',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate: nothing on disk changes.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
