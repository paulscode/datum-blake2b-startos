import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'The dashboard no longer reports "DATUM pool ignored a valid block" when the ' +
  'pool did nothing wrong. Two different conditions shared that alarm, and the ' +
  'usual one was local: the gateway could not keep shares for its ' +
  'anti-withholding check once an assignment had outlived about 20 minutes ' +
  "of work updates on this package's old settings. That now shows as a " +
  'warning for the assignment it affects and clears when the pool discloses ' +
  'it, and the cause is fixed: identical work updates share one cached ' +
  "template, and routine work updates now come every 40 seconds (DATUM's own " +
  'default) instead of every 5, unless you set Work Update Seconds yourself, ' +
  'or less if you set a Protocol Timeout under 45 seconds. A new block still ' +
  'reaches miners immediately; new transactions and fees reach the template ' +
  'within 40 seconds instead of 5. A real ignored block still shows as ' +
  'CRITICAL and now names the block and the time. The version moves from ' +
  '1.0.0 to 1.1.0 because the gateway build changed: from here the first ' +
  "three numbers are the gateway build's version. " +
  'From 1.0.0:58: if the Bitcoin Knots BLAKE2b node fails to update, StartOS puts its data ' +
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
  version: '1.1.0:0',
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
