import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes = `Pooled mining now puts the pool's whole payout list in the blocks your gateway finds. Every earlier version of this app put at most about 17 pool payouts in a block's coinbase; everyone else in the window was left out of that block and had to be paid later by the pool as a make-good.

The cause was a size limit meant for SHA256 mining hardware, which rebuilds the coinbase itself and can only take so much. The gateway applied a 750-byte class to any miner it did not recognise, which is every BLAKE2b miner. BLAKE2b miners never see the coinbase, so the limit protected nothing. The coinbase can now hold up to 1024 payouts, sized to the room the block has left. At the node's default block size there is room for about 900, more than twice the payout list of the largest pool on this chain today.

Also from upstream work by CONVOY, iohzrd and Lazarus Pool:

- A coinbase grown to fill a nearly full block is now measured against the BLAKE2b header, which is larger than the old one. Without this, a large coinbase could push a full block over the weight limit and the network would reject it.
- While pooled, the gateway no longer hands out work whose coinbase pays only the pool. That used to happen for a moment after each new block, and whenever the pool was slow to send its payout list.
- Payouts are kept within the block's signature operation limit.

The Fingerprint Miners setting is gone, because the gateway no longer has it. Your other settings are kept, and you do not need to reconfigure your miners.

Solo mining is unchanged.`

export const current = VersionInfo.of({
  version: '1.0.0:53',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. A stored fingerprint_miners from before is dropped by
    // the store schema on read, so it never reaches the gateway, and the gateway
    // ignores keys it does not know in any case.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
