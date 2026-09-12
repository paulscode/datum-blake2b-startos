import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes = `Pooled mining to Convoy now works. It could not before, and no setting would have fixed it.

Convoy extended the DATUM protocol, and their server hangs up on a gateway that does not speak the addition. This one did not, so it connected, was disconnected, and with Collaborative Reward Sharing on "prefer" fell back to solo without saying why. On the gateway's own dashboard that reads as "Non-Pooled Mode", with Pool Shares stuck at zero while local shares climb, and Pool Tag showing this gateway's tag where the pool's belongs. If that is what you have been looking at, this is the release that fixes it.

The gateway is now built from Convoy's own fork, which is the client for their pool, with our stratum password difficulty carried on top so that d=8192 and fd=8192 still work. That matters for rented hashrate, and Convoy's fork does not have it.

WHAT WAS CHECKED, because this decides what your miner is paid for. Convoy's BLAKE2b test vector, a full 164-byte header, hashes identically in an independent implementation verified against live mainnet block 961640. Their whole test suite passes. Solo mining against a Bitcoin Knots BLAKE2b node produced blocks the node accepted, with zero rejections. The Convoy handshake completes. And a Goldshell HS Box and an Innosilicon S11 mined against both the old build and this one on real hardware, at parity.

ONE VISIBLE CHANGE. Convoy advertises bitcoin difficulty rather than pool difficulty, so your miner is now told 1023.984375 where it used to see 1024. Both of the ASICs above handle it without complaint. Shares below difficulty 1 are also refused outright now, which no real miner produces.

Solo mining is unchanged and is still the default. Leaving Pool Host empty is all that takes.

The SHA256 companion is not affected and stays on the previous gateway. Convoy's fork is built for this chain and defaults to Convoy's pool, which is not the right thing to hand a SHA256d node.`

export const current = VersionInfo.of({
  version: '1.0.0:47',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. The gateway binary changes; nothing stored does. A pool
    // already configured keeps its host, port and key, and seedPoolPubkey still
    // fills or repairs the key on every init. The 1.0.0:43 store migration stays
    // with :43.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
