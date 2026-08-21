// Ports chosen to not collide with the official `datum` package, which uses
// 23334 (stratum) and 7152 (UI). A clash would not fail an install: StartOS
// hands the later claimant a random port instead, which would leave the user
// with a stratum URL that silently points nowhere. Distinct ports are for
// predictability.
export const stratumPort = 23335
export const uiPort = 7153

export const dataDir = '/data'

// Where this container mounts the node's volume, read-only, to read its cookie.
export const knotsMountpoint = '/knots'
