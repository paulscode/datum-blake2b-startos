import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  // Deliberately NOT `datum`: that is the official Datum Gateway package, and
  // both must be installable at once. See PLAN Q12 on why the chain stays out of
  // the id and in the title.
  id: 'datum-blake2b',
  title: 'Datum Gateway (BLAKE2b) Companion',
  license: 'MIT',
  packageRepo: 'https://github.com/paulscode/datum-blake2b-startos',
  upstreamRepo: 'https://github.com/OCEAN-xyz/datum_gateway',
  marketingUrl: 'https://ocean.xyz',
  donationUrl: null,
  description: { short, long },
  // StartOS 0.4.0.2, not the SDK's default, so the registry hides releases from
  // older servers. Every release from 2026-10-11 on targets 0.4.0.2.
  osVersion: '0.4.0.2',
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
})
