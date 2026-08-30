// Only en_US is authored here. The other locales are left as the English text
// rather than machine-translated, so a translator can see what still needs doing
// instead of finding plausible-looking text that nobody checked.
const shortEn = 'EXPERIMENTAL: mine the BLAKE2b test chains with a Sia ASIC'

const longEn =
  'A build of DATUM Gateway that serves Sia-style BLAKE2b work, so an existing ' +
  'Sia-compatible ASIC can mine the experimental BLAKE2b Bitcoin Knots chain. ' +
  'Point your miner at the Stratum address this service shows and it works with ' +
  'stock firmware; a Goldshell HS-Box has been verified end to end. ' +
  'Solo mining only: pooled BLAKE2b is not possible today because the pool side ' +
  'is closed-source and SHA256d-only. ' +
  'Requires the Bitcoin Knots (BLAKE2b) Companion service, not the official ' +
  'Bitcoin package, and installs alongside the official Datum Gateway without ' +
  'disturbing it. It follows whichever chain that node is on, a private regtest ' +
  'of your own or the public BLAKE2b test network. The coins are worthless by ' +
  'construction on both.'

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
