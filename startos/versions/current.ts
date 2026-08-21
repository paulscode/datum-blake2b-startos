import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.0.0:15',
  releaseNotes: {
    en_US: 'Send compatibility reports to the forum first, with GitHub as the alternative.',
    es_ES: 'Send compatibility reports to the forum first, with GitHub as the alternative.',
    de_DE: 'Send compatibility reports to the forum first, with GitHub as the alternative.',
    pl_PL: 'Send compatibility reports to the forum first, with GitHub as the alternative.',
    fr_FR: 'Send compatibility reports to the forum first, with GitHub as the alternative.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
