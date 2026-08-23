import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'
import { knotsDependencyDescription } from './i18n-dependency'

export const manifest = setupManifest({
  // Deliberately NOT `datum`: that is the official Datum Gateway package, and
  // both must be installable at once. See PLAN Q12 on why `regtest` stays out of
  // the id and in the title.
  id: 'datum-blake2b',
  title: 'Datum Gateway BLAKE2b (regtest)',
  license: 'MIT',
  packageRepo: 'https://github.com/paulscode/datum-blake2b-startos',
  upstreamRepo: 'https://github.com/OCEAN-xyz/datum_gateway',
  marketingUrl: 'https://ocean.xyz',
  donationUrl: null,
  description: { short, long },
  volumes: ['main'],
  images: {
    datum: {
      source: {
        dockerBuild: {
          dockerfile: 'Dockerfile',
          workdir: '.',
          // No buildArgs on purpose. The upstream ref belongs in exactly one
          // place, and that place is the Dockerfile's ARG defaults. Setting it
          // here as well silently overrode them: the Dockerfile was moved to a
          // pinned commit and this was left on a floating branch, so every
          // StartOS build kept fetching the old fork tip while the Umbrel and
          // plain-Docker images, which have no such override, moved correctly.
          // Two releases shipped with notes describing a change they did not
          // contain. One source of truth, and this is not it.
        },
      },
      arch: ['x86_64', 'aarch64'],
    },
  },
  dependencies: {
    // MUST be our node, not the official `bitcoind`. Depending on `bitcoind`
    // would bind this gateway to the user's mainnet node and generate templates
    // for the wrong chain. This is a correctness requirement, not a naming one.
    'knots-blake2b': {
      description: knotsDependencyDescription,
      optional: false,
      metadata: {
        title: 'Bitcoin Knots BLAKE2b (regtest)',
        // A dependency icon is an absolute URL into the dependency's repo, not a
        // magic filename, so PNG is fine (E9). It is fetched by the StartOS UI,
        // which means the packaging repo has to be public for it to render.
        icon: 'https://raw.githubusercontent.com/paulscode/knots-blake2b-startos/4dcb43811bf695ce6631e3e43876b41db52300ed/dep-icon.png',
      },
    },
  },
})
