import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:5',
  releaseNotes: {
    en_US: 'Move Stratum to 23336: StartOS would not honour 23335 as a preferred external port, assigning a random one instead.',
    es_ES: 'Move Stratum to 23336: StartOS would not honour 23335 as a preferred external port, assigning a random one instead.',
    de_DE: 'Move Stratum to 23336: StartOS would not honour 23335 as a preferred external port, assigning a random one instead.',
    pl_PL: 'Move Stratum to 23336: StartOS would not honour 23335 as a preferred external port, assigning a random one instead.',
    fr_FR: 'Move Stratum to 23336: StartOS would not honour 23335 as a preferred external port, assigning a random one instead.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
