// Only en_US is authored here. The other locales are left as the English text
// rather than machine-translated, so a translator can see what still needs doing
// instead of finding plausible-looking text that nobody checked.
const shortEn =
  'Solo mine the BLAKE2b chain with a Sia-style ASIC you already own'

const longEn =
  'A build of DATUM Gateway that serves Sia-style BLAKE2b work, so an existing ' +
  'Sia-compatible ASIC can mine the BLAKE2b chain. Bitcoin’s mainnet split on ' +
  '30 August 2026, and from block 961640 one of the two chains uses BLAKE2b for ' +
  'proof of work instead of SHA256d. BLAKE2b is the algorithm Sia mines, so the ' +
  'ASICs built for Sia can mine that chain. ' +
  'Point your miner at the Stratum address this service shows and it works with ' +
  'stock firmware; a Goldshell HS-Box and a Bitmain Antminer A3 on CGminer have ' +
  'both been verified. ' +
  'SET A PAYOUT ADDRESS BEFORE YOU MINE. Solo mining means a block you find ' +
  'pays its whole subsidy to the address configured here, so it should be one ' +
  'whose keys you hold. The service will not start until you set one. ' +
  'Solo mining only: pooled BLAKE2b is not possible today because the pool side ' +
  'is closed-source and SHA256d-only. ' +
  'Requires the Bitcoin Knots (BLAKE2b) Companion service, not the official ' +
  'Bitcoin package, and installs alongside the official Datum Gateway without ' +
  'disturbing it.'

export const short = {
  en_US: shortEn,
  es_ES: shortEn,
  de_DE: shortEn,
  pl_PL: shortEn,
  fr_FR: shortEn,
}

export const long = {
  en_US: longEn,
  es_ES: longEn,
  de_DE: longEn,
  pl_PL: longEn,
  fr_FR: longEn,
}
