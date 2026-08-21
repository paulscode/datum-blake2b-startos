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

// Opt-in recording port. A miner pointed here has its conversation captured for
// a compatibility report; the normal port records nothing. Kept separate rather
// than making the main port switchable, so the mining path never grows an extra
// hop or a mode that can be left switched on.
export const capturePort = 23337
export const captureLog = '/data/capture/wire.jsonl'

export const dataDir = '/data'

// Where this container mounts the node's volume, read-only, to read its cookie.
export const knotsMountpoint = '/knots'
