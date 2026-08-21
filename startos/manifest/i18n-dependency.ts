// Why this gateway needs that specific node, shown in the dependency prompt.
const en =
  'Provides the block templates this gateway turns into work for your ASIC. ' +
  'It must be the BLAKE2b build: the official Bitcoin package speaks SHA256d and ' +
  'a Sia miner cannot mine it.'

export const knotsDependencyDescription = {
  en_US: en,
  es_ES: en,
  de_DE: en,
  pl_PL: en,
  fr_FR: en,
}
