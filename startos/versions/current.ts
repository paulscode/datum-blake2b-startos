import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes = `Applies Convoy's pool key by itself, which 1.0.0:45 left half done.

1.0.0:45 set Convoy's key as the default for Pool Public Key. A default fills in a form; it does not write anything. So an install that updated into it still had no key stored, the gateway still fell back to the one compiled into DATUM, and nothing changed until somebody happened to open DATUM Pool and press Save. If you have already done that, this changes nothing for you.

The key is now written on every start when it is missing, so the update applies itself.

It is also replaced when what is stored is DATUM's own built-in key. That key is Ocean's, and Ocean mines the chain that kept SHA256d, so it can never reach a pool on this one. It arrives that way if a config is carried over from the official Datum Gateway package, or if somebody copies it out of DATUM's documentation.

A key you set yourself is left alone, including one you have taken from Convoy, and any key Convoy rotates to in future.

WHAT THIS FIXES. With Pool Host set to Convoy and no key of your own, the gateway offered Ocean's key, the handshake could not authenticate, and with Collaborative Reward Sharing on "prefer" it fell back to solo without saying why. On the dashboard that reads as "Non-Pooled Mode", with Pool Tag showing your own gateway's tag where the pool's should be, and Pool Shares stuck at zero while local shares climb. If that is what you are looking at, this is why.`

export const current = VersionInfo.of({
  version: '1.0.0:46',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. seedPoolPubkey runs on every init rather than here, so
    // an install that never crosses this exact edge is repaired too, and so is
    // one restored from a backup taken before it. The 1.0.0:43 store migration
    // stays with :43.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
