// Ports chosen to not collide with the official `datum` package, which uses
// 23334 (stratum) and 7152 (UI). 23335 is skipped: StartOS would not honour it as
// a preferred external port on this box, assigning a random ephemeral one
// instead, while the identically-shaped 18444 binding in the node package got its
// preference. Nothing in DATUM's source uses 23335 (stratum 23334, API 7152,
// outbound pool 28915) and nothing on the box was listening on it, so the cause
// is unidentified; 23336 is used because it demonstrably works. A clash would not fail an install: StartOS
// hands the later claimant a random port instead, which would leave the user
// with a stratum URL that silently points nowhere. Distinct ports are for
// predictability.
export const stratumPort = 23336
export const uiPort = 7153

// There was a third port here, 23337, an opt-in recording proxy that captured a
// miner's Stratum conversation so it could be turned into a compatibility
// report. It existed to find out which Sia ASICs could speak to this gateway,
// back when the answer was unknown and the fork had no public chain. Enough
// hardware is known to work now, and the report was the largest single thing
// making this package look unlike the official Datum Gateway package, which is
// what people install it expecting. Removed in 1.0.0:43.

export const dataDir = '/data'

// Where this container mounts the node's volume, read-only, to read its cookie.
export const knotsMountpoint = '/knots'

// DATUM's dashboard admin user is not configurable: `datum_conf.c` documents the
// admin_password option as "username 'admin'".
export const dashboardUser = 'admin'

// Password shape for the dashboard. Alphanumeric on purpose: it is typed into a
// browser's HTTP-auth prompt, and DATUM also folds it into a CSRF token, so
// punctuation buys nothing and costs transcription errors.
export const defaultPasswordSpec = { charset: 'a-z,A-Z,0-9', len: 24 } as const

/**
 * Convoy's DATUM server key, which is the one this chain needs.
 *
 * Read from a gateway connected to Convoy on 11 September 2026, whose dashboard reported "Connected
 * and Ready" against Pool Tag "CONVOY". The key authenticates the pool to the operator, so the Pool
 * Public Key description tells them to check it against Convoy's published value rather than
 * trusting this package for it.
 */
export const convoyPoolPubkey =
  'dbb11fa0c2b5403e4f798fa6071bb97e6079d219598366032fdf2ae01962b13c5e66e2be7d6b008f0b2603f3e6f6fc64768fa786c8129c46d3e30a5867734b62'

/**
 * The key DATUM falls back to when none is configured, from `datum_conf.c`.
 *
 * It is Ocean's, and Ocean mines the chain that kept SHA256d, so on this chain it is never a usable
 * answer: the handshake is encrypted and signed to the pool's key, so offering this one to Convoy
 * cannot authenticate. A gateway configured with Convoy's host and no key therefore fails, and with
 * reward sharing on "prefer" it falls back to solo without saying why. Recorded here so that
 * {@link seedPoolPubkey} can recognise it and replace it.
 */
export const datumBuiltinPoolPubkey =
  'f21f2f0ef0aa1970468f22bad9bb7f4535146f8e4a8f646bebc93da3d89b1406f40d032f09a417d94dc068055df654937922d2c89522e3e8f6f0e649de473003'
