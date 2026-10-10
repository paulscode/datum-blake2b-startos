import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes = `Moves the gateway onto CONVOY's current code: about 80 upstream changes since the last version, most of them fixes to how the gateway runs rather than what it builds. The full pool payout list from 1.0.0:53 is carried over unchanged.

What you might notice:

- Difficulty is shown with SI units on the dashboard, and is correct for BLAKE2b work. It used to be shown in SHA256 terms.
- A miner that submits work before subscribing, or for a coinbase the gateway never built, is now refused with a reason rather than having the share looked at.
- When the node answers a found block with "duplicate", the gateway now counts the block as accepted. It already was; the gateway just said otherwise.
- The duplicate share check now keys on the share itself and no longer forgets entries early when Work Update Seconds is long.

Under the hood: fixes to how threads start and share state, bounds checks on what the pool sends, a validation state that now survives a reconnect to the pool, and a larger stack for every thread. Some of these were rare crashes.

The gateway now refuses to start on a configuration error rather than carrying on with a default. This package writes the configuration itself, so the one setting that could trip it, the minimum difficulty, is rounded to a power of two before it is written, as the gateway used to do on its own. Work Update Seconds accepts 5 or more, the floor the gateway has always enforced; a saved value below that now shows as 5.

The Always Pay Self setting is gone. The gateway never implemented it, and upstream has removed it. Your other settings are kept, and you do not need to reconfigure your miners.`

export const current = VersionInfo.of({
  version: '1.0.0:54',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. A stored always_pay_self is left in place until the
    // DATUM Pool form is next saved, which replaces the group without it; the
    // gateway ignores keys it does not know in the meantime.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
