import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes = `Corrects the DATUM Pool settings, which told you pooled mining was not possible on this chain.

They carried a warning saying no pool served this chain, that every DATUM pool was SHA256d and could not check a BLAKE2b share, and that solo was the only mode that worked. That was true when it was written and it is not true now. Convoy serves this chain, at datum-beta1.mine.convoy.xyz on port 28915, and the warning was steering people away from a pool they could use.

Pool Public Key now comes prefilled with Convoy's. It is worth checking against the one Convoy publishes rather than trusting this package for it, because that key is what authenticates the pool to you. Do not clear it: DATUM falls back to a key compiled into it, that key belongs to a pool on the chain that kept SHA256d, and the connection would fail with nothing to say why. A key must always be 128 hex characters, a signing key and an encryption key one after the other, and any other length stops the gateway from starting. DATUM's own documentation is wrong about this, claiming an empty value is fetched from the pool; no version of DATUM does that.

Nothing about how the service runs has changed. The settings were always there and always applied, and a pool you have already configured keeps working exactly as it did.

Solo mining is still the default and still works. Leaving Pool Host empty is all that takes.`

export const current = VersionInfo.of({
  version: '1.0.0:45',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. This release changes the words on a form and the
    // default of one field, not the shape of anything stored, and a pool
    // already configured keeps its own values. The 1.0.0:43 store migration
    // stays with :43.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
