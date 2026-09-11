import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes = `Corrects the DATUM Pool settings, which told you pooled mining was not possible on this chain.

They carried a warning saying no pool served this chain, that every DATUM pool was SHA256d and could not check a BLAKE2b share, and that solo was the only mode that worked. That was true when it was written and it is not true now. Convoy serves this chain, at datum-beta1.mine.convoy.xyz on port 28915, and the warning was steering people away from a pool they could use.

Nothing about how the service works has changed. The settings were always there and always applied; only what they said about themselves was wrong.

The Pool Public Key is the other thing worth knowing. Leave it empty. DATUM has a pool key built in and uses it whenever that field is unset, which is why a host and a port are all Convoy asks for. Only fill it in if a pool publishes a key of its own, and then it has to be exactly 128 hex characters, a signing key and an encryption key one after the other. Any other length stops the gateway from starting, and DATUM's own documentation is wrong about this: it says an empty value is auto-fetched, and no version of DATUM does that.

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
    // Nothing to migrate. This release changes the words on a form, not the
    // shape of anything stored, and a pool already configured keeps working
    // exactly as it did. The 1.0.0:43 store migration stays with :43.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
