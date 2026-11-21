import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Reads the RPC login from the node volume that holds only that, on a Bitcoin ' +
  'Knots (BLAKE2b) Companion 29.5.0:2 or later, instead of mounting the whole ' +
  'data directory, wallets included. Older nodes keep working as before. ' +
  'From 1.1.3:0: fixes from independent reviews of the gateway changes. A rig no longer gets ' +
  "the same work twice when a quickdiff arrives for a job it hasn't been sent " +
  'yet; before, the quickdiff sent a copy of that job at once and the regular ' +
  "send repeated it, so the rig's shares came back as duplicates. A share the " +
  "gateway keeps from the pool (below the pool's minimum) is now answered as the " +
  "pool would answer it when its job can't be submitted: stale for an " +
  'anti-withholding assignment already disclosed, refused for a job with no ' +
  "assignment; before, such shares were accepted, so a rig's measured hashrate " +
  'counted work the pool would not take. A block the gateway can recognise in a ' +
  'quickdiff share for an earlier job is now submitted before the share is ' +
  'refused. A quickdiff share for another job is answered and recorded as ' +
  'unknown work, rather than as a hashing error that reads like a hardware fault. ' +
  'From 1.1.2:0: rented rigs keep their own difficulty. With "Serve miners below the pool\'s ' +
  'minimum difficulty" (Stratum settings, on by default), each miner gets a ' +
  "difficulty that suits its hashrate even when the pool's minimum is far higher, " +
  "as CONVOY's is behind a busy gateway. Work is still committed at the pool's " +
  'minimum and only shares meeting it are sent to the pool, so pool credit is ' +
  'unchanged; tested live on CONVOY. Vardiff now measures at the difficulty it ' +
  'serves, which stops large overshoots after a step up. A connection that opens ' +
  'with a TLS handshake is closed at once, so the MiningRigRentals pool test no ' +
  'longer reports a working endpoint as failing. The gateway answers ' +
  'datum.capabilities, so Pickhash can tell what it supports. "Let miners ' +
  'request a difficulty in the Stratum password", which this package has always ' +
  'switched on, is now a setting too. ' +
  'From 1.1.1:0: shares are no longer refused when the pool moves to a new anti-withholding ' +
  'assignment between work updates. The gateway kept the current job on the old ' +
  'assignment until its next work update, and once the pool disclosed it, every ' +
  'share for that job was rejected as pool-submit-failed with an error in the ' +
  'log. The gateway now sends new work as soon as the pool makes a new ' +
  'assignment active, without clean_jobs, so miners keep the work they have in ' +
  'progress. A share that still arrives for a disclosed assignment is counted ' +
  'as stale, which is what it is, and logged only at debug level. ' +
  'From 1.1.0:0: the dashboard no longer reports "DATUM pool ignored a valid block" when the ' +
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
  version: '1.1.3:1',
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
