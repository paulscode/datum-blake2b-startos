import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes = `The Obelisk SC1 Gen 2 can mine through this gateway now. Nothing changes for any other miner: what the gateway says to hardware when it connects is byte-for-byte what the previous release said, and that was checked against the previous build running side by side.

The SC1 Gen 2 has a 32-bit extranonce2 built into its firmware, where this gateway asks for 8 bytes. It goes wrong in two different ways depending on whether the firmware has been modified, and both are handled.

IF YOUR SC1 IS RUNNING PATCHED FIRMWARE, there is nothing to set. That firmware sends 4 bytes of real value and 4 bytes of whatever happened to be sitting next to it in memory, which used to make every share come back rejected as H-not-zero. The gateway now reads the share as sent first and, only if that fails, reads it again the way the miner actually calculated it. A miner whose shares already work never reaches the second attempt, so this cannot affect it.

IF YOUR SC1 IS STOCK, it refuses the work outright, and there is a new setting. Config, then Stratum, then Extranonce2 Size: choose "4 bytes". Leave it on 8 for anything else. This is not a per-miner setting - it changes what every miner on this gateway is told, so if you have other hardware pointed at it, check that it is still getting shares accepted afterwards. The gateway restarts when you change it, so your miners reconnect and pick up the new value.

This has not been tested on real SC1 hardware. It was built from a detailed report by somebody who got one mining, and verified here against software built to match how that firmware behaves. That is why the setting is off by default. If you have one, whether it works or not is worth posting on the forum.

Also in this release: the block subsidy for the gateway's own empty work is now taken from the block template rather than recalculated. On Bitcoin the two are the same number, so nothing changes for you; on a test chain with a different halving schedule the old calculation was wrong and cost blocks.`

export const current = VersionInfo.of({
  version: '1.0.0:48',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. The new stratum.extranonce2_size is optional in the
    // store and absent means DATUM's own default of 8, which is what every
    // existing install was already running. Verified by merging a store written
    // before this feature existed: the key stays absent.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
